const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const inicio = html.indexOf('function atualizarTabelaClientes()');
const codigo = html.slice(inicio, html.indexOf('function formatarMoeda', inicio));

test('busca clientes por nome, documento, telefone e código mantendo o índice das ações', () => {
    const busca = { value: '' }, status = {}, linhas = [];
    const tbody = { set innerHTML(valor) { linhas.length = 0; this.conteudo = valor; }, appendChild(tr) { linhas.push(tr); } };
    const ctx = { clientes: [
        { nome: 'Outro cliente', codigo: 'CLI-000001' },
        { nome: 'Márcia Silva', cpf: '123.456.789-09', telefone: '(11) 98765-4321', codigo: 'CLI-000002' }
    ], document: { querySelector: () => tbody, createElement: () => ({}), getElementById: id => id === 'busca-cliente' ? busca : status } };
    vm.createContext(ctx); vm.runInContext(codigo, ctx);
    for (const termo of ['marcia', 'MÁRCIA SILVA', '12345678909', '123.456.789-09', '11987654321', '(11) 98765', 'cli000002']) {
        busca.value = termo; ctx.atualizarTabelaClientes();
        assert.equal(linhas.length, 1, termo);
        assert.match(linhas[0].innerHTML, /editarCliente\(1\)/);
        assert.match(linhas[0].innerHTML, /excluirCliente\(1\)/);
    }
    busca.value = 'inexistente'; ctx.atualizarTabelaClientes();
    assert.match(tbody.conteudo, /Nenhum cliente/);
    busca.value = ''; ctx.atualizarTabelaClientes(); assert.equal(linhas.length, 2);
});
