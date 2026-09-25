function obterLinhasMateriaisPersianas(pedido) {
    const ambientes = pedido.configuracaoAmbientes?.length ? pedido.configuracaoAmbientes
        : (pedido.itens || []).map((item, i) => ({ id: i + 1, estado: item.configuracao }));
    const linhas = [];
    ambientes.forEach((ambiente, indice) => {
        const campos = ambiente.estado?.campos || {};
        const nomeAmbiente = campos[`ambiente-nome-${ambiente.id}`]?.value || pedido.itens?.[indice]?.ambiente || `Ambiente ${indice + 1}`;
        Object.entries(campos).filter(([id, dado]) => /^chk-persiana-(?:sub-)?\d+$/.test(id) && dado.checked).forEach(([id]) => {
            const sufixo = id.replace('chk-persiana-', '');
            const modelo = campos[`persiana-modelo-${sufixo}`] || {};
            const descricao = (modelo.text || '').replace(/\s*-\s*R\$.*$/, '').trim();
            const partes = descricao.split(/\s+-\s+/);
            const bando = campos[`persiana-bando-${sufixo}`] || {};
            linhas.push({
                chave: `${ambiente.id}:${sufixo}`, ambiente: nomeAmbiente,
                largura: Number(campos[`persiana-largura-${sufixo}`]?.value) || 0,
                altura: Number(campos[`persiana-altura-${sufixo}`]?.value) || 0,
                quantidade: Number(campos[`persiana-qtd-${sufixo}`]?.value) || 1,
                modelo: partes[0] || '', tecido: partes.slice(1).join(' - '),
                acabamento: Number(bando.value) > 0 ? (bando.text || 'Bandô').replace(/\s*-\s*R\$.*$/, '') : 'Nenhum',
                corBando: /branco/i.test(bando.text || '') ? 'Branco' : /preto/i.test(bando.text || '') ? 'Preto' : '',
                cor: '', corBase: '', tampaBando: false, corTampaBando: '', tampaBase: false, corTampaBase: '', tipoTubo: 'Tubo 38', comandos: '', corComando: ''
            });
        });
    });
    return linhas.map(linha => {
        const dados = { ...linha };
        const [ambienteId, sufixo] = linha.chave.split(':');
        const campos = ambientes.find(ambiente => String(ambiente.id) === ambienteId)?.estado?.campos || {};
        const mapa = { 'cor-bando': 'corBando', 'base-niveladora': 'baseNiveladora', 'cor-base-niveladora': 'corBaseNiveladora', 'base-inferior': 'baseInferior', 'cor-base-inferior': 'corBase', 'tubo': 'tipoTubo', 'comandos': 'comandos', 'cor-comando': 'corComando', 'cor-tampa-bando': 'corTampaBando', 'cor-tampa-base': 'corTampaBase' };
        Object.entries(mapa).forEach(([campo, propriedade]) => {
            const salvo = campos[`persiana-${campo}-${sufixo}`];
            if (salvo) dados[propriedade] = ['base-niveladora', 'base-inferior', 'tubo', 'comandos'].includes(campo)
                ? (salvo.value === '0' ? 'Não' : (salvo.text || salvo.value).replace(/\s*-\s*R\$.*$/, '')) : salvo.value;
        });
        ['tampa-bando', 'tampa-base'].forEach((tipo, indice) => {
            const salvo = campos[`persiana-${tipo}-${sufixo}`];
            if(salvo) {
                dados[indice ? 'tampaBase' : 'tampaBando'] = Number(salvo.value) > 0;
                dados[indice ? 'tipoTampaBase' : 'tipoTampaBando'] = Number(salvo.value) > 0 ? salvo.text : '';
            }
        });
        const duplaFace = campos[`persiana-dupla-face-${sufixo}`];
        if(duplaFace) dados.duplaFaceAtiva = Number(duplaFace.value) > 0;
        return { ...dados, ...(pedido.materiaisPersianas?.[linha.chave] || {}) };
    });
}

function calcularMateriaisPersiana(linha) {
    const largura = Number(linha.largura), altura = Number(linha.altura);
    const modelo = normalizarNomeTecido(linha.modelo);
    const conhecido = /^(rolo|romana|double vision)(?:\s|$)/.test(modelo);
    const tubo = largura > 0.025 ? largura - 0.025 : null;
    return {
        tecidoLargura: conhecido && largura > 0.03 ? largura - 0.03 : null,
        tecidoAltura: conhecido && altura > 0 ? (/^double vision/.test(modelo) ? altura * 2 : altura) + 0.20 : null,
        bando: linha.acabamento !== 'Nenhum' && largura > 0 ? largura : null,
        niveladora: linha.baseNiveladora && !['Não', 'Nenhum'].includes(linha.baseNiveladora) && largura > 0 ? largura : null,
        tubo, base: linha.baseInferior === 'Não' ? null : tubo, duplaFace: tubo === null || linha.duplaFaceAtiva === false ? null : tubo * 2,
        tampaBando: linha.acabamento !== 'Nenhum' && linha.tampaBando ? 2 : 0,
        tampaBase: linha.baseInferior !== 'Não' && linha.tampaBase ? 2 : 0
    };
}

