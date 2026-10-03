(function () {
    'use strict';
    const el = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function campo(id, chave, titulo, opcoes) {
        const nome = `cortina-${chave}-${id}`;
        return `<div class="form-group"><label for="${nome}">${titulo}</label>${opcoes
            ? `<select id="${nome}">${opcoes.map(v => `<option>${esc(v)}</option>`).join('')}</select>`
            : `<input id="${nome}" type="text" placeholder="Informar...">`}</div>`;
    }
    function montar(id) {
        const corpo = el(`corpo-cortina-${id}`);
        if (!corpo || corpo.dataset.editorCortina) return;
        corpo.dataset.editorCortina = 'true';
        corpo.classList.add('cortina-editor');
        const anteriores = document.createElement('div');
        while (corpo.firstChild) anteriores.appendChild(corpo.firstChild);
        corpo.innerHTML = `<div class="cortina-titulo">Calcular cortina</div>
            <div class="cortina-abas" role="tablist" aria-label="Cortina do ambiente ${id}">
                <button type="button" id="cortina-tab-form-${id}" role="tab" aria-selected="true" aria-controls="cortina-form-${id}">Formulário</button>
                <button type="button" id="cortina-tab-material-${id}" role="tab" aria-selected="false" aria-controls="cortina-material-${id}">Material</button>
            </div>
            <div id="cortina-form-${id}" role="tabpanel" aria-labelledby="cortina-tab-form-${id}" class="cortina-form">
                <div class="cortina-grade cortina-medidas"></div>
                <div class="cortina-grade cortina-complementos">
                    ${campo(id,'cor','Cor dos acessórios',['Não informado','Branco','Preto','Cromado','Marfim','Outro'])}
                    ${campo(id,'barra','Barra',['Não informado','10 cm','20 cm','30 cm','40 cm'])}
                    ${campo(id,'dupla','Dupla',['Não','Sim'])}
                    ${campo(id,'acabada','Acabada',['','Sim','Não'])}
                    ${campo(id,'cabecote-tipo','Tipo de cabeçote',['Não informado','Cabeçote simples — 5 cm','Cabeçote simples — 8 cm','Cabeçote com franzidor — 5 cm','Cabeçote com franzidor — 8 cm'])}
                    ${campo(id,'kit','Kit')}
                    ${campo(id,'costurar','Costurar forro / blackout',['Não informado','Junto','Separado'])}
                </div>
                <div class="cortina-colunas">
                    <section><h3>Cabeçotes e acessórios</h3><div class="cortina-grade cortina-acessorios">
                        ${campo(id,'cabecote-traseiro','Cabeçote traseiro')}
                        ${campo(id,'deslizante-traseiro','Deslizante traseiro')}
                        ${campo(id,'fixacao','Fixação')}
                        ${campo(id,'suporte','Suporte flange')}
                        ${campo(id,'ponteira-frontal','Ponteira frontal')}
                        ${campo(id,'ponteira-traseira','Ponteira traseira')}
                    </div></section>
                    <section><h3>Tecidos e franzimento</h3><div class="cortina-tecidos"></div></section>
                </div>
                <div class="cortina-grade">${campo(id,'opcional','Opcional')}
                    <div class="form-group"><label for="cortina-opcional-qtd-${id}">Quantidade opcional</label><input type="number" id="cortina-opcional-qtd-${id}" min="0" step="1"></div>
                </div>
                <div class="form-group"><label for="cortina-observacao-${id}">Observação</label><textarea id="cortina-observacao-${id}" rows="2"></textarea></div>
                <p class="cortina-nota">Barra, dupla, inversão, costura e acessórios descritivos ficam registrados para fabricação. O preço usa os tecidos e componentes do catálogo selecionados abaixo.</p>
                <details class="cortina-extras"><summary>Instalação, demais acessórios e motorização</summary></details>
            </div>
            <div id="cortina-material-${id}" role="tabpanel" aria-labelledby="cortina-tab-material-${id}" hidden class="cortina-material">
                <div class="tabela-scroll"><table><caption>Materiais da cortina</caption><thead><tr><th>Código</th><th>Descrição</th><th>Dimensão</th><th>Partes</th><th>Qtd.</th><th>UM</th><th>Valor unitário</th><th>Total</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div>
                <p class="cortina-nota">Valores conforme as regras atuais do sistema. Motorização, instalação e persianas são apresentados no orçamento completo.</p>
            </div>
            <div class="cortina-acoes"><span role="status" id="cortina-status-${id}"></span><button type="button" class="btn" data-acao="calcular">Calcular</button><button type="button" class="btn btn-ouro" data-acao="gravar">Gravar</button><button type="button" class="btn" data-acao="limpar">Limpar</button><button type="button" class="btn" data-acao="voltar">Voltar ao formulário</button></div>`;
        function mover(chave, destino, rotulo) {
            const input = anteriores.querySelector(`[id="${chave}-${id}"]`);
            const grupo = input?.closest('.form-group, .opcional-box');
            if (!grupo) return;
            if (rotulo && grupo.querySelector('label')) grupo.querySelector('label').textContent = rotulo;
            corpo.querySelector(destino).appendChild(grupo);
        }
        ['modelo-voal','largura','altura','quantidade'].forEach(chave => mover(chave,'.cortina-medidas',chave === 'modelo-voal' ? 'Modelo' : null));
        mover('select-tubo-trilho','.cortina-acessorios','Cabeçote frontal / trilho');
        mover('select-rodizio','.cortina-acessorios','Deslizante frontal');
        ['voal','forro','terceiro'].forEach((tipo, index) => {
            const linha = document.createElement('div'); linha.className = 'cortina-tecido-linha';
            corpo.querySelector('.cortina-tecidos').appendChild(linha);
            for (const chave of [`select-${tipo}`,`prop-${tipo}`]) {
                const grupo = anteriores.querySelector(`[id="${chave}-${id}"]`)?.closest('.form-group');
                if (grupo) { grupo.querySelector('label').textContent = chave.startsWith('prop') ? 'Franzimento' : ['Tecido','Forro','Blackout / terceiro tecido'][index]; linha.appendChild(grupo); }
            }
            linha.insertAdjacentHTML('beforeend', campo(id,`inverter-${tipo}`,'Inverter',['Automático','Sim']));
            if (tipo === 'terceiro') el(`select-terceiro-${id}`).disabled = false;
        });
        anteriores.querySelectorAll('.grid-forms').forEach(grupo => { if (!grupo.children.length) grupo.remove(); });
        corpo.querySelector('.cortina-extras').appendChild(anteriores);
        // A ficha principal segue a ordem e as proporções da referência.
        const grupo = chave => el(`${chave}-${id}`)?.closest('.form-group, .opcional-box');
        const medidas = corpo.querySelector('.cortina-medidas');
        const extras = corpo.querySelector('.cortina-extras');
        extras.appendChild(grupo('quantidade'));
        ['modelo-voal','cortina-cor','largura','altura','cortina-barra','cortina-dupla','cortina-acabada'].forEach(chave => medidas.appendChild(grupo(chave)));
        const complementos = corpo.querySelector('.cortina-complementos');
        if (grupo('costureira-id')) complementos.appendChild(grupo('costureira-id'));
        complementos.appendChild(grupo('cortina-observacao'));
        grupo('cortina-observacao').classList.add('cortina-observacao');
        const acessorios = corpo.querySelector('.cortina-acessorios');
        acessorios.insertAdjacentHTML('beforeend', `<div class="form-group"><label for="select-ilhos-${id}">Ilhós</label><select id="select-ilhos-${id}"></select></div>`);
        ['select-tubo-trilho','cortina-cabecote-traseiro','select-rodizio','cortina-deslizante-traseiro','cortina-fixacao','cortina-suporte','cortina-ponteira-frontal','cortina-ponteira-traseira'].forEach(chave => acessorios.appendChild(grupo(chave)));
        const dimensoesTrilho = grupo('select-tubo-trilho').querySelector('div[style*="grid"]');
        if (dimensoesTrilho) extras.appendChild(dimensoesTrilho);
        const opcionais = grupo('cortina-opcional').parentElement;
        opcionais.classList.add('cortina-opcionais');
        corpo.querySelector('.cortina-tecidos').appendChild(opcionais);
        corpo.querySelector('.cortina-nota').remove();
        corpo.querySelectorAll('.cortina-colunas h3').forEach(titulo => titulo.remove());
        corpo.querySelector('.cortina-titulo').remove();
        const rotulos = {'cortina-cor':'Cor Acessório','largura':'Largura','altura':'Altura','cortina-cabecote-tipo':'Tipo Cabeçote','cortina-costurar':'Costurar Forro/BK','select-tubo-trilho':'Cabeçote Frontal','cortina-cabecote-traseiro':'Cabeçote Traseiro','select-rodizio':'Deslizante Frontal','cortina-deslizante-traseiro':'Deslizante Traseiro','cortina-suporte':'Suporte entre Flange','cortina-ponteira-frontal':'Ponteira Frontal','cortina-ponteira-traseira':'Ponteira Traseira','select-terceiro':'Blackout','cortina-opcional':'OPCIONAL','cortina-opcional-qtd':'QTD'};
        Object.entries(rotulos).forEach(([chave,rotulo]) => grupo(chave).querySelector('label').textContent = rotulo);
        ['voal','forro','terceiro'].forEach(tipo => {
            grupo(`prop-${tipo}`).querySelector('label').textContent = 'Franz.';
            const busca = el(`search-${tipo}-${id}`);
            if (busca) { const label = document.createElement('label'); label.textContent = `Pesquisar ${tipo === 'voal' ? 'tecido' : tipo === 'forro' ? 'forro' : 'blackout'}`; label.appendChild(busca); extras.appendChild(label); }
        });
        corpo.querySelectorAll('input[type="text"]').forEach(input => input.placeholder = '');
        function trocar(antiga, nova, titulo) {
            const destino = grupo(antiga), origem = grupo(nova);
            destino.replaceWith(origem); destino.hidden = true; extras.appendChild(destino);
            origem.querySelector('label').textContent = titulo;
            return origem;
        }
        trocar('cortina-cabecote-traseiro','select-entretela','Entretela');
        trocar('cortina-fixacao','select-argola','Argolas');
        grupo('select-rodizio').querySelector('label').textContent = 'Rodízio deslizante';
        grupo('select-tubo-trilho').querySelector('label').textContent = 'Tubos e Trilhos';
        if (dimensoesTrilho) grupo('select-tubo-trilho').appendChild(dimensoesTrilho);
        const metragemLabel = el(`tubo-trilho-tamanho-${id}`).previousElementSibling;
        if (metragemLabel) metragemLabel.textContent = 'Metragem (m)';
        for (const [antiga,tipo,titulo] of [['cortina-deslizante-traseiro','ponteira','Ponteiras'],['cortina-suporte','suporte','Suportes']]) {
            const destino = grupo(antiga);
            const novo = document.createElement('div'); novo.className = 'form-group';
            novo.classList.add('cortina-produto-quantidade');
            novo.innerHTML = `<div><label for="select-${tipo}-${id}">${titulo}</label><select id="select-${tipo}-${id}"></select></div><div><label for="cortina-${tipo}-qtd-${id}">Qtd.</label><input id="cortina-${tipo}-qtd-${id}" type="number" min="0" step="1" value="0"></div>`;
            destino.replaceWith(novo); destino.hidden = true; extras.appendChild(destino);
        }
        const instalacao = trocar('cortina-ponteira-frontal','instalacao-valor','Instalação — valor unitário (R$)');
        const valorInstalacao = document.createElement('div');
        while (instalacao.firstChild) valorInstalacao.appendChild(instalacao.firstChild);
        instalacao.appendChild(valorInstalacao);
        instalacao.appendChild(grupo('instalacao-qtd'));
        instalacao.classList.add('cortina-produto-quantidade');
        grupo('instalacao-qtd').querySelector('label').textContent = 'Qtd.';
        grupo('cortina-ponteira-traseira').hidden = true;
        for (const tipo of ['voal','forro','terceiro']) {
            grupo(`select-${tipo}`).insertAdjacentHTML('beforeend', `<input id="cortina-largura-tecido-${tipo}-${id}" type="hidden" value="3">`);
            el(`select-${tipo}-${id}`).addEventListener('change', () => {
                let itens = []; try { itens = JSON.parse(el(`select-${tipo}-${id}`).dataset.source || '[]'); } catch (_) {}
                const nome = el(`select-${tipo}-${id}`).selectedOptions[0]?.textContent;
                const produto = itens.find(p => p.nome === nome && Number(p.preco) === Number(el(`select-${tipo}-${id}`).value));
                el(`cortina-largura-tecido-${tipo}-${id}`).value = produto?.larguraTecido || 3;
            });
        }
        extras.insertAdjacentHTML('afterbegin', `<div class="form-group"><label for="cortina-altura-cabecote-${id}">Altura do cabeçote (m)</label><input id="cortina-altura-cabecote-${id}" type="number" min="0" step="0.01" value="0.09"></div><p class="cortina-nota">Altura de corte = parede + cabeçote + barra. Se ultrapassar a largura do tecido cadastrado, a inversão é automática, com pedaços inteiros. As fórmulas dos acessórios podem ser alteradas no cadastro de produtos; o espaçamento padrão de rodízios e argolas é 8 cm.</p>`);
        el(`cortina-cabecote-tipo-${id}`).addEventListener('change', () => {
            const medida = /([58]) cm/.exec(el(`cortina-cabecote-tipo-${id}`).value);
            const altura = el(`cortina-altura-cabecote-${id}`);
            altura.readOnly = !!medida;
            if (medida) altura.value = Number(medida[1]) / 100;
            processarCalculoGeral();
        });
        corpo.querySelector('.cortina-abas').insertAdjacentHTML('afterend', `<div id="cortina-alerta-inversao-${id}" class="cortina-alerta-inversao" role="alert" hidden></div>`);
        window.MichelePagamento?.montar(id, corpo);
        // Agrupa os campos sem recriar os controles nem perder seus eventos.
        const formulario = corpo.querySelector('.cortina-form');
        function organizarSecao(conteudo, titulo, descricao) {
            const secao = document.createElement('section');
            secao.className = 'cortina-secao';
            const cabecalho = document.createElement('div');
            cabecalho.className = 'cortina-secao-cabecalho';
            const heading = document.createElement('h3');
            heading.textContent = titulo;
            const ajuda = document.createElement('p');
            ajuda.textContent = descricao;
            cabecalho.append(heading, ajuda);
            conteudo.before(secao);
            secao.append(cabecalho, conteudo);
            return secao;
        }
        medidas.appendChild(grupo('quantidade'));
        grupo('largura').querySelector('label').textContent = 'Largura da parede (m)';
        grupo('altura').querySelector('label').textContent = 'Altura da parede (m)';
        organizarSecao(medidas, '1. Modelo e medidas', 'Defina o modelo, as dimensões e a quantidade de cortinas.');
        organizarSecao(complementos, '2. Acabamentos', 'Configure o cabeçote, o kit e a costura do forro ou blackout.');
        const observacao = grupo('cortina-observacao');
        observacao.classList.remove('cortina-observacao');
        formulario.insertBefore(observacao, extras);
        organizarSecao(observacao, '5. Observações', 'Registre orientações adicionais para a fabricação.');
        organizarSecao(acessorios, '3. Trilhos e acessórios', 'Selecione os componentes e informe as quantidades necessárias.');
        organizarSecao(corpo.querySelector('.cortina-tecidos'), '4. Tecidos e franzimento', 'Escolha o tecido, o forro e o blackout de cada cortina.');
        ['voal', 'forro', 'terceiro'].forEach(tipo => {
            grupo(`prop-${tipo}`).querySelector('label').textContent = 'Franzimento';
        });
        catalogos();
        const cancelar = corpo.querySelector('[data-acao="voltar"]');
        cancelar.textContent = 'Cancelar';
        let antesEdicao = null;
        corpo.addEventListener('focusin', () => {
            if (!antesEdicao) antesEdicao = Array.from(corpo.querySelectorAll('input,select,textarea'), input => ({input, value:input.value, checked:input.checked, selectedIndex:input.selectedIndex}));
        });
        el(`cortina-tab-form-${id}`).onclick = () => aba(id, false);
        el(`cortina-tab-material-${id}`).onclick = () => { processarCalculoGeral(); aba(id, true); };
        corpo.querySelector('[data-acao="calcular"]').onclick = () => { processarCalculoGeral(); aba(id, true); };
        cancelar.onclick = () => {
            if (antesEdicao) antesEdicao.forEach(({input,value,checked,selectedIndex}) => {
                if (input.tagName === 'SELECT') input.selectedIndex = selectedIndex;
                else { input.value = value; input.checked = checked; }
            });
            antesEdicao = null;
            processarCalculoGeral(); aba(id, false);
            window.MicheleAutoSave?.agendar('orcamento');
            el(`item-card-${id}`).classList.remove('aberto');
        };
        corpo.querySelector('[data-acao="gravar"]').onclick = async event => {
            const botao = event.currentTarget; botao.disabled = true;
            try { await salvarAmbiente(id); antesEdicao = null; } finally { botao.disabled = false; }
        };
        corpo.querySelector('[data-acao="limpar"]').onclick = () => {
            if (!confirm('Limpar os campos desta cortina? Para atualizar um documento já salvo, grave o ambiente novamente.')) return;
            corpo.querySelectorAll('input,select,textarea').forEach(input => {
                if (input.tagName === 'SELECT') input.selectedIndex = 0;
                else if (input.type === 'checkbox') input.checked = false;
                else input.value = input.defaultValue || '';
            });
            alternarModuloCortina(id); processarCalculoGeral(); aba(id, false);
            window.MicheleAutoSave?.agendar('orcamento');
        };
        corpo.querySelectorAll('textarea').forEach(input => input.addEventListener('input', () => processarCalculoGeral()));
    }
    function aba(id, material) {
        window.MichelePagamento?.ocultar(id);
        el(`cortina-form-${id}`).hidden = material;
        el(`cortina-material-${id}`).hidden = !material;
        el(`cortina-tab-form-${id}`).setAttribute('aria-selected', String(!material));
        el(`cortina-tab-material-${id}`).setAttribute('aria-selected', String(material));
    }
    function renderizar(id, item) {
        const painel = el(`cortina-material-${id}`); if (!painel) return;
        const materiais = item.materiaisCortina || [];
        const total = materiais.reduce((soma, material) => soma + material.valorTotal, 0);
        const numero = valor => Number(valor || 0).toLocaleString('pt-BR', {maximumFractionDigits:3});
        painel.querySelector('caption').textContent = item.modeloVoal || 'Materiais da cortina';
        painel.querySelector('tbody').innerHTML = materiais.map(material => `<tr><td>${esc(material.codigo || '—')}</td><td>${esc(material.nome)}</td><td>${esc(material.dimensao || '—')}</td><td>${esc(material.partes || '—')}</td><td>${numero(material.quantidade)}</td><td>${esc(material.unidade)}</td><td>${formatarMoeda(material.valorUnitario)}</td><td>${formatarMoeda(material.valorTotal)}</td></tr>`).join('') || '<tr><td colspan="8">Selecione os tecidos, componentes e medidas no formulário.</td></tr>';
        painel.querySelector('tfoot').innerHTML = `<tr><th colspan="7">Total dos materiais e confecção</th><th>${formatarMoeda(total)}</th></tr>`;
        el(`cortina-status-${id}`).textContent = item.cortinaAtiva ? `${materiais.length} itens · ${formatarMoeda(total)}` : 'Cortina desativada';
        const alerta = el(`cortina-alerta-inversao-${id}`);
        if (alerta) {
            const avisos = item.cortinaAtiva ? item.calculoCortina?.avisos || [] : [];
            const mensagem = avisos.length ? `<strong>Atenção: tecido invertido — informe o cliente antes de confirmar o orçamento.</strong>${avisos.map(a => `<p>${esc(a.nome)}: parede ${numero(a.alturaParede)} m + cabeçote ${numero(a.cabecote)} m + barra ${numero(a.barra)} m = ${numero(a.alturaCorte)} m${a.automatico ? `, acima da largura do tecido de ${numero(a.larguraTecido)} m. Inversão automática` : '. Inversão selecionada'}. ${numero(a.partes)} pedaços de ${numero(a.comprimento)} m = <strong>${numero(a.metros)} m de tecido</strong>.</p>`).join('')}` : '';
            alerta.hidden = !avisos.length;
            if (alerta.innerHTML !== mensagem) alerta.innerHTML = mensagem;
        }
    }
    function catalogos() {
        const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const filtros = {'tubo-trilho':/tubo|trilho/,rodizio:/rodizio|deslizante/,gancho:/gancho|ganchinho/,clip:/clip/,wave:/wave/,argola:/argola/,ilhos:/ilhos/,entretela:/entretela/,suporte:/suporte/,ponteira:/ponteira|terminal/,terceiro:/blackout|black out|blecaute/};
        for (const [tipo,filtro] of Object.entries(filtros)) {
            const itens = Object.entries(categoriasProduto).flatMap(([categoria,c]) => (c.lista || []).filter(p => MicheleCatalogoUso.permite(p,`${categoria} ${c.nome}`,'cortinas') && filtro.test(normalizar(`${p.subcategoria || ''} ${p.nome}`))));
            document.querySelectorAll(`select[id^="select-${tipo}-"]`).forEach(select => {
                atualizarSelectProduto(select,itens,'');
                if (tipo === 'ilhos') select.options[0].textContent = itens.length ? 'Sem ilhós' : 'Cadastre Ilhós nos produtos';
                if (tipo === 'terceiro') {
                    select.options[0].textContent = itens.length ? 'Selecionar blackout...' : 'Cadastre Blackout na tabela de preços';
                    const id = select.id.replace('select-terceiro-','');
                    select.disabled = el(`chk-cortina-${id}`)?.checked === false;
                }
            });
        }
    }
    window.MicheleCortinaEditor = { montar, renderizar, catalogos };
})();
