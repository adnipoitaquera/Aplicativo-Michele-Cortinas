const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function ambiente(){
  const nodes={},gravados={};
  const ctx={window:{},document:{getElementById:id=>nodes[id] ||= {value:'',textContent:'',innerHTML:''}},localStorage:{getItem:()=>JSON.stringify({'DOC-1-1':'Em produção'})},dadosStorage:{setItem:(k,v)=>gravados[k]=JSON.parse(v)},pedidos:[{idDocumento:'DOC-1',tipo:'Pedido',numeroPedido:'001',cliente:{nome:'Maria'},dataEntrega:'2026-10-10',itens:[{modelo:'Wave',ambiente:'Sala',largura:3,altura:2},{descPersiana:'Rolo',ambiente:'Quarto',largura:1,altura:2}],producao:{0:'Em confecção'},confeccao:{costureiraNome:'Ana <Silva>',dataEntrega:'2026-10-12',itens:{0:{}}}}],numeroExibicao:d=>d.numeroPedido,formatarDataMaterial:d=>d,escOperacao:v=>String(v).replace(/</g,'&lt;'),atualizarEtiquetas(){},alert(){}};
  ctx.itensOperacionais=()=>ctx.pedidos.flatMap(doc=>doc.itens.map((item,indice)=>({doc,item,indice,chave:`${doc.idDocumento}-${indice}`})));
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../producao-status.js'),'utf8'),ctx);Object.assign(ctx,ctx.window);
  return {ctx,nodes,gravados};
}
test('produção mostra confecção, costureira e prazo da ficha preservando status antigos',()=>{
  const {ctx,nodes}=ambiente();ctx.atualizarProducao();
  assert.match(nodes['prod-corpo'].innerHTML,/Ana &lt;Silva>/);
  assert.match(nodes['prod-corpo'].innerHTML,/2026-10-12/);
  assert.equal(nodes['prod-confeccao'].textContent,1);assert.equal(nodes['prod-andamento'].textContent,1);
  nodes['prod-status'].value='Em confecção';ctx.atualizarProducao();
  assert.doesNotMatch(nodes['prod-corpo'].innerHTML,/Rolo/);
  assert.match(nodes['prod-corpo'].innerHTML,/<option selected>Em confecção/);
  nodes['prod-status'].value='';nodes['prod-busca'].value='Ana';ctx.atualizarProducao();assert.doesNotMatch(nodes['prod-corpo'].innerHTML,/Rolo/);
});
test('marcar como pronto grava no pedido sem mudar persiana e falha preserva o estado',()=>{
  const {ctx,gravados}=ambiente();ctx.alterarStatusProducao('DOC-1-0','Pronto');
  assert.equal(gravados.michele_pedidos[0].producao[0],'Pronto');
  assert.equal(gravados.michele_pedidos[0].confeccao.costureiraNome,'Ana <Silva>');
  assert.equal(gravados.michele_pedidos[0].producao[1],undefined);
  const anterior=ctx.pedidos;ctx.dadosStorage.setItem=()=>{throw Error('Sem espaço')};ctx.alterarStatusProducao('DOC-1-0','Na fila');assert.equal(ctx.pedidos,anterior);
});
