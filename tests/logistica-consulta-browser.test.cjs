const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('leitor consulta pacote sem gravar, limpa resultado inválido e mantém movimentações',async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/supabase-config.js'){res.end('window.MICHELE_SUPABASE={enabled:false};');return;}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const antes=await page.evaluate(()=>{
      usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();
      pedidos=[{idDocumento:'PACOTE1',numeroPedido:'000007',tipo:'Pedido',cliente:{nome:'Maria <Silva>',telefone:'11999999999',endereco:'Rua Teste, 10'},itens:[{id:1,ambiente:'Sala',quantidade:2,largura:3,altura:2.5}]}];
      dadosStorage.setItem('michele_pedidos',JSON.stringify(pedidos));
      abrirAbaComando('aba-logistica');
      window.consultaGravacoes=0;const original=dadosStorage.setItem;
      dadosStorage.setItem=function(...args){window.consultaGravacoes++;return original.apply(this,args);};
      return JSON.stringify(pedidos);
    });
    assert.equal(await page.locator('#log-acao').inputValue(),'consultar');
    const codigo=await page.evaluate(()=>MicheleLogisticaModelo.itens(pedidos)[1].peca.codigo);
    await page.locator('#log-codigo').fill(codigo);await page.locator('#log-codigo').press('Enter');
    const painel=page.locator('#log-consulta');assert.equal(await painel.isVisible(),true);
    assert.match(await painel.innerText(),/Maria <Silva>|Rua Teste, 10/);
    assert.match(await painel.innerText(),/2 de 2/);assert.match(await painel.innerText(),/Aguardando confecção/);
    assert.equal(await page.evaluate(()=>JSON.stringify(pedidos)),antes);
    assert.equal(await page.evaluate(()=>window.consultaGravacoes),0);
    assert.equal(await page.locator('#log-codigo').evaluate(e=>document.activeElement===e),true);
    await page.locator('#log-codigo').fill('00000000000000');await page.locator('#log-codigo').press('Enter');
    assert.equal(await painel.isVisible(),false);assert.match(await page.locator('#log-feedback').innerText(),/não encontrado/);
    await page.locator('#log-acao').selectOption('receber');
    assert.equal(await page.locator('#log-registrar').innerText(),'Registrar leitura');
    await page.locator('#log-codigo').fill(codigo);await page.locator('#log-codigo').press('Enter');
    assert.match(await page.locator('#log-feedback').innerText(),/Recebido da confecção/);
    await page.locator('#log-acao').selectOption('consultar');
    const depois=await page.evaluate(()=>JSON.stringify(pedidos));
    await page.locator('#log-codigo').fill(codigo);await page.locator('#log-codigo').press('Enter');
    assert.match(await painel.innerText(),/Recebido da confecção/);assert.match(await painel.innerText(),/Teste/);
    assert.equal(await page.evaluate(()=>JSON.stringify(pedidos)),depois);
    assert.deepEqual(errors,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