function medidaMaterialPersiana(valor) {
    return valor === null ? 'Não definido' : `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`;
}

function montarFichaMateriaisPersianas(pedido, editavel = true) {
    const esc = escaparHtmlProduto;
    const linhas = obterLinhasMateriaisPersianas(pedido);
    const campo = (titulo, valor) => `<div class="mp-campo"><strong>${titulo}</strong><div>${valor}</div></div>`;
    const fichas = linhas.map(linha => {
        const medidas = calcularMateriaisPersiana(linha);
        const resultado = (chave, valor) => `<span data-medida="${chave}">${valor}</span>`;
        const texto = (chave, titulo) => campo(titulo, editavel
            ? `<input aria-label="${titulo}" data-campo="${chave}" value="${esc(linha[chave] || '')}" onchange="salvarCampoMaterialPersiana(this)">`
            : esc(linha[chave] || 'Não informado'));
        const tampa = (chave, titulo, quantidade) => campo(titulo, editavel
            ? `<label><input type="checkbox" data-campo="${chave}" ${linha[chave] ? 'checked' : ''} onchange="salvarCampoMaterialPersiana(this)"> Incluir</label>${resultado(chave, `${quantidade} un.`)}`
            : `${quantidade} un.`);
        const tamanhoTecido = medidas.tecidoLargura === null || medidas.tecidoAltura === null ? 'Não definido'
            : `${medidaMaterialPersiana(medidas.tecidoLargura)} × ${medidaMaterialPersiana(medidas.tecidoAltura)}`;
        const opcoesBando = [...new Set(['Nenhum', linha.acabamento, ...(typeof PRECOS_PERSIANA === 'undefined' ? [] : PRECOS_PERSIANA.filter(item => item.tipoMaterial === 'bando').map(item => item.nome))])];
        const acabamento = editavel ? `<select aria-label="Bandô" data-campo="acabamento" onchange="salvarCampoMaterialPersiana(this)">${opcoesBando.map(nome => `<option ${linha.acabamento === nome ? 'selected' : ''}>${esc(nome)}</option>`).join('')}</select>` : esc(linha.acabamento);
        return `<section class="mp-peca" data-chave="${esc(linha.chave)}"><h3>${esc(linha.ambiente)}</h3><p>Medidas por peça</p><div class="mp-grade">
            ${campo('Largura', medidaMaterialPersiana(linha.largura))}${campo('Altura', medidaMaterialPersiana(linha.altura))}${campo('Quantidade', esc(linha.quantidade))}
            ${texto('modelo', 'Modelo da Persiana')}${texto('tecido', 'Tecido')}${campo('Tamanho do tecido', resultado('tecido', tamanhoTecido))}${texto('cor', 'Cor')}
            ${campo('Bandô', acabamento + `<div>${resultado('bando', medidas.bando === null ? '' : medidaMaterialPersiana(medidas.bando))}</div>`)}
            ${texto('corBando', 'Cor do Bandô')}${campo('Base Niveladora', esc(linha.baseNiveladora || 'Não informado') + (medidas.niveladora === null ? '' : `<div>${medidaMaterialPersiana(medidas.niveladora)}</div>`))}
            ${texto('corBaseNiveladora', 'Cor da Base Niveladora')}${texto('tipoTubo', 'Tubo')}${campo('Medida do Tubo', medidaMaterialPersiana(medidas.tubo))}${campo('Base Inferior', linha.baseInferior === 'Não' ? 'Não' : `${esc(linha.baseInferior || '')}<div>${medidaMaterialPersiana(medidas.base)}</div>`)}
            ${texto('comandos', 'Comandos')}${texto('corComando', 'Cor do comando')}
            ${texto('corBase', 'Cor da Base Inferior')}${campo('Dupla Face', medidaMaterialPersiana(medidas.duplaFace))}
            ${tampa('tampaBando', `Tampa do Bandô${linha.tipoTampaBando ? ' — ' + esc(linha.tipoTampaBando) : ''}`, medidas.tampaBando)}${texto('corTampaBando', 'Cor da Tampa do Bandô')}
            ${tampa('tampaBase', `Tampa da Base${linha.tipoTampaBase ? ' — ' + esc(linha.tipoTampaBase) : ''}`, medidas.tampaBase)}${texto('corTampaBase', 'Cor da Tampa da Base')}
        </div></section>`;
    }).join('');
    return `<h2>Materias para Persianas</h2><div class="mp-cabecalho">
        ${campo('Nome do cliente', esc(pedido.cliente?.nome || 'Cliente Avulso'))}${campo('Nº do pedido', esc(numeroExibicao(pedido)))}
        ${campo('Data do Pedido', esc(pedido.data || 'Não informada'))}${campo('Data da Entrega', esc(formatarDataMaterial(pedido.dataEntrega)))}
        </div>${fichas || '<p>Nenhuma persiana ativa neste pedido.</p>'}`;
}

