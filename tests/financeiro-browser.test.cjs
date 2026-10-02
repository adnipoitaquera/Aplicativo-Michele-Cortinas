const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('financeiro conecta pedido, líquido, despesas, administrador e relatórios',async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/supabase-config.js'){res.setHeader('Content-Type','application/javascript');res.end('window.MICHELE_SUPABASE={enabled:false};');return;}
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(target,(erro,dados)=>{if(erro){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css'})[path.extname(target)]||'application/octet-stream');res.end(dados);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const page=await browser.newPage(),erros=[],alertas=[];
    page.on('pageerror',e=>erros.push(e.message));page.on('console',msg=>{if(msg.type()==='log' && msg.text().startsWith('ALERTA:'))alertas.push(msg.text());});
    await page.addInitScript(()=>window.alert=msg=>console.log('ALERTA:'+msg));
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>{
      usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();
      pedidos=[{idDocumento:'FIN-PED-1',numeroPedido:'000001',tipo:'Pedido',valorTotal:1000,cliente:{nome:'Maria Silva'},dataEntrega:'2026-10-02',itens:[]}];
      dadosStorage.setItem('michele_config_empresa',JSON.stringify({nomeEmpresa:'Empresa de teste',nomesCategorias:{voal:'Tecidos'},costureiras:[{nome:'Ana'}]}));
      abrirAbaComando('aba-financeiro');
    });
    assert.match(await page.locator('#fin-a-receber').innerText(),/1\.000,00/);
    await page.getByRole('button',{name:'Receber',exact:true}).click();
    await page.locator('#fin-liquido').fill('800');await page.locator('#fin-conta').selectOption('Cartão de crédito');await page.locator('#fin-data-movimento').fill('2026-10-02');
    assert.match(await page.locator('#fin-taxas').innerText(),/200,00/);
    await page.getByRole('button',{name:'Salvar lançamento',exact:true}).click();
    assert.equal(await page.locator('#fin-editor').isVisible(),false);
    assert.match(await page.locator('#fin-a-receber').innerText(),/0,00/);
    assert.match(await page.locator('#fin-recebido').innerText(),/800,00/);
    await page.getByRole('button',{name:'Administradores e pró-labore',exact:true}).click();
    await page.locator('#fin-admin-nome').fill('Sócia Teste');await page.getByRole('button',{name:'Salvar administrador',exact:true}).click();
    await page.getByRole('button',{name:'Registrar pró-labore',exact:true}).click();
    await page.locator('#fin-administrador').selectOption({label:'Sócia Teste'});
    await page.locator('#fin-bruto').fill('300');await page.locator('#fin-vencimento').fill('2026-10-02');await page.locator('#fin-situacao').selectOption('Liquidado');await page.locator('#fin-data-movimento').fill('2026-10-02');
    await page.getByRole('button',{name:'Salvar lançamento',exact:true}).click();
    await page.getByRole('button',{name:'+ Conta a pagar',exact:true}).click();
    await page.locator('#fin-descricao').fill('Compra de material');await page.locator('#fin-bruto').fill('200');await page.locator('#fin-vencimento').fill('2026-10-03');await page.locator('#fin-situacao').selectOption('Liquidado');await page.locator('#fin-data-movimento').fill('2026-10-03');
    await page.getByRole('button',{name:'Salvar lançamento',exact:true}).click();
    await page.locator('.fin-abas').getByRole('button',{name:'Relatórios',exact:true}).click();await page.locator('#fin-rel-data').fill('2026-10-02');await page.locator('#fin-rel-data').dispatchEvent('change');
    assert.match(await page.locator('#fin-rel-bruto').innerText(),/1\.000,00/);assert.match(await page.locator('#fin-rel-taxas').innerText(),/200,00/);assert.match(await page.locator('#fin-rel-entradas').innerText(),/800,00/);assert.match(await page.locator('#fin-rel-saidas').innerText(),/500,00/);assert.match(await page.locator('#fin-rel-saldo').innerText(),/300,00/);
    assert.match(await page.locator('#fin-rel-faixa').innerText(),/28\/09\/2026 a 04\/10\/2026/);
    await page.locator('#fin-rel-periodo').selectOption('mensal');assert.match(await page.locator('#fin-rel-faixa').innerText(),/01\/10\/2026 a 31\/10\/2026/);
    await page.locator('#fin-rel-admin').selectOption({label:'Sócia Teste'});assert.match(await page.locator('#fin-rel-prolabore').innerText(),/300,00/);assert.doesNotMatch(await page.locator('#fin-rel-corpo').innerText(),/Compra de material|Maria Silva/);
    const salvo=await page.evaluate(()=>JSON.parse(dadosStorage.getItem('michele_config_empresa')));
    assert.equal(salvo.financeiro.lancamentos.length,3);assert.equal(salvo.costureiras[0].nome,'Ana');assert.equal(salvo.nomesCategorias.voal,'Tecidos');
    await page.reload();
    await page.evaluate(()=>{usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();abrirAbaComando('aba-financeiro');});
    assert.match(await page.locator('#fin-recebido').innerText(),/800,00/);
    await page.locator('.fin-abas').getByRole('button',{name:'Relatórios',exact:true}).click();await page.locator('#fin-rel-data').fill('2026-10-02');await page.locator('#fin-rel-data').dispatchEvent('change');
    await page.evaluate(()=>window.print=()=>window.dispatchEvent(new Event('beforeprint')));
    await page.getByRole('button',{name:'Imprimir / Salvar em PDF',exact:true}).click();await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#fin-painel-relatorios').isVisible(),true);assert.equal(await page.locator('#fin-form').isVisible(),false);assert.equal(await page.evaluate(()=>document.body.classList.contains('imprimindo-proposta')),false);
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
    assert.equal(await page.evaluate(()=>document.body.classList.contains('imprimindo-financeiro')),false);
    assert.deepEqual(erros,[]);
    assert.ok(!alertas.some(a=>a.includes('Não foi possível')||a.includes('Informe ')),alertas.join('\n'));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
