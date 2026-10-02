(function(){
  'use strict';
  window.atualizarOpcoesEtiquetasNiimbot=function(){
    const select=document.getElementById('etiq-imagem');
    if(!select)return;
    const anterior=select.value;
    select.replaceChildren(...Array.from(document.querySelectorAll('#etiquetas-corpo .etiqueta'),(el,i)=>{
      const option=document.createElement('option');option.value=i;
      option.textContent=`${el.querySelector('.etiqueta-topo small')?.textContent} — ${el.querySelector('h3')?.textContent} — ${el.querySelector('.etiqueta-ambiente')?.textContent} — ${el.querySelector('.etiqueta-topo span')?.textContent || ''}`;
      return option;
    }));
    if(Array.from(select.options).some(o=>o.value===anterior))select.value=anterior;
    document.getElementById('etiq-baixar').disabled=!select.options.length;
  };
  window.baixarEtiquetaNiimbot=function(){
    const indice=Number(document.getElementById('etiq-imagem').value);
    const etiqueta=document.querySelectorAll('#etiquetas-corpo .etiqueta')[indice];
    if(!etiqueta)return;
    // 50 × 30 mm a 203 dpi; margem lateral mantém o texto nos 48 mm centrais.
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,400,240);ctx.fillStyle='#000';ctx.textBaseline='top';
    const texto=seletor=>(etiqueta.querySelector(seletor)?.textContent||'').trim().replace(/\s+/g,' ');
    const limitar=(valor,max)=>{
      if(ctx.measureText(valor).width<=max)return valor;
      while(valor && ctx.measureText(valor+'…').width>max)valor=valor.slice(0,-1);
      return valor+'…';
    };
    const linha=(valor,y,tamanho,peso='bold')=>{ctx.font=`${peso} ${tamanho}px Arial`;ctx.fillText(limitar(valor,380),10,y);};
    const temCodigo=!!etiqueta.dataset.codigo;
    linha(texto('.etiqueta-topo small')+(temCodigo?' · '+texto('.etiqueta-topo span'):''),8,26);
    linha(texto('h3'),temCodigo?38:42,34);
    ctx.font='bold 28px Arial';
    const palavras=texto('.etiqueta-ambiente').split(' ');let primeira='';
    while(palavras.length && ctx.measureText((primeira+' '+palavras[0]).trim()).width<=380)primeira=(primeira+' '+palavras.shift()).trim();
    if(!primeira && palavras.length)primeira=palavras.shift();
    if(temCodigo){
      linha(texto('.etiqueta-ambiente'),78,28);linha(texto('.etiqueta-medidas'),110,27);linha(texto('.etiqueta-produto'),142,25,'normal');
      MicheleCodigoBarras.desenhar(ctx,etiqueta.dataset.codigo,178);
    }else{
      linha(primeira,82,28);linha(palavras.join(' '),112,28);linha(texto('.etiqueta-medidas'),150,27);linha(texto('.etiqueta-produto'),192,25,'normal');
    }
    const link=document.createElement('a');
    link.download=`etiqueta-${texto('.etiqueta-topo small').replace(/[^a-z0-9-]/gi,'')}-${indice+1}-50x30.png`;
    link.href=canvas.toDataURL('image/png');link.click();
  };
})();
