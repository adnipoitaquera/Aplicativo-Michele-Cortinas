const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const codigo = fs.readFileSync(path.join(__dirname, '../persianas-materiais.js'), 'utf8');
function contexto() {
    const ctx = {
        normalizarNomeTecido: s => String(s || '').toLowerCase(),
        escaparHtmlProduto: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
        numeroExibicao: p => `PED-${p.numeroPedido}`,
        formatarDataMaterial: s => s ? s.split('-').reverse().join('/') : '-',
    };
    vm.createContext(ctx);
    vm.runInContext(codigo, ctx);
    return ctx;
}
function pedido() {
    return { idDocumento: 'DOC-1', numeroPedido: '000001', tipo: 'Pedido', cliente: { nome: 'Cliente <Teste>' }, data: '11/09/2026', dataEntrega: '2026-10-01', configuracaoAmbientes: [{ id: 1, estado: { campos: {
        'ambiente-nome-1': { value: 'Sala' },
        'chk-persiana-1': { checked: true },
        'persiana-modelo-1': { value: '250', text: 'Double Vision - Linho - R$ 250,00/m²' },
        'persiana-largura-1': { value: '2' }, 'persiana-altura-1': { value: '1.8' }, 'persiana-qtd-1': { value: '3' },
        'persiana-bando-1': { value: '85', text: 'Bandô Branco' },
        'chk-persiana-sub-100': { checked: true },
        'persiana-modelo-sub-100': { value: '250', text: 'Romana - Screen' },
        'persiana-largura-sub-100': { value: '1.5' }, 'persiana-altura-sub-100': { value: '2' }, 'persiana-qtd-sub-100': { value: '1' },
        'chk-persiana-sub-200': { checked: false }
    } } }] };
}

test('cortes de Rolo, Romana e Double Vision em metros por peça', () => {
    const ctx = contexto();
    for (const modelo of ['Rolo', 'Romana', 'Double Vision']) {
        const m = ctx.calcularMateriaisPersiana({ modelo, largura: 2, altura: 1.8, quantidade: 3, acabamento: 'Bandô', tampaBando: true, tampaBase: true });
        assert.equal(m.tecidoLargura, 1.97);
        assert.ok(Math.abs(m.tecidoAltura - (modelo === 'Double Vision' ? 3.8 : 2)) < 1e-10);
        assert.equal(m.tubo, 1.975); assert.equal(m.base, 1.975); assert.equal(m.duplaFace, 3.95);
        assert.equal(m.bando, 2); assert.equal(m.tampaBando, 2); assert.equal(m.tampaBase, 2);
    }
});
test('não inventa cortes de outros modelos, não gera valores negativos e respeita opcionais', () => {
    const ctx = contexto();
    const m = ctx.calcularMateriaisPersiana({ modelo: 'Vertical', largura: 0.02, altura: 0, acabamento: 'Nenhum', tampaBando: true, tampaBase: false });
    assert.equal(m.tecidoLargura, null); assert.equal(m.tecidoAltura, null); assert.equal(m.tubo, null);
    assert.equal(m.bando, null); assert.equal(m.tampaBando, 0); assert.equal(m.tampaBase, 0);
});
test('lê persianas principais e adicionais, separa tecido e modelo sem confundir preços iguais', () => {
    const linhas = contexto().obterLinhasMateriaisPersianas(pedido());
    assert.equal(linhas.length, 2); assert.equal(linhas[0].modelo, 'Double Vision'); assert.equal(linhas[0].tecido, 'Linho');
    assert.equal(linhas[1].modelo, 'Romana'); assert.equal(linhas[0].quantidade, 3); assert.equal(linhas[0].corBando, 'Branco');
});
test('impressão contém cabeçalho, resultados e acabamentos, sem campos, preços ou fórmulas', () => {
    const ctx = contexto(), p = pedido();
    p.materiaisPersianas = { '1:1': { cor: 'Areia', tampaBase: true, corTampaBase: 'Branco' } };
    const html = ctx.montarFichaMateriaisPersianas(p, false);
    for (const texto of ['Cliente &lt;Teste>', 'PED-000001', '11/09/2026', '01/10/2026', '1,975 m', '3,800 m', 'Areia', 'Tampa da Base', '2 un.']) assert.ok(html.includes(texto), texto);
    assert.doesNotMatch(html, /<input|<select|R\$|20\s*cm|2,5\s*cm|altura\s*X\s*2/i);
});
test('salva acabamento no pedido e no documento em edição, recuperando após recarregar', () => {
    const ctx = contexto(), p = pedido(), armazenado = {};
    const status = {};
    ctx.pedidos = [p]; ctx.objetoOrcamentoCorrente = { idDocumento: p.idDocumento };
    ctx.dadosStorage = { setItem: (k, v) => armazenado[k] = v };
    ctx.document = { getElementById: id => id === 'mp-pedido' ? { value: p.idDocumento } : status };
    const input = { dataset: { campo: 'cor' }, value: 'Azul', type: 'text', closest: () => ({ dataset: { chave: '1:1' }, querySelectorAll: () => [] }) };
    ctx.salvarCampoMaterialPersiana(input);
    const salvo = JSON.parse(armazenado.michele_pedidos)[0];
    assert.equal(ctx.obterLinhasMateriaisPersianas(salvo)[0].cor, 'Azul');
    assert.equal(ctx.objetoOrcamentoCorrente.materiaisPersianas['1:1'].cor, 'Azul');
});

test('acabamentos separados, tubo e comandos são recuperados e impressos para principal e adicional', () => {
    const ctx = contexto(), p = pedido(), campos = p.configuracaoAmbientes[0].estado.campos;
    assert.equal(ctx.obterLinhasMateriaisPersianas(p)[0].tipoTubo, 'Tubo 38');
    for (const sufixo of ['1', 'sub-100']) {
        const valores = { 'cor-bando': 'Areia', 'base-niveladora': 'Sim', 'cor-base-niveladora': 'Cinza', 'base-inferior': 'Sim', 'cor-base-inferior': 'Branco', tubo: 'Tubo 50', comandos: 'Corrente', 'cor-comando': 'Preto' };
        for (const [campo, value] of Object.entries(valores)) campos[`persiana-${campo}-${sufixo}`] = { value };
    }
    const salvo = JSON.parse(JSON.stringify(p));
    for (const linha of ctx.obterLinhasMateriaisPersianas(salvo)) {
        assert.equal(linha.corBando, 'Areia'); assert.equal(linha.baseNiveladora, 'Sim'); assert.equal(linha.corBaseNiveladora, 'Cinza');
        assert.equal(linha.baseInferior, 'Sim'); assert.equal(linha.corBase, 'Branco');
        assert.equal(linha.tipoTubo, 'Tubo 50'); assert.equal(linha.comandos, 'Corrente'); assert.equal(linha.corComando, 'Preto');
    }
    const html = ctx.montarFichaMateriaisPersianas(salvo, false);
    for (const texto of ['Base Niveladora', 'Cor da Base Niveladora', 'Base Inferior', 'Cor da Base Inferior', 'Tubo 50', 'Comandos', 'Corrente', 'Cor do comando']) assert.ok(html.includes(texto), texto);
});
