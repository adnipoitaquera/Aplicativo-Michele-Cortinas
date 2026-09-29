const {test} = require('node:test');
const assert = require('node:assert/strict');
const {tecido,calcular} = require('../cortina-calculo.js');
test('quatro cabeçotes somam 5 ou 8 cm à barra e mudam a inversão no limite', () => {
    for (const tipo of ['simples','com franzidor']) {
        const dados = {largura:3,altura:2.64,'select-voal':100,'prop-voal':3,'cortina-barra':'30 cm','cortina-largura-tecido-voal':3,'cortina-altura-cabecote':0.09};
        dados['cortina-cabecote-tipo'] = `Cabeçote ${tipo} — 5 cm`;
        assert.equal(calcular(k=>dados[k],()=> 'Linho').avisos.length,0);
        dados['cortina-cabecote-tipo'] = `Cabeçote ${tipo} — 8 cm`;
        const resultado = calcular(k=>dados[k],()=> 'Linho');
        assert.equal(resultado.avisos[0].alturaCorte,3.02);
        assert.ok(Math.abs(resultado.tecidos.voal.metros-9.06)<1e-9);
    }
});
test('inverte somente quando parede + cabeçote + barra excedem a largura cadastrada', () => {
    const dados = {largura:3,altura:2.61,'select-voal':100,'prop-voal':3,'cortina-inverter-voal':'Automático','cortina-largura-tecido-voal':3,'cortina-barra':'30 cm','cortina-altura-cabecote':0.09};
    const executar = () => calcular(k=>dados[k],()=> 'Linho');
    assert.equal(executar().avisos.length,0); // 3,00 m exatos cabem.
    dados.altura=2.62;
    assert.equal(executar().avisos.length,1);
    assert.equal(executar().avisos[0].alturaCorte,3.01);
    assert.ok(Math.abs(executar().tecidos.voal.metros-9.03)<1e-9);
    dados['cortina-largura-tecido-voal']=2.8;
    assert.equal(executar().tecidos.voal.partes,4);
    dados['select-voal']='';
    assert.equal(executar().avisos.length,0);
});
test('inversão do exemplo: três cortes de 4,50 m totalizam 13,50 m', () => {
    assert.deepEqual(tecido({largura:3,altura:4,proporcao:3,inverter:true,larguraTecido:3}), {metros:13.5,partes:3,comprimento:4.5});
    assert.equal(tecido({largura:3.1,altura:4,proporcao:3,inverter:true,larguraTecido:3}).partes,4);
    assert.equal(tecido({largura:3,altura:4,proporcao:3,inverter:true,larguraTecido:3,quantidade:2}).metros,27);
    assert.equal(tecido({largura:3,altura:2.6,proporcao:3}).metros,9);
});
test('materiais usam inversão, preço por metro, quantidade manual e instalação uma vez', () => {
    const dados = {largura:3,altura:4,quantidade:1,'select-voal':100,'prop-voal':3,'cortina-inverter-voal':'Automático','cortina-largura-tecido-voal':3,'cortina-barra':'30 cm','cortina-altura-cabecote':0.09,'select-entretela':2,'select-rodizio':1,'select-argola':2,'select-tubo-trilho':20,'tubo-trilho-tamanho':3,'tubo-trilho-qtd':2,'select-suporte':5,'cortina-suporte-qtd':4,'select-ponteira':6,'cortina-ponteira-qtd':2,'instalacao-valor':50,'instalacao-qtd':2};
    const resultado = calcular(k=>dados[k],k=>k);
    const material = nome => resultado.materiais.find(m=>m.nome===nome);
    assert.ok(Math.abs(material('select-entretela').quantidade-13.17)<1e-9);
    assert.equal(material('select-rodizio').quantidade,37.5);
    assert.equal(material('select-argola').quantidade,37.5);
    assert.equal(material('select-tubo-trilho').valorTotal,120);
    assert.equal(material('select-suporte').valorTotal,20);
    assert.equal(material('select-ponteira').valorTotal,12);
    assert.equal(material('Instalação').valorTotal,100);
    assert.equal(resultado.total,resultado.materiais.reduce((s,m)=>s+m.valorTotal,0));
    dados.altura=2.6;
    assert.equal(calcular(k=>dados[k],k=>k).tecidos.voal.metros,9);
    dados.altura=4;dados['cortina-inverter-voal']='Não';
    assert.ok(Math.abs(calcular(k=>dados[k],k=>k).tecidos.voal.metros-13.17)<1e-9);
});
