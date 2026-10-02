(function(root){
  'use strict';
  const positivo=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0;
  function resumir(pedidos,config){
    const mapa=new Map((config.costureiras||[]).map(c=>[c.id,{id:c.id,nome:c.nome,metros:0,previsto:0,pago:0,semMetragem:0}]));
    function grupo(id,nome){if(!mapa.has(id))mapa.set(id,{id,nome:nome||'Costureira não informada',metros:0,previsto:0,pago:0,semMetragem:0});return mapa.get(id);}
    for(const p of pedidos.filter(p=>p.tipo==='Pedido'))for(const [i,item] of (p.itens||[]).entries()){
      if(item.cortinaAtiva===false || (item.cortinaAtiva!==true && (item.tipo==='persiana'||item.descPersiana)))continue;
      const ficha=p.confeccao?.itens?.[i]?p.confeccao:null;
      const id=ficha?.costureiraId||item.costureiraId;if(!id)continue;
      const g=grupo(id,ficha?.costureiraNome||item.costureiraNome);
      const materiais=item.rentabilidade||item.calculoCortina?.materiais||item.materiaisCortina||item.materiais||[];
      const mao=materiais.filter(m=>String(m.nome).includes('Mão de obra de confecção'));
      const tecidos=item.calculoCortina?.tecidos;
      let metros=null;
      if(tecidos)metros=Object.values(tecidos).reduce((s,t)=>s+positivo(t.metros),0);
      else if(materiais.some(m=>m.tecido))metros=materiais.filter(m=>m.tecido).reduce((s,m)=>s+positivo(m.quantidade),0);
      else if(mao.length)metros=mao.reduce((s,m)=>s+positivo(m.quantidade)*1.4,0);
      if(metros===null)g.semMetragem++;else g.metros+=metros;
      g.previsto+=mao.reduce((s,m)=>s+Math.round(positivo(m.custoTotal??m.valorTotal)*100),0);
    }
    for(const x of config.financeiro?.lancamentos||[]){
      if(x.tipo!=='saida'||!['Liquidado','Pago'].includes(x.status)||!x.costureiraId)continue;
      grupo(x.costureiraId,x.costureiraNome||x.contato).pago+=Math.round(positivo(x.valorLiquido??x.valorBruto??x.valor)*100);
    }
    return Array.from(mapa.values()).map(g=>({...g,metros:Math.round(g.metros*1000)/1000,previsto:g.previsto/100,pago:g.pago/100})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  }
  root.MicheleRelatorioConfeccao={resumir};
  if(typeof module!=='undefined')module.exports=root.MicheleRelatorioConfeccao;
})(typeof window!=='undefined'?window:globalThis);
