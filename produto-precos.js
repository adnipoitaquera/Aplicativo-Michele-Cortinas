(function(root){
  'use strict';
  const dinheiro=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  function preco(custo, percentual){
    if(!Number.isFinite(Number(custo)) || !Number.isFinite(Number(percentual)) || Number(custo)<0 || Number(percentual)<0) throw new Error('Informe custo e percentual válidos.');
    return dinheiro(Number(custo)*(1+Number(percentual)/100));
  }
  function completar(item){
    if(item.custo == null && Number.isFinite(Number(item.preco))) return {...item,custo:Number(item.preco)/2,acrescimo:100};
    return item;
  }
  function registrar(materiais, receita){
    const base=materiais.reduce((s,m)=>s+Number(m.valorTotal||0),0);
    return materiais.map(m=>({...m,receita:base ? Number(receita)*Number(m.valorTotal||0)/base : 0}));
  }
  function resumo(doc){
    const materiais=(doc.itens||[]).flatMap(i=>i.rentabilidade || (i.materiais||[]).map(m=>({...m,custoTotal:null})));
    const completo=(doc.itens||[]).length>0 && (doc.itens||[]).every(i=>Array.isArray(i.rentabilidade) && i.rentabilidade.length>0) && materiais.every(m=>m.custoTotal!=null && Number.isFinite(Number(m.custoTotal)));
    const custo=dinheiro(materiais.reduce((s,m)=>s+(Number(m.custoTotal)||0),0));
    return {custo,completo,lucro:completo ? dinheiro(Number(doc.valorTotal||0)-custo) : null};
  }
  root.MicheleProdutoPrecos={preco,completar,registrar,resumo,dinheiro};
  if(typeof module!=='undefined') module.exports=root.MicheleProdutoPrecos;
})(typeof window!=='undefined'?window:globalThis);
