const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function preparar() {
    const campos = {};
    const input = (id, value) => campos[id] = { id, value };
    const select = (id, value, text) => campos[id] = { id, value, selectedOptions: [{ textContent: text }] };
    input('ambiente-nome-1', 'Sala <principal>');
    campos['chk-cortina-1'] = { checked: true };
    input('quantidade-1', '1'); input('largura-1', '3.2'); input('altura-1', '2.7');
    select('select-voal-1', '89.6', 'AMÉRICA 13'); select('modelo-voal-1', 'Wave', 'Wave');
    select('bando-1', 'Sanca', 'Sanca'); input('cor-bando-1', 'Branco');
    campos['resumo-valor-1'] = { textContent: 'R$ 2.345,67' };
    const caixas = ['1', 'sub-10'].map((sufixo, i) => {
        const chk = { id: `chk-persiana-${sufixo}`, checked: true };
        select(`persiana-modelo-${sufixo}`, '250', i ? 'Romana - Screen' : 'Double Vision - Linho');
        input(`persiana-largura-${sufixo}`, i ? '0.9' : '1.5'); input(`persiana-altura-${sufixo}`, i ? '1.1' : '1.8'); input(`persiana-qtd-${sufixo}`, i ? '2' : '1');
        select(`persiana-bando-${sufixo}`, '80', i ? 'Bandô de Parafuso' : 'Bandô de Encaixe'); input(`persiana-cor-bando-${sufixo}`, i ? 'Preto' : 'Bege');
        select(`persiana-tubo-${sufixo}`, '35', 'Tubo 38');
        select(`persiana-base-inferior-${sufixo}`, '35', 'Base inferior Cônica'); input(`persiana-cor-base-inferior-${sufixo}`, 'Cinza');
        return { chk, querySelector: () => chk };
    });
    const card = { id: 'item-card-1', querySelectorAll: () => caixas };
    const ctx = { document: { getElementById: id => campos[id] }, escaparHtmlProduto: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), formatarMoeda: () => 'R$ 0,00' };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../orcamento-impressao.js'), 'utf8'), ctx);
    return { ctx, card, campos, caixas };
}
test('separa cortina, persiana e adicional com medidas, modelos e acabamentos próprios', () => {
    const { ctx, card } = preparar();
    const html = ctx.montarLinhasDescritivoImpressao([card]);
    const linhas = html.match(/<tr>[\s\S]*?<\/tr>/g);
    assert.equal(linhas.length, 3);
    for (const texto of ['01 Cortina de tecido', 'AMÉRICA 13', '3,2 m', '2,7 m', 'Sanca']) assert.ok(linhas[0].includes(texto), texto);
    for (const texto of ['01 Persiana', 'Double Vision', 'Linho', '1,5 m', '1,8 m', 'Bandô de Encaixe', 'Bege', 'Base inferior Cônica', 'Cinza']) assert.ok(linhas[1].includes(texto), texto);
    for (const texto of ['02 Persiana', 'Romana', 'Screen', '0,9 m', '1,1 m', 'Bandô de Parafuso', 'Preto']) assert.ok(linhas[2].includes(texto), texto);
    assert.ok(!linhas[1].includes('AMÉRICA')); assert.ok(!linhas[2].includes('Double Vision'));
    assert.equal((html.match(/R\$ 2\.345,67/g) || []).length, 1);
    assert.ok(html.includes('rowspan="3"')); assert.ok(html.includes('Sala &lt;principal>'));
});
test('imprime só a persiana ativa quando a cortina e a adicional estão desativadas', () => {
    const { ctx, card, campos, caixas } = preparar();
    campos['chk-cortina-1'].checked = false; caixas[1].chk.checked = false;
    const html = ctx.montarLinhasDescritivoImpressao([card]);
    assert.equal((html.match(/<tr>/g) || []).length, 1);
    assert.ok(!html.includes('Cortina de tecido')); assert.ok(!html.includes('Romana'));
    assert.ok(html.includes('1,5 m')); assert.ok(!html.includes('3,2 m'));
});
