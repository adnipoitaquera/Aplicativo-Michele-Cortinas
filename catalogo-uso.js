(function(root) {
  'use strict';
  const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function uso(item, categoria = '') {
    if (item.tipoMaterial || item.materialId?.startsWith('persiana-material-')) return 'persianas';
    if (['cortinas','persianas','ambos'].includes(item.uso)) return item.uso;
    const descricao = normalizar(`${categoria} ${item.subcategoria || ''} ${item.nome || ''}`);
    if (/persiana|double vision|base inferior|base niveladora|tampa.*(?:base|bando)|comando\s*(?:32|38)|\btubo\s*(?:32|38|41|53)\b/.test(descricao)) return 'persianas';
    return 'cortinas';
  }
  const permite = (item,categoria,destino) => [destino,'ambos'].includes(uso(item,categoria));
  function grupos(categorias, filtro = '', busca = '') {
    const resultado=[];
    for(const dominio of ['cortinas','persianas','ambos']) {
      if(filtro && filtro !== dominio) continue;
      for(const [categoria,dados] of Object.entries(categorias)) {
        const itens=(dados.lista || []).map((item,indice)=>({item,indice})).filter(x=>uso(x.item,`${categoria} ${dados.nome}`)===dominio && normalizar(`${dados.nome} ${x.item.nome} ${x.item.subcategoria || ''}`).includes(normalizar(busca)));
        if(itens.length) resultado.push({categoria,dados,itens,dominio});
      }
    }
    return resultado;
  }
  function buscar(categorias,texto) {
    const busca=normalizar(texto).replace(/\s+/g,' ').trim();
    if(!busca)return [];
    return Object.entries(categorias).flatMap(([categoria,dados])=>(dados.lista || []).map((item,indice)=>({categoria,indice,item})).filter(x=>normalizar(x.item.nome).replace(/\s+/g,' ').trim().includes(busca)));
  }
  function preencher(categorias,texto) {
    const encontrados=buscar(categorias,texto),busca=normalizar(texto).replace(/\s+/g,' ').trim();
    const exatos=encontrados.filter(x=>normalizar(x.item.nome).replace(/\s+/g,' ').trim()===busca);
    if(exatos.length===1)return exatos[0];
    return encontrados.length===1 && busca.length>=2?encontrados[0]:null;
  }
  root.MicheleCatalogoUso={uso,permite,grupos,buscar,preencher};
  if(typeof module !== 'undefined') module.exports=root.MicheleCatalogoUso;
})(typeof window !== 'undefined' ? window : globalThis);
