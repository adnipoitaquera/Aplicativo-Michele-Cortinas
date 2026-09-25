function montarLinhasDescritivoImpressao(cards) {
    const esc = escaparHtmlProduto;
    const campo = id => document.getElementById(id);
    const valor = id => campo(id)?.value || '';
    const texto = id => {
        const el = campo(id);
        const nome = el?.selectedOptions?.[0]?.textContent ?? el?.value ?? '';
        return String(nome).replace(/\s*-\s*R\$.*$/, '').trim();
    };
    const medida = n => n ? `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m` : '-';
    const juntar = itens => itens.filter(Boolean).join('\n') || '-';
    return cards.map((card, index) => {
        const id = card.id.replace('item-card-', '');
        const ambiente = valor(`ambiente-nome-${id}`).trim() || `Ambiente ${index + 1}`;
        const linhas = [];
        if (campo(`chk-cortina-${id}`)?.checked) {
            const tecidos = [], modelos = [];
            [['voal', 'Principal'], ['forro', 'Forro'], ['terceiro', 'Tecido 3']].forEach(([tipo, titulo]) => {
                const seletor = campo(`select-${tipo}-${id}`);
                if(!seletor?.value || seletor.disabled) return;
                tecidos.push(`${titulo}: ${texto(seletor.id)}`);
                if(valor(`modelo-${tipo}-${id}`)) modelos.push(`${titulo}: ${texto(`modelo-${tipo}-${id}`)}`);
            });
            linhas.push({
                tipo: 'Cortina de tecido', quantidade: valor(`quantidade-${id}`) || '1',
                tecidos: juntar(tecidos), modeloCortina: juntar(modelos),
                instalacao: texto(`instalacao-${id}`) || '-',
                tubo: Number(valor(`select-tubo-trilho-${id}`)) > 0 ? texto(`select-tubo-trilho-${id}`) : 'Não',
                motorizacao: campo(`chk-motorizacao-${id}`)?.checked ? 'Sim' : 'Não', modeloPersiana: '-',
                bando: texto(`bando-${id}`) || 'Não', corBando: valor(`cor-bando-${id}`) || '-',
                largura: medida(valor(`largura-${id}`)), altura: medida(valor(`altura-${id}`))
            });
        }
        card.querySelectorAll(`#container-persianas-${id} .opcional-box`).forEach(box => {
            const chk = box.querySelector('input[type="checkbox"]');
            if (!chk?.checked) return;
            const sufixo = chk.id.replace('chk-persiana-', '');
            const modeloCompleto = texto(`persiana-modelo-${sufixo}`);
            const [modelo, ...tecido] = modeloCompleto.split(/\s+-\s+/);
            const acabamento = (tipo, titulo, cor) => {
                const escolhido = valor(`persiana-${tipo}-${sufixo}`);
                if(!escolhido || escolhido === '0' || escolhido === 'Não') return '';
                return `${titulo}: ${texto(`persiana-${tipo}-${sufixo}`)}${valor(`persiana-${cor}-${sufixo}`) ? ' — ' + valor(`persiana-${cor}-${sufixo}`) : ''}`;
            };
            linhas.push({
                tipo: 'Persiana', quantidade: valor(`persiana-qtd-${sufixo}`) || '1',
                tecidos: tecido.join(' - ') || '-', modeloCortina: '-',
                instalacao: juntar([
                    acabamento('base-niveladora', 'Base Niveladora', 'cor-base-niveladora'),
                    acabamento('base-inferior', 'Base Inferior', 'cor-base-inferior'),
                    acabamento('comandos', 'Comandos', 'cor-comando')
                ]),
                tubo: valor(`persiana-tubo-${sufixo}`) && valor(`persiana-tubo-${sufixo}`) !== '0' ? texto(`persiana-tubo-${sufixo}`) : '-',
                motorizacao: '-', modeloPersiana: modelo || '-',
                bando: Number(valor(`persiana-bando-${sufixo}`)) > 0 ? texto(`persiana-bando-${sufixo}`) : 'Não',
                corBando: Number(valor(`persiana-bando-${sufixo}`)) > 0 ? valor(`persiana-cor-bando-${sufixo}`) || '-' : '-',
                largura: medida(valor(`persiana-largura-${sufixo}`)), altura: medida(valor(`persiana-altura-${sufixo}`))
            });
        });
        const total = campo(`resumo-valor-${id}`)?.textContent || formatarMoeda(0);
        return linhas.map((linha, indiceLinha) => {
            const valores = [linha.tecidos, linha.modeloCortina, linha.instalacao, linha.tubo, linha.motorizacao, linha.modeloPersiana, linha.bando, linha.corBando, linha.largura, linha.altura, linha.quantidade];
            return `<tr><td>${esc(String(index + 1).padStart(2, '0') + ' — ' + ambiente)}<br><strong>${esc(String(linha.quantidade).padStart(2, '0') + ' ' + linha.tipo)}</strong></td>${valores.map(v => `<td>${esc(v).replace(/\n/g, '<br>')}</td>`).join('')}${indiceLinha === 0 ? `<td rowspan="${linhas.length}" style="white-space:nowrap;font-weight:700">${esc(total)}</td>` : ''}</tr>`;
        }).join('');
    }).join('');
}
