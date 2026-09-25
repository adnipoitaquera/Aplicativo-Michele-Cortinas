const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function contexto() {
    const ctx = { PRECOS_PERSIANA: [{ nome: 'Rolo - Screen', preco: 170 }], normalizarNomeTecido: s => s.toLowerCase() };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../persianas-catalogo.js'), 'utf8'), ctx);
    ctx.completarCatalogoMateriaisPersianas();
    return ctx;
}
test('26 materiais na categoria Persiana, com preços e unidades informados', () => {
    const ctx = contexto(), lista = ctx.PRECOS_PERSIANA;
    assert.equal(lista.length, 27);
    assert.equal(lista.filter(p => !p.tipoMaterial).length, 1);
    const conferir = (tipo, valores, unidade) => {
        const itens = lista.filter(p => p.tipoMaterial === tipo);
        assert.deepEqual(Array.from(itens, p => p.preco), valores);
        assert.ok(itens.every(p => p.unidade === unidade));
    };
    conferir('bando', [80, 80], '/m linear');
    conferir('base-niveladora', [35, 35], '/m linear');
    conferir('base-inferior', [35, 30, 40], '/m linear');
    conferir('tubo', [23, 35, 50, 80], '/m linear');
    conferir('tampa-bando', [20, 20], '/un.');
    conferir('tampa-base', [5, 5, 7.5], '/un.');
    conferir('dupla-face', [2], '/m linear');
    conferir('comandos', [50, 50, 50, 50, 60, 60, 60, 60, 90], '/un.');
});
test('atualização do catálogo não duplica nem sobrescreve preços editados', () => {
    const ctx = contexto(), tubo = ctx.PRECOS_PERSIANA.find(p => p.nome === 'Tubo 38');
    tubo.nome = 'Tubo 38 atualizado'; tubo.preco = 37;
    ctx.completarCatalogoMateriaisPersianas();
    assert.equal(ctx.PRECOS_PERSIANA.length, 27);
    assert.equal(tubo.preco, 37); assert.equal(tubo.nome, 'Tubo 38 atualizado');
    assert.equal(tubo.unidade, '/m linear');
});
test('custos usam comprimentos de corte e quantidade, sem duplicar cobrança de bandô', () => {
    const ctx = contexto();
    const selecao = { bando: 80, 'base-niveladora': 35, 'base-inferior': 35, tubo: 35, 'dupla-face': 2, comandos: 60, 'tampa-bando': 20, 'tampa-base': 5 };
    assert.ok(Math.abs(ctx.calcularCustoMateriaisPersiana(selecao, 2, 3) - 1458.45) < 1e-8);
    assert.equal(ctx.calcularCustoMateriaisPersiana({ 'tampa-bando': 20, 'tampa-base': 5 }, 2, 3), 0);
    assert.equal(ctx.calcularCustoMateriaisPersiana({ tubo: 35 }, 0.01, 1), 0);
});
test('cores dos comandos são compatíveis com seu tamanho e redução', () => {
    const ctx = contexto();
    for (const grupo of ['32', '38']) {
        const cores = ctx.PRECOS_PERSIANA.filter(p => p.grupoComando === grupo).map(p => p.cor).sort();
        assert.deepEqual(Array.from(cores), ['Bege', 'Branco', 'Cinza', 'Preto']);
    }
    const reduzidos = ctx.PRECOS_PERSIANA.filter(p => p.grupoComando === '38-reducao');
    assert.equal(reduzidos.length, 1); assert.equal(reduzidos[0].cor, 'Branco');
});
