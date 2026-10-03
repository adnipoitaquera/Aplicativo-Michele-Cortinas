(function(root) {
    'use strict';
    const bases = {parede:'largura da parede × quantidade de cortinas',principal:'largura da parede × franzimento principal × quantidade de cortinas',consumo:'metragem de compra do tecido principal',forro:'metragem de compra do forro',terceiro:'metragem de compra do terceiro tecido'};
    const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function padrao(item = {}) {
        const texto = normalizar(`${item.nome || ''} ${item.subcategoria || ''}`);
        if (/ilhos/.test(texto)) return {tipo:'espacamento',base:'principal',valor:14,arredondamento:'exato'};
        if (/gancho|ganchinho|argola|rodizio|deslizante|clip/.test(texto)) return {tipo:'espacamento',base:'parede',valor:8,arredondamento:'exato'};
        if (/entretela|wave/.test(texto)) return {tipo:'metragem',base:'consumo',valor:1,arredondamento:'exato'};
        return {tipo:'padrao'};
    }
    function validar(regra) {
        if (!regra || regra.tipo === 'padrao') return {tipo:'padrao'};
        if (!['espacamento','metragem','fixa'].includes(regra.tipo) || !['exato','cima','par'].includes(regra.arredondamento)) throw Error('Selecione uma fórmula e um arredondamento válidos.');
        if (regra.tipo !== 'fixa' && !Object.hasOwn(bases,regra.base)) throw Error('Selecione a base do cálculo.');
        const valor = Number(regra.valor);
        if (!Number.isFinite(valor) || valor <= 0) throw Error('Informe um espaçamento, fator ou quantidade maior que zero.');
        return {tipo:regra.tipo,base:regra.base,valor,arredondamento:regra.arredondamento};
    }
    function calcular(regra, medidas, quantidadeOriginal, unidadeOriginal) {
        if (!regra || regra.tipo === 'padrao') return {quantidade:quantidadeOriginal,unidade:unidadeOriginal};
        const r = validar(regra);
        let quantidade = r.tipo === 'fixa' ? medidas.cortinas*r.valor : Number(medidas[r.base] || 0)*(r.tipo === 'espacamento' ? 100/r.valor : r.valor);
        if (r.arredondamento === 'cima') quantidade = Math.ceil(quantidade-1e-10);
        if (r.arredondamento === 'par') quantidade = Math.ceil(quantidade/2-1e-10)*2;
        return {quantidade,unidade:r.tipo === 'metragem' ? 'm' : 'un.'};
    }
    const el = id => root.document.getElementById(`produto-formula-${id}`);
    function ler() { return validar({tipo:el('tipo').value,base:el('base').value,valor:el('valor').value,arredondamento:el('arredondamento').value}); }
    function atualizar() {
        const tipo = el('tipo').value, automatico = tipo === 'padrao';
        el('base').disabled = automatico || tipo === 'fixa';
        el('valor').disabled = automatico;
        el('arredondamento').disabled = automatico;
        el('valor').required = !automatico;
        el('rotulo').textContent = tipo === 'espacamento' ? 'Espaçamento (cm)' : tipo === 'fixa' ? 'Quantidade por cortina' : 'Fator por metro';
        let texto = 'Mantém o cálculo do campo de orçamento: tubos usam metragem × quantidade; suportes e ponteiras usam a quantidade informada. Tecidos e persianas mantêm seus cálculos próprios.';
        if (!automatico) {
            const valor = el('valor').value || '…', base = bases[el('base').value];
            texto = tipo === 'fixa' ? `${valor} × quantidade de cortinas` : tipo === 'espacamento' ? `(${base}) ÷ (${valor} cm ÷ 100)` : `(${base}) × ${valor}`;
            texto += '. O total é a quantidade calculada × preço unitário do produto.';
        }
        el('resumo').textContent = texto;
    }
    function preencher(item = {}) {
        const r = item.formulaCortina || padrao(item);
        el('tipo').value = r.tipo;
        el('base').value = r.base || 'parede';
        el('valor').value = r.valor ?? 1;
        el('arredondamento').value = r.arredondamento || 'exato';
        atualizar();
    }
    function produtoSelecionado(select) {
        if (!select || select.value === '') return null;
        let itens = []; try { itens = JSON.parse(select.dataset.source || '[]'); } catch (_) {}
        const nome = select.selectedOptions[0]?.textContent?.replace(/\s*-\s*R\$.*$/, '').trim();
        return itens.find(p=>p.nome === nome && Number(p.preco) === Number(select.value)) || null;
    }
    root.MicheleProdutoFormulas = {padrao,validar,calcular,ler,atualizar,preencher,produtoSelecionado};
    if (typeof module !== 'undefined') module.exports = root.MicheleProdutoFormulas;
})(typeof window !== 'undefined' ? window : globalThis);
