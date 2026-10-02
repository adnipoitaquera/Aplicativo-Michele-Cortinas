const {test}=require('node:test');
const assert=require('node:assert/strict');
const modelo=require('../produto-precos.js');
const cortina=require('../cortina-calculo.js');
test('migração mantém preço final e custa metade, sem sobrescrever edição',()=>{
  const p=modelo.completar({nome:'Tecido',preco:37.51});
  assert.equal(p.custo,18.755);assert.equal(p.acrescimo,100);
  assert.equal(modelo.preco(p.custo,p.acrescimo),37.51);
  assert.equal(modelo.completar(p),p);
  assert.equal(modelo.preco(100,30),130);
  assert.throws(()=>modelo.preco(-1,100));
});
test('lucro usa receita efetiva e custo congelado, sem inventar custo histórico',()=>{
  const linhas=modelo.registrar([{valorTotal:200,custoTotal:100},{valorTotal:100,custoTotal:40}],270);
  assert.equal(linhas[0].receita,180);
  assert.deepEqual(modelo.resumo({valorTotal:270,itens:[{rentabilidade:linhas}]}),{custo:140,completo:true,lucro:130});
  assert.equal(modelo.resumo({valorTotal:200,itens:[{materiais:[{valorTotal:200}]}]}).lucro,null);
  assert.equal(modelo.resumo({valorTotal:300,itens:[{rentabilidade:linhas},{}]}).completo,false);
});
test('mão de obra editável mantém fórmula e zero informado',()=>{
  const dados={'largura':2,'altura':2,'quantidade':1,'select-voal':10,'prop-voal':3,'costureira-valor':60};
  const calcular=()=>cortina.calcular(k=>dados[k],k=>k).materiais.find(m=>m.nome.includes('obra'));
  assert.equal(calcular().valorTotal,6/1.4*60);
  assert.equal(calcular().custoTotal,6/1.4*60);
  dados['costureira-valor']=0;assert.equal(calcular().valorTotal,0);
  delete dados['costureira-valor'];assert.equal(calcular().valorTotal,6/1.4*45);
});
