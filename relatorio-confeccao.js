(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moeda=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const metros=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
  window.atualizarRelatorioConfeccao=function(){
    if(!usuarioEhAdministrador())return;
    const config=JSON.parse(dadosStorage.getItem('michele_config_empresa')||'{}');
    const lista=MicheleRelatorioConfeccao.resumir(pedidos,config);
    document.getElementById('rel-conf-corpo').innerHTML=lista.map(x=>`<tr><td>${esc(x.nome)}</td><td>${metros(x.metros)}${x.semMetragem?' (parcial)':''}</td><td>${moeda(x.previsto)}</td><td>${moeda(x.pago)}</td><td class="rel-conf-acoes"><button type="button" class="btn" data-id="${esc(x.id)}" onclick="registrarPagamentoCostureira(this.dataset.id)">Registrar pagamento</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhuma costureira ou confecção registrada.</td></tr>';
    const total=lista.reduce((s,x)=>({metros:s.metros+x.metros,previsto:s.previsto+x.previsto,pago:s.pago+x.pago}),{metros:0,previsto:0,pago:0});
    document.getElementById('rel-conf-total').innerHTML=`<tr><th>Total</th><th>${metros(total.metros)}</th><th>${moeda(total.previsto)}</th><th>${moeda(total.pago)}</th><th class="rel-conf-acoes"></th></tr>`;
    const sem=lista.reduce((s,x)=>s+x.semMetragem,0);
    document.getElementById('rel-conf-aviso').textContent=(sem?`${sem} item(ns) sem metragem registrada; os totais de metragem são parciais. `:'')+'Pagamentos antigos sem vínculo com costureira não entram neste total. Vincule-os ao editar o lançamento no Financeiro.';
  };
  window.registrarPagamentoCostureira=function(id){
    if(!usuarioEhAdministrador())return;
    abrirAbaComando('aba-financeiro');novoLancamentoFinanceiro('saida');
    document.getElementById('fin-categoria').value='Confecção';atualizarFormularioFinanceiro();
    document.getElementById('fin-costureira').value=id;
    document.getElementById('fin-descricao').value='Pagamento de confecção';
    document.getElementById('fin-situacao').value='Liquidado';document.getElementById('fin-data-movimento').value=MicheleFinanceiro.hoje();atualizarFormularioFinanceiro();
    document.getElementById('fin-bruto').focus();
  };
})();
