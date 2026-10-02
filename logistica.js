(function(){
  'use strict';
  const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config=()=>JSON.parse(dadosStorage.getItem('michele_config_empresa')||'{}');
  const cadastros=()=>config().logistica||{responsaveis:[],rotas:[]};
  const permitido=()=>typeof usuarioEhAdministrador==='function' && usuarioEhAdministrador();
  function gravarPedidos(lista){
    dadosStorage.setItem('michele_pedidos',JSON.stringify(lista));pedidos=lista;
    if(typeof objetoOrcamentoCorrente!=='undefined' && objetoOrcamentoCorrente?.idDocumento){const atual=lista.find(p=>p.idDocumento===objetoOrcamentoCorrente.idDocumento);if(atual){objetoOrcamentoCorrente.logistica=atual.logistica;objetoOrcamentoCorrente.producao=atual.producao;}}
  }
  function codigo(){return Array.from(crypto.getRandomValues(new Uint8Array(7)),n=>String(n%100).padStart(2,'0')).join('');}
  window.garantirCodigosLogistica=function(){
    const resultado=MicheleLogisticaModelo.garantir(pedidos,codigo);
    if(resultado.mudou)gravarPedidos(resultado.pedidos);
    return MicheleLogisticaModelo.itens(pedidos);
  };
  function salvarCadastros(dados){const atual=config();dadosStorage.setItem('michele_config_empresa',JSON.stringify({...atual,logistica:dados}));}
  window.atualizarOperacaoLeitura=function(){
    const consulta=el('log-acao').value==='consultar';
    el('log-registrar').textContent=consulta?'Consultar etiqueta':'Registrar leitura';
    el('log-consulta').hidden=true;el('log-feedback').textContent='';
    el('log-codigo').focus();
  };
  function mostrarConsulta(x){
    const dados=cadastros(),rota=(dados.rotas||[]).find(r=>r.id===x.peca.rotaId);
    const responsavel=(dados.responsaveis||[]).find(r=>r.id===rota?.responsavelId);
    const campos=[['Cliente',x.doc.cliente?.nome],['Pedido',numeroExibicao(x.doc)],['Telefone',x.doc.cliente?.telefone],['Endereço',x.doc.cliente?.endereco],['Ambiente',x.item.ambiente],['Peça',`${x.peca.unidade} de ${Number(x.item.quantidade)||1}`],['Produto',x.item.descPersiana||x.item.modelo||x.item.textoVoal],['Medidas',`${Number(x.item.largura||0).toFixed(2)} × ${Number(x.item.altura||0).toFixed(2)} m`],['Status',x.peca.estado],['Rota',rota?.nome],['Responsável',responsavel?.nome]];
    const painel=el('log-consulta');
    painel.innerHTML=`<h3>Identificação do pacote</h3><p>Código: <strong>${esc(x.peca.codigo)}</strong></p><div class="operacao-grid">${campos.map(([nome,valor])=>`<div class="operacao-card"><small>${esc(nome)}</small><p>${esc(valor||'Não informado')}</p></div>`).join('')}</div><h4>Histórico de movimentações</h4>${(x.peca.historico||[]).map(h=>`<p>${esc(h.estado)} · ${esc(new Date(h.data).toLocaleString('pt-BR'))} · ${esc(h.usuario)}</p>`).join('')||'<p>Nenhuma movimentação registrada.</p>'}`;
    painel.hidden=false;
  }
  window.atualizarLogistica=function(){
    if(!permitido())return;
    const shell=el('log-shell');if(!shell)return;
    if(!shell.children.length)shell.innerHTML=`
      <div class="modulo-cabecalho"><div><h2>Logística e entregas</h2><p>Consulte uma etiqueta para identificar o pacote sem alterar seu status. Escolha uma operação para registrar a movimentação.</p></div></div>
      <form id="log-leitura" onsubmit="event.preventDefault();lerEtiquetaLogistica()"><div class="historico-toolbar"><label for="log-acao">Operação</label><select id="log-acao" onchange="atualizarOperacaoLeitura()"><option value="consultar">Consultar etiqueta</option><option value="receber">Receber da confecção</option><option value="carregar">Saiu para entrega</option><option value="entregar">Confirmar entrega</option></select><input id="log-codigo" autocomplete="off" placeholder="Leia o código e pressione Enter" aria-label="Código da etiqueta"><button id="log-registrar" class="btn btn-ouro">Consultar etiqueta</button></div></form><p id="log-feedback" role="status" aria-live="polite"></p><section id="log-consulta" hidden aria-label="Identificação do pacote"></section><p id="log-notificacoes"></p>
      <details><summary>Cadastro de motoristas e instaladores</summary><form onsubmit="event.preventDefault();salvarResponsavelLogistica()"><div class="grid-forms"><div class="form-group"><label>Nome</label><input id="log-resp-nome" required></div><div class="form-group"><label>Função</label><select id="log-resp-tipo"><option>Motorista</option><option>Instalador</option><option>Motorista e instalador</option></select></div><div class="form-group"><label>Telefone</label><input id="log-resp-telefone" type="tel"></div></div><button class="btn">Cadastrar responsável</button></form><p id="log-responsaveis"></p></details>
      <details><summary>Cadastrar rota</summary><form onsubmit="event.preventDefault();salvarRotaLogistica()"><div class="grid-forms"><div class="form-group"><label>Nome da rota</label><input id="log-rota-nome" required></div><div class="form-group"><label>Data</label><input id="log-rota-data" type="date" required></div><div class="form-group"><label>Motorista ou instalador</label><select id="log-rota-responsavel" required></select></div><div class="form-group"><label>Local de saída</label><input id="log-rota-origem" placeholder="Endereço completo"></div></div><button class="btn">Criar rota</button></form></details>
      <div class="historico-toolbar"><input id="log-busca" type="search" placeholder="Filtrar pedido, cliente, ambiente ou código" oninput="atualizarLogistica()"><select id="log-rota" onchange="atualizarLogistica()"><option value="">Todas as rotas</option></select><button class="btn" onclick="vincularPecasRota()">Vincular peças selecionadas à rota</button><button class="btn" onclick="abrirMapaRota()">Abrir rota no mapa</button></div><p id="log-rota-info"></p>
      <div class="tabela-scroll"><table><thead><tr><th>Selecionar</th><th>Código / pedido</th><th>Cliente / ambiente</th><th>Peça</th><th>Status</th><th>Rota / responsável</th><th>Rastreamento</th></tr></thead><tbody id="log-corpo"></tbody></table></div>`;
    let lista;try{lista=garantirCodigosLogistica();}catch(e){el('log-feedback').textContent='Não foi possível preparar as etiquetas: '+e.message;return;}
    const dados=cadastros(),responsaveis=dados.responsaveis||[],rotas=dados.rotas||[];
    for(const [id,opcoes,padrao] of [['log-rota',rotas,'Todas as rotas'],['log-rota-responsavel',responsaveis,'Selecione o responsável']]){
      const select=el(id),atual=select.value;
      select.innerHTML=`<option value="">${padrao}</option>`+opcoes.map(x=>`<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('');select.value=atual;
    }
    el('log-responsaveis').textContent=responsaveis.map(x=>`${x.nome} (${x.tipo})`).join(' · ')||'Nenhum responsável cadastrado.';
    const pendentes=pedidos.flatMap(p=>(p.logistica?.notificacoes||[]).filter(n=>n.status==='Pendente de integração WhatsApp').map(n=>numeroExibicao(p)));
    el('log-notificacoes').textContent=pendentes.length?'Avisos de saída aguardando integração com WhatsApp: '+[...new Set(pendentes)].join(', '):'';
    const filtro=el('log-rota').value,termo=el('log-busca').value.trim().toLocaleLowerCase('pt-BR'),rota=rotas.find(r=>r.id===filtro);
    el('log-rota-info').textContent=rota?`${rota.nome} · ${rota.data} · ${responsaveis.find(r=>r.id===rota.responsavelId)?.nome||'Responsável não informado'}`:'';
    lista=lista.filter(x=>(!filtro||!x.peca.rotaId||x.peca.rotaId===filtro)&&`${x.peca.codigo} ${numeroExibicao(x.doc)} ${x.doc.cliente?.nome} ${x.item.ambiente}`.toLocaleLowerCase('pt-BR').includes(termo));
    el('log-corpo').innerHTML=lista.map(x=>{
      const r=rotas.find(r=>r.id===x.peca.rotaId),resp=responsaveis.find(p=>p.id===r?.responsavelId);
      return `<tr><td><input type="checkbox" class="log-selecao" value="${x.peca.codigo}" aria-label="Selecionar peça ${x.peca.codigo}"></td><td><strong>${x.peca.codigo}</strong><br>${esc(numeroExibicao(x.doc))}</td><td>${esc(x.doc.cliente?.nome)}<br>${esc(x.item.ambiente)}</td><td>${x.peca.unidade}/${Number(x.item.quantidade)||1}</td><td>${esc(x.peca.estado)}</td><td>${esc(r?.nome||'Sem rota')}<br>${esc(resp?.nome||'')}</td><td><details><summary>Histórico</summary>${(x.peca.historico||[]).map(h=>`<p>${esc(h.estado)} · ${esc(new Date(h.data).toLocaleString('pt-BR'))} · ${esc(h.usuario)}</p>`).join('')||'Aguardando leitura'}</details></td></tr>`;
    }).join('')||'<tr><td colspan="7">Nenhuma peça para os filtros selecionados.</td></tr>';
  };
  window.lerEtiquetaLogistica=function(){
    if(!permitido())return;
    const entrada=el('log-codigo'),feedback=el('log-feedback');
    el('log-consulta').hidden=true;
    try{
      if(el('log-acao').value==='consultar'){
        mostrarConsulta(MicheleLogisticaModelo.consultar(pedidos,entrada.value.trim()));
        feedback.textContent='Etiqueta encontrada. Consulta realizada sem alterar o status da peça.';
        entrada.value='';entrada.focus();return;
      }
      const resultado=MicheleLogisticaModelo.ler(pedidos,entrada.value.trim(),el('log-acao').value,usuarioAtual?.nome||'Administrador',new Date().toISOString());
      if(!resultado.repetido)gravarPedidos(resultado.pedidos);
      feedback.textContent=resultado.repetido?'Esta leitura já foi registrada.':`${numeroExibicao(resultado.x.doc)} · ${resultado.x.item.ambiente} · peça ${resultado.x.peca.unidade}: ${resultado.x.peca.estado}.`;
      entrada.value='';atualizarLogistica();atualizarProducao();
    }catch(e){feedback.textContent='Leitura não registrada: '+e.message;}
    entrada.focus();
  };
  window.salvarResponsavelLogistica=function(){if(!permitido())return;const nome=el('log-resp-nome').value.trim();if(!nome)return;const dados=cadastros();try{salvarCadastros({...dados,responsaveis:[...(dados.responsaveis||[]),{id:crypto.randomUUID(),nome,tipo:el('log-resp-tipo').value,telefone:el('log-resp-telefone').value.trim()}]});el('log-resp-nome').value='';atualizarLogistica();avisarGravacao('Responsável cadastrado.');}catch(e){alert(e.message);}};
  window.salvarRotaLogistica=function(){if(!permitido())return;const dados=cadastros(),responsavelId=el('log-rota-responsavel').value,nome=el('log-rota-nome').value.trim(),data=el('log-rota-data').value;if(!nome||!data||!(dados.responsaveis||[]).some(p=>p.id===responsavelId))return;try{salvarCadastros({...dados,rotas:[...(dados.rotas||[]),{id:crypto.randomUUID(),nome,data,responsavelId,origem:el('log-rota-origem').value.trim()}]});el('log-rota-nome').value='';atualizarLogistica();avisarGravacao('Rota cadastrada.');}catch(e){alert(e.message);}};
  window.vincularPecasRota=function(){
    if(!permitido())return;
    const rotaId=el('log-rota').value,codigos=new Set(Array.from(document.querySelectorAll('.log-selecao:checked'),x=>x.value));
    if(!rotaId||!codigos.size){alert('Selecione uma rota e as peças que deseja vincular.');return;}
    const selecionadas=MicheleLogisticaModelo.itens(pedidos).filter(x=>codigos.has(x.peca.codigo));
    if(selecionadas.some(x=>['Em rota','Entregue'].includes(x.peca.estado))){alert('Peças em rota ou entregues não podem ser transferidas.');return;}
    const data=new Date().toISOString();
    try{const lista=pedidos.map(p=>{if(!p.logistica)return p;const pecas=Object.fromEntries(Object.entries(p.logistica.pecas).map(([codigo,x])=>[codigo,codigos.has(codigo)?{...x,rotaId,historico:[...(x.historico||[]),{acao:'vincular',estado:'Vinculado à rota',data,usuario:usuarioAtual?.nome||''}]}:x]));return {...p,logistica:{...p.logistica,pecas}};});gravarPedidos(lista);atualizarLogistica();el('log-feedback').textContent='Peças vinculadas à rota.';}catch(e){alert('Não foi possível salvar: '+e.message);}
  };
  window.abrirMapaRota=function(){
    const rota=(cadastros().rotas||[]).find(r=>r.id===el('log-rota').value);
    if(!rota){alert('Selecione uma rota.');return;}
    const docs=[...new Map(MicheleLogisticaModelo.itens(pedidos).filter(x=>x.peca.rotaId===rota.id && x.peca.estado!=='Entregue').map(x=>[x.doc.idDocumento,x.doc])).values()];
    const enderecos=docs.map(d=>d.cliente?.endereco?.trim());
    if(!enderecos.length||enderecos.some(e=>!e)){alert('Informe o endereço de todos os clientes da rota.');return;}
    if(enderecos.length>10){alert('Esta rota tem mais de 10 endereços. Divida-a em rotas menores para abrir no mapa.');return;}
    const params=new URLSearchParams({api:'1',destination:enderecos.at(-1),travelmode:'driving'});if(rota.origem)params.set('origin',rota.origem);if(enderecos.length>1)params.set('waypoints',enderecos.slice(0,-1).join('|'));
    window.open('https://www.google.com/maps/dir/?'+params,'_blank','noopener,noreferrer');
  };
})();
