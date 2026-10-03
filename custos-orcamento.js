function registrarCustoMaterial(material, id) {
  if (material.custoTotal != null) return {...material};
  const select = material.produtoChave ? document.getElementById(`${material.produtoChave}-${id}`) : null;
  const nome = String(select?.selectedOptions?.[0]?.textContent || material.nome).replace(/\s*-\s*R\$.*$/, '').replace(/\s+[—-]\s+(Tecido principal|Forro|Tecido 3).*$/i,'').trim();
  let lista = [];
  try { lista = JSON.parse(select?.dataset.source || '[]'); } catch (_) {}
  if (!lista.length) lista = Object.values(categoriasProduto).flatMap(c=>c.lista);
  const candidatos = lista.filter(p=>p.nome === nome && Number(p.preco) === Number(material.valorUnitario));
  const custos = [...new Set(candidatos.map(p=>p.custo).filter(c=>c!=null))];
  const custoUnitario = custos.length === 1 ? Number(custos[0]) : null;
  return {...material,custoUnitario,custoTotal:custoUnitario == null ? null : custoUnitario*material.quantidade};
}
function materiaisCustosAmbiente(materiais, id, card) {
  const linhas = materiais.filter(m=>m.unidade!=='conj.').map(m=>registrarCustoMaterial(m,id));
  const adicionar = (nome,qtd,preco,unidade='un.') => {
    if (qtd>0 && preco>0) linhas.push(registrarCustoMaterial({nome,quantidade:qtd,unidade,valorUnitario:preco,valorTotal:qtd*preco},id));
  };
  card.querySelectorAll(`#container-persianas-${id} .opcional-box`).forEach(box=>{
    if(!box.querySelector('input[type="checkbox"]')?.checked) return;
    const inputs=box.querySelectorAll('input[type="number"]');
    const largura=Number(inputs[0]?.value)||0, altura=Number(inputs[1]?.value)||0, qtd=Number(inputs[2]?.value)||1;
    const select=box.querySelector('select');
    adicionar(select?.selectedOptions[0]?.textContent||'Persiana',largura*altura*qtd,Number(select?.value),'m²');
    const tubo=Math.max(0,largura-.025);
    const consumos={bando:largura,'base-niveladora':largura,'base-inferior':tubo,tubo,'dupla-face':tubo*2,comandos:1,'tampa-bando':2,'tampa-base':2};
    const selects=Object.fromEntries(Array.from(box.querySelectorAll('[data-material-persiana]'),s=>[s.dataset.materialPersiana,s]));
    Object.entries(consumos).forEach(([tipo,consumo])=>{
      if(tipo==='tampa-bando' && !Number(selects.bando?.value))return;
      if(tipo==='tampa-base' && !Number(selects['base-inferior']?.value))return;
      const s=selects[tipo]; adicionar(s?.selectedOptions[0]?.textContent||tipo,consumo*qtd,Number(s?.value),consumo>2?'m':'un.');
    });
  });
  const ler=chave=>document.getElementById(`${chave}-${id}`);
  if(ler('chk-motorizacao')?.checked){
    const largura=Number(ler('m-trilho-larg')?.value)||0,qtd=Number(ler('m-trilho-qtd')?.value)||1,motores=Number(ler('m-motor-qtd')?.value)||1;
    if(ler('m-chk-trilho')?.checked)adicionar('Trilho Motorizado',largura*qtd,precoCatalogo('motorizacao','Trilho Motorizado',40.14),'m');
    if(ler('m-chk-motor')?.checked)adicionar('Motor para Trilho',motores,precoCatalogo('motorizacao','Motor para Trilho',1882.4));
    if(Number(ler('m-select-comp')?.value)>0)adicionar('Kit Wave',largura||Number(ler('largura')?.value)||0,precoCatalogo('motorizacao','Kit Wave',Number(ler('m-select-comp').value)),'m');
    if(Number(ler('m-select-inst')?.value)>0)adicionar('Kit de Instalação Wave',motores,precoCatalogo('motorizacao','Kit de Instalação Wave',Number(ler('m-select-inst').value)));
    if(Number(ler('m-select-controle')?.value)>0)adicionar('Controle 01 Canal',Number(ler('m-controle-qtd')?.value)||1,precoCatalogo('motorizacao','Controle 01 Canal',Number(ler('m-select-controle').value)));
  }
  return linhas;
}
function celulasRentabilidade(doc){
  const r=MicheleProdutoPrecos.resumo(doc);
  return `<td>${formatarMoeda(r.custo)}${r.completo?'':' (parcial)'}</td><td>${r.completo?formatarMoeda(r.lucro):'—'}</td>`;
}
