const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
test('ficha de confecção permanece visível na mídia de impressão', async () => {
  const root=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const estilos=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')+['erp-classico.css','interface-moderna.css','confeccao-cortinas.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(`<style>${estilos}</style><body class="imprimindo-confeccao"><div id="app-shell"><div class="app-layout"><aside class="sidebar">Menu</aside><main class="app-main"><div class="container"><div id="aba-confeccao" class="conteudo-aba ativa"><div id="conf-editor">Edição</div><div id="conf-impressao"><h1>Confecção de cortinas</h1><p>Costureira responsável: Ana</p><section><h2>Sala</h2><dl><div><dt>Largura (m)</dt><dd>3,5</dd></div></dl></section></div></div></div></main></div></div><div id="area-impressao-profissional"></div></body>`);
    // O login mostra o contêiner da aplicação antes de abrir qualquer módulo.
    await page.evaluate(()=>document.getElementById('app-shell').style.display='block');
    const inicio=html.indexOf("window.addEventListener('beforeprint'");
    await page.addScriptTag({content:'function prepararPropostaImpressao(){document.body.classList.add("imprimindo-proposta");}'+html.slice(inicio,html.indexOf('// Módulos operacionais:',inicio))});
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#conf-impressao').isVisible(),true);
    assert.equal(await page.locator('#conf-editor').isVisible(),false);
    assert.equal(await page.locator('.sidebar').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('imprimindo-proposta')),false);
    assert.ok((await page.locator('#conf-impressao').boundingBox()).height>100);
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({media:'screen'});
    assert.equal(await page.locator('#conf-editor').isVisible(),true);
  } finally {await browser.close();}
});
