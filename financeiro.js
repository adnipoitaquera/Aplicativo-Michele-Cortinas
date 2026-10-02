(function() {
  'use strict';
  const M=window.MicheleFinanceiro,el=id=>document.getElementById(id);
  const esc=valor=>String(valor ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moeda=n=>Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const data=d=>d ? d.split('-').reverse().join('/') : '—';
  const config=()=>JSON.parse(dadosStorage.getItem('michele_config_empresa') || '{}');
  const financeiro=()=>config().financeiro || {lancamentos:[],administradores:[]};
  let editando='',adminEditando='';
  function autorizado(){if(usuarioEhAdministrador())return true;alert('Somente o Administrador pode alterar o Financeiro.');return false;}
  function gravar(dados){
    if(!autorizado())return false;
    try {dadosStorage.setItem('michele_config_empresa',JSON.stringify({...config(),financeiro:dados}));return true;}
    catch(erro){alert('Não foi possível salvar o Financeiro: '+erro.message);return false;}
  }
  const lancamentos=()=>financeiro().lancamentos || [];
  const contas=()=>M.contas(lancamentos(),pedidos,numeroExibicao);
  function administradores(){
    const cadastrados=financeiro().administradores || [];
    const equipe=profissionais.filter(p=>p.cargo==='Administrador').map(p=>({id:'PROF-'+p.id,nome:p.nome,telefone:p.telefone || '',email:p.email || '',status:p.status==='Inativo'?'Inativo':'Ativo',profissional:true}));
    return [...equipe,...cadastrados];
  }
  function nomeAdmin(id){return administradores().find(a=>a.id===id)?.nome || '';}
  function opcoesAdmin(id,vazio){
    const select=el(id),atual=select.value;
    select.innerHTML=`<option value="">${vazio}</option>`+administradores().map(a=>`<option value="${esc(a.id)}">${esc(a.nome)}${a.status==='Inativo'?' (Inativo)':''}</option>`).join('');select.value=atual;
  }
  function statusTexto(x){return x.status==='Liquidado' ? x.tipo==='entrada'?'Recebido':'Pago' : x.status;}
  function classe(x){return x.status==='Liquidado'?'status-pronto':'status-novo';}
  function linhasTabela(lista,acoes=true){
    return lista.map(x=>`<tr><td>${x.tipo==='entrada'?'Entrada':'Saída'}</td><td><strong>${esc(x.descricao)}</strong><br><small>${esc(x.contato || '')}${x.numero ? ' — Pedido '+esc(x.numero):''}</small></td><td>${esc(x.categoria || '')}${x.administradorId ? '<br>'+esc(nomeAdmin(x.administradorId)):''}</td><td>${data(x.vencimento)}</td><td>${data(x.dataMovimento)}</td><td>${esc(x.conta || '')}</td><td>${moeda(x.valorBruto)}</td><td>${moeda(M.dinheiro(x.valorBruto-x.valorLiquido))}</td><td>${moeda(x.valorLiquido)}</td>${acoes?`<td><span class="status-pedido ${classe(x)}">${statusTexto(x)}</span></td><td><button type="button" class="btn" data-id="${esc(x.id)}" onclick="editarLancamentoFinanceiro(this.dataset.id)">Editar</button>${x.status==='Pendente'?` <button type="button" class="btn btn-ouro" data-id="${esc(x.id)}" onclick="editarLancamentoFinanceiro(this.dataset.id,true)">${x.tipo==='entrada'?'Receber':'Pagar'}</button>`:''}</td>`:''}</tr>`).join('');
  }
  function popularPedidos(){
    const select=el('fin-documento'),atual=select.value;
    select.innerHTML='<option value="">Sem vínculo com pedido</option>'+pedidos.filter(p=>p.tipo==='Pedido').map(p=>`<option value="${esc(p.idDocumento)}">${esc(numeroExibicao(p))} — ${esc(p.cliente?.nome || 'Cliente Avulso')}</option>`).join('');select.value=atual;
  }
  window.atualizarFormularioFinanceiro=function(){
    const categoria=el('fin-categoria').value;
    if(categoria==='Pró-labore')el('fin-tipo').value='saida';
    const tipoSaida=el('fin-tipo').value==='saida',status=el('fin-situacao').value;
    el('fin-situacao').innerHTML=`<option value="Pendente">${tipoSaida?'A pagar':'A receber'}</option><option value="Liquidado">${tipoSaida?'Pago':'Recebido'}</option><option value="Cancelado">Cancelado</option>`;
    el('fin-situacao').value=status || 'Pendente';
    el('fin-data-movimento').required=el('fin-situacao').value==='Liquidado';
    el('fin-data-label').textContent=tipoSaida?'Data do pagamento':'Data do recebimento';
    el('fin-documento').disabled=tipoSaida;
    if(tipoSaida)el('fin-documento').value='';
    el('fin-administrador').required=categoria==='Pró-labore';
    el('fin-prolabore-nota').hidden=categoria!=='Pró-labore';
    atualizarTaxasFinanceiro();
  };
  window.atualizarTaxasFinanceiro=function(){
    const bruto=Number(el('fin-bruto').value),liquido=el('fin-liquido').value===''?bruto:Number(el('fin-liquido').value);
    el('fin-taxas').textContent=moeda(M.dinheiro(bruto-liquido));
    el('fin-liquido').max=Number.isFinite(bruto)?bruto:'';
  };
  window.vincularPedidoFinanceiro=function(){
    const p=pedidos.find(p=>p.idDocumento===el('fin-documento').value);
    if(!p)return;
    el('fin-contato').value=p.cliente?.nome || '';
    if(!el('fin-descricao').value)el('fin-descricao').value='Recebimento do pedido '+numeroExibicao(p);
    if(p.dataEntrega)el('fin-vencimento').value=p.dataEntrega;
  };
  window.novoLancamentoFinanceiro=function(tipo='entrada'){
    if(!autorizado())return;
    abrirPainelFinanceiro('contas');editando='';el('fin-form').reset();popularPedidos();opcoesAdmin('fin-administrador','Sem administrador');
    el('fin-tipo').value=tipo;el('fin-categoria').value=tipo==='entrada'?'Recebimento':'Despesa';
    el('fin-situacao').value='Pendente';el('fin-vencimento').value=M.hoje();el('fin-editor').hidden=false;el('fin-editor-titulo').textContent='Novo lançamento';atualizarFormularioFinanceiro();
    el('fin-editor').scrollIntoView({behavior:'smooth',block:'start'});el('fin-descricao').focus();
  };
  window.fecharFinanceiro=function(){el('fin-editor').hidden=true;editando='';};
  window.abrirPainelFinanceiro=function(nome){
    for(const id of ['contas','relatorios','administradores'])el('fin-painel-'+id).hidden=id!==nome;
    if(nome==='relatorios')atualizarRelatorioFinanceiro();
  };
  window.novoProlaboreFinanceiro=function(){novoLancamentoFinanceiro('saida');el('fin-categoria').value='Pró-labore';el('fin-descricao').value='Pró-labore';atualizarFormularioFinanceiro();el('fin-administrador').focus();};
  window.novoMovimentoAdministradorFinanceiro=function(tipo){novoLancamentoFinanceiro(tipo);el('fin-categoria').value=tipo==='entrada'?'Aporte':'Retirada';el('fin-administrador').focus();};
  window.editarLancamentoFinanceiro=function(id,liquidar=false){
    const x=contas().find(x=>x.id===id);if(!x || !autorizado())return;
    novoLancamentoFinanceiro(x.tipo);editando=x.id;el('fin-editor-titulo').textContent=x.virtual?'Registrar saldo do pedido':'Editar lançamento';
    for(const [campo,chave] of [['tipo','tipo'],['categoria','categoria'],['descricao','descricao'],['contato','contato'],['documento','documentoId'],['vencimento','vencimento'],['conta','conta'],['bruto','valorBruto'],['liquido','valorLiquido'],['administrador','administradorId']])el('fin-'+campo).value=x[chave] ?? '';
    if(x.administradorId && !Array.from(el('fin-administrador').options).some(o=>o.value===x.administradorId)){opcoesAdmin('fin-administrador','Sem administrador');el('fin-administrador').value=x.administradorId;}
    el('fin-situacao').value=liquidar?'Liquidado':x.status;
    el('fin-data-movimento').value=liquidar?M.hoje():x.dataMovimento || '';
    atualizarFormularioFinanceiro();
  };
  window.salvarLancamentoFinanceiro=function(){
    if(!autorizado() || !el('fin-form').reportValidity())return;
    const dados=financeiro(),p=pedidos.find(p=>p.idDocumento===el('fin-documento').value);
    let x;
    try{
      x=M.validar({id:editando || crypto.randomUUID(),tipo:el('fin-tipo').value,categoria:el('fin-categoria').value,descricao:el('fin-descricao').value,contato:el('fin-contato').value.trim(),documentoId:p?.idDocumento || '',numero:p?numeroExibicao(p):'',vencimento:el('fin-vencimento').value,dataMovimento:el('fin-data-movimento').value,conta:el('fin-conta').value,valorBruto:el('fin-bruto').value,valorLiquido:el('fin-liquido').value,status:el('fin-situacao').value,administradorId:el('fin-administrador').value});
      if(x.administradorId && !administradores().some(a=>a.id===x.administradorId))throw Error('Selecione um administrador cadastrado.');
      if(x.documentoId && x.status!=='Cancelado'){
        const reservado=(dados.lancamentos || []).filter(a=>a.id!==x.id && a.documentoId===x.documentoId && a.tipo==='entrada' && a.status!=='Cancelado').reduce((s,a)=>s+M.centavos(a.valorBruto ?? a.valor),0);
        if(reservado+M.centavos(x.valorBruto)>M.centavos(p.valorTotal || 0))throw Error('O valor vinculado supera o saldo do pedido. Ajuste as parcelas existentes ou registre o valor sem vínculo com pedido.');
      }
    }catch(erro){alert(erro.message);return;}
    const anteriores=dados.lancamentos || [],existe=anteriores.some(a=>a.id===x.id);
    dados.lancamentos=existe?anteriores.map(a=>a.id===x.id?x:a):[...anteriores,x];
    if(!gravar(dados))return;
    fecharFinanceiro();atualizarFinanceiro();avisarGravacao('Lançamento financeiro salvo.');
  };
  window.atualizarFinanceiro=function(){
    if(!el('fin-corpo'))return;
    const lista=contas(),tipo=el('fin-filtro-tipo').value,status=el('fin-status').value,termo=el('fin-busca').value.trim().toLowerCase();
    const filtrados=lista.filter(x=>(!tipo || x.tipo===tipo) && (!status || x.status===status) && `${x.numero || ''} ${x.contato || ''} ${x.descricao} ${nomeAdmin(x.administradorId)} ${x.categoria}`.toLowerCase().includes(termo));
    el('fin-corpo').innerHTML=linhasTabela(filtrados) || '<tr><td colspan="11">Nenhum lançamento encontrado.</td></tr>';
    const pendente=tipo=>lista.filter(x=>x.status==='Pendente' && x.tipo===tipo).reduce((s,x)=>s+M.centavos(x.valorBruto),0)/100;
    el('fin-a-receber').textContent=moeda(pendente('entrada'));el('fin-a-pagar').textContent=moeda(pendente('saida'));
    const totais=M.totais(lista);el('fin-recebido').textContent=moeda(totais.entradas);el('fin-pago').textContent=moeda(totais.saidas);el('fin-saldo').textContent=moeda(totais.saldo);
    popularPedidos();opcoesAdmin('fin-administrador','Sem administrador');opcoesAdmin('fin-rel-admin','Todos os administradores');
    if(!el('fin-rel-data').value)el('fin-rel-data').value=M.hoje();
    const semData=lista.filter(x=>x.status==='Liquidado' && !x.dataMovimento).length;
    el('fin-sem-data').textContent=semData?`${semData} lançamento(s) liquidado(s) sem data de movimentação. Edite para incluir nos relatórios.`:'';
    const antigos=JSON.parse(localStorage.getItem('michele_financeiro') || '[]');
    const importaveis=antigos.filter(x=>!(financeiro().importadosLocal || []).includes(x.id));
    el('fin-importacao').hidden=!importaveis.length;
    el('fin-importacao-resumo').textContent=`${importaveis.length} lançamento(s) anterior(es) neste navegador. Revise-os após importar para esta empresa.`;
    atualizarAdministradoresFinanceiro();atualizarRelatorioFinanceiro();
  };
  function relatorio(){return M.relatorio(lancamentos(),el('fin-rel-periodo').value,el('fin-rel-data').value,el('fin-rel-admin').value);}
  window.atualizarRelatorioFinanceiro=function(){
    if(!el('fin-rel-data').value)return;
    let r;try{r=relatorio();}catch(erro){el('fin-rel-faixa').textContent=erro.message;return;}
    el('fin-rel-faixa').textContent=`${data(r.inicio)} a ${data(r.fim)} — movimentações efetivamente recebidas ou pagas`;
    el('fin-rel-administrador').textContent=el('fin-rel-admin').value?'Administrador: '+nomeAdmin(el('fin-rel-admin').value):'Todos os administradores';
    for(const k of ['bruto','taxas','entradas','saidas','saldo','prolabore'])el('fin-rel-'+k).textContent=moeda(r[k]);
    el('fin-rel-corpo').innerHTML=linhasTabela(r.linhas,false) || '<tr><td colspan="9">Nenhuma entrada ou saída liquidada neste período.</td></tr>';
  };
  window.exportarRelatorioFinanceiro=function(){
    let r;try{r=relatorio();}catch(erro){alert(erro.message);return;}
    const valores=r.linhas.map(x=>[x.tipo==='entrada'?'Entrada':'Saída',x.descricao,x.categoria,nomeAdmin(x.administradorId),x.numero || '',data(x.vencimento),data(x.dataMovimento),x.conta || '',x.valorBruto.toFixed(2),M.dinheiro(x.valorBruto-x.valorLiquido).toFixed(2),x.valorLiquido.toFixed(2)]);
    valores.unshift(['Tipo','Descrição','Categoria','Administrador','Pedido','Vencimento','Movimentação','Conta','Bruto','Taxas / descontos','Líquido']);
    const csv='\uFEFF'+valores.map(l=>l.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`financeiro-${r.inicio}-${r.fim}.csv`;a.click();URL.revokeObjectURL(url);
  };
  window.imprimirRelatorioFinanceiro=function(){atualizarRelatorioFinanceiro();document.body.classList.add('imprimindo-financeiro');imprimirComRetorno();};
  window.limparAdministradorFinanceiro=function(){adminEditando='';el('fin-admin-form').reset();};
  window.editarAdministradorFinanceiro=function(id){
    const a=(financeiro().administradores || []).find(a=>a.id===id);if(!a || !autorizado())return;
    adminEditando=id;for(const k of ['nome','telefone','email','status'])el('fin-admin-'+k).value=a[k] || '';el('fin-admin-nome').focus();
  };
  window.salvarAdministradorFinanceiro=function(){
    if(!autorizado() || !el('fin-admin-form').reportValidity())return;
    const a={id:adminEditando || crypto.randomUUID()};for(const k of ['nome','telefone','email','status'])a[k]=el('fin-admin-'+k).value.trim();
    if(!a.nome){alert('Informe o nome do administrador.');return;}
    const dados=financeiro(),lista=dados.administradores || [];
    dados.administradores=lista.some(x=>x.id===a.id)?lista.map(x=>x.id===a.id?a:x):[...lista,a];
    if(!gravar(dados))return;
    limparAdministradorFinanceiro();atualizarFinanceiro();avisarGravacao('Administrador financeiro salvo.');
  };
  function atualizarAdministradoresFinanceiro(){
    el('fin-admin-lista').innerHTML=administradores().map(a=>`<tr><td>${esc(a.nome)}</td><td>${esc(a.telefone)}</td><td>${esc(a.email)}</td><td>${esc(a.status)}</td><td>${a.profissional?'Cadastro de Profissionais':`<button type="button" class="btn" data-id="${esc(a.id)}" onclick="editarAdministradorFinanceiro(this.dataset.id)">Editar</button>`}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum administrador cadastrado.</td></tr>';
  }
  window.importarFinanceiroAnterior=function(){
    if(!autorizado())return;
    const dados=financeiro(),antigos=JSON.parse(localStorage.getItem('michele_financeiro') || '[]');
    const novos=antigos.filter(x=>!(dados.importadosLocal || []).includes(x.id));
    if(!novos.length)return;
    dados.lancamentos=[...(dados.lancamentos || []),...novos.filter(x=>!(dados.lancamentos || []).some(a=>a.id===x.id)).map(M.normalizarAntigo)];
    dados.importadosLocal=[...new Set([...(dados.importadosLocal || []),...novos.map(x=>x.id)])];
    if(!gravar(dados))return;atualizarFinanceiro();avisarGravacao('Lançamentos anteriores importados. Confira as datas e os valores líquidos.');
  };
})();
