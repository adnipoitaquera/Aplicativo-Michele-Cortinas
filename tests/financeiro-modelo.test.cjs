const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../financeiro-modelo.js');
const base={id:'FIN-1',tipo:'entrada',categoria:'Recebimento',descricao:'Cartão',vencimento:'2026-10-02',dataMovimento:'2026-10-02',status:'Liquidado',valorBruto:1000,valorLiquido:800};
test('recebimento bruto e líquido apuram taxa e saldo sem duplicar desconto',()=>{
  const entrada=M.validar(base),saida=M.validar({...base,id:'SAIDA',tipo:'saida',categoria:'Despesa',descricao:'Conta paga',valorBruto:200,valorLiquido:''});
  const r=M.relatorio([entrada,saida],'mensal','2026-10-02');
  assert.equal(r.bruto,1000);assert.equal(r.entradas,800);assert.equal(r.taxas,200);assert.equal(r.saidas,200);assert.equal(r.saldo,600);
  assert.equal(M.totais([{...entrada,valorBruto:0.3,valorLiquido:0.1},{...entrada,valorBruto:0.2,valorLiquido:0.2}]).entradas,0.3);
});
test('pagamento bruto abate pedido e parcelas não somam novamente o saldo total',()=>{
  const pedido={idDocumento:'DOC-1',tipo:'Pedido',numeroPedido:'01',valorTotal:1000};
  let contas=M.contas([{...base,documentoId:'DOC-1',valorBruto:400,valorLiquido:300}],[pedido]);
  assert.equal(contas.find(x=>x.virtual).valorBruto,600);
  const virtual=contas.find(x=>x.virtual);
  contas=M.contas([{...base,documentoId:'DOC-1',valorBruto:400,valorLiquido:300},{...virtual,virtual:undefined,valorBruto:200,valorLiquido:200}],[pedido]);
  assert.equal(contas.find(x=>x.virtual).valorBruto,400);assert.equal(new Set(contas.map(x=>x.id)).size,contas.length);
  assert.equal(M.contas([{...base,documentoId:'DOC-1'}],[pedido]).filter(x=>x.virtual).length,0);
});
test('relatórios usam data efetiva, semana de segunda a domingo e mês escolhido',()=>{
  assert.deepEqual(M.periodo('semanal','2026-10-02'),{inicio:'2026-09-28',fim:'2026-10-04'});
  assert.deepEqual(M.periodo('semanal','2026-10-04'),{inicio:'2026-09-28',fim:'2026-10-04'});
  assert.deepEqual(M.periodo('mensal','2026-02-10'),{inicio:'2026-02-01',fim:'2026-02-28'});
  assert.deepEqual(M.periodo('mensal','2028-02-10'),{inicio:'2028-02-01',fim:'2028-02-29'});
  const lista=[base,{...base,id:'ANTERIOR',dataMovimento:'2026-09-27'},{...base,id:'DEPOIS',dataMovimento:'2026-10-05'},{...base,id:'PENDENTE',status:'Pendente'},{...base,id:'CANCELADO',status:'Cancelado'},{...base,id:'SEM-DATA',dataMovimento:''}];
  assert.deepEqual(M.relatorio(lista,'semanal','2026-10-02').linhas.map(x=>x.id),['FIN-1']);
  assert.equal(M.relatorio(lista,'mensal','2026-10-02').linhas.length,2);
});
test('pró-labore é pago ao administrador e entra uma vez nas saídas da empresa',()=>{
  const prolabore=M.validar({...base,tipo:'saida',categoria:'Pró-labore',administradorId:'ADM-1',valorBruto:300,valorLiquido:300});
  const r=M.relatorio([base,prolabore],'mensal','2026-10-02');
  assert.equal(r.saidas,300);assert.equal(r.prolabore,300);assert.equal(r.saldo,500);
  const pessoal=M.relatorio([base,prolabore],'mensal','2026-10-02','ADM-1');assert.equal(pessoal.linhas.length,1);assert.equal(pessoal.prolabore,300);
});
test('validações impedem valores, datas e vínculos inconsistentes',()=>{
  for(const extra of [{valorLiquido:1001},{valorBruto:0},{valorLiquido:-1},{valorBruto:NaN},{dataMovimento:''},{vencimento:'2026-02-30'},{tipo:'saida',documentoId:'DOC-1'},{categoria:'Pró-labore'},{tipo:'saida',categoria:'Pró-labore',administradorId:''}])assert.throws(()=>M.validar({...base,...extra}));
  assert.equal(M.validar({...base,valorLiquido:0}).valorLiquido,0);
});
test('importação conserva valores antigos sem inventar data de recebimento',()=>{
  const antigo=M.normalizarAntigo({id:'OLD',valor:100,cliente:'Maria',status:'Recebido',vencimento:'2026-10-02'});
  assert.equal(antigo.valorBruto,100);assert.equal(antigo.valorLiquido,100);assert.equal(antigo.dataMovimento,'');assert.equal(antigo.contato,'Maria');
  assert.equal(M.relatorio([antigo],'mensal','2026-10-02').linhas.length,0);
});
