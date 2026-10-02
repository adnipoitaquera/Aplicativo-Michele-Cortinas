function coletarCortesTubosTrilhos(termo = '') {
    const busca = normalizarNomeTecido(termo), cortes = [];
    pedidos.filter(pedido => pedido.tipo === 'Pedido').forEach(pedido => (pedido.itens || []).forEach(item => {
        const materiais = obterMateriaisAmbiente(item);
        const comprimento = Number(materiais.trilhoTamanho) || 0;
        const quantidade = Math.max(1, Number(materiais.trilhoQtd) || 1);
        if (!comprimento || comprimento > COMPRIMENTO_BARRA_ALUMINIO) return;
        const texto = `${numeroExibicao(pedido)} ${pedido.cliente?.nome || ''} ${item.ambiente || ''} ${materiais.nomeTrilho || ''}`;
        if (busca && !normalizarNomeTecido(texto).includes(busca)) return;
        for (let unidade = 1; unidade <= quantidade; unidade++) cortes.push({ pedido: numeroExibicao(pedido), cliente: pedido.cliente?.nome || 'Cliente Avulso', ambiente: item.ambiente || 'Ambiente', tipo: 'Tubo / Trilho', material: materiais.nomeTrilho || 'Tubo / Trilho', comprimento, unidade });
    }));
    return cortes;
}

function atualizarPlanoCorteTubosTrilhos() {
    const cortes = coletarCortesTubosTrilhos(document.getElementById('pct-busca')?.value || ''), barras = organizarBarrasAluminio(cortes);
    const conteudo = htmlPlanoCortePersianas(cortes, barras);
    document.getElementById('pct-lista').innerHTML = conteudo;
    document.getElementById('pct-resumo').innerHTML = cortes.length ? conteudo.split('<div class="pc-legenda">')[0] : '';
    document.getElementById('pct-status').textContent = cortes.length ? `${cortes.length} corte${cortes.length === 1 ? '' : 's'} distribuído${cortes.length === 1 ? '' : 's'} em ${barras.length} barra${barras.length === 1 ? '' : 's'}.` : 'Nenhum tubo ou trilho encontrado.';
    document.getElementById('pct-imprimir').disabled = !cortes.length;
}

function imprimirPlanoCorteTubosTrilhos() {
    const cortes = coletarCortesTubosTrilhos(document.getElementById('pct-busca')?.value || '');
    if (!cortes.length) return;
    const barras = organizarBarrasAluminio(cortes);
    document.getElementById('area-impressao-plano-corte').innerHTML = `<h1>Plano de Corte de Tubos e Trilhos</h1>${htmlPlanoCortePersianas(cortes, barras)}`;
    document.body.classList.add('imprimindo-plano-corte');
    imprimirComRetorno();
}
