const COMPRIMENTO_BARRA_ALUMINIO = 6;

function coletarCortesAluminioPersianas(termo = '', pedidoSelecionado = '') {
    const busca = normalizarNomeTecido(termo);
    const cortes = [];
    const adicionar = (pedido, linha, tipo, material, comprimento) => {
        const nome = String(material || '').trim();
        const medida = Number(comprimento) || 0;
        if (!nome || ['nenhum', 'não', 'nao'].includes(normalizarNomeTecido(nome)) || medida <= 0 || medida > COMPRIMENTO_BARRA_ALUMINIO) return;
        const texto = `${numeroExibicao(pedido)} ${pedido.cliente?.nome || ''} ${linha.ambiente} ${nome} ${tipo}`;
        if (busca && !normalizarNomeTecido(texto).includes(busca)) return;
        const quantidade = Math.max(1, Number(linha.quantidade) || 1);
        for (let indice = 1; indice <= quantidade; indice++) cortes.push({ pedido: numeroExibicao(pedido), cliente: pedido.cliente?.nome || 'Cliente Avulso', ambiente: linha.ambiente, tipo, material: nome, comprimento: medida, unidade: indice });
    };
    pedidos.filter(pedido => String(pedido.tipo || '').toLowerCase() === 'pedido' && (!pedidoSelecionado || pedidoSelecionado === '__todos__' || pedido.idDocumento === pedidoSelecionado)).forEach(pedido => {
        let linhas = obterLinhasMateriaisPersianas(pedido);
        // Compatibilidade com pedidos antigos: a configuração pode estar apenas em cada item.
        if (!linhas.length && (pedido.itens || []).some(item => item.configuracao)) {
            linhas = obterLinhasMateriaisPersianas({ ...pedido, configuracaoAmbientes: undefined });
        }
        linhas.forEach(linha => {
            adicionar(pedido, linha, 'Bandô', linha.acabamento, linha.largura);
            adicionar(pedido, linha, 'Base Niveladora', linha.baseNiveladora, linha.largura);
            adicionar(pedido, linha, 'Base Inferior', linha.baseInferior, linha.largura);
        });
    });
    return cortes;
}

function organizarBarrasUnificadas(cortes) {
    const ordenados = [...cortes].sort((a, b) => b.comprimento - a.comprimento);
    const limiteBusca = 45;
    let melhor = null;
    if (ordenados.length <= limiteBusca) {
        const minimo = Math.max(1, Math.ceil((ordenados.reduce((total, corte) => total + corte.comprimento, 0) - 1e-9) / COMPRIMENTO_BARRA_ALUMINIO));
        const tentativa = quantidade => {
            const capacidades = Array(quantidade).fill(COMPRIMENTO_BARRA_ALUMINIO);
            const grupos = Array.from({ length: quantidade }, () => []);
            const procurar = indice => {
                if (indice === ordenados.length) return true;
                const corte = ordenados[indice], usadas = new Set();
                for (let barra = 0; barra < quantidade; barra++) {
                    const capacidade = Number(capacidades[barra].toFixed(6));
                    if (capacidade + 1e-9 < corte.comprimento || usadas.has(capacidade)) continue;
                    usadas.add(capacidade);
                    capacidades[barra] -= corte.comprimento;
                    grupos[barra].push(corte);
                    if (procurar(indice + 1)) return true;
                    grupos[barra].pop();
                    capacidades[barra] += corte.comprimento;
                }
                return false;
            };
            return procurar(0) ? grupos.map((grupo, indice) => ({ numero: indice + 1, cortes: [...grupo], usado: grupo.reduce((total, corte) => total + corte.comprimento, 0), sobra: COMPRIMENTO_BARRA_ALUMINIO - grupo.reduce((total, corte) => total + corte.comprimento, 0) })) : null;
        };
        for (let quantidade = minimo; quantidade <= ordenados.length; quantidade++) {
            melhor = tentativa(quantidade);
            if (melhor) break;
        }
    }
    if (!melhor) {
        melhor = [];
        ordenados.forEach(corte => {
            let escolhida = melhor.filter(barra => barra.sobra + 1e-9 >= corte.comprimento).sort((a, b) => a.sobra - b.sobra)[0];
            if (!escolhida) { escolhida = { numero: melhor.length + 1, cortes: [], usado: 0, sobra: COMPRIMENTO_BARRA_ALUMINIO }; melhor.push(escolhida); }
            escolhida.cortes.push(corte); escolhida.usado += corte.comprimento; escolhida.sobra -= corte.comprimento;
        });
    }
    melhor.forEach(barra => barra.cortes.forEach((corte, indice) => { corte.posicao = indice + 1; }));
    const barras = melhor;
    barras.forEach(barra => { barra.usado = Number(barra.usado.toFixed(3)); barra.sobra = Number(Math.max(0, barra.sobra).toFixed(3)); });
    return barras;
}

