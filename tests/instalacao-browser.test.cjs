const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('Instalacao soma valor com quantidade inicialmente vazia',async()=>{
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
    const page=await browser.newPage(),erros=[];page.on('pageerror',e=>erros.push(e.message));
    await page.addInitScript(()=>window.alert=()=>{});
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const resultado=await page.evaluate(()=>{
      usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();
      iniciarNovoOrcamento();adicionarItemOrcamentoPadrao();
      const id=document.querySelector('.item-carrinho-card').id.replace('item-card-','');
      const valor=document.getElementById(`instalacao-valor-${id}`),qtd=document.getElementById(`instalacao-qtd-${id}`);
      const total=()=>objetoOrcamentoCorrente.valorTotal;
      processarCalculoGeral();const antes=total();
      valor.value='80';valor.dispatchEvent(new Event('input',{bubbles:true}));
      const uma={diferenca:total()-antes,qtd:qtd.value};
      qtd.value='2';qtd.dispatchEvent(new Event('input',{bubbles:true}));const duas=total()-antes;
      qtd.value='0';qtd.dispatchEvent(new Event('input',{bubbles:true}));const zero=total()-antes;
      qtd.value='';processarCalculoGeral();const restaurado=total()-antes;
      return {uma,duas,zero,restaurado};
    });
    assert.deepEqual(resultado,{uma:{diferenca:80,qtd:'1'},duas:160,zero:0,restaurado:80});
    assert.deepEqual(erros,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});