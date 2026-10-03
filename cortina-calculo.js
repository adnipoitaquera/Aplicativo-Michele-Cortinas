(function(root) {
    'use strict';
    const positivo = n => Math.max(0, Number(n) || 0);
    function tecido({largura, altura, proporcao, quantidade = 1, inverter = false, larguraTecido = 3, acrescimo = 0.5}) {
        largura = positivo(largura); altura = positivo(altura); proporcao = positivo(proporcao);
        quantidade = positivo(quantidade); larguraTecido = positivo(larguraTecido);
        if (!largura || !proporcao || !quantidade) return {metros:0, partes:0, comprimento:0};
        if (!inverter) return {metros:largura * proporcao * quantidade, partes:0, comprimento:0};
        if (!altura || !larguraTecido) return {metros:0, partes:0, comprimento:0};
        const partes = Math.ceil(largura * proporcao / larguraTecido - 1e-10) * quantidade;
        const comprimento = altura + positivo(acrescimo);
        return {metros:partes * comprimento, partes, comprimento};
    }
    function calcular(ler, nome) {
        const largura = positivo(ler('largura')), altura = positivo(ler('altura')), quantidade = positivo(ler('quantidade')) || 1;
        const materiais = [], tecidos = {}, avisos = [];
        const tipoCabecote = String(ler('cortina-cabecote-tipo') || '');
        const medidaCabecote = /(?:simples|franzidor).*([58]) cm/.exec(tipoCabecote);
        const cabecote = medidaCabecote ? Number(medidaCabecote[1]) / 100 : ler('cortina-altura-cabecote') == null || ler('cortina-altura-cabecote') === '' ? 0.09 : positivo(ler('cortina-altura-cabecote'));
        const barraTexto = String(ler('cortina-barra') || '');
        const barra = /\d/.test(barraTexto) ? positivo(parseFloat(barraTexto.replace(',','.'))) / 100 : 0;
        const alturaCorte = Math.round((altura + cabecote + barra) * 1000000) / 1000000;
        const adicionar = (chave,qtd,unidade,descricao,extra={}) => {
            const valor = positivo(ler(chave));
            if (qtd > 0 && ler(chave) !== '' && ler(chave) != null) materiais.push({produtoChave:chave,nome:descricao || nome(chave), quantidade:qtd, unidade, valorUnitario:valor, valorTotal:qtd*valor,...extra});
        };
        for (const tipo of ['voal','forro','terceiro']) {
            const selecionado = ler(`select-${tipo}`) !== '' && ler(`select-${tipo}`) != null;
            const inversao = ler(`cortina-inverter-${tipo}`);
            const larguraTecido = positivo(ler(`cortina-largura-tecido-${tipo}`)) || 3;
            const necessaria = altura > 0 && alturaCorte > larguraTecido + 1e-9;
            const inverter = inversao === 'Sim' || necessaria;
            const corte = selecionado ? tecido({largura,altura,quantidade,proporcao:ler(`prop-${tipo}`),inverter,larguraTecido,acrescimo:cabecote + barra}) : {metros:0,partes:0,comprimento:0};
            if (selecionado && corte.metros > 0 && inverter) avisos.push({tipo,nome:nome(`select-${tipo}`),automatico:necessaria,alturaParede:altura,cabecote,barra,alturaCorte,larguraTecido,partes:corte.partes,comprimento:corte.comprimento,metros:corte.metros});
            tecidos[tipo] = corte;
            adicionar(`select-${tipo}`,corte.metros,'m',null,{partes:corte.partes || '',dimensao:corte.comprimento ? `${corte.comprimento.toFixed(2)} m` : '',tecido:tipo});
        }
        const metros = Object.values(tecidos).reduce((s,t)=>s+t.metros,0);
        const valorCostureira = ler('costureira-valor') == null || ler('costureira-valor') === '' ? 45 : positivo(ler('costureira-valor'));
        if (metros) materiais.push({nome:'Mão de obra de confecção',quantidade:metros/1.4,unidade:'faixa',valorUnitario:valorCostureira,valorTotal:metros/1.4*valorCostureira,custoUnitario:valorCostureira,custoTotal:metros/1.4*valorCostureira});
        for (const tipo of ['rodizio','argola','gancho','clip']) adicionar(`select-${tipo}`,largura/0.08*quantidade,'un.');
        // A largura com franzimento independe da metragem de compra quando o tecido é invertido.
        const larguraPrincipal = tecidos.voal.metros > 0 ? largura * positivo(ler('prop-voal')) * quantidade : 0;
        adicionar('select-ilhos',larguraPrincipal/0.14,'un.');
        for (const tipo of ['entretela','wave']) adicionar(`select-${tipo}`,tecidos.voal.metros,'m');
        adicionar('select-tubo-trilho',positivo(ler('tubo-trilho-tamanho'))*positivo(ler('tubo-trilho-qtd')),'m');
        for (const tipo of ['suporte','ponteira']) adicionar(`select-${tipo}`,positivo(ler(`cortina-${tipo}-qtd`)),'un.');
        adicionar('instalacao-valor',positivo(ler('instalacao-qtd')),'un.','Instalação');
        return {materiais,tecidos,avisos,total:materiais.reduce((s,m)=>s+m.valorTotal,0)};
    }
    root.MicheleCortinaCalculo = {tecido,calcular};
    if (typeof module !== 'undefined') module.exports = root.MicheleCortinaCalculo;
})(typeof window !== 'undefined' ? window : globalThis);
