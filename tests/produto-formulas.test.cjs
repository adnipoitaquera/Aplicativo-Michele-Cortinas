const {test}=require('node:test');
const assert=require('node:assert/strict');
const formulas=require('../produto-formulas.js');
const {calcular}=require('../cortina-calculo.js');
test('padrões visíveis e validação de fórmulas',()=>{
    for(const nome of ['Ganchinhos','Argolas','Rodízios']) assert.equal(formulas.padrao({nome}).valor,8);
    assert.equal(formulas.padrao({nome:'Ilhós branco'}).valor,14);
    assert.equal(formulas.padrao({nome:'Entretela'}).tipo,'metragem');
    for(const valor of [0,-1,NaN,Infinity,'']) assert.throws(()=>formulas.validar({tipo:'espacamento',base:'parede',valor,arredondamento:'exato'}));
    assert.throws(()=>formulas.validar({tipo:'codigo',base:'parede',valor:8,arredondamento:'exato'}));
});
test('espaçamento em cm, arredondamento, metragem e quantidade fixa',()=>{
    const medidas={parede:3.05,principal:7,consumo:13.5,forro:5,cortinas:2};
    const regra={tipo:'espacamento',base:'parede',valor:10,arredondamento:'exato'};
    assert.equal(formulas.calcular(regra,medidas).quantidade,30.5);
    assert.equal(formulas.calcular({...regra,arredondamento:'cima'},medidas).quantidade,31);
    assert.equal(formulas.calcular({...regra,arredondamento:'par'},medidas).quantidade,32);
    assert.equal(formulas.calcular({...regra,base:'principal',valor:14},medidas).quantidade,50);
    assert.deepEqual(formulas.calcular({...regra,tipo:'metragem',base:'forro',valor:2},medidas),{quantidade:10,unidade:'m'});
    assert.equal(formulas.calcular({...regra,tipo:'fixa',valor:4},medidas).quantidade,8);
    assert.deepEqual(formulas.calcular(null,medidas,3,'m'),{quantidade:3,unidade:'m'});
});
test('orçamento aplica a regra do produto selecionado e preserva tecidos e padrões antigos',()=>{
    const dados={largura:3,altura:2,quantidade:2,'select-voal':10,'prop-voal':3,'select-rodizio':2,'select-suporte':5,'cortina-suporte-qtd':1};
    const regra={tipo:'espacamento',base:'parede',valor:10,arredondamento:'exato'};
    const produtos={'select-rodizio':{formulaCortina:regra},'select-suporte':{formulaCortina:{...regra,tipo:'fixa',valor:3}}};
    const resultado=calcular(k=>dados[k],k=>k,k=>produtos[k]);
    const rodizio=resultado.materiais.find(m=>m.produtoChave==='select-rodizio');
    assert.equal(rodizio.quantidade,60);assert.equal(rodizio.valorTotal,120);
    assert.equal(resultado.materiais.find(m=>m.produtoChave==='select-suporte').quantidade,6);
    assert.equal(resultado.tecidos.voal.metros,18);
    regra.valor=20;
    assert.equal(rodizio.formulaCortina.valor,10); // O material conserva a regra usada.
    const antigo=calcular(k=>dados[k],k=>k);
    assert.equal(antigo.materiais.find(m=>m.produtoChave==='select-rodizio').quantidade,75);
});
