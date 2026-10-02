// Validação visual local e isolada; execute com: node tests/validar-celular.cjs
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'celular');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (pathname === '/supabase-config.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end('window.MICHELE_SUPABASE = { enabled: false };'); return;
  }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript'})[path.extname(target)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const reports = [];
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 800, hasTouch: width < 800, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.evaluate(() => {
        usuarioAtual = { id:'TESTE-VISUAL', nome:'Validação local', cargo:'Administrador' };
        iniciarAplicacao();
        iniciarNovoOrcamento();
        adicionarItemOrcamentoPadrao();
        document.querySelector('.item-carrinho-card').classList.add('aberto');
      });
      const editor = page.locator('.cortina-editor').first();
      await editor.waitFor({ state: 'visible' });
      await editor.screenshot({ path:path.join(output, `cortina-${width}.png`) });
      await page.screenshot({ path:path.join(output, `tela-${width}.png`), fullPage:true });
      const medir = () => page.evaluate(() => {
        const editor = document.querySelector('.cortina-editor');
        const visible = el => el.checkVisibility({ checkVisibilityCSS:true });
        const rect = editor.getBoundingClientRect();
        const overflow = Array.from(editor.querySelectorAll('*')).filter(visible).filter(el => {
          const box = el.getBoundingClientRect();
          return box.right > rect.right + 2 || box.left < rect.left - 2;
        }).map(el => ({tag:el.tagName,id:el.id,class:el.className}));
        const inputs = Array.from(editor.querySelectorAll('input:not([type=hidden]),select,textarea')).filter(visible);
        const narrow = inputs.filter(el => !['checkbox','radio'].includes(el.type) && el.getBoundingClientRect().width < 44).map(el => el.id);
        return { width:innerWidth, documentWidth:document.documentElement.scrollWidth, editorWidth:rect.width, overflow, narrow, sections:editor.querySelectorAll('.cortina-secao').length };
      });
      const report = await medir();
      await page.locator('.cortina-extras summary').first().click();
      report.extras = await medir();
      await editor.screenshot({ path:path.join(output, `extras-${width}.png`) });
      await page.locator('.cortina-extras summary').first().click();
      // Digitação real e troca de abas, sem gravar nenhum documento.
      await page.locator('[id^="largura-"]').first().fill('3.50');
      await page.locator('[id^="altura-"]').first().fill('2.70');
      await page.locator('[id^="quantidade-"]').first().fill('1');
      await page.locator('[id^="cortina-tab-material-"]').first().click();
      assert(await page.locator('.cortina-material').first().isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Material alarga a página');
      await page.locator('[id^="cortina-tab-pagamento-"]').first().click();
      await page.locator('[id^="pagamento-forma-"]').first().selectOption('cartao');
      report.pagamento = await medir();
      await editor.screenshot({ path:path.join(output, `pagamento-${width}.png`) });
      await page.locator('[id^="cortina-tab-form-"]').first().click();
      assert(await page.locator('.cortina-form').first().isVisible());
      if (width < 800) {
        await page.locator('.moderna-menu').click();
        assert.equal(await page.locator('.moderna-menu').getAttribute('aria-expanded'), 'true');
        await page.locator('.sidebar-btn[data-tab="home"]').click();
        assert.equal(await page.locator('.moderna-menu').getAttribute('aria-expanded'), 'false');
        assert(await page.locator('#painel-dashboard').isVisible());
      }
      report.errors = errors;
      reports.push(report);
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'resultado.json'), JSON.stringify(reports, null, 2));
    for (const cargo of ['Administrador','Gerente','Vendedor']) {
      for (const width of [360,1366]) {
        const context = await browser.newContext({ viewport:{width,height:844}, reducedMotion:'reduce' });
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.evaluate(cargo => {
          usuarioAtual = {id:'PERFIL-VISUAL', nome:cargo === 'Vendedor' ? 'Elton (teste local)' : 'Validação local', cargo};
          iniciarAplicacao();
        }, cargo);
        const section = page.locator('.inicio-atalhos');
        await section.screenshot({path:path.join(output,`inicio-${cargo}-${width}.png`)});
        const heading = await page.locator('.inicio-atalhos-titulo').boundingBox();
        const buttons = page.locator('.atalho-trabalho:visible');
        assert.equal(await buttons.count(), cargo === 'Administrador' ? 3 : 2);
        for (const button of await buttons.all()) {
          const box = await button.boundingBox();
          assert(box.y >= heading.y + heading.height, 'Atalho deve ficar abaixo do título Rotina da empresa');
          assert(box.x >= 0 && box.x + box.width <= width + 1, 'Atalho ultrapassa a tela');
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await context.close();
      }
    }
    console.log(JSON.stringify(reports, null, 2));
    assert(reports.every(report => report.overflow.length === 0), 'Campos ultrapassam o módulo');
    assert(reports.every(report => report.narrow.length === 0), 'Campos estreitos demais');
    assert(reports.every(report => report.documentWidth <= report.width + 1), 'Rolagem horizontal na página');
    assert(reports.every(report => report.errors.length === 0), 'Erros JavaScript');
    for (const report of reports) for (const state of ['extras','pagamento']) {
      assert.equal(report[state].overflow.length, 0, `${state} ultrapassa o módulo em ${report.width}px`);
      assert.equal(report[state].narrow.length, 0, `${state} possui campos estreitos em ${report.width}px`);
      assert(report[state].documentWidth <= report.width + 1, `${state} alarga a página`);
    }
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
