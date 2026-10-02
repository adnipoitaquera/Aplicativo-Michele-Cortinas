(function(root) {
  'use strict';
  const centavos = valor => Math.round(Number(valor) * 100);
  const dinheiro = valor => centavos(valor) / 100;
  function hoje(data = new Date()) {
    return [data.getFullYear(),String(data.getMonth()+1).padStart(2,'0'),String(data.getDate()).padStart(2,'0')].join('-');
  }
  function dataValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return false;
    const data = new Date(valor + 'T12:00:00');
    return !Number.isNaN(data.getTime()) && hoje(data) === valor;
  }
  function validar(lancamento) {
    const x = {...lancamento};
    if (!['entrada','saida'].includes(x.tipo)) throw Error('Selecione entrada ou saída.');
    if (!String(x.descricao || '').trim()) throw Error('Informe a descrição.');
    if (!dataValida(x.vencimento)) throw Error('Informe uma data de vencimento válida.');
    if (!['Pendente','Liquidado','Cancelado'].includes(x.status)) throw Error('Selecione a situação do lançamento.');
    if (x.status === 'Liquidado' && !dataValida(x.dataMovimento)) throw Error('Informe a data do recebimento ou pagamento.');
    if (x.dataMovimento && !dataValida(x.dataMovimento)) throw Error('Informe uma data de movimentação válida.');
    const bruto = Number(x.valorBruto), liquido = x.valorLiquido === '' || x.valorLiquido == null ? bruto : Number(x.valorLiquido);
    if (!Number.isFinite(bruto) || bruto <= 0 || !Number.isFinite(liquido) || liquido < 0 || liquido > bruto) throw Error('Informe um valor bruto maior que zero e um líquido entre zero e o valor bruto.');
    if (x.categoria === 'Pró-labore' && (x.tipo !== 'saida' || !x.administradorId)) throw Error('O pró-labore deve ser uma saída da empresa vinculada a um administrador.');
    if (x.documentoId && x.tipo !== 'entrada') throw Error('Vincule pedidos somente a contas a receber.');
    return {...x,descricao:x.descricao.trim(),valorBruto:dinheiro(bruto),valorLiquido:dinheiro(liquido)};
  }
  function normalizarAntigo(x) {
    return {...x,tipo:x.tipo || 'entrada',categoria:x.categoria || 'Recebimento',contato:x.contato || x.cliente || '',
      valorBruto:dinheiro(x.valorBruto ?? x.valor ?? 0),valorLiquido:dinheiro(x.valorLiquido ?? x.valorBruto ?? x.valor ?? 0),
      status:['Recebido','Pago','Liquidado'].includes(x.status) ? 'Liquidado' : x.status === 'Cancelado' ? 'Cancelado' : 'Pendente',
      dataMovimento:x.dataMovimento || x.dataRecebimento || ''};
  }
  function contas(lancamentos,pedidos,numero = p => p.numeroPedido || p.idDocumento) {
    const lista=lancamentos.map(normalizarAntigo);
    for(const p of pedidos.filter(p=>p.tipo === 'Pedido')) {
      const reservado=lista.filter(x=>x.documentoId === p.idDocumento && x.tipo === 'entrada' && x.status !== 'Cancelado').reduce((s,x)=>s+centavos(x.valorBruto),0);
      const saldo=centavos(p.valorTotal || 0)-reservado;
      if(saldo > 0) {
        const base='SALDO-'+p.idDocumento+'-'+reservado;
        let id=base,indice=0;while(lista.some(x=>x.id===id))id=base+'-'+(++indice);
        lista.push({id,virtual:true,documentoId:p.idDocumento,numero:numero(p),contato:p.cliente?.nome || 'Cliente Avulso',descricao:'Saldo do pedido '+numero(p),tipo:'entrada',categoria:'Recebimento',valorBruto:saldo/100,valorLiquido:saldo/100,vencimento:p.dataEntrega || hoje(),dataMovimento:'',conta:'Caixa',status:'Pendente'});
      }
    }
    return lista;
  }
  function periodo(tipo, referencia) {
    if (!dataValida(referencia)) throw Error('Informe uma data de referência válida.');
    const inicio=new Date(referencia+'T12:00:00'),fim=new Date(inicio);
    if(tipo === 'mensal') {inicio.setDate(1);fim.setMonth(fim.getMonth()+1,0);}
    else {inicio.setDate(inicio.getDate()-((inicio.getDay()+6)%7));fim.setTime(inicio.getTime());fim.setDate(fim.getDate()+6);}
    return {inicio:hoje(inicio),fim:hoje(fim)};
  }
  function totais(lista) {
    const soma=(tipo,campo)=>lista.filter(x=>x.tipo===tipo && x.status==='Liquidado').reduce((s,x)=>s+centavos(x[campo]),0)/100;
    const entradas=soma('entrada','valorLiquido'),saidas=soma('saida','valorLiquido'),bruto=soma('entrada','valorBruto');
    return {entradas,saidas,bruto,taxas:dinheiro(bruto-entradas),saldo:dinheiro(entradas-saidas),prolabore:lista.filter(x=>x.status==='Liquidado' && x.categoria==='Pró-labore' && x.tipo==='saida').reduce((s,x)=>s+centavos(x.valorLiquido),0)/100};
  }
  function relatorio(lista,tipo,referencia,administradorId='') {
    const datas=periodo(tipo,referencia);
    const linhas=lista.map(normalizarAntigo).filter(x=>x.status==='Liquidado' && dataValida(x.dataMovimento) && x.dataMovimento>=datas.inicio && x.dataMovimento<=datas.fim && (!administradorId || x.administradorId===administradorId)).sort((a,b)=>a.dataMovimento.localeCompare(b.dataMovimento));
    return {...datas,linhas,...totais(linhas)};
  }
  root.MicheleFinanceiro={hoje,dataValida,validar,normalizarAntigo,contas,periodo,totais,relatorio,centavos,dinheiro};
  if(typeof module !== 'undefined') module.exports=root.MicheleFinanceiro;
})(typeof window !== 'undefined' ? window : globalThis);
