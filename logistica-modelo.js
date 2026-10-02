(function(root){
  'use strict';
  const estados=['Aguardando confecção','Recebido da confecção','Em rota','Entregue'];
  function garantir(pedidos,gerar){
    const usados=new Set(pedidos.flatMap(p=>Object.keys(p.logistica?.pecas||{})));
    let mudou=false;
    const lista=pedidos.map(p=>{
      if(p.tipo!=='Pedido')return p;
      const pecas=JSON.parse(JSON.stringify(p.logistica?.pecas||{}));
      Object.values(pecas).forEach(x=>x.ativa=false);
      (p.itens||[]).forEach((item,indice)=>{
        const chave=item.id!=null?`id:${item.id}`:`indice:${indice}`;
        const quantidade=Math.max(1,Math.floor(Number(item.quantidade)||1));
        for(let unidade=1;unidade<=quantidade;unidade++){
          let x=Object.values(pecas).find(x=>x.itemChave===chave && x.unidade===unidade);
          if(!x){let codigo;for(let tentativa=0;tentativa<100;tentativa++){codigo=gerar();if(/^\d{14}$/.test(codigo) && !usados.has(codigo))break;codigo=null;}
            if(!codigo)throw new Error('Não foi possível gerar um código único.');
            usados.add(codigo);x=pecas[codigo]={codigo,itemChave:chave,unidade,estado:estados[0],historico:[]};
          }
          Object.assign(x,{indice,ativa:true});
        }
      });
      if(JSON.stringify(pecas)===JSON.stringify(p.logistica?.pecas||{}))return p;
      mudou=true;return {...p,logistica:{...p.logistica,pecas}};
    });
    return {pedidos:lista,mudou};
  }
  function itens(pedidos){return pedidos.filter(p=>p.tipo==='Pedido').flatMap(doc=>Object.values(doc.logistica?.pecas||{}).filter(p=>p.ativa).map(peca=>({doc,peca,item:doc.itens[peca.indice]})).filter(x=>x.item));}
  function ler(pedidos,codigo,acao,usuario,data){
    const matches=itens(pedidos).filter(x=>x.peca.codigo===codigo.trim());
    if(matches.length!==1)throw new Error(matches.length?'Código duplicado. Verifique o cadastro.':'Código não encontrado nas etiquetas ativas.');
    const x=matches[0],novo={receber:estados[1],carregar:estados[2],entregar:estados[3]}[acao];
    if(!novo)throw new Error('Escolha a operação.');
    if(x.peca.estado===novo || (acao==='receber' && estados.indexOf(x.peca.estado)>1))return {pedidos,repetido:true,x};
    const esperado={receber:estados[0],carregar:estados[1],entregar:estados[2]}[acao];
    if(x.peca.estado!==esperado)throw new Error(`Operação indisponível: a peça está ${x.peca.estado.toLowerCase()}.`);
    if(acao==='carregar' && !x.peca.rotaId)throw new Error('Vincule a peça a uma rota antes de carregar.');
    const peca={...x.peca,estado:novo,historico:[...(x.peca.historico||[]),{acao,estado:novo,usuario,data}]};
    const pecas={...x.doc.logistica.pecas,[codigo]:peca};
    const grupo=Object.values(pecas).filter(p=>p.ativa && p.itemChave===peca.itemChave);
    const producao=acao==='receber' && grupo.every(p=>estados.indexOf(p.estado)>=1)?{...x.doc.producao,[peca.indice]:'Pronto'}:x.doc.producao;
    let notificacoes=x.doc.logistica.notificacoes||[];
    const lote=Object.values(pecas).filter(p=>p.ativa && p.rotaId===peca.rotaId);
    if(acao==='carregar' && lote.every(p=>['Em rota','Entregue'].includes(p.estado)) && !notificacoes.some(n=>n.rotaId===peca.rotaId && n.tipo==='a-caminho'))notificacoes=[...notificacoes,{tipo:'a-caminho',rotaId:peca.rotaId,data,status:'Pendente de integração WhatsApp'}];
    return {pedidos:pedidos.map(p=>p===x.doc?{...p,producao,logistica:{...p.logistica,pecas,notificacoes}}:p),repetido:false,x:{...x,peca}};
  }
  root.MicheleLogisticaModelo={estados,garantir,itens,ler};
  if(typeof module!=='undefined')module.exports=root.MicheleLogisticaModelo;
})(typeof window!=='undefined'?window:globalThis);
