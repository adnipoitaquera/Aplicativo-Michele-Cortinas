const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function ambiente(){
 const campos={}; const gravados={};
 const ctx={clientes:[{codigo:'CLI-1',nome:'Original',extra:'preservado'}],clienteEditando:null,fornecedores:[{id:'FOR-1',razao:'Fornecedor'}],fornecedorEditando:null,profissionais:[{id:'ADMIN',usuario:'admin',cargo:'Administrador',status:'Ativo'},{id:'PROF-1',usuario:'vendedor',nome:'Vendedor'}],profissionalEditando:null,usuarioAtual:{id:'ADMIN',usuario:'admin',cargo:'Administrador'},pedidos:[{idDocumento:'DOC-1',tipo:'Orçamento',cliente:{nome:'Original'}}],objetoOrcamentoCorrente:null,confirm:()=>true,alert:()=>{},document:{getElementById:id=>campos[id]??=( {value:'',textContent:'',focus(){}})},dadosStorage:{setItem:(k,v)=>gravados[k]=JSON.parse(v)},numeroExibicao:()=> 'ORC-1'};
 for(const n of ['gerarCodigosUnicos','popularClientesSelect','atualizarTabelaClientes','atualizarDashboard','avisarGravacao','atualizarFornecedores','atualizarProfissionais','popularVendedores','atualizarTabelaPedidos','atualizarRelatorioTotalPedidos','atualizarRelatorioGeralPedidos','atualizarRelatorioVendasVendedor','atualizarRelatorioGeralProdutos','atualizarListaMateriais','atualizarMateriaisPersianas','atualizarPlanoCortePersianas','atualizarPlanoCorteTubosTrilhos'])ctx[n]=()=>{};
 vm.createContext(ctx);
 for(const [inicio,fim] of [['function limparCliente()', 'function popularClientesSelect()'],['function excluirFornecedor(', 'function limparFornecedor()'],['function deletarPedido(', 'function normalizarDadosExistentes()']])vm.runInContext(html.slice(html.indexOf(inicio),html.indexOf(fim,html.indexOf(inicio))),ctx);
 return {ctx,campos,gravados};
}
test('editar cliente atualiza sem duplicar e preserva campos antigos',()=>{
 const {ctx,campos,gravados}=ambiente();ctx.editarCliente(0);campos['c-nome'].value='Atualizado';ctx.salvarNovoClienteNoBanco();assert.equal(ctx.clientes.length,1);assert.equal(gravados.michele_clientes[0].nome,'Atualizado');assert.equal(ctx.clientes[0].codigo,'CLI-1');assert.equal(ctx.clientes[0].extra,'preservado');
});
test('exclusão cancelada preserva todos os cadastros e documentos',()=>{
 const {ctx,gravados}=ambiente();ctx.confirm=()=>false;ctx.excluirCliente(0);ctx.excluirFornecedor('FOR-1');ctx.excluirProfissional('PROF-1');ctx.deletarPedido(0);assert.deepEqual(gravados,{});
});
test('excluir cadastros preserva documentos e protege usuário conectado',()=>{
 const {ctx,gravados}=ambiente();ctx.excluirCliente(0);ctx.excluirFornecedor('FOR-1');ctx.excluirProfissional('ADMIN');assert.equal(ctx.profissionais.length,2);ctx.excluirProfissional('PROF-1');assert.equal(gravados.michele_profissionais.length,1);assert.equal(ctx.pedidos[0].cliente.nome,'Original');assert.equal(gravados.michele_clientes.length,0);assert.equal(gravados.michele_fornecedores.length,0);
});
test('excluir pedido e orçamento persiste remoção; falha local preserva lista',()=>{
 for(const tipo of ['Pedido','Orçamento']){const {ctx,gravados}=ambiente();ctx.pedidos[0].tipo=tipo;ctx.deletarPedido(0);assert.equal(gravados.michele_pedidos.length,0);}
 const {ctx}=ambiente();ctx.dadosStorage.setItem=()=>{throw Error('Sem espaço')};assert.throws(()=>ctx.deletarPedido(0),/Sem espaço/);assert.equal(ctx.pedidos.length,1);
});
