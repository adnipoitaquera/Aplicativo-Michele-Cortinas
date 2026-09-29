(function() {
  'use strict';
  const config = window.MICHELE_SUPABASE || {};
  if (config.authMode !== 'usuario' || config.enabled === false) return;
  const local = window.localStorage, { NuvemStore, CHAVES } = window.MicheleNuvemStore;
  const sessionKey = 'michele_sessao_usuario:' + config.url;
  let store, token, usuario, timer, entrando = false, lockObtido = false;
  const api = { ativo: true, login, iniciar, sair, sincronizar, exportarLocais, exportarPendentes, recarregar, prepararInstalacao };
  window.MicheleNuvem = api;
  api.autorizar = async (login, senha, contexto) => {
    const resposta = await rpc('michele_u_autorizar', {p_token:token, p_login:login, p_senha:senha, p_contexto:contexto});
    if (resposta.erro) throw new Error(resposta.erro);
    return resposta;
  };
  window.dadosStorage = {
    getItem: chave => store ? store.getItem(chave) : local.getItem(chave),
    setItem(chave, valor) {
      if (!api.ativo) {
        local.setItem(chave, valor);
        status('local', 'Salvo somente neste navegador. A instalação da nuvem ainda precisa ser concluída.');
        return;
      }
      if (!store?.pronto) throw new Error('Entre na sua conta antes de salvar.');
      store.setItem(chave, valor);
      clearTimeout(timer);
      timer = setTimeout(() => sincronizar().catch(() => {}), chave === 'michele_rascunhos' ? 1200 : 200);
    }
  };
  function status(tipo, mensagem) {
    const barra = document.getElementById('nuvem-status');
    if (!barra) return;
    barra.hidden = false; barra.dataset.estado = tipo;
    document.getElementById('nuvem-mensagem').textContent = mensagem;
    document.getElementById('nuvem-tentar').hidden = !['erro','pendente'].includes(tipo);
    document.getElementById('nuvem-exportar').hidden = !store?.pendente();
    document.getElementById('nuvem-recarregar').hidden = !['conflito','atualizado'].includes(tipo);
    if (tipo === 'conflito') document.getElementById('app-shell').inert = true;
  }
  async function rpc(nome, args = {}) {
    const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
    if (config.publishableKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + config.publishableKey;
    const response = await fetch(config.url + '/rest/v1/rpc/' + nome, {
      method: 'POST', headers,
      body: JSON.stringify(args), signal: AbortSignal.timeout(20000)
    });
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const erro = new Error(body.message || 'Falha na conexão com o Supabase.');
      erro.code = body.code; throw erro;
    }
    return body;
  }
  async function reservarAba() {
    if (lockObtido) return;
    if (!navigator.locks) throw new Error('Abra o sistema por HTTPS ou localhost em um navegador atualizado.');
    await new Promise((resolve,reject) => {
      navigator.locks.request('michele-empresa:' + config.url, { ifAvailable: true }, lock => {
        if (!lock) { reject(new Error('Feche a outra aba do sistema neste navegador antes de continuar.')); return; }
        lockObtido = true; resolve(); return new Promise(() => {});
      }).catch(reject);
    });
  }
  async function conectar() {
    await reservarAba();
    const remoto = await rpc('michele_u_ler', { p_token: token });
    usuario = remoto.usuario;
    store = new NuvemStore({ storage: local, journalKey: 'michele_usuario_pendente:' + config.url + ':' + usuario.id,
      uuid: () => crypto.randomUUID(), status, gerenciarSenhas: true,
      salvar: op => rpc('michele_u_salvar', { p_token: token, p_dados: op.dados, p_revisao: op.revisao,
        p_operacao: op.id, p_senhas: op.senhas || {} }) });
    store.carregar(remoto);
    await store.flush();
    window.iniciarComDadosNuvem(usuario);
    document.getElementById('app-shell').inert = false;
  }
  async function iniciar() {
    mostrarLogin();
    status('conectando', 'Verificando o salvamento na nuvem…');
    try {
      let estado;
      try { estado = await rpc('michele_u_status'); }
      catch (e) { if (e.code !== 'PGRST202') throw e; estado = { instalado: false }; }
      if (!estado.instalado) {
        api.ativo = false;
        window.onload();
        document.getElementById('nuvem-instalar').hidden = false;
        status('local', 'A nuvem ainda não está instalada para seu usuário e senha. Seus dados locais foram preservados. Use Preparar nuvem neste navegador.');
        return;
      }
      token = sessionStorage.getItem(sessionKey);
      if (token) await conectar();
      else status('conectando', 'Entre com seu usuário e senha de sempre para acessar a nuvem.');
    } catch (e) {
      if (e.message.includes('MICHELE_SESSAO')) sessionStorage.removeItem(sessionKey);
      document.getElementById('login-erro').textContent = 'Não foi possível abrir a nuvem. ' + e.message;
      status('erro', 'Não foi possível abrir a nuvem. Seus dados locais foram preservados.');
    }
  }
  async function login() {
    if (entrando) return;
    entrando = true;
    const erro = document.getElementById('login-erro');
    erro.textContent = 'Entrando…';
    try {
      const resposta = await rpc('michele_u_login', { p_login: document.getElementById('login-usuario').value.trim(),
        p_senha: document.getElementById('login-senha').value });
      if (resposta.erro) throw new Error(resposta.erro);
      token = resposta.token;
      sessionStorage.setItem(sessionKey, token);
      await conectar();
      document.getElementById('login-senha').value = ''; erro.textContent = '';
    } catch (e) { erro.textContent = e.message; }
    finally { entrando = false; }
  }
  async function sincronizar() {
    if (!api.ativo) return;
    if (!store?.pronto) throw new Error('Entre na sua conta para confirmar o envio.');
    try { await store.flush(); }
    catch (e) {
      if (e.message.includes('MICHELE_SESSAO')) {
        mostrarLogin(); status('erro', 'Sua sessão expirou. Entre novamente com o mesmo usuário; as alterações pendentes foram preservadas.');
      }
      throw e;
    }
  }
  async function sair() {
    try {
      await sincronizar();
      await rpc('michele_u_sair', { p_token: token });
      sessionStorage.removeItem(sessionKey); sessionStorage.removeItem('michele_usuario_atual'); location.reload();
    } catch (e) { alert('Não foi possível confirmar os envios antes de sair: ' + e.message); }
  }
  function baixar(dados, nome, tipo = 'application/json') {
    const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportarLocais() {
    const dados = { versao: 'Michele Cortinas - Backup local original', originais: {} };
    for (const k of CHAVES) {
      const v = local.getItem(k); if (v === null) continue;
      dados.originais[k] = v;
      try { dados[k] = JSON.parse(v); } catch (_) { /* Original preservado. */ }
    }
    baixar(JSON.stringify(dados,null,2), 'backup-michele-original.json');
  }
  function exportarPendentes() {
    if (!store) return;
    const dados = { versao: 'Michele Cortinas - Backup' };
    for (const [k,v] of Object.entries(store.dados)) dados[k] = JSON.parse(v);
    baixar(JSON.stringify(dados,null,2), 'backup-michele-pendente.json');
  }
  async function prepararInstalacao() {
    try {
      const resposta = await fetch('supabase/instalar-login-usuario.sql');
      if (!resposta.ok) throw new Error('O arquivo de instalação não foi publicado junto com o site.');
      const sql = window.MicheleInstalacao.preparar(local, await resposta.text(), window.MicheleNuvemStore);
      baixar(sql, 'instalar-michele-com-meus-dados.sql', 'application/sql');
      alert('Arquivo preparado com seus cadastros e acessos atuais. Abra o arquivo baixado, copie o conteúdo no SQL Editor do seu projeto Supabase e clique em Run. Depois recarregue o sistema. Guarde esse arquivo em local privado.');
    } catch (e) { alert('Não foi possível preparar a instalação: ' + e.message); }
  }
  function recarregar() {
    if (!confirm(store?.pendente() ? 'Exporte as alterações pendentes antes de continuar. Carregar a nuvem descarta esta cópia pendente e os formulários abertos. Continuar?' : 'Carregar a nuvem? Formulários ainda não salvos serão descartados.')) return;
    if (store) local.removeItem(store.journalKey);
    location.reload();
  }
  async function verificar() {
    if (!api.ativo || !store?.pronto || store.pendente() || document.hidden) return;
    try {
      const remoto = await rpc('michele_u_ler', { p_token: token });
      if (remoto.revisao > store.revisao) status('atualizado', 'Outro dispositivo salvou alterações. Carregue a versão da nuvem antes de editar.');
    } catch (_) { status('erro', 'Não foi possível consultar a nuvem. Verifique a conexão ou entre novamente.'); }
  }
  window.addEventListener('DOMContentLoaded', () => {
    for (const [id, acao] of Object.entries({ 'nuvem-tentar': () => sincronizar().catch(() => {}),
      'nuvem-exportar': exportarPendentes, 'nuvem-recarregar': recarregar,
      'nuvem-backup-local': exportarLocais, 'nuvem-instalar': prepararInstalacao })) document.getElementById(id).onclick = acao;
    document.getElementById('nuvem-backup-local').hidden = !CHAVES.some(k => local.getItem(k) !== null);
  });
  window.addEventListener('beforeunload', e => { if (store?.pendente()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('online', () => sincronizar().catch(() => {}));
  window.addEventListener('focus', verificar); setInterval(verificar, 30000);
})();
