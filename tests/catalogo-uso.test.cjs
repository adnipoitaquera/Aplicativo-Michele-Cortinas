const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const uso=require('../catalogo-uso.js');
test('acessórios de persianas não entram no catálogo de cortinas',()=>{
  for(const item of [{nome:'Tubo 38'},{nome:'Tubo 32'},{nome:'Tubo 41'},{nome:'Tubo 53'},{nome:'Rodízio de persiana'},{nome:'Base inferior Cônica'},{nome:'Produto',tipoMaterial:'suporte'}])assert.equal(uso.permite(item,'Acessórios','cortinas'),false,item.nome);
  for(const nome of ['Tubo de cortina 28 mm','Trilho suíço','Rodízio deslizante','Entretela Tecido','Argola de cortina'])assert.equal(uso.permite({nome},'Acessórios','cortinas'),true,nome);
  assert.equal(uso.permite({nome:'Suporte',uso:'ambos'},'Acessórios','cortinas'),true);
});
test('grupos e filtro conservam índices de edição sem misturar aplicações',()=>{
  const categorias={personalizado:{nome:'Tubos e Trilhos',lista:[{nome:'Trilho suíço'},{nome:'Tubo 38'},{nome:'Suporte universal',uso:'ambos'}]}};
  const grupos=uso.grupos(categorias);assert.deepEqual(grupos.map(g=>g.dominio),['cortinas','persianas','ambos']);
  assert.deepEqual(grupos.map(g=>g.itens[0].indice),[0,1,2]);
  assert.equal(uso.grupos(categorias,'persianas')[0].itens[0].item.nome,'Tubo 38');
});
test('busca global preenche resultado único e não escolhe nomes duplicados',()=>{
  const categorias={voal:{nome:'Tecidos',lista:[{nome:'Linho natural',preco:10}]},trilhos:{nome:'Tubos e Trilhos',lista:[{nome:'Trilho suíço',preco:20},{nome:'Tubo 38',preco:30}]},persiana:{nome:'Persianas',lista:[{nome:'Tubo 38',preco:35}]}};
  assert.equal(uso.preencher(categorias,' TRILHO SUICO ').categoria,'trilhos');
  assert.equal(uso.preencher(categorias,'natural').categoria,'voal');
  assert.equal(uso.buscar(categorias,'tubo 38').length,2);assert.equal(uso.preencher(categorias,'tubo 38'),null);
  assert.equal(uso.preencher(categorias,'não cadastrado'),null);assert.deepEqual(uso.buscar(categorias,''),[]);
  assert.equal(categorias.trilhos.lista[0].preco,20);
});
test('seletor de tubos e trilhos das cortinas exclui materiais de persianas',()=>{
  const select={};let resultado;
  const ctx={window:{},document:{querySelectorAll:s=>s==='select[id^="select-tubo-trilho-"]'?[select]:[]},categoriasProduto:{persiana:{nome:'Persiana',lista:[{nome:'Tubo 38',tipoMaterial:'tubo'}]},tubos:{nome:'Tubos e Trilhos',lista:[{nome:'Tubo 38'},{nome:'Trilho suíço'}]}},produtosPersonalizados:[],PRECOS_VOAL:[],PRECOS_FORRO:[],PRECOS_PERSIANA:[],PRECOS_ACESSORIOS:[],MicheleCatalogoUso:uso,atualizarSelectProduto:(s,itens)=>resultado=itens};
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');vm.createContext(ctx);
  const inicio=html.indexOf('function atualizarOpcoesProdutos()');vm.runInContext(html.slice(inicio,html.indexOf('function atualizarTabelaProdutos()',inicio)),ctx);ctx.atualizarOpcoesProdutos();
  assert.deepEqual(Array.from(resultado,i=>i.nome),['Trilho suíço']);
});
