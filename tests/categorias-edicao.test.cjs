const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function ambiente(){
  const nodes={'produto-categoria':{value:'tubos'},'produto-categoria-nome':{value:'Trilhos de cortinas'}},gravados={};
  const produto={id:'tubos',nome:'Tubos e Trilhos',lista:[{nome:'Tubo 38',preco:35},{nome:'Trilho suíço',preco:10}]};
  const ctx={window:{},document:{getElementById:id=>nodes[id]},usuarioEhAdministrador:()=>true,alert(){},normalizarNomeTecido:s=>s.toLowerCase(),produtosPersonalizados:[produto],categoriasProduto:{tubos:{nome:produto.nome,lista:produto.lista},voal:{nome:'Tecido principal',lista:[]}},MicheleCatalogoUso:require('../catalogo-uso.js'),dadosStorage:{getItem:()=>JSON.stringify({logo:'logo',costureiras:[{nome:'Ana'}]}),setItem:(k,v)=>gravados[k]=JSON.parse(v)},atualizarCategoriasProdutoSelecionaveis(){},atualizarTabelaProdutos(){},atualizarOpcoesProdutos(){},avisarGravacao(){}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../categorias-edicao.js'),'utf8'),ctx);return {ctx,nodes,gravados};
}
test('renomear categoria personalizada mantém produtos, preços e separação',()=>{
  const {ctx,gravados}=ambiente();ctx.window.salvarNomeCategoriaProduto();
  const categoria=gravados.michele_produtos_personalizados[0];assert.equal(categoria.id,'tubos');assert.equal(categoria.nome,'Trilhos de cortinas');
  assert.equal(categoria.lista[0].preco,35);assert.equal(categoria.lista[0].uso,'persianas');assert.equal(categoria.lista[1].uso,'cortinas');
});
test('categoria padrão mantém configurações e falha não altera nomes',()=>{
  const {ctx,nodes,gravados}=ambiente();nodes['produto-categoria'].value='voal';nodes['produto-categoria-nome'].value='Tecidos';ctx.window.salvarNomeCategoriaProduto();
  assert.equal(gravados.michele_config_empresa.nomesCategorias.voal,'Tecidos');assert.equal(gravados.michele_config_empresa.logo,'logo');assert.equal(gravados.michele_config_empresa.costureiras[0].nome,'Ana');
  nodes['produto-categoria-nome'].value='Outro nome';ctx.dadosStorage.setItem=()=>{throw Error('Sem espaço')};ctx.window.salvarNomeCategoriaProduto();assert.equal(ctx.categoriasProduto.voal.nome,'Tecidos');
});