function atualizarMateriaisPersianas() {
    const filtro = document.getElementById('mp-pedido');
    const atual = filtro.value;
    const termo = normalizarNomeTecido(document.getElementById('mp-busca').value);
    const disponiveis = pedidos.filter(p => p.tipo === 'Pedido' && normalizarNomeTecido(`${numeroExibicao(p)} ${p.cliente?.nome || ''}`).includes(termo));
    filtro.innerHTML = '<option value="">Selecione um pedido</option>' + disponiveis.map(p => `<option value="${escaparHtmlProduto(p.idDocumento)}">${escaparHtmlProduto(numeroExibicao(p))} — ${escaparHtmlProduto(p.cliente?.nome || 'Cliente Avulso')}</option>`).join('');
    filtro.value = disponiveis.some(p => p.idDocumento === atual) ? atual : '';
    const pedido = disponiveis.find(p => p.idDocumento === filtro.value);
    document.getElementById('mp-ficha').innerHTML = pedido ? montarFichaMateriaisPersianas(pedido) : '<p>Selecione um pedido para gerar a ficha de materiais.</p>';
    document.getElementById('mp-imprimir').disabled = !pedido || !obterLinhasMateriaisPersianas(pedido).length;
}

function salvarCampoMaterialPersiana(input) {
    const pedido = pedidos.find(p => p.idDocumento === document.getElementById('mp-pedido').value);
    if (!pedido) return;
    const chave = input.closest('[data-chave]').dataset.chave;
    const campo = input.dataset.campo;
    const permitidos = ['modelo', 'tecido', 'cor', 'acabamento', 'corBando', 'corBaseNiveladora', 'corBase', 'tampaBando', 'corTampaBando', 'tampaBase', 'corTampaBase', 'tipoTubo', 'comandos', 'corComando'];
    if (!permitidos.includes(campo)) return;
    const dados = JSON.parse(JSON.stringify(pedido.materiaisPersianas || {}));
    dados[chave] = { ...dados[chave], [campo]: input.type === 'checkbox' ? input.checked : input.value.trim() };
    const atualizados = pedidos.map(p => p === pedido ? { ...p, materiaisPersianas: dados } : p);
    try { localStorage.setItem('michele_pedidos', JSON.stringify(atualizados)); }
    catch (erro) { alert('Não foi possível salvar o acabamento. Verifique o armazenamento do navegador e tente novamente.'); return; }
    pedido.materiaisPersianas = dados;
    if (objetoOrcamentoCorrente?.idDocumento === pedido.idDocumento) objetoOrcamentoCorrente.materiaisPersianas = dados;
    const medidas = calcularMateriaisPersiana(obterLinhasMateriaisPersianas(pedido).find(linha => linha.chave === chave));
    const valores = {
        tecido: medidas.tecidoLargura === null || medidas.tecidoAltura === null ? 'Não definido' : `${medidaMaterialPersiana(medidas.tecidoLargura)} × ${medidaMaterialPersiana(medidas.tecidoAltura)}`,
        bando: medidas.bando === null ? '' : medidaMaterialPersiana(medidas.bando),
        tampaBando: `${medidas.tampaBando} un.`, tampaBase: `${medidas.tampaBase} un.`
    };
    input.closest('[data-chave]').querySelectorAll('[data-medida]').forEach(el => el.textContent = valores[el.dataset.medida]);
    document.getElementById('mp-status').textContent = 'Acabamento salvo no pedido.';
}

function imprimirMateriaisPersianas() {
    const pedido = pedidos.find(p => p.idDocumento === document.getElementById('mp-pedido').value);
    if (!pedido || !obterLinhasMateriaisPersianas(pedido).length) return;
    document.getElementById('area-impressao-persianas').innerHTML = montarFichaMateriaisPersianas(pedido, false);
    document.body.classList.add('imprimindo-persianas');
    window.print();
}