function organizarBarrasAluminio(cortes) {
    const grupos = new Map();
    cortes.forEach(corte => {
        const chave = `${corte.tipo || ''} — ${corte.material || 'Material não informado'}`;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(corte);
    });
    const barras = [];
    grupos.forEach((itens, grupo) => organizarBarrasUnificadas(itens).forEach(barra => barras.push({ ...barra, grupo })));
    return barras;
}

function htmlPlanoCortePersianas(cortes, barras) {
    const esc = escaparHtmlProduto;
    const total = cortes.reduce((soma, corte) => soma + corte.comprimento, 0);
    const desperdicio = barras.reduce((soma, barra) => soma + barra.sobra, 0);
    const resumo = `<div class="pc-resumo"><div><strong>Barras de 6,00 m</strong><span>${barras.length}</span></div><div><strong>Alumínio utilizado</strong><span>${total.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m</span></div><div><strong>Sobra total</strong><span>${desperdicio.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m</span></div><div><strong>Cortes</strong><span>${cortes.length}</span></div></div>`;
    const grupos = [...new Set(barras.map(barra => barra.grupo || 'Alumínio'))];
    const lista = grupos.map(grupo => {
        const barrasGrupo = barras.filter(barra => (barra.grupo || 'Alumínio') === grupo);
        return `<div class="pc-material-grupo"><h3>${esc(grupo)} — ${barrasGrupo.length} barra${barrasGrupo.length === 1 ? '' : 's'}</h3>${barrasGrupo.map(barra => `<section class="pc-barra"><div class="pc-barra-cabecalho"><strong>Barra ${barra.numero}</strong><span>Uso: ${barra.usado.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m · Sobra: ${barra.sobra.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m</span></div><div class="pc-cortes">${barra.cortes.map(corte => `<div class="pc-corte"><strong>${esc(corte.comprimento.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' m')}</strong><span>${esc(corte.tipo)} — ${esc(corte.material)}</span><small>${esc(corte.pedido)} · ${esc(corte.cliente)} · ${esc(corte.ambiente)} · peça ${corte.unidade}</small></div>`).join('')}</div></section>`).join('')}</div>`;
    }).join('');
    return `${resumo}<div class="pc-legenda">Cada corte abaixo representa uma peça. A ordem dos cortes é a sequência sugerida para cada barra de 6,00 m.</div>${lista || '<p class="plano-corte-vazio">Nenhum alumínio encontrado.</p>'}`;
}

function atualizarPlanoCortePersianas() {
    const termo = document.getElementById('pc-busca')?.value || '';
    const seletor = document.getElementById('pc-pedido');
    const pedidoAnterior = seletor?.value || '';
    const pedidosDisponiveis = pedidos.filter(pedido => String(pedido.tipo || '').toLowerCase() === 'pedido').filter(pedido => !termo || normalizarNomeTecido(`${numeroExibicao(pedido)} ${pedido.cliente?.nome || ''}`).includes(normalizarNomeTecido(termo)));
    if (seletor) {
        seletor.innerHTML = '<option value="">Selecione um pedido</option><option value="__todos__">Total geral — todos os pedidos</option>' + pedidosDisponiveis.map(pedido => `<option value="${escaparHtmlProduto(pedido.idDocumento)}">${escaparHtmlProduto(numeroExibicao(pedido))} — ${escaparHtmlProduto(pedido.cliente?.nome || 'Cliente Avulso')}</option>`).join('');
        seletor.value = pedidosDisponiveis.some(pedido => pedido.idDocumento === pedidoAnterior) || pedidoAnterior === '__todos__' ? pedidoAnterior : '';
    }
    const selecionado = seletor?.value || '';
    const cortes = selecionado ? coletarCortesAluminioPersianas('', selecionado) : [];
    const barras = organizarBarrasAluminio(cortes);
    const lista = document.getElementById('pc-lista');
    if (lista) lista.innerHTML = htmlPlanoCortePersianas(cortes, barras);
    const status = document.getElementById('pc-status');
    if (status) status.textContent = !selecionado ? 'Selecione um pedido ou o total geral para montar o plano de corte.' : cortes.length ? `${cortes.length} corte${cortes.length === 1 ? '' : 's'} distribuído${cortes.length === 1 ? '' : 's'} em ${barras.length} barra${barras.length === 1 ? '' : 's'}.` : 'Nenhum corte de alumínio encontrado nesse pedido.';
    const resumo = document.getElementById('pc-resumo');
    if (resumo) resumo.innerHTML = cortes.length ? htmlPlanoCortePersianas(cortes, barras).split('<div class="pc-legenda">')[0] : '';
    const imprimir = document.getElementById('pc-imprimir');
    if (imprimir) imprimir.disabled = !cortes.length;
}

function imprimirPlanoCortePersianas() {
    const cortes = coletarCortesAluminioPersianas('', document.getElementById('pc-pedido')?.value || '');
    if (!cortes.length) return;
    const barras = organizarBarrasAluminio(cortes);
    document.getElementById('area-impressao-plano-corte').innerHTML = `<h1>Plano de Corte de Persianas</h1>${htmlPlanoCortePersianas(cortes, barras)}`;
    document.body.classList.add('imprimindo-plano-corte');
    imprimirComRetorno();
}
