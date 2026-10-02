const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {Code128Reader,BitArray}=require('@zxing/library');
test('etiquetas imprimem em páginas de 50 por 30 mm sem telas extras',async()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const estilos=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')+['erp-classico.css','interface-moderna.css','etiquetas.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent(`<style>${estilos}</style><body class="imprimindo-etiquetas"><div id="app-shell"><div class="app-layout"><aside class="sidebar">Menu</aside><main class="app-main"><div class="container"><div id="aba-etiquetas" class="conteudo-aba ativa"><div class="modulo-cabecalho">Botões</div><div class="historico-toolbar">Filtros</div><div id="etiquetas-corpo"></div></div></div></main></div></div><div id="area-impressao-profissional">Proposta</div></body>`);
    const inicio=html.indexOf('function atualizarEtiquetas()'),fim=html.indexOf('function imprimirEtiquetas(',inicio);
    await page.addScriptTag({content:`const pedidosOperacionais=()=>[{idDocumento:'1',cliente:{nome:'Maria Aparecida de Oliveira da Silva'}}]; const numeroExibicao=()=> 'PED-12345'; const escOperacao=v=>String(v); const itensOperacionais=()=>[0,1].map(i=>({doc:pedidosOperacionais()[0],item:{ambiente:'Sala de estar e jantar com varanda integrada',largura:3.5,altura:2.8,modelo:'Cortina com tecido principal e blackout modelo wave',quantidade:2}}));`+html.slice(inicio,fim)});
    await page.locator('#aba-etiquetas').evaluate(el=>el.insertAdjacentHTML('afterbegin','<select id="etiq-pedido"></select><input id="etiq-busca">'));
    await page.evaluate(()=>{atualizarEtiquetas();document.getElementById('etiq-pedido').remove();document.getElementById('etiq-busca').remove();});
    await page.locator('#aba-etiquetas').evaluate(el=>el.insertAdjacentHTML('afterbegin','<div id="etiq-exportacao"><select id="etiq-imagem"></select><button id="etiq-baixar">Baixar</button></div>'));
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'etiquetas-niimbot.js'),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'vendor/jsbarcode-code128.min.js'),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'etiquetas-codigo-barras.js'),'utf8')});
    await page.addScriptTag({content:`function garantirCodigosLogistica(){return itensOperacionais().map((x,i)=>({...x,peca:{codigo:String(10000000000000+i),unidade:i+1}}));}`});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'etiquetas-producao.js'),'utf8')});
    await page.evaluate(()=>{document.getElementById('aba-etiquetas').insertAdjacentHTML('afterbegin','<select id="etiq-pedido"></select><input id="etiq-busca">');atualizarEtiquetas();document.getElementById('etiq-pedido').remove();document.getElementById('etiq-busca').remove();});
    const imagem=await page.evaluate(()=>{
      atualizarOpcoesEtiquetasNiimbot();
      let resultado;
      const original=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){resultado={url:this.href,nome:this.download};};
      try{baixarEtiquetaNiimbot();}finally{HTMLAnchorElement.prototype.click=original;}
      return {...resultado,opcoes:document.getElementById('etiq-imagem').options.length};
    });
    assert.equal(imagem.opcoes,2);
    assert.match(imagem.nome,/50x30\.png$/);
    const png=Buffer.from(imagem.url.split(',')[1],'base64');
    assert.equal(png.readUInt32BE(16),400);assert.equal(png.readUInt32BE(20),240);
    const pixels=await page.evaluate(async url=>{
      const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return Array.from(ctx.getImageData(0,200,400,1).data);
    },imagem.url);
    const linha=new BitArray(400);for(let i=0;i<400;i++)if(pixels[i*4]<128)linha.set(i);
    assert.equal(new Code128Reader().decodeRow(0,linha).getText(),'10000000000000');
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.etiqueta').count(),2);
    assert.equal(await page.locator('.etiqueta').first().isVisible(),true);
    assert.equal(await page.locator('.sidebar').isVisible(),false);
    assert.equal(await page.locator('#area-impressao-profissional').isVisible(),false);
    assert.equal(await page.locator('#etiq-exportacao').isVisible(),false);
    assert.equal(await page.locator('.etiqueta h3').first().innerText(),'Maria');
    assert.ok(await page.locator('.etiqueta h3').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
    assert.match(await page.locator('.etiqueta-medidas').first().innerText(),/Qtd\. 1/);
    assert.equal(await page.locator('.etiqueta-barras').count(),2);
    assert.ok(await page.locator('.etiqueta').first().evaluate(el=>{
      const limite=el.getBoundingClientRect().bottom-parseFloat(getComputedStyle(el).paddingBottom);
      return [...el.querySelectorAll('.etiqueta-topo,h3,.etiqueta-dados,.etiqueta-barras')].every(f=>f.getBoundingClientRect().bottom<=limite+1);
    }));
    const box=await page.locator('.etiqueta').first().boundingBox();
    assert.ok(Math.abs(box.width-50*96/25.4)<1);
    assert.ok(Math.abs(box.height-30*96/25.4)<1);
    const pdf=(await page.pdf({preferCSSPageSize:true,displayHeaderFooter:false})).toString('latin1');
    assert.equal((pdf.match(/\/Type \/Page\b/g)||[]).length,2);
    const medidas=[...pdf.matchAll(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/g)];
    assert.ok(medidas.length>0);
    medidas.forEach(m=>{assert.ok(Math.abs(Number(m[1])-50*72/25.4)<1);assert.ok(Math.abs(Number(m[2])-30*72/25.4)<1);});
    const imprimir=html.slice(fim,html.indexOf('\n',fim));
    await page.addScriptTag({content:'function imprimirComRetorno(){};'+imprimir});
    await page.evaluate(()=>{document.getElementById('etiq-imagem').value='1';imprimirEtiquetas();});
    assert.equal(await page.locator('.etiqueta').first().isVisible(),false);
    assert.equal(await page.locator('.etiqueta').nth(1).isVisible(),true);
    const unico=(await page.pdf({preferCSSPageSize:true,displayHeaderFooter:false})).toString('latin1');
    assert.equal((unico.match(/\/Type \/Page\b/g)||[]).length,1,'etiqueta selecionada não imprime uma segunda folha');
    await page.evaluate(()=>imprimirEtiquetas(true));
    const todas=(await page.pdf({preferCSSPageSize:true,displayHeaderFooter:false})).toString('latin1');
    assert.equal((todas.match(/\/Type \/Page\b/g)||[]).length,2,'duas etiquetas sem página em branco ao final');
  }finally{await browser.close();}
});
