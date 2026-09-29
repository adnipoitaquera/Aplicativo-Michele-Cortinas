(function (root) {
    'use strict';
    const CHAVE = 'michele_rascunhos';
    const telas = {
        clientes:['aba-clientes','c-'], fornecedores:['aba-fornecedores','f-'],
        profissionais:['aba-profissionais','p-'], produtos:['aba-produtos','produto-'],
        configuracoes:['modal-configuracoes','config-'], orcamento:['aba-orcamento','']
    };
    function extrairCampos(campos, prefixo = '') {
        return Object.fromEntries([...campos].filter(c => c.id && c.id.startsWith(prefixo) && !['password','file','button','submit','search'].includes(c.type) && !/^(busca-|search-|login-)/.test(c.id)).map(c => [c.id,{value:c.value,checked:!!c.checked,text:c.selectedOptions?.[0]?.textContent || ''}]));
    }
    function atualizarRascunho(lista, usuarioId, tela, estado) {
        const outros = lista.filter(r => r.usuarioId !== usuarioId || r.tela !== tela);
        return estado == null ? outros : [...outros,{usuarioId,tela,estado}];
    }
    if (typeof module !== 'undefined') module.exports = {extrairCampos,atualizarRascunho};
    if (!root.document) return;
    const el = id => document.getElementById(id), timers = new Map();
    let pronto = false, interno = false, restaurando = false, navegando = false;
    const usuario = () => typeof usuarioAtual !== 'undefined' ? usuarioAtual : null;
    const permitido = tela => usuario() && (['clientes','orcamento'].includes(tela) || usuario().cargo === 'Administrador');
    const lista = () => JSON.parse(dadosStorage.getItem(CHAVE) || '[]');
    function mensagem(tela,texto) {
        const secao = el(telas[tela][0]); if (!secao) return;
        let aviso = el(`autosave-${tela}`);
        if (!aviso) { aviso = document.createElement('p'); aviso.id = `autosave-${tela}`; aviso.className = 'autosave-status'; aviso.setAttribute('role','status'); secao.prepend(aviso); }
        aviso.textContent = texto;
    }
    function erro(tela,e) { mensagem(tela,`Não foi possível salvar automaticamente: ${e.message}. Mantenha esta tela aberta e verifique o aviso da nuvem.`); }
    function capturar(tela) {
        const secao = el(telas[tela][0]); if (!secao) return null;
        const campos = extrairCampos(secao.querySelectorAll('input[id],select[id],textarea[id]'),telas[tela][1]);
        const estado = {campos};
        if (tela === 'clientes') estado.editando = clienteEditando?.codigo || null;
        if (tela === 'fornecedores') estado.editando = fornecedorEditando;
        if (tela === 'profissionais') estado.editando = profissionalEditando;
        if (tela === 'produtos') estado.editando = produtoEditando ? {...produtoEditando} : null;
        if (tela === 'orcamento') {
            estado.documento = objetoOrcamentoCorrente ? JSON.parse(JSON.stringify(objetoOrcamentoCorrente)) : null;
            estado.ambientes = obterSnapshotAmbientes();
        }
        return estado;
    }
    function rascunho(tela) {
        const estado = capturar(tela), anteriores = lista();
        const atual = anteriores.find(r => r.usuarioId === usuario().id && r.tela === tela);
        if (JSON.stringify(atual?.estado) === JSON.stringify(estado)) return false;
        dadosStorage.setItem(CHAVE,JSON.stringify(atualizarRascunho(anteriores,usuario().id,tela,estado)));
        return true;
    }
    function descartar(tela) {
        clearTimeout(timers.get(tela)); timers.delete(tela);
        if (!pronto || restaurando || interno || !permitido(tela)) return;
        const antigos = lista(), novos = atualizarRascunho(antigos,usuario().id,tela,null);
        if (novos.length !== antigos.length) dadosStorage.setItem(CHAVE,JSON.stringify(novos));
        mensagem(tela,'Salvamento automático ativo.');
    }
    const valor = id => (el(id)?.value || '').trim();
    function valido(tela) {
        const secao = el(telas[tela][0]);
        if ([...secao.querySelectorAll('input,select,textarea')].some(c => !c.disabled && c.type !== 'password' && c.checkValidity && !c.checkValidity())) return false;
        if (tela === 'clientes') return !!valor('c-nome');
        if (tela === 'fornecedores') return !!(valor('f-razao') || valor('f-fantasia'));
        if (tela === 'profissionais') return document.activeElement !== el('p-senha') && !!valor('p-nome') && !!valor('p-usuario') && (!!profissionalEditando || !!valor('p-senha')) && !profissionais.some(p => p.usuario === valor('p-usuario') && p.id !== profissionalEditando);
        if (tela === 'produtos') return !!valor('produto-nome') && valor('produto-preco') !== '' && Number(valor('produto-preco')) >= 0 && (valor('produto-categoria') !== 'novo' || !!valor('produto-novo-nome'));
        if (tela === 'configuracoes') return !!valor('config-nome-empresa');
        if (tela === 'orcamento') {
            const cards = [...secao.querySelectorAll('.item-carrinho-card')];
            return cards.length > 0 && Number(objetoOrcamentoCorrente?.valorTotal) > 0 && cards.every(card => {
                const id = card.id.replace('item-card-','');
                return !el(`chk-cortina-${id}`)?.checked || (Number(valor(`largura-${id}`)) > 0 && Number(valor(`altura-${id}`)) > 0);
            });
        }
        return false;
    }
    function gravar(tela) {
        clearTimeout(timers.get(tela)); timers.delete(tela);
        if (!pronto || interno || restaurando || !permitido(tela)) return;
        interno = true;
        try {
            if (tela === 'orcamento') processarCalculoGeral();
            const completo = valido(tela);
            if (completo) {
                if (tela === 'clientes') {
                    const selecionado = el('orc-cliente-select')?.value;
                    salvarNovoClienteNoBanco();
                    clienteEditando = clientes.find(c => c.codigo === valor('c-codigo')) || null;
                    if (el('orc-cliente-select') && selecionado != null) el('orc-cliente-select').value = selecionado;
                }
                if (tela === 'fornecedores') { salvarFornecedor(); fornecedorEditando = valor('f-codigo'); }
                if (tela === 'profissionais') {
                    const vendedor = el('orc-vendedor-select')?.value;
                    salvarProfissional(); profissionalEditando = valor('p-codigo'); el('p-senha').value = '';
                    if (el('orc-vendedor-select') && vendedor != null) el('orc-vendedor-select').value = vendedor;
                }
                if (tela === 'produtos') {
                    salvarProduto();
                    const categoria = valor('produto-categoria');
                    produtoEditando = {categoria,indice:categoriasProduto[categoria].lista.findLastIndex(p => p.nome === valor('produto-nome') && Number(p.preco) === Number(valor('produto-preco')))};
                }
                if (tela === 'configuracoes') salvarConfiguraciones();
                if (tela === 'orcamento') salvarComoOrcamentoOuPedido(objetoOrcamentoCorrente.tipo || 'Orçamento').catch(e => erro(tela,e));
            }
            rascunho(tela);
            mensagem(tela,completo ? 'Alterações registradas automaticamente. Acompanhe a confirmação da nuvem no topo.' : 'Rascunho registrado automaticamente. Complete os campos obrigatórios para atualizar o cadastro.');
        } catch(e) { erro(tela,e); }
        finally { interno = false; }
    }
    function agendar(tela) {
        if (!pronto || interno || restaurando || !permitido(tela)) return;
        try {
            rascunho(tela); // O diário local protege a digitação antes do envio.
            mensagem(tela,'Alteração registrada; aguardando envio automático…');
            clearTimeout(timers.get(tela)); timers.set(tela,setTimeout(() => gravar(tela),900));
        } catch(e) { erro(tela,e); }
    }
    function identificar(campo) {
        if (!campo?.id || ['file','button','submit','search'].includes(campo.type) || /^(busca-|search-|login-)/.test(campo.id)) return null;
        return Object.keys(telas).find(tela => campo.closest?.(`#${telas[tela][0]}`) && campo.id.startsWith(telas[tela][1]));
    }
    function restaurarCampos(campos) {
        for (const [id,dados] of Object.entries(campos || {})) {
            const input = el(id); if (!input || ['password','file'].includes(input.type)) continue;
            if (input.tagName === 'SELECT') restaurarSelecaoProduto(input,dados);
            else input.value = dados.value;
            if (['checkbox','radio'].includes(input.type)) input.checked = dados.checked;
        }
    }
    function restaurar() {
        restaurando = true;
        try {
            for (const r of lista().filter(r => r.usuarioId === usuario()?.id && telas[r.tela] && permitido(r.tela))) {
                const e = r.estado;
                if (r.tela === 'produtos') atualizarCategoriasProdutoSelecionaveis(e.campos?.['produto-categoria']?.value || 'voal');
                if (r.tela === 'orcamento') {
                    el('container-itens-orcamento').innerHTML = ''; contadorItensId = 0;
                    objetoOrcamentoCorrente = e.documento || null;
                    for (const ambiente of e.ambientes || []) { contadorItensId = Number(ambiente.id)-1; adicionarItemOrcamentoPadrao(); aplicarEstadoCard(ambiente.id,ambiente.estado); }
                    objetoOrcamentoCorrente = e.documento || null;
                }
                restaurarCampos(e.campos);
                if (r.tela === 'clientes') clienteEditando = clientes.find(c => c.codigo === e.editando) || null;
                if (r.tela === 'fornecedores') fornecedorEditando = e.editando || null;
                if (r.tela === 'profissionais') profissionalEditando = e.editando || null;
                if (r.tela === 'produtos') produtoEditando = e.editando || null;
                if (r.tela === 'orcamento') processarCalculoGeral();
                mensagem(r.tela,'Seu último preenchimento foi recuperado. Salvamento automático ativo.');
            }
        } finally { restaurando = false; pronto = true; }
    }
    const avisoOriginal = root.avisarGravacao;
    root.avisarGravacao = (...args) => interno ? Promise.resolve(true) : avisoOriginal(...args);
    for (const [nome,tela] of Object.entries({limparCliente:'clientes',limparFornecedor:'fornecedores',limparProfissional:'profissionais',limparProduto:'produtos',resetarFormularioOrcamento:'orcamento'})) {
        const original = root[nome];
        root[nome] = (...args) => { if (interno || (navegando && lista().some(r => r.usuarioId === usuario()?.id && r.tela === tela))) return; descartar(tela); return original(...args); };
    }
    const abrirAba = root.abrirAbaComando;
    root.abrirAbaComando = (...args) => { navegando = true; try { return abrirAba(...args); } finally { navegando = false; } };
    const fechar = root.fecharConfiguracoes;
    root.fecharConfiguracoes = (...args) => { if (!interno) return fechar(...args); };
    const iniciar = root.iniciarAplicacao;
    root.iniciarAplicacao = (...args) => { pronto = false; const r = iniciar(...args); restaurar(); return r; };
    for (const [nome,tela] of Object.entries({removerItemOrcamento:'orcamento',adicionarItemOrcamentoPadrao:'orcamento'})) {
        const original = root[nome]; root[nome] = (...args) => { const r = original(...args); agendar(tela); return r; };
    }
    document.addEventListener('input',e => { const tela = identificar(e.target); if (tela && e.target.type !== 'password') agendar(tela); });
    document.addEventListener('change',e => { const tela = identificar(e.target); if (tela) agendar(tela); });
    document.addEventListener('focusout',e => { if (e.target.id === 'p-senha') agendar('profissionais'); });
    document.addEventListener('click',e => { if (e.target.closest?.('button') && !e.target.closest?.('dialog')) [...timers.keys()].forEach(gravar); },true);
    document.addEventListener('visibilitychange',() => { if (document.hidden) [...timers.keys()].forEach(gravar); });
    root.MicheleAutoSave = {agendar,gravar,restaurar};
})(typeof window !== 'undefined' ? window : globalThis);
