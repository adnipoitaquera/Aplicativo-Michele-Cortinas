const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const store = require('../nuvem-store.js');

function ambiente({ remoto = null, aceitar = true, erroBanco = false, ativo = true } = {}) {
  const elementos = new Map(), local = new Map(), chamadas = [], usuarios = [];
  let authChange;
  const elemento = id => {
    if (!elementos.has(id)) elementos.set(id, {
      value: id === 'login-usuario' ? 'elton@example.com' : 'senha-teste', dataset: {},
      textContent: '', hidden: true, closest() { return this; }, setAttribute() {}, prepend() {}
    });
    return elementos.get(id);
  };
  const sdk = {
    auth: {
      onAuthStateChange: cb => { authChange = cb; },
      signInWithPassword: async () => ({ data: { user: { id: 'conta-1', email: 'elton@example.com' } } })
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: remoto, error: erroBanco ? new Error('banco indisponível') : null }) }) }) }),
    rpc: async (nome, parametros) => { chamadas.push({ nome, parametros }); return { data: chamadas.length }; }
  };
  const ctx = {
    MICHELE_SUPABASE: ativo ? { url: 'https://teste.supabase.co', publishableKey: 'sb_publishable_teste' } : {},
    MicheleNuvemStore: store,
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k,v) => local.set(k,v), removeItem: k => local.delete(k) },
    document: { getElementById: elemento, querySelector: elemento },
    supabase: { createClient: () => sdk }, crypto: { randomUUID }, URL,
    navigator: { locks: { request: (_nome, _opcoes, callback) => { callback({}); return new Promise(() => {}); } } },
    mostrarLogin() {}, iniciarComDadosNuvem: conta => usuarios.push(conta),
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearTimeout() {},
    confirm: () => aceitar
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../supabase-sync.js'), 'utf8'), ctx);
  return { ctx, local, chamadas, usuarios, elemento, trocarSessao: sessao => authChange('SIGNED_IN', sessao) };
}

test('login carrega a nuvem antes de abrir as telas e não mistura os cadastros locais', async () => {
  const a = ambiente({ remoto: { revisao: 3, dados: { michele_clientes: '[{"nome":"Nuvem"}]' } } });
  a.local.set('michele_clientes', '[{"nome":"Navegador"}]');
  assert.equal(a.ctx.dadosStorage.getItem('michele_clientes'), null);
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.ctx.dadosStorage.getItem('michele_clientes'), '[{"nome":"Nuvem"}]');
  assert.equal(a.usuarios.length, 1);
  assert.equal(a.chamadas.length, 0);
});

test('migração inicial preserva o original, remove senhas e envia a identidade da conta', async () => {
  const a = ambiente();
  a.local.set('michele_profissionais', '[{"nome":"Ana","senha":"segredo"}]');
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.chamadas.length, 1);
  assert.equal(a.chamadas[0].parametros.p_usuario, 'conta-1');
  assert.equal(a.chamadas[0].parametros.p_dados.michele_profissionais, '[{"nome":"Ana"}]');
  assert.ok(a.local.get('michele_profissionais').includes('segredo'));
});

test('recusar migração não envia os dados locais', async () => {
  const a = ambiente({ aceitar: false });
  a.local.set('michele_clientes', '[{"nome":"Ana"}]');
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.chamadas.length, 0);
  assert.equal(a.ctx.dadosStorage.getItem('michele_clientes'), null);
});

test('erro no banco mantém a aplicação fechada e não usa os dados antigos como fallback', async () => {
  const a = ambiente({ erroBanco: true });
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.usuarios.length, 0);
  assert.match(a.elemento('login-erro').textContent, /Não foi possível carregar/);
});

test('troca de sessão impede enviar dados abertos em outra conta', async () => {
  const a = ambiente();
  await a.ctx.MicheleNuvem.login();
  a.ctx.dadosStorage.setItem('michele_clientes', '[{"nome":"Ana"}]');
  a.trocarSessao({ user: { id: 'conta-2' } });
  await assert.rejects(a.ctx.MicheleNuvem.sincronizar(), /Entre novamente/);
  assert.equal(a.chamadas.length, 0);
});

