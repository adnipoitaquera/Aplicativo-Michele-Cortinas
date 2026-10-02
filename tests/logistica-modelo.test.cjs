const {test}=require('node:test');const assert=require('node:assert/strict');
const modelo=require('../logistica-modelo.js');
const criar=()=>{let n=10000000000000;return modelo.garantir([{idDocumento:'PED1',tipo:'Pedido',itens:[{id:1,ambiente:'Sala',quantidade:2}],producao:{0:'Em confecção'}}],()=>String(n++)).pedidos;};
test('consulta identifica a peça em qualquer status sem alterar pedido ou histórico',()=>{
  const lista=criar();lista[0].cliente={nome:'Maria Silva',telefone:'11999999999',endereco:'Rua Teste, 10'};
  const codigo=modelo.itens(lista)[1].peca.codigo;
  for(const estado of modelo.estados){
    lista[0].logistica.pecas[codigo].estado=estado;
    const antes=JSON.stringify(lista),x=modelo.consultar(lista,' '+codigo+' ');
    assert.equal(x.doc.cliente.nome,'Maria Silva');assert.equal(x.item.ambiente,'Sala');
    assert.equal(x.peca.unidade,2);assert.equal(x.peca.estado,estado);assert.equal(JSON.stringify(lista),antes);
  }
  assert.throws(()=>modelo.consultar(lista,'00000000000000'),/não encontrado/);
  const duplicado=JSON.parse(JSON.stringify(lista[0]));
  assert.throws(()=>modelo.consultar([...lista,duplicado],codigo),/duplicado/);
});
test('cada peça tem código exclusivo persistente, sem trocar após editar ou reordenar',()=>{
  const lista=criar(),pecas=modelo.itens(lista);assert.equal(pecas.length,2);assert.notEqual(pecas[0].peca.codigo,pecas[1].peca.codigo);
  assert.equal(modelo.garantir(lista,()=>{throw Error('não deveria gerar');}).mudou,false);
  const nova=JSON.parse(JSON.stringify(lista));nova[0].itens.unshift({id:2,quantidade:1});let n=20000000000000;
  const resultado=modelo.garantir(nova,()=>String(n++)).pedidos;
  assert.equal(modelo.itens(resultado).find(x=>x.peca.codigo===pecas[0].peca.codigo).peca.indice,1);
  nova[0].itens[1].quantidade=1;
  assert.equal(modelo.itens(modelo.garantir(nova,()=>String(n++)).pedidos).length,2);
});
test('leitura recebe cada cortina e baixa produção somente quando todas chegaram',()=>{
  let lista=criar();const codigos=modelo.itens(lista).map(x=>x.peca.codigo);
  lista=modelo.ler(lista,codigos[0],'receber','Ana','2026-10-02T12:00:00Z').pedidos;
  assert.equal(lista[0].producao[0],'Em confecção');
  assert.equal(modelo.ler(lista,codigos[0],'receber','Ana','x').repetido,true);
  lista=modelo.ler(lista,codigos[1],'receber','Ana','2026-10-02T12:00:01Z').pedidos;
  assert.equal(lista[0].producao[0],'Pronto');
  assert.throws(()=>modelo.ler(lista,'00000000000000','receber','Ana','x'),/não encontrado/);
  assert.throws(()=>modelo.ler(lista,codigos[0],'carregar','Ana','x'),/rota/);
});
test('saída e entrega seguem rota e criam um aviso pendente por pedido, sem fingir envio',()=>{
  let lista=criar();const codigos=modelo.itens(lista).map(x=>x.peca.codigo);
  for(const c of codigos){lista=modelo.ler(lista,c,'receber','Ana','2026-10-02T12:00:00Z').pedidos;lista[0].logistica.pecas[c].rotaId='R1';}
  assert.throws(()=>modelo.ler(lista,codigos[0],'entregar','Ana','x'),/indisponível/);
  lista=modelo.ler(lista,codigos[0],'carregar','Ana','2026-10-02T13:00:00Z').pedidos;assert.equal(lista[0].logistica.notificacoes.length,0);
  lista=modelo.ler(lista,codigos[1],'carregar','Ana','2026-10-02T13:00:01Z').pedidos;assert.equal(lista[0].logistica.notificacoes.length,1);
  assert.match(lista[0].logistica.notificacoes[0].status,/Pendente/);
  assert.equal(modelo.ler(lista,codigos[1],'carregar','Ana','x').repetido,true);
  lista=modelo.ler(lista,codigos[0],'entregar','Ana','2026-10-02T14:00:00Z').pedidos;assert.equal(modelo.itens(lista)[0].peca.estado,'Entregue');
});
