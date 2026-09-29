(function () {
    'use strict';
    const el = id => document.getElementById(id);
    const campo = (id, chave) => el(`pagamento-${chave}-${id}`);
    const percentual = valor => Number.isFinite(Number(valor)) ? Math.min(100, Math.max(0, Number(valor))) : 0;
    const dinheiro = n => Math.round((n + Number.EPSILON) * 100) / 100;
    const bandeiras = ['Visa','Mastercard','Elo','American Express','Hipercard','Diners Club','Outra'];
    const totais = new Map();
    const limiteParcelas = () => ['Administrador','Gerente'].includes((profissionais.find(p => p.id === usuarioAtual?.id) || usuarioAtual)?.cargo) ? 12 : 3;
    function plano(total, parcelas) {
        const centavos = Math.round(total * 100), base = Math.floor(centavos / parcelas);
        return Array.from({length:parcelas}, (_, i) => (i === parcelas - 1 ? centavos - base * (parcelas - 1) : base) / 100);
    }
    function descreverParcelas(valores) {
        const n = valores.length, primeira = valores[0], ultima = valores[n-1];
        return primeira === ultima ? `${n}x de ${formatarMoeda(primeira)}` : `${n-1}x de ${formatarMoeda(primeira)} + última de ${formatarMoeda(ultima)}`;
    }
    function contextoCartao(id) {
        return {acao:'parcelamento', referencia:campo(id,'referencia').value, parcelas:Number(campo(id,'parcelas').value), bandeira:campo(id,'bandeira').value, total:totais.get(String(id)) || 0};
    }
    function limite() {
        const cadastro = profissionais.find(p => p.id === usuarioAtual?.id) || usuarioAtual;
        return percentual(cadastro?.descontoMaximo || 0);
    }
    function contexto(id, desconto) {
        return {acao:'desconto', referencia:campo(id,'referencia').value, percentual:desconto};
    }
    function comprovante(id, chave = 'autorizacao') {
        try { return JSON.parse(campo(id,chave)?.value || 'null'); } catch (_) { return null; }
    }
    async function autenticar(contexto) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog');
            dialog.innerHTML = `<form><h3>Autorização do administrador ou gerente</h3><p class="autorizacao-motivo"></p><div class="form-group"><label>Usuário<input name="usuario" autocomplete="off" required></label></div><div class="form-group"><label>Senha<input name="senha" type="password" autocomplete="off" required></label></div><p role="alert"></p><button class="btn btn-ouro" type="submit">Autorizar esta alteração</button> <button class="btn" type="button">Cancelar</button></form>`;
            dialog.querySelector('.autorizacao-motivo').textContent = contexto.acao === 'desconto' ? `Desconto solicitado: ${contexto.percentual}%.` : contexto.acao === 'parcelamento' ? `Cartão ${contexto.bandeira}: ${contexto.parcelas} parcelas, total ${formatarMoeda(contexto.total)}. ${descreverParcelas(plano(contexto.total,contexto.parcelas))}.` : `Alteração do campo: ${contexto.rotulo}. Novo valor: ${contexto.valor}.`;
            const fechar = resultado => { dialog.close(); dialog.remove(); resolve(resultado); };
            dialog.querySelector('button[type="button"]').onclick = () => fechar(null);
            dialog.addEventListener('cancel', e => { e.preventDefault(); fechar(null); });
            dialog.querySelector('form').onsubmit = async e => {
                e.preventDefault();
                const form = e.currentTarget, botao = form.querySelector('[type="submit"]'); botao.disabled = true;
                try {
                    let autorizacao;
                    const login = form.elements.usuario.value.trim(), senha = form.elements.senha.value;
                    if (window.MicheleNuvem?.ativo) {
                        if (!window.MicheleNuvem.autorizar) throw new Error('A autorização exige a instalação do login por usuário na nuvem.');
                        autorizacao = await window.MicheleNuvem.autorizar(login, senha, contexto);
                    } else {
                        const pessoa = profissionais.find(p => p.usuario?.toLowerCase() === login.toLowerCase() && p.senha === senha && p.status === 'Ativo' && ['Administrador','Gerente'].includes(p.cargo));
                        if (!pessoa) throw new Error('Usuário ou senha inválidos, ou sem permissão de gerente.');
                        autorizacao = {id:crypto.randomUUID(), aprovador:pessoa.id, nome:pessoa.nome, contexto, data:new Date().toISOString()};
                    }
                    fechar(autorizacao);
                } catch (erro) { form.querySelector('[role="alert"]').textContent = erro.message; }
                finally { form.elements.senha.value = ''; botao.disabled = false; }
            };
            document.body.appendChild(dialog); dialog.showModal(); dialog.querySelector('input').focus();
        });
    }
    function montar(id, corpo) {
        const auditoria = document.createElement('input');
        auditoria.type = 'hidden'; auditoria.id = `pagamento-alteracoes-${id}`; auditoria.value = '[]';
        corpo.appendChild(auditoria);
        const abas = corpo.querySelector('.cortina-abas');
        abas.insertAdjacentHTML('beforeend', `<button type="button" id="cortina-tab-pagamento-${id}" role="tab" aria-selected="false" aria-controls="cortina-pagamento-${id}">Pagamento</button>`);
        abas.insertAdjacentHTML('afterend', `<div id="cortina-pagamento-${id}" role="tabpanel" aria-labelledby="cortina-tab-pagamento-${id}" hidden><p>Pagamento deste ambiente. O administrador define o desconto máximo no cadastro do profissional.</p><div class="cortina-grade"><div class="form-group"><label for="pagamento-forma-${id}">Forma de pagamento</label><select id="pagamento-forma-${id}"><option value="avista">À vista</option><option value="outro">Outras condições / sem desconto</option></select></div><div class="form-group"><label for="pagamento-percentual-${id}">Desconto à vista (%)</label><input id="pagamento-percentual-${id}" type="number" min="0" max="100" step="0.01" value="0"></div></div><input type="hidden" id="pagamento-referencia-${id}" value="${crypto.randomUUID()}"><input type="hidden" id="pagamento-autorizacao-${id}" value=""><p id="pagamento-resumo-${id}" role="status"></p><button type="button" class="btn" id="pagamento-autorizar-${id}">Autorizar desconto maior</button><button type="button" class="btn" id="pagamento-campo-${id}">Alterar campo bloqueado</button></div>`);
        el(`cortina-tab-pagamento-${id}`).onclick = () => {
            processarCalculoGeral();
            for (const aba of ['form','material','pagamento']) {
                el(`cortina-${aba}-${id}`).hidden = aba !== 'pagamento';
                el(`cortina-tab-${aba}-${id}`).setAttribute('aria-selected', String(aba === 'pagamento'));
            }
        };
        campo(id,'forma').insertAdjacentHTML('beforeend', '<option value="cartao">Cartão de crédito / parcelamento</option>');
        campo(id,'resumo').insertAdjacentHTML('beforebegin', `<div id="pagamento-cartao-${id}" hidden><div class="cortina-grade"><div class="form-group"><label for="pagamento-bandeira-${id}">Bandeira do cartão</label><select id="pagamento-bandeira-${id}">${bandeiras.map(b => `<option>${b}</option>`).join('')}</select></div><div class="form-group"><label for="pagamento-parcelas-${id}">Número de parcelas</label><select id="pagamento-parcelas-${id}">${Array.from({length:12},(_,i) => `<option value="${i+1}">${i+1}x</option>`).join('')}</select></div></div><p>Parcelamento sem acréscimo. Vendedores podem oferecer até 3x; de 4x a 12x, solicite autorização.</p><p id="pagamento-simulacao-${id}" role="status"></p><button type="button" class="btn" id="pagamento-autorizar-parcelas-${id}">Autorizar mais parcelas</button></div><input type="hidden" id="pagamento-autorizacao-parcelas-${id}" value=""><input type="hidden" id="pagamento-descricao-${id}" value="">`);
        for (const chave of ['forma','bandeira','parcelas']) campo(id,chave).addEventListener('change', () => { campo(id,'autorizacao-parcelas').value = ''; processarCalculoGeral(); });
        campo(id,'autorizar-parcelas').onclick = async () => {
            processarCalculoGeral();
            const pedido = contextoCartao(id);
            const resposta = await autenticar(pedido);
            if (resposta && campo(id,'forma').value === 'cartao' && JSON.stringify(pedido) === JSON.stringify(contextoCartao(id))) {
                campo(id,'autorizacao-parcelas').value = JSON.stringify(resposta); processarCalculoGeral();
            }
        };
        for (const chave of ['forma','percentual']) campo(id,chave).addEventListener('input', () => { campo(id,'autorizacao').value = ''; processarCalculoGeral(); });
        campo(id,'autorizar').onclick = async () => {
            const input = campo(id,'percentual');
            if (!input.checkValidity()) { input.reportValidity(); return; }
            const pedido = contexto(id,percentual(input.value));
            const resposta = await autenticar(pedido);
            if (resposta && JSON.stringify(pedido) === JSON.stringify(contexto(id,percentual(input.value)))) {
                campo(id,'autorizacao').value = JSON.stringify(resposta); processarCalculoGeral();
            }
        };
        campo(id,'campo').onclick = () => alterarCampo(id);
    }
    async function alterarCampo(id) {
        const campos = [...el(`item-card-${id}`).querySelectorAll('input,select,textarea')].filter(c => (c.disabled || c.readOnly) && !['hidden','password','checkbox','button'].includes(c.type));
        if (!campos.length) { alert('Não há campos bloqueados neste ambiente.'); return; }
        const dialog = document.createElement('dialog');
        dialog.innerHTML = '<form><h3>Alterar um campo bloqueado</h3><label>Campo<select name="campo"></select></label><div class="novo-valor"></div><button class="btn" type="submit">Solicitar autorização</button> <button class="btn" type="button">Cancelar</button></form>';
        const seletor = dialog.querySelector('select');
        campos.forEach((c,i) => { const o = document.createElement('option'); o.value = i; o.textContent = c.closest('.form-group')?.querySelector('label')?.textContent || c.id; seletor.appendChild(o); });
        const escolher = () => { const copia = campos[seletor.value].cloneNode(true); copia.removeAttribute('id'); copia.name = 'valor'; copia.disabled = false; copia.readOnly = false; dialog.querySelector('.novo-valor').replaceChildren(copia); };
        seletor.onchange = escolher; escolher();
        dialog.querySelector('[type="button"]').onclick = () => { dialog.close(); dialog.remove(); };
        dialog.addEventListener('cancel', () => dialog.remove());
        dialog.querySelector('form').onsubmit = async e => {
            e.preventDefault();
            const alvo = campos[seletor.value], novo = e.currentTarget.elements.valor.value;
            const contexto = {acao:'campo', referencia:campo(id,'referencia').value, campo:alvo.id, rotulo:seletor.selectedOptions[0].textContent, anterior:alvo.value, valor:novo};
            dialog.close(); dialog.remove();
            const resposta = await autenticar(contexto);
            if (!resposta || !alvo.isConnected || alvo.value !== contexto.anterior) return;
            alvo.value = novo;
            // A autorização vale para esta alteração; o campo continua bloqueado.
            const registro = campo(id,'alteracoes');
            let historico = []; try { historico = JSON.parse(registro.value || '[]'); } catch (_) {}
            registro.value = JSON.stringify([...historico,resposta]);
            alvo.dispatchEvent(new Event('change', {bubbles:true})); processarCalculoGeral();
        };
        document.body.appendChild(dialog); dialog.showModal();
    }
    function calcular(id, bruto) {
        if (!campo(id,'forma')) return {total:bruto};
        const forma = campo(id,'forma').value, solicitado = percentual(campo(id,'percentual').value), maximo = limite();
        const autorizacao = comprovante(id), esperado = contexto(id,solicitado);
        const autorizado = autorizacao && autorizacao.contexto?.acao === esperado.acao && autorizacao.contexto?.referencia === esperado.referencia && autorizacao.contexto?.percentual === esperado.percentual;
        const aplicado = forma === 'avista' ? Math.min(solicitado, autorizado ? 100 : maximo) : 0;
        const desconto = dinheiro(bruto * aplicado / 100), total = dinheiro(bruto - desconto);
        totais.set(String(id),total);
        campo(id,'percentual').disabled = forma !== 'avista';
        if (campo(id,'cartao')) campo(id,'cartao').hidden = forma !== 'cartao';
        if (campo(id,'autorizar')) campo(id,'autorizar').hidden = forma !== 'avista';
        campo(id,'resumo').textContent = `Limite: ${maximo}%. Bruto: ${formatarMoeda(bruto)}. Desconto aplicado: ${aplicado}% (${formatarMoeda(desconto)}). Total: ${formatarMoeda(total)}.${forma === 'avista' && solicitado > maximo && !autorizado ? ' O desconto solicitado excede o limite; solicite autorização para aplicá-lo.' : autorizado ? ' Desconto autorizado pelo responsável.' : ''}`;
        const resultado = {forma, percentual:aplicado, desconto, total, referencia:esperado.referencia, autorizacao:autorizado && aplicado > maximo ? autorizacao : null};
        if (forma === 'cartao') {
            const pedido = contextoCartao(id), recibo = comprovante(id,'autorizacao-parcelas');
            const liberado = recibo?.contexto && Object.keys(pedido).every(k => recibo.contexto[k] === pedido[k]);
            const solicitado = Number.isInteger(pedido.parcelas) && pedido.parcelas >= 1 && pedido.parcelas <= 12 ? pedido.parcelas : 1;
            const parcelas = Math.min(solicitado,liberado ? 12 : limiteParcelas());
            const valoresParcelas = plano(total,parcelas);
            Object.assign(resultado, {bandeira:bandeiras.includes(pedido.bandeira) ? pedido.bandeira : 'Outra', parcelas, valoresParcelas, autorizacaoParcelas:liberado ? recibo : null});
            for (const option of campo(id,'parcelas').options || []) {
                const n = Number(option.value);
                option.textContent = `${n}x — ${descreverParcelas(plano(total,n))}${n > limiteParcelas() ? ' (autorização)' : ''}`;
            }
            campo(id,'simulacao').textContent = solicitado > parcelas ? `Simulação solicitada: ${solicitado}x — ${descreverParcelas(plano(total,solicitado))}. Ainda não autorizada. O orçamento permanece em ${parcelas}x até a autorização.` : liberado ? 'Parcelamento autorizado pelo responsável.' : '';
            campo(id,'autorizar-parcelas').hidden = solicitado <= limiteParcelas();
            campo(id,'resumo').textContent = `Cartão ${resultado.bandeira}: ${descreverParcelas(valoresParcelas)}. Total: ${formatarMoeda(total)}.`;
            resultado.descricao = campo(id,'resumo').textContent;
        } else resultado.descricao = `${forma === 'avista' ? 'À vista' : 'Outras condições'} | Desconto: ${aplicado}% (${formatarMoeda(desconto)})`;
        if (campo(id,'descricao')) campo(id,'descricao').value = resultado.descricao;
        return resultado;
    }
    function ocultar(id) { const painel = el(`cortina-pagamento-${id}`); if (painel) painel.hidden = true; el(`cortina-tab-pagamento-${id}`)?.setAttribute('aria-selected','false'); }
    window.MichelePagamento = {montar,calcular,ocultar,autenticar};
})();
