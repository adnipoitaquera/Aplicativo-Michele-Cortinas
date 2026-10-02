(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.atualizarEtiquetas=function(){
    const alvo=document.getElementById('etiquetas-corpo'),sel=document.getElementById('etiq-pedido');if(!alvo||!sel)return;
    const anterior=sel.value;
    sel.innerHTML='<option value="">Todos os pedidos</option>'+pedidosOperacionais().map(d=>`<option value="${esc(d.idDocumento)}">${esc(numeroExibicao(d))} — ${esc(d.cliente?.nome||'Cliente')}</option>`).join('');sel.value=anterior;
    let lista;
    try{lista=garantirCodigosLogistica();}catch(e){alvo.innerHTML=`<p>${esc('Não foi possível salvar os códigos das etiquetas: '+e.message)}</p>`;return;}
    const termo=(document.getElementById('etiq-busca')?.value||'').toLowerCase();
    lista=lista.filter(x=>(!sel.value||x.doc.idDocumento===sel.value)&&`${numeroExibicao(x.doc)} ${x.doc.cliente?.nome} ${x.item.ambiente} ${x.peca.codigo}`.toLowerCase().includes(termo));
    alvo.innerHTML=lista.map(x=>`<article class="etiqueta" data-codigo="${x.peca.codigo}"><div class="etiqueta-topo"><span>Peça ${x.peca.unidade}/${Number(x.item.quantidade)||1}</span><small>${esc(numeroExibicao(x.doc))}</small></div><h3>${esc(String(x.doc.cliente?.nome||'Cliente').trim().split(/\s+/)[0])}</h3><div class="etiqueta-dados"><span class="etiqueta-ambiente">${esc(x.item.ambiente||'-')}</span><span class="etiqueta-medidas">${Number(x.item.largura||0).toFixed(2)} × ${Number(x.item.altura||0).toFixed(2)} m <b>Qtd. 1</b></span><span class="etiqueta-produto">${esc(x.item.descPersiana||x.item.modelo||x.item.textoVoal||'Cortina')}</span></div>${MicheleCodigoBarras.svg(x.peca.codigo)}</article>`).join('')||'<div class="vazio-modulo">Nenhuma etiqueta para os filtros selecionados.</div>';
    atualizarOpcoesEtiquetasNiimbot();
  };
})();
