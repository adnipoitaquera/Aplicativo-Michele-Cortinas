const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('fórmula cadastrada persiste e altera a quantidade de acessórios no orçamento',async()=>{
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
    await page.evaluate(()=>{
      usuarioAtual={id:'TESTE',nome:'Teste',cargo:'Administrador'};iniciarAplicacao();
      iniciarNovoOrcamento();adicionarItemOrcamentoPadrao();
      const id=document.querySelector('.item-carrinho-card').id.replace('item-card-','');
      document.getElementById(`largura-${id}`).value='2';
      document.getElementById(`altura-${id}`).value='2';
    });
    // Salva a regra pelo cadastro real e confirma seu uso no orçamento.
    await page.evaluate(()=>{
      PRECOS_ACESSORIOS.push({nome:'Rodízio teste fórmula',preco:2,custo:1,acrescimo:100});
      abrirAbaComando('aba-produtos');
      editarProduto('acessorios',PRECOS_ACESSORIOS.length-1);
    });
    assert.equal(await page.locator('#produto-formula-tipo').inputValue(),'espacamento');
    assert.equal(await page.locator('#produto-formula-valor').inputValue(),'8');
    await page.locator('#produto-formula-valor').fill('10');
    await page.evaluate(()=>salvarProduto());
    const formulaSalva=await page.evaluate(()=>JSON.parse(dadosStorage.getItem('michele_produtos_acessorios')).find(p=>p.nome==='Rodízio teste fórmula').formulaCortina);
    assert.deepEqual(formulaSalva,{tipo:'espacamento',base:'parede',valor:10,arredondamento:'exato'});
    await page.evaluate(()=>editarProduto('acessorios',PRECOS_ACESSORIOS.findIndex(p=>p.nome==='Rodízio teste fórmula')));
    assert.equal(await page.locator('#produto-formula-valor').inputValue(),'10');
    const rodizios=await page.evaluate(()=>{
      const card=document.querySelector('.item-carrinho-card'),id=card.id.replace('item-card-','');
      const select=document.getElementById(`select-rodizio-${id}`);
      select.selectedIndex=Array.from(select.options).findIndex(o=>o.textContent==='Rodízio teste fórmula');
      select.dispatchEvent(new Event('change',{bubbles:true}));
      const material=objetoOrcamentoCorrente.itens[0].materiaisCortina.find(m=>m.produtoChave==='select-rodizio');
      const estado=capturarEstadoCard(card);
      select.value='';aplicarEstadoCard(id,estado);processarCalculoGeral();
      return {qtd:material.quantidade,total:material.valorTotal,restaurado:select.selectedOptions[0].textContent};
    });
    assert.deepEqual(rodizios,{qtd:20,total:40,restaurado:'Rodízio teste fórmula'});
    const listas=await page.evaluate(()=>{
      categoriasProduto['teste-misto']={nome:'Ilhós, tubos, argolas e rodízios',lista:[
        {nome:'Ilhós branco teste',preco:7}, {nome:'Ilhos cromado teste',preco:8},
        {nome:'Tubo decorativo teste',preco:9}, {nome:'Argola branca teste',preco:10},
        {nome:'Rodízio deslizante teste',preco:11}, {nome:'Ganchinho teste',preco:12},
        {nome:'Branco liso teste',subcategoria:'Ilhós',preco:13}
      ]};
      atualizarOpcoesProdutos();
      const opcoes=tipo=>Array.from(document.querySelector(`select[id^="select-${tipo}-"]`).options,o=>o.textContent).filter(n=>n.includes('teste'));
      return {ilhos:opcoes('ilhos'),tubos:opcoes('tubo-trilho'),argolas:opcoes('argola'),ganchos:opcoes('gancho')};
    });
    assert.deepEqual(listas.ilhos,['Ilhós branco teste','Ilhos cromado teste','Branco liso teste']);
    assert.deepEqual(listas.tubos,['Tubo decorativo teste']);
    assert.deepEqual(listas.argolas,['Argola branca teste']);
    assert.deepEqual(listas.ganchos,['Ganchinho teste']);
    assert.deepEqual(erros,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
