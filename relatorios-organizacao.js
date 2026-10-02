(function(){
  'use strict';
  const vendas=document.getElementById('aba-relatorio-pedidos');
  const materiais=document.getElementById('aba-relatorio-materiais');
  if(!vendas||!materiais)return;
  const barra=document.createElement('div');
  barra.className='historico-toolbar';
  for(const [id,titulo] of [['relatorio-individual','Materiais por pedido'],['relatorio-geral-produtos','Resumo geral de materiais']]){
    const secao=document.getElementById(id);
    const botao=vendas.querySelector(`button[onclick="abrirRelatorioInterno('${id}')"]`);
    botao.textContent=titulo;barra.append(botao);
    secao.querySelector('h2').textContent=titulo;
    materiais.append(secao);
  }
  materiais.querySelector('.secao-titulo').after(barra);
  materiais.querySelector('.secao-titulo').remove();
  materiais.className='relatorio-grupo';
  const grupoVendas=document.createElement('div');grupoVendas.id='relatorio-grupo-vendas';grupoVendas.className='relatorio-grupo';
  Array.from(vendas.children).filter(el=>!el.classList.contains('secao-titulo')).forEach(el=>grupoVendas.append(el));
  vendas.append(grupoVendas,materiais);
  const confeccao=document.createElement('div');confeccao.id='relatorio-grupo-confeccao';confeccao.className='relatorio-grupo';
  confeccao.innerHTML=`<section id="relatorio-confeccao" class="relatorio-interno"><h2>Confecção por costureira</h2><p>Metragem dos tecidos dos pedidos, incluindo forro e terceiro tecido. O valor pago considera apenas saídas pagas no Financeiro vinculadas à costureira.</p><div class="historico-toolbar"><button type="button" class="btn" onclick="atualizarRelatorioConfeccao()">Atualizar</button><button type="button" class="btn" onclick="imprimirRelatorioLista('relatorio-confeccao')">Imprimir / Salvar em PDF</button></div><div class="tabela-scroll"><table><thead><tr><th>Costureira</th><th>Metragem total (m)</th><th>Valor previsto</th><th>Valor pago</th><th class="historico-toolbar">Pagamento</th></tr></thead><tbody id="rel-conf-corpo"></tbody><tfoot id="rel-conf-total"></tfoot></table></div><p id="rel-conf-aviso"></p></section>`;
  vendas.append(confeccao);
  const abas=document.createElement('div');abas.className='historico-toolbar';abas.setAttribute('role','tablist');abas.setAttribute('aria-label','Tipos de relatório');
  for(const [grupo,titulo,alvo] of [['vendas','Vendas',grupoVendas.id],['materiais','Materiais',materiais.id],['confeccao','Confecção',confeccao.id]]){
    const botao=document.createElement('button');botao.type='button';botao.className='btn';botao.id='relatorio-aba-'+grupo;
    botao.textContent=titulo;botao.setAttribute('role','tab');botao.setAttribute('aria-controls',alvo);
    botao.addEventListener('click',()=>abrirGrupoRelatorios(grupo));abas.append(botao);
    const painel=document.getElementById(alvo);painel.setAttribute('role','tabpanel');painel.setAttribute('aria-labelledby',botao.id);
  }
  vendas.querySelector('.secao-titulo').after(abas);
  window.abrirGrupoRelatorios=function(grupo){
    for(const [nome,painel] of [['vendas',grupoVendas],['materiais',materiais],['confeccao',confeccao]]){
      const ativo=nome===grupo; painel.style.display=ativo?'block':'none';
      const botao=document.getElementById('relatorio-aba-'+nome);botao.setAttribute('aria-selected',String(ativo));botao.classList.toggle('btn-ouro',ativo);
    }
    if(grupo==='confeccao')atualizarRelatorioConfeccao();
  };
  abrirGrupoRelatorios('vendas');
  document.getElementById('relatorio-individual').style.display='block';
  document.getElementById('relatorio-geral-pedidos').style.display='block';
})();
