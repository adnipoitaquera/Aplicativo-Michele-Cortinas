const MATERIAIS_PERSIANAS_PADRAO = [
    ['bando', 'Bandô de Encaixe', 80, '/m linear'],
    ['bando', 'Bandô de Parafuso', 80, '/m linear'],
    ['base-niveladora', 'Base Niveladora Encaixe', 35, '/m linear'],
    ['base-niveladora', 'Base Niveladora Parafuso', 35, '/m linear'],
    ['base-inferior', 'Base inferior Cônica', 35, '/m linear'],
    ['base-inferior', 'Base inferior Redonda', 30, '/m linear'],
    ['base-inferior', 'Base inferior da Double Vision', 40, '/m linear'],
    ['tubo', 'Tubo 32', 23, '/m linear'],
    ['tubo', 'Tubo 38', 35, '/m linear'],
    ['tubo', 'Tubo 41', 50, '/m linear'],
    ['tubo', 'Tubo 53', 80, '/m linear'],
    ['tampa-bando', 'Tampa do Bandô encaixe', 20, '/un.'],
    ['tampa-bando', 'Tampa do Bandô Parafuso', 20, '/un.'],
    ['tampa-base', 'Tampa da Base Cônica', 5, '/un.'],
    ['tampa-base', 'Tampa da Base redonda', 5, '/un.'],
    ['tampa-base', 'Tampa da Base Double Vision', 7.5, '/un.'],
    ['dupla-face', 'Dupla Face', 2, '/m linear'],
    ...[32, 38].flatMap(tamanho => ['Branco', 'Bege', 'Cinza', 'Preto'].map(cor => ['comandos', `Comando ${tamanho} ${cor}`, tamanho === 32 ? 50 : 60, '/un.', cor, String(tamanho)])),
    ['comandos', 'Comando 38 Branco com redução de Peso', 90, '/un.', 'Branco', '38-reducao']
].map(([tipoMaterial, nome, preco, unidade, cor, grupoComando], indice) => ({ materialId: `persiana-material-${indice + 1}`, tipoMaterial, nome, preco, unidade, ...(cor ? { cor, grupoComando } : {}) }));

function completarCatalogoMateriaisPersianas() {
    MATERIAIS_PERSIANAS_PADRAO.forEach(padrao => {
        const item = PRECOS_PERSIANA.find(item => item.materialId === padrao.materialId || normalizarNomeTecido(item.nome) === normalizarNomeTecido(padrao.nome));
        if (item) Object.assign(item, { ...padrao, ...item, materialId: padrao.materialId, tipoMaterial: padrao.tipoMaterial, unidade: padrao.unidade });
        else PRECOS_PERSIANA.push({ ...padrao });
    });
}

const CORES_MATERIAIS_PERSIANAS = {
    'cor-bando': ['Branco', 'Bege', 'Preto', 'Cinza'],
    'cor-base-niveladora': ['Branco', 'Preto'],
    'cor-base-inferior': ['Branco', 'Bege', 'Preto', 'Cinza'],
    'cor-comando': ['Branco', 'Bege', 'Preto', 'Cinza']
};

function preencherMaterialPersiana(select, tipo, padrao) {
    const anterior = select.selectedOptions[0];
    const nome = anterior?.textContent;
    const valor = anterior?.value;
    select.dataset.materialPersiana = tipo;
    select.replaceChildren(new Option('Nenhum', '0'));
    PRECOS_PERSIANA.filter(item => item.tipoMaterial === tipo).forEach(item => select.appendChild(new Option(item.nome, String(item.preco))));
    const indice = Array.from(select.options).findIndex(opcao => opcao.textContent === (padrao || nome));
    if (indice >= 0) select.selectedIndex = indice;
    else if (nome && Number(valor) > 0) {
        select.appendChild(new Option(nome.replace(/\s*-\s*R\$.*$/, ''), valor));
        select.selectedIndex = select.options.length - 1;
    }
}

function atualizarCatalogoCamposPersianas() {
    document.querySelectorAll('select[data-material-persiana]').forEach(select => preencherMaterialPersiana(select, select.dataset.materialPersiana));
}

