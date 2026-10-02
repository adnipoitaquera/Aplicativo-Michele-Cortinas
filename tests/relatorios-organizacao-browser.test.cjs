const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('menu único de relatórios alterna vendas e materiais e imprime apenas o escolhido',async()=>{
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
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(()=>{
      usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();
      pedidos=[{idDocumento:'REL1',numeroPedido:'000001',tipo:'Pedido',cliente:{nome:'Maria'},valorTotal:100,data:'2026-10-02',itens:[{ambiente:'Sala',quantidade:1,rentabilidade:[{nome:'Tecido Teste',quantidade:2,unidade:'m',valorTotal:100,custoTotal:50}]}]}];
      window.imprimirComRetorno=()=>{};
    });
    await page.locator('.sidebar').getByRole('button',{name:'Relatórios',exact:true}).click();
    assert.equal(await page.locator('.sidebar').getByRole('button',{name:'Relatórios',exact:true}).count(),1);
    assert.equal(await page.locator('#relatorio-geral-pedidos').isVisible(),true);
    assert.match(await page.locator('#corpo-relatorio-geral-pedidos').innerText(),/Maria/);
    assert.equal(await page.locator('#relatorio-individual').isVisible(),false);
    await page.getByRole('tab',{name:'Materiais',exact:true}).click();
    assert.equal(await page.locator('#relatorio-individual').isVisible(),true);
    assert.equal(await page.locator('#relatorio-geral-pedidos').isVisible(),false);
    assert.equal(await page.locator('#v6-pagina-atual').innerText(),'Relatórios');
    await page.getByRole('button',{name:'Resumo geral de materiais',exact:true}).click();
    assert.match(await page.locator('#corpo-relatorio-geral-produtos').innerText(),/Tecido Teste/);
    await page.evaluate(()=>imprimirRelatorioLista('relatorio-geral-produtos'));
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#relatorio-geral-produtos').isVisible(),true);
    assert.equal(await page.locator('#relatorio-grupo-vendas').isVisible(),false);
    assert.equal(await page.locator('#relatorio-individual').isVisible(),false);
    await page.evaluate(()=>{limparEstadoImpressao();imprimirRelatorioTotalPedido();});
    assert.equal(await page.locator('#relatorio-documento').isVisible(),true);
    assert.equal(await page.locator('#relatorio-grupo-vendas').isVisible(),false);
    assert.equal(await page.locator('#relatorio-geral-produtos').isVisible(),false);
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>limparEstadoImpressao());
    await page.getByRole('tab',{name:'Vendas',exact:true}).click();
    assert.equal(await page.locator('#relatorio-geral-pedidos').isVisible(),true);
    assert.equal(await page.locator('#relatorio-individual').isVisible(),false);
    await page.evaluate(()=>{limparEstadoImpressao();usuarioAtual.cargo='Vendedor';aplicarPermissoes();});
    assert.equal(await page.locator('.sidebar [data-tab="aba-relatorio-pedidos"]').isVisible(),false);
    assert.deepEqual(errors,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
