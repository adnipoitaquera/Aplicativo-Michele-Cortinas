(function(root) {
  'use strict';
  function preparar(local, modelo, api) {
    const dados = {}, senhas = {};
    for (const chave of api.CHAVES) {
      const valor = local.getItem(chave);
      if (valor !== null) dados[chave] = api.limpar(chave, valor);
    }
    const profissionais = JSON.parse(local.getItem('michele_profissionais') || '[]');
    if (!profissionais.length) throw new Error('Abra o sistema no navegador onde seus usuários estão cadastrados.');
    const logins = new Set(), ids = new Set();
    for (const p of profissionais) {
      if (!p.id || !p.usuario || !p.senha) throw new Error('O cadastro de ' + (p.nome || p.usuario || 'um profissional') + ' está sem código, usuário ou senha. A cópia original foi preservada.');
      if (new TextEncoder().encode(p.senha).length > 72) throw new Error('A senha de ' + p.usuario + ' excede o limite de 72 bytes.');
      const login = p.usuario.trim().toLocaleLowerCase('pt-BR');
      if (logins.has(login) || ids.has(p.id)) throw new Error('Há usuários ou códigos duplicados. Nenhum dado foi enviado.');
      logins.add(login); ids.add(p.id); senhas[p.id] = p.senha;
    }
    const marcador = '-- MICHELE_IMPORTACAO_INICIAL';
    if (!modelo.includes(marcador)) throw new Error('Arquivo de instalação incompleto.');
    const literal = valor => "'" + JSON.stringify(valor).replace(/'/g, "''") + "'::jsonb";
    return modelo.replace(marcador,
      '-- Importação dos cadastros originais deste navegador. Guarde este arquivo em local privado.\n' +
      'select michele_privado.importar_inicial(' + literal(dados) + ',' + literal(senhas) + ');');
  }
  root.MicheleInstalacao = { preparar };
  if (typeof module !== 'undefined') module.exports = root.MicheleInstalacao;
})(typeof window !== 'undefined' ? window : globalThis);
