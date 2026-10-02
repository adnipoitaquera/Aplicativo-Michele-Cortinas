const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
test('scripts inline possuem sintaxe valida', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});

test('impressão de confecção não prepara a proposta e limpa o estado ao retornar', () => {
  const listeners = {}, classes = new Set(['imprimindo-confeccao']);
  let propostas = 0;
  const ctx = {document:{body:{matches:seletores=>seletores.split(',').some(s=>classes.has(s.trim().slice(1))),classList:{remove:(...nomes)=>nomes.forEach(n=>classes.delete(n))}},querySelectorAll:()=>[],getElementById:()=>null},window:{addEventListener:(nome,cb)=>listeners[nome]=cb},prepararPropostaImpressao:()=>propostas++};
  vm.createContext(ctx);
  const inicio=html.indexOf("window.addEventListener('beforeprint'");
  const fim=html.indexOf('// Módulos operacionais:',inicio);
  vm.runInContext(html.slice(inicio,fim),ctx);
  listeners.beforeprint();
  assert.equal(propostas,0);
  assert.ok(classes.has('imprimindo-confeccao'));
  listeners.afterprint();
  assert.equal(classes.size,0);
});
test('cancelar a proposta limpa o estado e nao agenda outra impressao', () => {
  const listeners = {};
  const classes = new Set();
  const root = { innerHTML: '', style: { removeProperty() {} }, setAttribute(k,v) { this[k] = v; } };
  let prints = 0;
  const ctx = {
    document: { getElementById: id => id === 'area-impressao-profissional' ? root : null,
      querySelectorAll: () => [], body: { matches: () => false, classList: {
        add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c))
      } } },
    window: { addEventListener: (name, cb) => listeners[name] = cb,
      print: () => { prints++; listeners.beforeprint(); listeners.afterprint(); } },
    processarCalculoGeral() {}, clientes: [], usuarioAtual: { nome: 'Teste' },
    objetoOrcamentoCorrente: null, dadosStorage: { getItem: () => null },
    LOGO_EMPRESA_PADRAO: '', montarLinhasDescritivoImpressao: () => '', montarPagamentoImpressao: () => '<section class="print-payment">À vista</section>'
  };
  vm.createContext(ctx);
  const start = html.indexOf('function imprimirPropostaProfissional()');
  vm.runInContext(html.slice(start, html.indexOf('</script>', start)), ctx);
  ctx.imprimirPropostaProfissional();
  assert.equal(prints, 1);
  assert.equal(classes.size, 0);
  assert.equal(root['aria-hidden'], 'true');
  assert.ok(root.innerHTML.includes('print-page'));
  assert.ok(root.innerHTML.indexOf('print-payment') > root.innerHTML.indexOf('class="print-total"'));
  listeners.beforeprint(); // Ctrl+P prepares without calling print again.
  assert.equal(prints, 1);
  assert.ok(classes.has('imprimindo-proposta'));
  listeners.afterprint();
  assert.equal(classes.size, 0);
  ctx.imprimirPropostaProfissional();
  assert.equal(prints, 2);
});
