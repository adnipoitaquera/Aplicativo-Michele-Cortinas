(function () {
  'use strict';
  const statusPermitidos = ['Na fila','Em produção','Em confecção','Pronto'];
  function itens() {
    const anteriores = JSON.parse(localStorage.getItem('michele_producao') || '{}');
    return itensOperacionais().map(x => ({...x,
      status:x.doc.producao?.[x.indice] || anteriores[x.chave] || 'Na fila',
      costureira:x.doc.confeccao?.itens?.[x.indice] ? x.doc.confeccao.costureiraNome || '' : '',
      entrega:x.doc.confeccao?.itens?.[x.indice] ? x.doc.confeccao.dataEntrega : x.doc.dataEntrega
    }));
  }
  window.atualizarProducao = function () {
    const corpo = document.getElementById('prod-corpo'); if (!corpo) return;
    const termo = (document.getElementById('prod-busca')?.value || '').trim().toLowerCase();
    const filtro = document.getElementById('prod-status')?.value || '';
    const lista = itens().filter(x => (!filtro || x.status === filtro) && `${numeroExibicao(x.doc)} ${x.doc.cliente?.nome || ''} ${x.item.ambiente || ''} ${x.item.descPersiana || x.item.modelo || x.item.textoVoal || ''} ${x.costureira}`.toLowerCase().includes(termo));
    corpo.innerHTML = lista.length ? lista.map(x => {
      const produto = x.item.descPersiana || x.item.modelo || x.item.textoVoal || 'Cortina sob medida';
      const classe = x.status === 'Pronto' ? 'status-pronto' : ['Em produção','Em confecção'].includes(x.status) ? 'status-producao' : 'status-novo';
      return `<tr><td>${escOperacao(numeroExibicao(x.doc))}</td><td><strong>${escOperacao(x.doc.cliente?.nome || 'Cliente')}</strong><br><small>${escOperacao(x.item.ambiente || 'Ambiente')}</small></td><td>${escOperacao(produto)}</td><td>${Number(x.item.largura || 0).toFixed(2)} × ${Number(x.item.altura || 0).toFixed(2)} m<br><small>Qtd. ${x.item.quantidade || 1}</small></td><td>${escOperacao(formatarDataMaterial(x.entrega) || '-')}</td><td>${escOperacao(x.costureira || '—')}</td><td><span class="status-pedido ${classe}">${escOperacao(x.status)}</span></td><td><select data-chave="${escOperacao(x.chave)}" onchange="alterarStatusProducao(this.dataset.chave,this.value)">${statusPermitidos.map(s => `<option${s === x.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`;
    }).join('') : '<tr><td colspan="8">Nenhum item de produção encontrado.</td></tr>';
    for (const [id,status] of [['prod-fila','Na fila'],['prod-andamento','Em produção'],['prod-confeccao','Em confecção'],['prod-prontos','Pronto']]) {
      const campo = document.getElementById(id); if (campo) campo.textContent = lista.filter(x => x.status === status).length;
    }
  };
  window.alterarStatusProducao = function (chave, status) {
    if (!statusPermitidos.includes(status)) return;
    const x = itensOperacionais().find(x => x.chave === chave); if (!x) return;
    const producao = {...x.doc.producao, [x.indice]:status};
    const atualizados = pedidos.map(p => p === x.doc ? {...p, producao} : p);
    try { dadosStorage.setItem('michele_pedidos',JSON.stringify(atualizados)); }
    catch (erro) { alert('Não foi possível salvar o status: ' + erro.message); atualizarProducao(); return; }
    pedidos = atualizados;
    if (typeof objetoOrcamentoCorrente !== 'undefined' && objetoOrcamentoCorrente?.idDocumento === x.doc.idDocumento) objetoOrcamentoCorrente.producao = producao;
    atualizarProducao(); atualizarEtiquetas();
  };
  window.exportarProducaoCSV = function () {
    const linhas = itens().map(x => [numeroExibicao(x.doc),x.doc.cliente?.nome || '',x.item.ambiente || '',x.item.descPersiana || x.item.modelo || x.item.textoVoal || '',`${x.item.largura || 0} x ${x.item.altura || 0}`,x.entrega || '',x.costureira,x.status].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
    const blob = new Blob([['Pedido;Cliente;Ambiente;Produto;Medidas;Entrega;Costureira;Status',...linhas].join('\n')],{type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'producao-Michele Cortinas.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
})();
