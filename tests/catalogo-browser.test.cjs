const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
test('cadastro e orçamento usam larguras, aplicações e categorias editadas no navegador',async()=>{
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
      const categoria={id:'teste-tubos',nome:'Tubos e Trilhos',lista:[{nome:'Tubo 38',preco:35},{nome:'Trilho suíço',preco:12}]};
      produtosPersonalizados.push(categoria);categoriasProduto[categoria.id]={nome:categoria.nome,lista:categoria.lista,chave:'michele_produtos_personalizados',unidade:'/m'};
      abrirAbaComando('aba-produtos');atualizarCategoriasProdutoSelecionaveis(categoria.id);
    });
    assert.equal(await page.evaluate(()=>PRECOS_VOAL.find(x=>x.nome==='ANDRIA 2,80').larguraTecido),2.8);
    assert.match(await page.locator('#tabela-produtos').innerText(),/Trilho suíço/);
    assert.doesNotMatch(await page.locator('#tabela-produtos').innerText(),/ANDRIA/);
    await page.locator('#produto-categoria').selectOption('voal');
    assert.match(await page.locator('#tabela-produtos').innerText(),/ANDRIA/);
    assert.doesNotMatch(await page.locator('#tabela-produtos').innerText(),/Trilho suíço/);
    await page.locator('#produto-categoria').selectOption('teste-tubos');
    await page.locator('#produto-categoria-nome').fill('Tubos e Trilhos atualizados');
    await page.getByRole('button',{name:'Atualizar categoria',exact:true}).click();
    assert.equal(await page.locator('#produto-categoria option:checked').textContent(),'Tubos e Trilhos atualizados');
    await page.locator('#produto-categoria').selectOption('persiana');
    await page.locator('#produto-categoria-nome').fill('Modelos sob medida');
    await page.getByRole('button',{name:'Atualizar categoria',exact:true}).click();
    await page.evaluate(()=>editarProduto('persiana',0));
    assert.equal(await page.locator('#produto-uso').inputValue(),'persianas');
    await page.locator('#busca-produto').fill('trilho suico');
    assert.equal(await page.locator('#produto-categoria').inputValue(),'teste-tubos');
    assert.equal(await page.locator('#produto-nome').inputValue(),'Trilho suíço');
    assert.equal(await page.locator('#produto-preco').inputValue(),'12');
    assert.equal(await page.locator('#produto-uso').inputValue(),'cortinas');
    assert.match(await page.locator('#produto-busca-status').innerText(),/Produto preenchido/);
    await page.locator('#busca-produto').fill('Tubo 38');
    assert.match(await page.locator('#produto-busca-status').innerText(),/mais de um/);
    assert.equal(await page.locator('#produto-nome').inputValue(),'Trilho suíço');
    assert.equal(await page.locator('#tabela-produtos tr').filter({hasText:'Tubo 38'}).count(),2);
    await page.locator('#tabela-produtos tr').filter({hasText:'Tubo 38'}).last().getByRole('button',{name:'Editar',exact:true}).click();
    assert.equal(await page.locator('#produto-nome').inputValue(),'Tubo 38');
    await page.locator('#busca-produto').fill('');
    await page.locator('#produto-categoria').selectOption('persiana');
    await page.locator('#produto-uso-filtro').selectOption('persianas');
    assert.match(await page.locator('#tabela-produtos').innerText(),/Tubo 38/);
    assert.doesNotMatch(await page.locator('#tabela-produtos').innerText(),/Trilho suíço/);
    await page.evaluate(()=>editarProduto('voal',0));
    const precoAnterior=Number(await page.locator('#produto-preco').inputValue());
    assert.equal(Number(await page.locator('#produto-custo').inputValue()),precoAnterior/2);
    await page.locator('#produto-custo').fill('20');
    await page.locator('#produto-acrescimo').fill('50');
    assert.equal(await page.locator('#produto-preco').inputValue(),'30');
    await page.evaluate(()=>salvarProduto());
    assert.equal(await page.evaluate(()=>PRECOS_VOAL[0].preco),30);
    await page.evaluate(()=>{
      const config=JSON.parse(dadosStorage.getItem('michele_config_empresa')||'{}');
      config.costureiras=[{id:'ANA',nome:'Ana',status:'Ativa',valorAltura:60},{id:'BIA',nome:'Bia',status:'Ativa',valorAltura:75}];
      dadosStorage.setItem('michele_config_empresa',JSON.stringify(config));
      iniciarNovoOrcamento();adicionarItemOrcamentoPadrao();
    });
    const tubos=await page.locator('select[id^="select-tubo-trilho-"]').first().locator('option').allTextContents();
    assert.ok(tubos.includes('Trilho suíço'));assert.ok(!tubos.includes('Tubo 38'));
    assert.equal(await page.locator('select[id^="cortina-acabada-"]').count(),1);
    const apuracao=await page.evaluate(()=>{
      const card=document.querySelector('.item-carrinho-card'),id=card.id.replace('item-card-','');
      document.getElementById(`select-voal-${id}`).value='30';
      document.getElementById(`largura-${id}`).value='2';
      document.getElementById(`altura-${id}`).value='2';
      document.getElementById(`prop-voal-${id}`).value='3';
      document.getElementById(`costureira-id-${id}`).value='BIA';selecionarCostureiraOrcamento(id);
      if(Number(document.getElementById(`costureira-valor-${id}`).value)!==75)throw new Error('Valor de Bia incorreto');
      document.getElementById(`costureira-id-${id}`).value='ANA';selecionarCostureiraOrcamento(id);
      processarCalculoGeral();
      const item=objetoOrcamentoCorrente.itens[0];
      const tecido=item.rentabilidade.find(m=>m.produtoChave==='select-voal');
      const trabalho=item.rentabilidade.find(m=>m.nome.includes('obra'));
      const snapshot=JSON.stringify(item.rentabilidade);
      PRECOS_VOAL[0].custo=999;
      return {preco:tecido.valorUnitario,custo:tecido.custoUnitario,mao:trabalho.valorUnitario,congelado:snapshot===JSON.stringify(item.rentabilidade)};
    });
    assert.deepEqual(apuracao,{preco:30,custo:20,mao:60,congelado:true});
    const logistica=await page.evaluate(()=>{
      const doc={idDocumento:'LOG-TESTE',tipo:'Pedido',numeroPedido:'999999',cliente:{nome:'Maria',telefone:'11999999999',endereco:'Rua A, 1, São Paulo'},itens:[{id:1,ambiente:'Sala',largura:3,altura:2,quantidade:2}],producao:{0:'Em confecção'}};
      pedidos.push(doc);abrirAbaComando('aba-logistica');
      const pecas=MicheleLogisticaModelo.itens(pedidos).filter(x=>x.doc.idDocumento==='LOG-TESTE');
      document.getElementById('log-codigo').value=pecas[0].peca.codigo;lerEtiquetaLogistica();
      const parcial=pedidos.find(x=>x.idDocumento==='LOG-TESTE').producao[0];
      document.getElementById('log-codigo').value=pecas[1].peca.codigo;lerEtiquetaLogistica();
      const completo=pedidos.find(x=>x.idDocumento==='LOG-TESTE').producao[0];
      const original=dadosStorage.setItem;dadosStorage.setItem=()=>{throw Error('Sem espaço');};
      try{document.getElementById('log-codigo').value=pecas[1].peca.codigo;document.getElementById('log-acao').value='entregar';lerEtiquetaLogistica();}finally{dadosStorage.setItem=original;}
      abrirAbaComando('aba-etiquetas');
      return {parcial,completo,codigos:pecas.map(x=>x.peca.codigo),etiquetas:document.querySelectorAll('.etiqueta-barras').length,persistidas:JSON.parse(dadosStorage.getItem('michele_pedidos')).find(x=>x.idDocumento==='LOG-TESTE').logistica.pecas};
    });
    assert.equal(logistica.parcial,'Em confecção');assert.equal(logistica.completo,'Pronto');
    assert.equal(new Set(logistica.codigos).size,2);assert.equal(logistica.etiquetas,2);
    assert.equal(Object.keys(logistica.persistidas).length,2);
    assert.deepEqual(erros,[]);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
