const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const inicio = html.indexOf('function fazerLogin(){');
const codigo = html.slice(inicio, html.indexOf('// Configurações da Empresa', inicio));

function ambiente(senha = '1234', status = 'Ativo') {
  const cadastro = { id: 'PROF-2', nome: 'Elton', usuario: 'Elton', senha: '1234', cargo: 'Vendedor', comissao: 5, status };
  const campos = { 'login-usuario': { value: ' elton ' }, 'login-senha': { value: senha }, 'login-erro': { textContent: '' } };
  let abriu = false, sessao;
  const ctx = { profissionais: [cadastro], MicheleNuvem: { ativo: false },
    document: { getElementById: id => campos[id] },
    sessionStorage: { setItem: (_chave, valor) => { sessao = JSON.parse(valor); } },
    iniciarAplicacao: () => { abriu = true; } };
  vm.createContext(ctx); vm.runInContext(codigo, ctx);
  return { ctx, cadastro, campos, abriu: () => abriu, sessao: () => sessao };
}

test('Elton entra com 1234 sem e-mail e conserva cadastro e permissões', () => {
  const a = ambiente(); const antes = JSON.stringify(a.cadastro);
  a.ctx.fazerLogin();
  assert.equal(a.abriu(), true);
  assert.equal(a.sessao().cargo, 'Vendedor');
  assert.equal(JSON.stringify(a.cadastro), antes);
});

test('senha errada ou cadastro inativo não abre o sistema', () => {
  for (const a of [ambiente('errada'), ambiente('1234', 'Inativo')]) {
    a.ctx.fazerLogin();
    assert.equal(a.abriu(), false);
    assert.equal(a.sessao(), undefined);
    assert.match(a.campos['login-erro'].textContent, /inválidos/);
  }
});

test('configuração atual usa usuário e senha, sem impor login por e-mail', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../supabase-config.js'), 'utf8'), ctx);
  assert.equal(ctx.window.MICHELE_SUPABASE.enabled, true);
  assert.equal(ctx.window.MICHELE_SUPABASE.authMode, 'usuario');
});