function montarAcabamentosPersiana(sufixo) {
    const bando = document.getElementById(`persiana-bando-${sufixo}`);
    if (!bando || document.getElementById(`persiana-cor-bando-${sufixo}`)) return;
    bando.previousElementSibling.textContent = 'Bandô';
    preencherMaterialPersiana(bando, 'bando');
    const campos = [
        ['cor-bando', 'Cor do Bandô'], ['base-niveladora', 'Base Niveladora'], ['cor-base-niveladora', 'Cor da Base Niveladora'],
        ['base-inferior', 'Base Inferior'], ['cor-base-inferior', 'Cor da Base Inferior'], ['tubo', 'Tubo'], ['comandos', 'Comandos'], ['cor-comando', 'Cor do comando'],
        ['tampa-bando', 'Tampa do Bandô'], ['cor-tampa-bando', 'Cor da Tampa do Bandô'], ['tampa-base', 'Tampa da Base'], ['cor-tampa-base', 'Cor da Tampa da Base'], ['dupla-face', 'Dupla Face']
    ];
    bando.parentElement.insertAdjacentHTML('afterend', campos.map(([nome, titulo]) => `<div class="form-group"><label for="persiana-${nome}-${sufixo}">${titulo}</label><select id="persiana-${nome}-${sufixo}" disabled></select></div>`).join(''));
    campos.forEach(([nome]) => {
        const select = document.getElementById(`persiana-${nome}-${sufixo}`);
        if (CORES_MATERIAIS_PERSIANAS[nome] || ['cor-tampa-bando', 'cor-tampa-base'].includes(nome)) {
            select.appendChild(new Option('Selecione a cor', ''));
            (CORES_MATERIAIS_PERSIANAS[nome] || ['Branco', 'Bege', 'Preto', 'Cinza']).forEach(cor => select.appendChild(new Option(cor, cor)));
        } else preencherMaterialPersiana(select, nome, nome === 'tubo' ? 'Tubo 38' : nome === 'dupla-face' ? 'Dupla Face' : undefined);
    });
    const modelo = document.getElementById(`persiana-modelo-${sufixo}`);
    const selecionar = (tipo, nome) => {
        const select = document.getElementById(`persiana-${tipo}-${sufixo}`);
        if (!select) return;
        const indice = Array.from(select.options).findIndex(opcao => nome === '' ? opcao.value === '' : opcao.textContent === nome);
        if (indice >= 0) select.selectedIndex = indice;
    };
    const aplicarPadroes = () => {
        const descricao = String(modelo?.selectedOptions?.[0]?.textContent || '').replace(/\s*-\s*R\$.*$/, '').toLowerCase();
        const doubleVision = descricao.includes('double vision');
        const rolo = descricao.startsWith('rolo');
        if (!doubleVision && !rolo) return;
        selecionar('base-inferior', doubleVision ? 'Base inferior da Double Vision' : 'Base inferior Cônica');
        selecionar('tampa-base', doubleVision ? 'Tampa da Base Double Vision' : 'Tampa da Base Cônica');
        selecionar('comandos', 'Comando 38 Branco');
        selecionar('cor-comando', 'Branco');
        selecionar('tubo', 'Tubo 38');
        selecionar('bando', 'Bandô de Encaixe');
        selecionar('cor-bando', 'Branco');
        selecionar('tampa-bando', 'Tampa do Bandô encaixe');
        selecionar('cor-tampa-bando', 'Branco');
        selecionar('cor-tampa-base', 'Branco');
        selecionar('cor-base-niveladora', 'Branco');
        selecionar('cor-base-inferior', 'Branco');
        const tampaBase = document.getElementById(`persiana-tampa-base-${sufixo}`);
        if (tampaBase) Array.from(tampaBase.options).forEach(opcao => { opcao.disabled = doubleVision && opcao.textContent === 'Nenhum'; });
    };
    modelo?.addEventListener('change', () => { aplicarPadroes(); processarCalculoGeral(); });
    const mapa = { bando: 'acabamento', 'cor-bando': 'corBando', 'base-niveladora': 'baseNiveladora', 'cor-base-niveladora': 'corBaseNiveladora', 'base-inferior': 'baseInferior', 'cor-base-inferior': 'corBase', tubo: 'tipoTubo', comandos: 'comandos', 'cor-comando': 'corComando', 'tampa-bando': 'tampaBando', 'cor-tampa-bando': 'corTampaBando', 'tampa-base': 'tampaBase', 'cor-tampa-base': 'corTampaBase' };
    [bando, ...campos.map(([nome]) => document.getElementById(`persiana-${nome}-${sufixo}`))].forEach(select => {
        select.addEventListener('change', () => {
            const ambienteId = bando.closest('.item-carrinho-card').id.replace('item-card-', '');
            const acabamento = objetoOrcamentoCorrente?.materiaisPersianas?.[`${ambienteId}:${sufixo}`];
            const nome = select.id.slice('persiana-'.length, -(sufixo.length + 1));
            if(acabamento && mapa[nome]) delete acabamento[mapa[nome]];
            const comando = document.getElementById(`persiana-comandos-${sufixo}`);
            const cor = document.getElementById(`persiana-cor-comando-${sufixo}`);
            const item = PRECOS_PERSIANA.find(item => item.tipoMaterial === 'comandos' && item.nome === comando.selectedOptions[0]?.textContent);
            if (nome === 'bando' && String(select.value) === '0') {
                selecionar('base-niveladora', 'Base Niveladora Encaixe');
                selecionar('tampa-bando', 'Nenhum');
                selecionar('cor-tampa-bando', '');
                const corBando = document.getElementById(`persiana-cor-bando-${sufixo}`);
                if (corBando) corBando.value = '';
            }
            if (nome === 'bando' && String(select.value) !== '0') {
                selecionar('cor-bando', 'Branco');
                selecionar('tampa-bando', select.selectedOptions[0]?.textContent.includes('Parafuso') ? 'Tampa do Bandô Parafuso' : 'Tampa do Bandô encaixe');
                selecionar('cor-tampa-bando', 'Branco');
            }
            if (nome === 'base-niveladora' && String(select.value) !== '0') selecionar('cor-base-niveladora', 'Branco');
            if (nome === 'base-inferior' && String(select.value) !== '0') {
                selecionar('cor-base-inferior', 'Branco');
                const base = select.selectedOptions[0]?.textContent || '';
                selecionar('tampa-base', base.includes('Double Vision') ? 'Tampa da Base Double Vision' : base.includes('Cônica') ? 'Tampa da Base Cônica' : base.includes('Redonda') ? 'Tampa da Base redonda' : 'Nenhum');
                selecionar('cor-tampa-base', 'Branco');
            }
            if(nome === 'comandos') cor.value = item?.cor || '';
            if(nome === 'cor-comando' && item) {
                const variante = PRECOS_PERSIANA.find(outro => outro.grupoComando === item.grupoComando && outro.cor === cor.value);
                if(variante) comando.selectedIndex = Array.from(comando.options).findIndex(opcao => opcao.textContent === variante.nome);
                else cor.value = item.cor;
            }
            if(acabamento && ['comandos', 'cor-comando'].includes(nome)) { delete acabamento.comandos; delete acabamento.corComando; }
            processarCalculoGeral();
        });
    });
    aplicarPadroes();
}

