(function () {
  'use strict';
  window.editarNomeCategoriaProduto = function () {
    const campo=document.getElementById('produto-categoria-nome');
    if(document.getElementById('produto-categoria').value==='novo'){alert('Selecione uma categoria existente para alterar o nome.');return;}
    campo.scrollIntoView({behavior:'smooth',block:'center'});campo.focus();campo.select();
  };
  window.salvarNomeCategoriaProduto = function () {
    if (!usuarioEhAdministrador()) { alert('Somente o Administrador pode alterar categorias.'); return; }
    const categoria = document.getElementById('produto-categoria').value;
    const dados = categoriasProduto[categoria];
    const nome = document.getElementById('produto-categoria-nome').value.trim();
    if (!dados || !nome) { alert('Selecione uma categoria existente e informe o nome.'); return; }
    if (Object.entries(categoriasProduto).some(([id,c]) => id !== categoria && normalizarNomeTecido(c.nome) === normalizarNomeTecido(nome))) { alert('Já existe uma categoria com esse nome.'); return; }
    const personalizada = produtosPersonalizados.find(p => p.id === categoria);
    let lista;
    try {
      if (personalizada) {
        lista = dados.lista.map(item => ({...item,uso:MicheleCatalogoUso.uso(item,`${categoria} ${dados.nome}`)}));
        const atualizados = produtosPersonalizados.map(p => p.id === categoria ? {...p,nome,lista} : p);
        dadosStorage.setItem('michele_produtos_personalizados',JSON.stringify(atualizados));
        personalizada.nome = nome;
        dados.lista.splice(0,dados.lista.length,...lista);
      } else {
        const config = JSON.parse(dadosStorage.getItem('michele_config_empresa') || '{}');
        config.nomesCategorias = {...config.nomesCategorias,[categoria]:nome};
        dadosStorage.setItem('michele_config_empresa',JSON.stringify(config));
      }
    } catch (erro) { alert('Não foi possível alterar a categoria: ' + erro.message); return; }
    dados.nome = nome;
    const campoNome=document.getElementById('produto-categoria-nome');
    campoNome.value=nome;
    const feedback=document.getElementById('produto-categoria-status');
    if(feedback)feedback.textContent='Nome da categoria atualizado para: '+nome+'.';
    atualizarCategoriasProdutoSelecionaveis(categoria);
    atualizarTabelaProdutos(); atualizarOpcoesProdutos();
    avisarGravacao('Categoria atualizada.');
  };
})();
