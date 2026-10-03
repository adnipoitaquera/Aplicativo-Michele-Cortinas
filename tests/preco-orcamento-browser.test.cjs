const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('Ravena usa o preço cadastrado em novos orçamentos e rascunhos',async()=>{
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
      editarProduto('voal',PRECOS_VOAL.findIndex(p=>p.nome==='RAVENA 3,00'));
      document.getElementById('produto-custo').value='10';
      document.getElementById('produto-acrescimo').value='100';
      salvarProduto();
      iniciarNovoOrcamento();adicionarItemOrcamentoPadrao();
      const card=document.querySelector('.item-carrinho-card'), id=card.id.replace('item-card-','');
      const select=document.getElementById(`select-voal-${id}`);
      select.selectedIndex=Array.from(select.options).findIndex(o=>o.textContent==='RAVENA 3,00');
      document.getElementById(`largura-${id}`).value='2';
      document.getElementById(`altura-${id}`).value='2';
      document.getElementById(`prop-voal-${id}`).value='3';
      processarCalculoGeral();
      const material=()=>objetoOrcamentoCorrente.itens[0].materiaisCortina.find(m=>m.produtoChave==='select-voal');
      const novo=material().valorUnitario;
      const estado=capturarEstadoCard(card);
      estado.campos[select.id]={value:'33.9',text:'RAVENA 3,00',disabled:false,checked:false};
      aplicarEstadoCard(id,estado);processarCalculoGeral();
      const restaurado=material().valorUnitario,totalTecido=material().valorTotal;
      objetoOrcamentoCorrente.idDocumento='ORC-ANTIGO';
      aplicarEstadoCard(id,estado);processarCalculoGeral();
      const historico=material().valorUnitario;
      atualizarPrecosOrcamento();
      const atualizado=material().valorUnitario;
      editarProduto('voal',PRECOS_VOAL.findIndex(p=>p.nome==='RAVENA 3,00'));
      document.getElementById('produto-custo').value='11';salvarProduto();
      const depoisEdicao=material().valorUnitario;
      return {novo,restaurado,totalTecido,historico,atualizado,depoisEdicao};
    });
    assert.equal(resultado.novo,20);
    assert.equal(resultado.restaurado,20);
    assert.equal(resultado.totalTecido,120);
    assert.equal(resultado.historico,33.9);
    assert.equal(resultado.atualizado,20);
    assert.equal(resultado.depoisEdicao,22);
    assert.deepEqual(erros,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
