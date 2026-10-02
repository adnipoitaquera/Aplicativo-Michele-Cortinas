(function () {
  'use strict';
  const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el = id => document.getElementById(id);
  const textoImpressao = valor => {
    const texto = String(valor ?? '').trim();
    return !texto || /^(?:selecionar|selecione)(?:\b|\.{3})/i.test(texto) || /^(?:não informado|não informada)$/i.test(texto) || /não selecionad[oa]/i.test(texto) ? '—' : texto;
  };
  const config = () => JSON.parse(dadosStorage.getItem('michele_config_empresa') || '{}');
  const costureiras = () => config().costureiras || [];
  window.listarCostureirasOrcamento = () => costureiras().filter(c=>c.status === 'Ativa');
  window.selecionarCostureiraOrcamento = function(id) {
    const c=costureiras().find(c=>c.id === el(`costureira-id-${id}`)?.value);
    el(`costureira-valor-${id}`).value = c?.valorAltura ?? 45;
    processarCalculoGeral();
  };
  let editando = '', pedidoAtual = '';
  const campos = [
    ['largura','Largura (m)'], ['altura','Altura (m)'], ['modelo','Modelo'],
    ['cabecoteModelo','Modelo do cabeçote'],
    ['barraTamanho','Tamanho da barra'],
    ['acabada','Acabada', ['','Sim','Não']],
    ['invertido','É invertido?', ['Não','Sim']], ['cortineiro','Tem cortineiro?', ['Não','Sim']],
    ['tecido','Descrição do tecido'], ['desconto','Dar desconto na altura?', ['Não','Sim']],
    ['trilho','Tipo de tubo / trilho'], ['rodizio','Tipo de rodízio'], ['abertura','Abertura']
  ];
  function autorizado() {
    if (usuarioEhAdministrador()) return true;
    alert('Acesso restrito. Somente o Administrador pode acessar esta área.');
    return false;
  }
  function campo(id, nome, valor = '', opcoes) {
    return `<div class="form-group"><label for="${id}">${nome}</label>${opcoes ? `<select id="${id}">${opcoes.map(o => `<option${o === valor ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input id="${id}" value="${esc(valor)}">`}</div>`;
  }
  window.atualizarCostureiras = function () {
    el('cost-lista').innerHTML = costureiras().map((c, i) => `<tr><td>${esc(c.nome)}</td><td>${esc(c.telefone)}</td><td>${esc(c.email)}</td><td>${esc(c.status)}</td><td>${Number(c.valorAltura ?? 45).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td><button class="btn" onclick="editarCostureira(${i})">Editar</button></td></tr>`).join('') || '<tr><td colspan="6">Nenhuma costureira cadastrada.</td></tr>';
  };
  window.limparCostureira = function () { editando = ''; el('cost-form').reset(); };
  window.editarCostureira = function (i) {
    if (!autorizado()) return;
    const c = costureiras()[i]; if (!c) return;
    editando = c.id;
    ['nome','telefone','email','status','observacoes'].forEach(k => el('cost-' + k).value = c[k] || '');
    if(el('cost-valor-altura')) el('cost-valor-altura').value = c.valorAltura ?? 45;
  };
  window.salvarCostureira = function () {
    if (!autorizado() || !el('cost-form').reportValidity()) return;
    const c = {id: editando || crypto.randomUUID()};
    ['nome','telefone','email','status','observacoes'].forEach(k => c[k] = el('cost-' + k).value.trim());
    if (!c.nome) { alert('Informe o nome da costureira.'); return; }
    const valor = el('cost-valor-altura')?.value ?? '45';
    c.valorAltura = Number(valor);
    if (valor === '' || !Number.isFinite(c.valorAltura) || c.valorAltura < 0) { alert('Informe um valor por altura válido.'); return; }
    const dados = config(), lista = costureiras(), indice = lista.findIndex(x => x.id === c.id);
    dados.costureiras = indice < 0 ? [...lista, c] : lista.map(x => x.id === c.id ? c : x);
    try { dadosStorage.setItem('michele_config_empresa', JSON.stringify(dados)); }
    catch (erro) { alert('Não foi possível salvar: ' + erro.message); return; }
    limparCostureira(); atualizarCostureiras(); avisarGravacao('Costureira salva.');
  };
  window.buscarPedidosConfeccao = function () {
    const termo = el('conf-busca').value.trim().toLocaleLowerCase('pt-BR');
    const lista = pedidos.filter(p => p.tipo === 'Pedido' && `${numeroExibicao(p)} ${p.cliente?.nome || ''}`.toLocaleLowerCase('pt-BR').includes(termo));
    const anterior = el('conf-pedido').value;
    el('conf-pedido').innerHTML = '<option value="">Selecione um pedido</option>' + lista.map(p => `<option value="${esc(p.idDocumento)}">${esc(numeroExibicao(p))} — ${esc(p.cliente?.nome || 'Cliente Avulso')}</option>`).join('');
    el('conf-pedido').value = anterior;
    el('conf-resultado').textContent = lista.length ? `${lista.length} pedido(s) encontrado(s).` : 'Nenhum pedido encontrado.';
  };
  function dadosItem(item) {
    const m = obterMateriaisAmbiente(item), estado = item.configuracao || {}, id = m.idAmbiente;
    const ler = (nome, padrao = '') => campoMaterial(estado, nome + '-' + id, padrao);
    return {largura:m.largura, altura:m.alturaParede, modelo:m.modelo,
      cabecoteModelo:ler('cortina-cabecote-tipo'),
      barraTamanho:ler('cortina-barra'),
      acabada:ler('cortina-acabada'),
      invertido:item.calculoCortina?.avisos?.length || ['voal','forro','terceiro'].some(t => ler('cortina-inverter-' + t) === 'Sim') ? 'Sim' : 'Não',
      cortineiro:ler('bando','Não'), tecido:[item.textoVoal, item.textoForro, item.textoTerceiro].filter(Boolean).join(' / ') || m.nomePrincipal,
      desconto:m.desconto, trilho:m.nomeTrilho, rodizio:textoMaterial(estado,'select-rodizio-' + id), abertura:ler('abertura',item.abertura || '')};
  }
  window.inserirPedidoConfeccao = function () {
    if (!autorizado()) return;
    const p = pedidos.find(p => p.tipo === 'Pedido' && p.idDocumento === el('conf-pedido').value);
    if (!p) { alert('Selecione um pedido.'); return; }
    pedidoAtual = p.idDocumento;
    const responsavel = p.itens?.find(i=>i.costureiraId)?.costureiraId || '';
    const ficha = p.confeccao || {costureiraId:responsavel}, lista = costureiras().filter(c => c.status === 'Ativa' || c.id === ficha.costureiraId);
    el('conf-costureira').innerHTML = '<option value="">Selecione a costureira responsável</option>' + lista.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
    el('conf-costureira').value = ficha.costureiraId || '';
    el('conf-identificacao').textContent = `Pedido ${numeroExibicao(p)} — ${p.cliente?.nome || 'Cliente Avulso'} | Data do pedido: ${p.data || 'Não informada'}`;
    el('conf-entrega').value = ficha.dataEntrega ?? p.dataEntrega ?? '';
    el('conf-itens').innerHTML = (p.itens || []).map((item, i) => {
      if (item.cortinaAtiva === false || (item.cortinaAtiva !== true && (item.tipo === 'persiana' || item.descPersiana))) return '';
      const dados = {...dadosItem(item), ...ficha.itens?.[i]};
      return `<section class="conf-item" data-indice="${i}"><h3>${esc(item.ambiente || 'Cortina')} — Quantidade: ${esc(item.quantidade || 1)}</h3><div class="grid-forms">${campos.map(([k,n,o]) => campo(`conf-${i}-${k}`,n,dados[k],o)).join('')}</div></section>`;
    }).join('');
    el('conf-editor').hidden = false;
    el('conf-vazio').textContent = el('conf-itens').children.length ? '' : 'Este pedido não possui cortinas para confecção.';
  };
  window.salvarConfeccao = function (silencioso = false, enviar = false) {
    if (!autorizado()) return false;
    const p = pedidos.find(p => p.idDocumento === pedidoAtual && p.tipo === 'Pedido');
    const c = costureiras().find(c => c.id === el('conf-costureira').value);
    if (!p || !c || !el('conf-itens').children.length) { alert('Insira um pedido com cortinas e selecione a costureira responsável.'); return false; }
    const itens = {};
    for (const secao of el('conf-itens').children) {
      const i = secao.dataset.indice; itens[i] = {};
      for (const [k] of campos) itens[i][k] = el(`conf-${i}-${k}`).value.trim();
      for (const k of ['largura','altura']) {
        const valor = Number(itens[i][k].replace(',','.'));
        if (!Number.isFinite(valor) || valor <= 0) { alert('Informe largura e altura maiores que zero em todas as cortinas.'); return false; }
      }
    }
    const valorAltura = Number(c.valorAltura ?? 45);
    const ficha = {costureiraId:c.id, costureiraNome:c.nome, valorAltura, dataEntrega:el('conf-entrega').value, itens};
    const itensPedido = (p.itens || []).map((item,i)=>{
      if (!itens[i]) return item;
      return {...item,costureiraId:c.id,costureiraNome:c.nome,...(item.rentabilidade ? {rentabilidade:item.rentabilidade.map(m=>String(m.nome).includes('Mão de obra de confecção') ? {...m,custoUnitario:valorAltura,custoTotal:Number(m.quantidade)*valorAltura} : m)} : {})};
    });
    const producao = {...p.producao};
    if (enviar) Object.keys(itens).forEach(i => producao[i] = 'Em confecção');
    const atualizados = pedidos.map(x => x === p ? {...x, itens:itensPedido, confeccao:ficha, ...(enviar ? {producao} : {})} : x);
    try { dadosStorage.setItem('michele_pedidos', JSON.stringify(atualizados)); }
    catch (erro) { alert('Não foi possível salvar: ' + erro.message); return false; }
    pedidos = atualizados;
    if (typeof objetoOrcamentoCorrente !== 'undefined' && objetoOrcamentoCorrente?.idDocumento === p.idDocumento) {
      objetoOrcamentoCorrente.confeccao = ficha;
      objetoOrcamentoCorrente.itens = itensPedido;
      if (enviar) objetoOrcamentoCorrente.producao = producao;
    }
    if (enviar) atualizarProducao();
    if (!silencioso) avisarGravacao('Ficha de confecção salva.');
    return true;
  };
  window.enviarParaCostureira = function () {
    if (salvarConfeccao(true, true)) avisarGravacao('Pedido enviado para a costureira. Status: Em confecção.');
  };
  window.imprimirConfeccao = function () {
    if (!salvarConfeccao(true)) return;
    const p = pedidos.find(p => p.idDocumento === pedidoAtual), f = p.confeccao;
    const primeiroNome = String(p.cliente?.nome || '').trim().split(/\s+/)[0] || '—';
    el('conf-impressao').innerHTML = `<h1>Confecção de cortinas</h1><p><strong>Costureira responsável:</strong> ${esc(f.costureiraNome)}</p><p><strong>Número do pedido:</strong> ${esc(numeroExibicao(p))}<br><strong>Cliente:</strong> ${esc(primeiroNome)}<br><strong>Data do pedido:</strong> ${esc(p.data || 'Não informada')}<br><strong>Data da entrega:</strong> ${esc(formatarDataMaterial(f.dataEntrega))}</p>` + Object.entries(f.itens).map(([i,d]) => `<section><h2>${esc(p.itens[i].ambiente || 'Cortina')} — Quantidade: ${esc(p.itens[i].quantidade || 1)}</h2><dl>${campos.map(([k,n]) => `<div><dt>${n}</dt><dd>${esc(textoImpressao(d[k]))}</dd></div>`).join('')}</dl></section>`).join('');
    document.body.classList.add('imprimindo-confeccao');
    imprimirComRetorno();
  };
  window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo-confeccao'));
})();
