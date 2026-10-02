(function(root){
  'use strict';
  function codificar(valor){
    const resultado={};
    root.JsBarcode(resultado,String(valor),{format:'CODE128',displayValue:false});
    const modulos=resultado.encodings.map(e=>e.data).join('');
    const escala=Math.floor(384/(modulos.length+20));
    if(escala<1)throw new Error('Código muito longo para a etiqueta de 50 mm.');
    return {modulos,escala,largura:(modulos.length+20)*escala};
  }
  function svg(valor){
    const {modulos,escala,largura}=codificar(valor);
    let barras='';
    for(let i=0;i<modulos.length;i++)if(modulos[i]==='1')barras+=`<rect x="${(i+10)*escala}" y="0" width="${escala}" height="48"/>`;
    return `<svg class="etiqueta-barras" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} 48" width="${largura/203*25.4}mm" height="6mm" role="img" aria-label="Código de barras" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${barras}</g></svg>`;
  }
  function desenhar(ctx,valor,y){
    const {modulos,escala,largura}=codificar(valor),inicio=Math.floor((400-largura)/2)+10*escala;
    ctx.fillStyle='#000';
    for(let i=0;i<modulos.length;i++)if(modulos[i]==='1')ctx.fillRect(inicio+i*escala,y,escala,48);
  }
  root.MicheleCodigoBarras={codificar,svg,desenhar};
})(typeof window!=='undefined'?window:globalThis);