test('sem configuração o armazenamento local existente continua funcionando', () => {
  const a = ambiente({ ativo: false });
  a.ctx.dadosStorage.setItem('michele_clientes', '[{"nome":"Ana"}]');
  assert.equal(a.local.get('michele_clientes'), '[{"nome":"Ana"}]');
  assert.equal(a.ctx.MicheleNuvem.ativo, false);
});

test('migração preserva campos antigos, valores, números e todos os cadastros locais', async () => {
  const a = ambiente();
  const originais = {
    michele_clientes: '[{"id":"CLI-1","nome":"Maria","campoAntigo":{"valor":0}}]',
    michele_fornecedores: '[{"id":"FOR-1","razao":"Fornecedor","inscricaoEstadual":"00123"}]',
    michele_pedidos: '[{"tipo":"Pedido","numeroPedido":"000087","desconto":0,"ambientes":[{"nome":"Sala"}]}]',
    michele_config_empresa: '{"logo":"data:image/png;base64,original","nomeEmpresa":"Michele"}',
    michele_numero_pedido: '87',
    michele_numero_orcamento: '90'
  };
  for (const chave of store.CHAVES) if (!(chave in originais)) originais[chave] = '[{"nome":"Registro antigo","campoExtra":"original"}]';
  for (const [chave, valor] of Object.entries(originais)) a.local.set(chave, valor);
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.chamadas.length, 1);
  for (const [chave, valor] of Object.entries(originais)) {
    assert.equal(a.local.get(chave), valor);
    assert.deepEqual(JSON.parse(a.chamadas[0].parametros.p_dados[chave]), JSON.parse(valor));
  }
});

test('cadastro inválido interrompe toda a migração antes de qualquer envio', async () => {
  const a = ambiente();
  a.local.set('michele_clientes', '[{"nome":"Ana"}]');
  a.local.set('michele_pedidos', 'JSON antigo inválido');
  await a.ctx.MicheleNuvem.login();
  assert.equal(a.chamadas.length, 0);
  assert.equal(a.usuarios.length, 0);
  assert.equal(a.local.get('michele_pedidos'), 'JSON antigo inválido');
});

test('abrir dados na nuvem não normaliza, renumera ou regrava registros existentes', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('function iniciarComDadosNuvem('), html.indexOf('function alternarAba('));
  const pedidos = [{ tipo: 'Pedido', idDocumento: 'antigo-sem-numero', propriedadeLegada: true }];
  const ctx = {
    dadosStorage: { getItem: chave => chave === 'michele_pedidos' ? JSON.stringify(pedidos) : '[]', setItem() { assert.fail('Não deveria gravar na inicialização'); } },
    restaurarCatalogoProdutos() {}, atualizarOpcoesProdutos() {}, iniciarAplicacao() {},
    normalizarDadosExistentes() { assert.fail('Não deveria modificar os cadastros'); },
    garantirNumeracaoHistorico() { assert.fail('Não deveria renumerar o histórico'); }
  };
  vm.createContext(ctx);
  vm.runInContext(trecho + ';iniciarComDadosNuvem({id:"conta-1"});', ctx);
  assert.equal(JSON.stringify(ctx.pedidos), JSON.stringify(pedidos));
});

test('novos números respeitam o histórico sem modificar pedidos e orçamentos antigos', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('function proximoNumero('), html.indexOf('function numeroExibicao('));
  const antigos = [{ tipo: 'Pedido', numeroPedido: '000099', numeroOrcamento: '000145' }, { tipo: 'Pedido', idDocumento: 'antigo' }];
  const gravacoes = {};
  const ctx = { pedidos: structuredClone(antigos), dadosStorage: { getItem: () => '1', setItem: (k,v) => { gravacoes[k] = v; } } };
  vm.createContext(ctx); vm.runInContext(trecho, ctx);
  assert.equal(ctx.proximoNumero('Pedido'), '000100');
  assert.equal(ctx.proximoNumero('Orçamento'), '000146');
  assert.deepEqual(ctx.pedidos, antigos);
  assert.deepEqual(gravacoes, { michele_numero_pedido: '100', michele_numero_orcamento: '146' });
});
