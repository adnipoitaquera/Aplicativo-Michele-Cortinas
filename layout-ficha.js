// Reorganiza os campos existentes sem duplicar IDs ou alterar os cálculos.
function organizarFichaAmbiente(card, id) {
    const corpo = card.querySelector(`#corpo-cortina-${id}`);
    if (!corpo || corpo.classList.contains('ficha-grade')) return;
    const filhos = Array.from(corpo.children);
    const secoes = [];
    let secao = null;
    filhos.forEach(elemento => {
        if (elemento.classList.contains('secao-titulo')) {
            secao = document.createElement('section');
            secao.className = 'ficha-secao';
            secao.id = `ficha-${id}-secao-${secoes.length}`;
            corpo.insertBefore(secao, elemento);
            secoes.push(secao);
        }
        if (secao) secao.appendChild(elemento);
        else elemento.classList.add('ficha-introducao');
    });
    corpo.classList.add('ficha-grade');
    const nomes = ['Medidas e instalação', 'Tecidos e modelos', 'Acessórios', 'Motorização'];
    const moduloPersiana = card.querySelector(`#container-persianas-${id}`)?.parentElement;
    if (moduloPersiana) {
        moduloPersiana.id = `ficha-${id}-persianas`;
        secoes.push(moduloPersiana);
        nomes.push('Persianas');
    }
    const atalhos = document.createElement('nav');
    atalhos.className = 'ficha-navegacao';
    atalhos.setAttribute('aria-label', 'Seções da ficha do ambiente');
    secoes.forEach((painel, indice) => {
        const titulo = painel.querySelector('.secao-titulo span');
        const nome = nomes[indice] || titulo?.textContent || 'Detalhes';
        if (titulo) titulo.textContent = nome;
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn';
        botao.textContent = nome;
        botao.setAttribute('aria-controls', painel.id);
        botao.addEventListener('click', () => {
            painel.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            painel.tabIndex = -1;
            painel.focus({ preventScroll: true });
        });
        atalhos.appendChild(botao);
    });
    const cabecalho = card.querySelector('.item-header');
    if (cabecalho) {
        cabecalho.querySelector('.item-titulo').textContent = `Ficha da cortina · Ambiente ${id}`;
        cabecalho.after(atalhos);
    }
    card.classList.add('ficha-ambiente');
    criarJanelaAmbiente(card, id);
}

function adicionarAmbienteNaFicha() {
    adicionarItemOrcamentoPadrao();
    abrirFichaAmbiente(contadorItensId);
}

function criarJanelaAmbiente(card, id) {
    const conteudo = card.querySelector('.ambiente-conteudo');
    const janela = document.createElement('dialog');
    janela.className = 'editor-ambiente';
    janela.setAttribute('aria-labelledby', `editor-titulo-${id}`);
    const topo = document.createElement('header');
    topo.className = 'editor-topo';
    topo.innerHTML = `<div><small>CONFIGURAÇÃO DO AMBIENTE</small><h2 id="editor-titulo-${id}">Editar ambiente</h2></div><div class="editor-controles"><button type="button" class="btn editor-anterior" aria-label="Editar ambiente anterior">← Anterior</button><button type="button" class="btn editor-proximo" aria-label="Editar próximo ambiente">Próximo →</button><button type="button" class="btn editor-fechar" aria-label="Fechar edição do ambiente">✕</button></div>`;
    topo.querySelector('.editor-fechar').onclick = () => janela.close();
    const navegar = direcao => {
        const cards = Array.from(document.querySelectorAll('.item-carrinho-card'));
        const destino = cards[cards.indexOf(card) + direcao];
        if (destino) abrirFichaAmbiente(destino.id.replace('item-card-', ''));
    };
    topo.querySelector('.editor-anterior').onclick = () => navegar(-1);
    topo.querySelector('.editor-proximo').onclick = () => navegar(1);
    const abas = document.createElement('div');
    abas.className = 'editor-abas';
    abas.setAttribute('role', 'tablist');
    abas.setAttribute('aria-label', 'Edição e conferência');
    const configuracao = document.createElement('div');
    configuracao.id = `editor-config-${id}`;
    configuracao.className = 'editor-painel';
    const materiais = document.createElement('div');
    materiais.id = `editor-materiais-${id}`;
    materiais.className = 'editor-painel editor-materiais';
    materiais.hidden = true;
    const paineis = [configuracao, materiais];
    ['Configuração', 'Materiais e custos'].forEach((nome, indice) => {
        const aba = document.createElement('button');
        aba.type = 'button';
        aba.id = `editor-aba-${id}-${indice}`;
        aba.textContent = nome;
        aba.setAttribute('role', 'tab');
        aba.setAttribute('aria-controls', paineis[indice].id);
        aba.setAttribute('aria-selected', String(indice === 0));
        aba.tabIndex = indice === 0 ? 0 : -1;
        paineis[indice].setAttribute('role', 'tabpanel');
        paineis[indice].setAttribute('aria-labelledby', aba.id);
        aba.onclick = () => {
            paineis.forEach((painel, n) => { painel.hidden = n !== indice; });
            Array.from(abas.children).forEach((botao, n) => {
                botao.setAttribute('aria-selected', String(n === indice));
                botao.tabIndex = n === indice ? 0 : -1;
            });
            atualizarMateriaisDaFicha(id);
        };
        aba.onkeydown = e => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const proximo = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - indice;
            abas.children[proximo].click();
            abas.children[proximo].focus();
        };
        abas.appendChild(aba);
    });
    const acoes = conteudo.querySelector('.ficha-acoes');
    acoes.querySelector('button:last-child').textContent = 'Voltar ao pedido';
    const nota = document.createElement('p');
    nota.className = 'editor-nota';
    nota.textContent = 'As alterações entram no orçamento em edição. Use Salvar ambiente para gravar o documento.';
    configuracao.appendChild(conteudo);
    janela.append(topo, abas, configuracao, materiais, nota, acoes);
    card.appendChild(janela);
    const resumo = card.querySelector('.ambiente-resumo');
    resumo.setAttribute('role', 'button');
    resumo.setAttribute('tabindex', '0');
    resumo.setAttribute('aria-haspopup', 'dialog');
    resumo.setAttribute('aria-label', `Editar ambiente ${id}`);
    resumo.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFichaAmbiente(id); }
    };
    resumo.querySelector('.ambiente-seta').textContent = 'Editar →';
    janela.addEventListener('close', () => {
        atualizarResumoAmbiente(id);
        processarCalculoGeral();
        resumo.focus();
    });
    janela.addEventListener('input', () => queueMicrotask(() => atualizarMateriaisDaFicha(id, false)));
    janela.addEventListener('change', () => queueMicrotask(() => atualizarMateriaisDaFicha(id, false)));
}

