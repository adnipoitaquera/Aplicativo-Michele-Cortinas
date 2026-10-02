const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('menus agrupam cadastros e módulos sem duplicar botões',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  for(const [nome,tabs] of [['Cadastro',['aba-profissionais','aba-costureiras','aba-fornecedores','aba-clientes','aba-produtos']],['Cortinas',['aba-confeccao','aba-materiais-cortinas']],['Persianas',['aba-materiais-persianas','aba-plano-corte-persianas']]]){
    const inicio=html.indexOf(`<summary>${nome}</summary>`);assert.ok(inicio>=0);
    const grupo=html.slice(inicio,html.indexOf('</details>',inicio));
    for(const tab of tabs){assert.ok(grupo.includes(`data-tab="${tab}"`));assert.equal(html.split(`data-tab="${tab}"`).length-1,1);}
  }
  assert.ok(!html.includes('Confec??o'));
});
test('ficha e impressão omitem modelo da barra e tamanho do cabeçote',()=>{
  const codigo=fs.readFileSync(require('node:path').join(__dirname,'../confeccao-cortinas.js'),'utf8');
  assert.ok(!codigo.includes('barraModelo'));
  assert.ok(!codigo.includes('cabecoteTamanho'));
  assert.ok(codigo.includes("['barraTamanho','Tamanho da barra']"));
  assert.ok(codigo.includes("['cabecoteModelo','Modelo do cabeçote']"));
});
function ambiente() {
  const elementos = {}, gravados = {}, eventos = {};
  const ctx = {window:{addEventListener:(n,f)=>eventos[n]=f,print(){}}, document:{getElementById:id=>elementos[id] ||= {value:'',innerHTML:'',textContent:'',children:[],reportValidity:()=>true,reset(){}},body:{classList:{add(){},remove(){}}}},dadosStorage:{getItem:k=>gravados[k] || null,setItem:(k,v)=>gravados[k]=v},crypto:{randomUUID:()=> 'COST-1'},usuarioEhAdministrador:()=>true,alert(){},avisarGravacao(){},numeroExibicao:p=>p.numeroPedido,formatarDataMaterial:x=>x,pedidos:[{idDocumento:'PED-1',numeroPedido:'001',tipo:'Pedido',cliente:{nome:'Maria'},itens:[{ambiente:'Sala',quantidade:1}]}]};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../confeccao-cortinas.js'),'utf8'),ctx);
  Object.assign(ctx,ctx.window);
  return {ctx,elementos,gravados};
}
test('cadastro de costureira preserva configuração e edita sem duplicar',()=>{
  const {ctx,elementos,gravados}=ambiente();
  gravados.michele_config_empresa=JSON.stringify({nomeEmpresa:'Empresa',logo:'logo'});
  for(const [k,v] of Object.entries({nome:'Ana',telefone:'123',email:'',status:'Ativa',observacoes:''}))ctx.document.getElementById('cost-'+k).value=v;
  ctx.document.getElementById('cost-valor-altura').value='60';
  ctx.window.salvarCostureira();
  assert.equal(JSON.parse(gravados.michele_config_empresa).nomeEmpresa,'Empresa');
  ctx.window.editarCostureira(0);elementos['cost-nome'].value='Ana Maria';
  ctx.window.salvarCostureira();
  const dados=JSON.parse(gravados.michele_config_empresa);
  assert.equal(dados.costureiras.length,1);assert.equal(dados.costureiras[0].nome,'Ana Maria');assert.equal(dados.logo,'logo');
  assert.equal(dados.costureiras[0].valorAltura,60);
  ctx.document.getElementById('costureira-id-1').value=dados.costureiras[0].id;
  ctx.processarCalculoGeral=()=>{};
  ctx.window.selecionarCostureiraOrcamento(1);
  assert.equal(Number(elementos['costureira-valor-1'].value),60);
});
test('ficha grava no pedido; falha de armazenamento preserva documento',()=>{
  const {ctx,elementos,gravados}=ambiente();
  gravados.michele_config_empresa=JSON.stringify({costureiras:[{id:'COST-1',nome:'Ana',status:'Ativa',valorAltura:60}]});
  ctx.pedidos[0].valorTotal=500;
  ctx.pedidos[0].itens[0].rentabilidade=[{nome:'Mão de obra de confecção',quantidade:3,receita:135,custoTotal:135}];
  ctx.obterMateriaisAmbiente=()=>({idAmbiente:1,largura:3,alturaParede:2,modelo:'Wave',desconto:'Sim',nomeTrilho:'Trilho',nomePrincipal:'Linho'});
  ctx.pedidos[0].itens.push({cortinaAtiva:false,descPersiana:'Rolo'});
  ctx.campoMaterial=(e,k,p)=>k==='cortina-acabada-1' ? 'Sim' : p;ctx.textoMaterial=()=>'';
  ctx.document.getElementById('conf-pedido').value='PED-1';ctx.window.inserirPedidoConfeccao();
  assert.match(elementos['conf-itens'].innerHTML,/conf-0-acabada/);
  assert.match(elementos['conf-itens'].innerHTML,/<option selected>Sim<\/option>/);
  elementos['conf-costureira'].value='COST-1';elementos['conf-entrega'].value='2026-10-10';elementos['conf-itens'].children=[{dataset:{indice:'0'}}];
  for(const k of ['largura','altura','modelo','cabecoteTamanho','cabecoteModelo','barraTamanho','barraModelo','invertido','cortineiro','tecido','desconto','trilho','rodizio','abertura'])ctx.document.getElementById('conf-0-'+k).value='';
  elementos['conf-0-largura'].value='3,5';elementos['conf-0-altura'].value='2.5';elementos['conf-0-tecido'].value='Linho';
  ctx.document.getElementById('conf-0-acabada').value='Sim';
  assert.equal(ctx.window.salvarConfeccao(true),true);
  assert.equal(JSON.parse(gravados.michele_pedidos)[0].confeccao.costureiraNome,'Ana');
  assert.equal(ctx.pedidos[0].cliente.nome,'Maria');
  assert.equal(ctx.pedidos[0].confeccao.itens[0].acabada,'Sim');
  assert.equal(ctx.pedidos[0].itens[0].rentabilidade[0].custoTotal,180);
  assert.equal(ctx.pedidos[0].itens[0].rentabilidade[0].receita,135);
  assert.equal(ctx.pedidos[0].valorTotal,500);
  ctx.pedidos[0].cliente.nome='  Maria   Silva Santos';
  elementos['conf-0-abertura'].value='Selecionar abertura...';
  elementos['conf-0-trilho'].value='Trilho / tubo não selecionado';
  ctx.imprimirComRetorno=()=>{};
  ctx.window.imprimirConfeccao();
  assert.match(elementos['conf-impressao'].innerHTML,/<strong>Cliente:<\/strong> Maria<br>/);
  assert.doesNotMatch(elementos['conf-impressao'].innerHTML,/Silva|Santos|Selecionar|não selecionado|Não informado/);
  assert.match(elementos['conf-impressao'].innerHTML,/<dt>Acabada<\/dt><dd>Sim<\/dd>/);
  assert.match(elementos['conf-impressao'].innerHTML,/<dt>Abertura<\/dt><dd>—<\/dd>/);
  ctx.atualizarProducao=()=>{};
  ctx.window.enviarParaCostureira();
  assert.equal(ctx.pedidos[0].producao[0],'Em confecção');
  assert.equal(ctx.pedidos[0].producao[1],undefined);
  assert.equal(JSON.parse(gravados.michele_pedidos)[0].producao[0],'Em confecção');
  const anterior=ctx.pedidos;ctx.dadosStorage.setItem=()=>{throw Error('Sem espaço')};
  elementos['conf-0-tecido'].value='Outro';assert.equal(ctx.window.salvarConfeccao(true),false);assert.equal(ctx.pedidos,anterior);
});
