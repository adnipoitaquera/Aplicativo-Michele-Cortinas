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
  document.getElementById('relatorio-individual').style.display='block';
  document.getElementById('relatorio-geral-pedidos').style.display='block';
})();
