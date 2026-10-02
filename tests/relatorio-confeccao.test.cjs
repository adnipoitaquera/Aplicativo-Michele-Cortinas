const {test}=require('node:test'),assert=require('node:assert/strict');
const {resumir}=require('../relatorio-confeccao-modelo.js');
test('confecção soma tecidos uma vez e somente pagamentos liquidados por costureira',()=>{
  const config={costureiras:[{id:'A',nome:'Ana'},{id:'B',nome:'Bia'}],financeiro:{lancamentos:[
    {tipo:'saida',status:'Liquidado',costureiraId:'A',valorBruto:100,valorLiquido:90},
    {tipo:'saida',status:'Pendente',costureiraId:'A',valorBruto:200},
    {tipo:'saida',status:'Cancelado',costureiraId:'A',valorBruto:300},
    {tipo:'entrada',status:'Liquidado',costureiraId:'A',valorBruto:400},
    {tipo:'saida',status:'Liquidado',contato:'Ana',valorBruto:500}
  ]}};
  const item={costureiraId:'A',calculoCortina:{tecidos:{voal:{metros:14},forro:{metros:7}}},rentabilidade:[{nome:'Mão de obra de confecção',quantidade:15,custoTotal:600}]};
  const pedidos=[{tipo:'Pedido',itens:[item,{...item,cortinaAtiva:false},{tipo:'persiana',costureiraId:'A'}]},{tipo:'Orçamento',itens:[item]}];
  const antes=JSON.stringify({pedidos,config}),[ana,bia]=resumir(pedidos,config);
  assert.equal(ana.metros,21);assert.equal(ana.previsto,600);assert.equal(ana.pago,90);assert.equal(bia.pago,0);
  assert.equal(JSON.stringify({pedidos,config}),antes);
});
test('ficha define responsável, preserva valores históricos e indica metragem ausente',()=>{
  const lista=resumir([{tipo:'Pedido',confeccao:{costureiraId:'B',costureiraNome:'Bia',itens:{0:{}}},itens:[{costureiraId:'A',rentabilidade:[{nome:'Mão de obra de confecção',quantidade:10,custoTotal:450}]},{costureiraId:'A'}]}],{costureiras:[{id:'B',nome:'Bia',valorAltura:999}]});
  const bia=lista.find(x=>x.id==='B'),ana=lista.find(x=>x.id==='A');
  assert.equal(bia.metros,14);assert.equal(bia.previsto,450);assert.equal(ana.semMetragem,1);
});