function aplicarPadroesPersianaSeNecessario(sufixo) {
    const modelo = document.getElementById(`persiana-modelo-${sufixo}`);
    if (!modelo || typeof montarAcabamentosPersiana !== 'function') return;
    const descricao = String(modelo.selectedOptions?.[0]?.textContent || '').replace(/\s*-\s*R\$.*$/, '').toLowerCase();
    const doubleVision = descricao.includes('double vision');
    const rolo = descricao.startsWith('rolo');
    if (!doubleVision && !rolo) return;
    const nomes = {
        'base-inferior': doubleVision ? 'Base inferior da Double Vision' : 'Base inferior Cônica',
        'tampa-base': doubleVision ? 'Tampa da Base Double Vision' : 'Tampa da Base Cônica',
        comandos: 'Comando 38 Branco', 'cor-comando': 'Branco', tubo: 'Tubo 38', bando: 'Bandô de Encaixe', 'cor-bando': 'Branco', 'tampa-bando': 'Tampa do Bandô encaixe', 'cor-tampa-bando': 'Branco', 'cor-base-niveladora': 'Branco', 'cor-base-inferior': 'Branco', 'cor-tampa-base': 'Branco'
    };
    Object.entries(nomes).forEach(([tipo, nome]) => {
        const select = document.getElementById(`persiana-${tipo}-${sufixo}`);
        const indice = select && Array.from(select.options).findIndex(opcao => opcao.textContent === nome);
        if (select && indice >= 0) select.selectedIndex = indice;
    });
}

function calcularCustoMateriaisPersiana(selecionados, largura, quantidade) {
    const tubo = Math.max(0, largura - 0.025);
    const comprimentos = { bando: largura, 'base-niveladora': largura, 'base-inferior': tubo, tubo, 'dupla-face': tubo * 2, comandos: 1, 'tampa-bando': 2, 'tampa-base': 2 };
    return Object.entries(comprimentos).reduce((total, [tipo, consumo]) => {
        if (tipo === 'tampa-bando' && !Number(selecionados.bando)) return total;
        if (tipo === 'tampa-base' && !Number(selecionados['base-inferior'])) return total;
        return total + (Number(selecionados[tipo]) || 0) * consumo * quantidade;
    }, 0);
}

function custoMateriaisPersianaNoModulo(box, largura, quantidade) {
    const valores = {};
    box.querySelectorAll('[data-material-persiana]').forEach(select => valores[select.dataset.materialPersiana] = select.value);
    return calcularCustoMateriaisPersiana(valores, largura, quantidade);
}
