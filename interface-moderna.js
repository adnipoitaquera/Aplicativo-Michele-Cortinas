(() => {
  'use strict';
  const painel = document.getElementById('painel-dashboard');
  const layout = document.querySelector('.app-layout');
  const topbar = document.querySelector('.v6-topbar');
  if (!painel || !layout || !topbar) return;

  const boasVindas = document.createElement('div');
  boasVindas.className = 'moderna-boas-vindas';
  boasVindas.innerHTML = '<div><small>Seu espaço de trabalho</small><h1>Vamos criar novos ambientes?</h1><p>Organize seus clientes, acompanhe pedidos e prepare o próximo orçamento em um só lugar.</p></div>';
  const novo = document.createElement('button');
  novo.type = 'button';
  novo.className = 'btn btn-ouro';
  novo.textContent = '+ Novo orçamento';
  novo.addEventListener('click', () => window.iniciarNovoOrcamento());
  boasVindas.append(novo);
  painel.prepend(boasVindas);

  const descricoes = ['Comece um novo projeto', 'Consulte e cadastre contatos', 'Acompanhe cada negociação', 'Sua rede de fornecimento', 'Parceiros de cada projeto', 'Organize seu catálogo', 'Veja os resultados do negócio', 'Consulte materiais e medidas', 'Planeje e aproveite materiais', 'Prepare a produção de cortinas'];
  painel.querySelectorAll('.dashboard > .dash-card').forEach((card, indice) => {
    const descricao = document.createElement('span');
    descricao.className = 'atalho-descricao';
    descricao.textContent = descricoes[indice] || 'Acessar módulo';
    card.append(descricao);
  });

  const sidebar = layout.querySelector('.sidebar');
  sidebar.id = sidebar.id || 'menu-principal';
  sidebar.setAttribute('aria-label', 'Navegação principal');
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'btn moderna-menu';
  menu.textContent = '☰ Menu';
  menu.setAttribute('aria-controls', sidebar.id);
  const mobile = window.matchMedia('(max-width: 800px)');
  const atualizarMenu = () => menu.setAttribute('aria-expanded', String(mobile.matches ? layout.classList.contains('menu-aberto') : !layout.classList.contains('menu-recolhido')));
  menu.addEventListener('click', () => {
    layout.classList.toggle(mobile.matches ? 'menu-aberto' : 'menu-recolhido');
    atualizarMenu();
  });
  topbar.querySelector('.v6-actions').prepend(menu);
  atualizarMenu();
  mobile.addEventListener('change', atualizarMenu);
  sidebar.addEventListener('click', event => {
    if (mobile.matches && event.target.closest('button')) {
      layout.classList.remove('menu-aberto');
      atualizarMenu();
    }
  });
  sidebar.querySelectorAll('.menu-dominio').forEach(grupo => {
    grupo.addEventListener('toggle', () => {
      if (grupo.open) sidebar.querySelectorAll('.menu-dominio').forEach(outro => {
        if (outro !== grupo) outro.open = false;
      });
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && layout.classList.contains('menu-aberto')) {
      layout.classList.remove('menu-aberto');
      atualizarMenu();
      menu.focus();
    }
  });
  const busca = document.getElementById('busca-global');
  busca?.setAttribute('aria-label', 'Buscar clientes, orçamentos, pedidos e fornecedores');
})();