function abrirFichaAmbiente(id) {
    const card = document.getElementById(`item-card-${id}`);
    const janela = card?.querySelector('.editor-ambiente');
    if (!janela) return;
    document.querySelectorAll('.editor-ambiente[open]').forEach(outra => { if (outra !== janela) outra.close(); });
    janela.querySelector('h2').textContent = document.getElementById(`ambiente-nome-${id}`).value.trim() || `Ambiente ${id}`;
    const cards = Array.from(document.querySelectorAll('.item-carrinho-card'));
    janela.querySelector('.editor-anterior').disabled = cards.indexOf(card) === 0;
    janela.querySelector('.editor-proximo').disabled = cards.indexOf(card) === cards.length - 1;
    janela.querySelector('[role="tab"]').click();
    if (!janela.open) janela.showModal();
}

function revisarAmbientesNaFicha() {
    const cards = Array.from(document.querySelectorAll('.item-carrinho-card'));
    const pendente = cards.find(card => {
        const id = card.id.replace('item-card-', '');
        const cortinaAtiva = document.getElementById(`chk-cortina-${id}`).checked;
        return !document.getElementById(`ambiente-nome-${id}`).value.trim() || (cortinaAtiva && ['largura', 'altura', 'quantidade'].some(campo => Number(document.getElementById(`${campo}-${id}`).value) <= 0));
    }) || cards[0];
    if (pendente) abrirFichaAmbiente(pendente.id.replace('item-card-', ''));
}

function atualizarMateriaisDaFicha(id, recalcular = true) {
    if (recalcular) processarCalculoGeral();
    const painel = document.getElementById(`editor-materiais-${id}`);
    if (!painel || painel.hidden) return;
    const item = objetoOrcamentoCorrente?.itens.find(item => Number(item.id) === Number(id));
    painel.replaceChildren();
    const titulo = document.createElement('h3');
    titulo.textContent = 'Composição do ambiente';
    const explicacao = document.createElement('p');
    explicacao.textContent = 'Quantidades e custos calculados a partir dos tecidos, componentes e serviços selecionados.';
    painel.append(titulo, explicacao);
    if (!item?.materiais?.length) {
        const vazio = document.createElement('p');
        vazio.className = 'editor-vazio';
        vazio.textContent = 'Preencha as medidas, a quantidade e os materiais na aba Configuração para conferir o cálculo.';
        painel.appendChild(vazio);
        return;
    }
    const rolagem = document.createElement('div');
    rolagem.className = 'tabela-scroll';
    const tabela = document.createElement('table');
    tabela.innerHTML = '<thead><tr><th>Material / serviço</th><th>Quantidade</th><th>Unidade</th><th>Unitário</th><th>Total</th></tr></thead>';
    const corpo = document.createElement('tbody');
    const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    item.materiais.forEach(material => {
        const linha = document.createElement('tr');
        [material.nome, Number(material.quantidade).toLocaleString('pt-BR', {maximumFractionDigits: 2}), material.unidade, moeda(material.valorUnitario), moeda(material.valorTotal)].forEach(valor => {
            const celula = document.createElement('td');
            celula.textContent = valor;
            linha.appendChild(celula);
        });
        corpo.appendChild(linha);
    });
    tabela.appendChild(corpo);
    rolagem.appendChild(tabela);
    painel.appendChild(rolagem);
    const total = document.createElement('p');
    total.className = 'editor-total-materiais';
    total.textContent = `Total calculado do ambiente: ${moeda(item.subtotal)}`;
    painel.appendChild(total);
}
