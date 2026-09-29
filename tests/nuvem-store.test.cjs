const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NuvemStore, limpar, CHAVES } = require('../nuvem-store.js');

function storage() {
  const dados = new Map();
  return { getItem: k => dados.get(k) ?? null, setItem: (k,v) => dados.set(k,v), removeItem: k => dados.delete(k) };
}
function servidor() {
  let remoto = { revisao: 0, dados: {} }, id;
  return {
    ler: () => structuredClone(remoto),
    salvar: async op => {
      if (op.id === id) return remoto.revisao;
      if (op.revisao !== remoto.revisao) throw new Error('MICHELE_CONFLITO');
      remoto = { revisao: remoto.revisao + 1, dados: structuredClone(op.dados) };
      id = op.id;
      return remoto.revisao;
    }
  };
}
function criar(servidor, extras = {}) {
  const store = new NuvemStore({ storage: storage(), journalKey: 'conta-A',
    salvar: servidor.salvar, uuid: () => require('node:crypto').randomUUID(), ...extras });
  store.carregar(servidor.ler());
  return store;
}

test('outro dispositivo carrega todos os cadastros, configurações e números confirmados', async () => {
  const server = servidor(), a = criar(server);
  for (const chave of CHAVES) {
    const valor = chave.includes('_numero_') ? '12' : chave === 'michele_config_empresa' ? '{"nomeEmpresa":"Michele"}' : '[{"id":"1"}]';
    a.setItem(chave, valor);
  }
  await a.flush();
  const b = criar(server);
  assert.deepEqual(b.dados, a.dados);
  assert.equal(a.pendente(), false);
});

test('edições simultâneas e numeração não sobrescrevem dados do outro dispositivo', async () => {
  const server = servidor(), a = criar(server), b = criar(server);
  a.setItem('michele_pedidos', '[{"numeroPedido":"000001","cliente":"Ana"}]');
  a.setItem('michele_numero_pedido', '1');
  b.setItem('michele_pedidos', '[{"numeroPedido":"000001","cliente":"Bia"}]');
  b.setItem('michele_numero_pedido', '1');
  await a.flush();
  await assert.rejects(b.flush(), /MICHELE_CONFLITO/);
  assert.equal(server.ler().dados.michele_pedidos, a.getItem('michele_pedidos'));
  assert.equal(b.conflito, true);
  assert.equal(b.pendente(), true);
  assert.ok(b.storage.getItem(b.journalKey));
  assert.throws(() => b.setItem('michele_clientes', '[]'), /Aguarde/);
});

test('falha de rede preserva pendências após recarregar e não sinaliza sucesso', async () => {
  const server = servidor(), local = storage(), estados = [];
  const a = criar(server, { storage: local, salvar: async () => { throw new Error('offline'); }, status: tipo => estados.push(tipo) });
  a.setItem('michele_clientes', '[{"nome":"Ana"}]');
  await assert.rejects(a.flush(), /offline/);
  assert.equal(estados.includes('salvo'), false);
  const b = criar(server, { storage: local });
  await b.flush();
  assert.equal(server.ler().dados.michele_clientes, '[{"nome":"Ana"}]');
  assert.equal(local.getItem(b.journalKey), null);
});

test('resposta perdida é repetida com o mesmo identificador sem duplicar a gravação', async () => {
  const server = servidor(), local = storage();
  const a = criar(server, { storage: local, salvar: async op => {
    await server.salvar(op); throw new Error('resposta perdida');
  } });
  a.setItem('michele_clientes', '[{"nome":"Ana"}]');
  await assert.rejects(a.flush());
  const b = criar(server, { storage: local });
  await b.flush();
  assert.equal(server.ler().revisao, 1);
  assert.equal(b.pendente(), false);
});

test('alterações durante um envio são enviadas depois e recuperadas após resposta perdida', async () => {
  const server = servidor(), local = storage();
  let liberar;
  const a = criar(server, { storage: local, salvar: async op => {
    await new Promise(resolve => { liberar = resolve; });
    await server.salvar(op); throw new Error('resposta perdida');
  } });
  a.setItem('michele_clientes', '[{"nome":"Ana"}]');
  const envio = a.flush();
  a.setItem('michele_clientes', '[{"nome":"Ana Maria"}]');
  a.setItem('michele_fornecedores', '[{"razao":"Fornecedor"}]');
  liberar(); await assert.rejects(envio);
  const b = criar(server, { storage: local });
  await b.flush();
  assert.equal(server.ler().revisao, 2);
  assert.equal(server.ler().dados.michele_clientes, '[{"nome":"Ana Maria"}]');
  assert.ok(server.ler().dados.michele_fornecedores);
});

test('pendências são isoladas por conta', () => {
  const server = servidor(), local = storage();
  const a = criar(server, { storage: local });
  a.setItem('michele_clientes', '[{"nome":"Privado"}]');
  const b = criar(server, { storage: local, journalKey: 'conta-B' });
  assert.equal(b.getItem('michele_clientes'), null);
});

test('senhas locais não são enviadas ao banco e cadastros inválidos são rejeitados', () => {
  assert.equal(limpar('michele_profissionais', '[{"nome":"Ana","senha":"segredo"}]'), '[{"nome":"Ana"}]');
  assert.throws(() => limpar('michele_clientes', '{}'));
  assert.throws(() => limpar('michele_numero_pedido', '-1'));
  assert.throws(() => limpar('outra_chave', '[]'));
});

test('armazenamento cheio não informa que uma alteração foi guardada', () => {
  const a = criar(servidor(), { storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } });
  assert.throws(() => a.setItem('michele_clientes', '[{"nome":"Ana"}]'), /quota/);
  assert.equal(a.getItem('michele_clientes'), null);
});

test('journal não triplica o tamanho do logotipo enquanto envia', async () => {
  const server = servidor(), local = storage();
  const a = criar(server, { storage: local, salvar: async () => { throw new Error('offline'); } });
  a.setItem('michele_config_empresa', JSON.stringify({ logo: 'a'.repeat(100000) }));
  await assert.rejects(a.flush());
  assert.ok(local.getItem(a.journalKey).length < 101000);
});
