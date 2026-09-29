(function() {
  'use strict';
  if (window.MicheleNuvem) return;
  const config = window.MICHELE_SUPABASE || {};
  const ativo = config.enabled !== false && !!(config.url || config.publishableKey);
  let cliente, store, usuario, timer, iniciando = false, liberarAba, contaTravada;
  const local = window.localStorage;
  const { NuvemStore, CHAVES, limpar } = window.MicheleNuvemStore;

  window.dadosStorage = {
    getItem(chave) { return ativo ? store?.getItem(chave) ?? null : local.getItem(chave); },
    setItem(chave, valor) {
      if (!ativo) return local.setItem(chave, valor);
      if (!store) throw new Error('Entre na sua conta antes de salvar.');
      store.setItem(chave, valor);
      clearTimeout(timer);
      timer = setTimeout(() => sincronizar().catch(() => {}), 200);
    }
  };
  function status(tipo, mensagem) {
    const barra = document.getElementById('nuvem-status');
    if (!barra) return;
    barra.hidden = false;
    barra.dataset.estado = tipo;
    document.getElementById('nuvem-mensagem').textContent = mensagem;
    document.getElementById('nuvem-tentar').hidden = !['erro', 'pendente'].includes(tipo);
    document.getElementById('nuvem-exportar').hidden = !store?.pendente();
    document.getElementById('nuvem-recarregar').hidden = !['conflito', 'atualizado'].includes(tipo);
    if (tipo === 'conflito') document.getElementById('app-shell').inert = true;
  }
  async function sdk() {
    if (cliente) return cliente;
    if (!config.url || !config.publishableKey) throw new Error('Preencha a URL e a chave pública em supabase-config.js.');
    const url = new URL(config.url);
    if (url.protocol !== 'https:') throw new Error('A URL do Supabase deve começar com https://.');
    if (!window.supabase) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível conectar. Verifique sua internet e tente novamente.'));
      document.head.appendChild(script);
    });
    cliente = window.supabase.createClient(config.url, config.publishableKey);
    cliente.auth.onAuthStateChange((_evento, session) => {
      if (store && session?.user?.id !== usuario?.id) {
        store.pronto = false;
        mostrarLogin();
        status('erro', 'A sessão mudou. Entre novamente na conta para continuar. As alterações pendentes foram preservadas.');
      }
    });
    return cliente;
  }
  async function reservarAba(conta) {
    if (contaTravada === conta.id) return;
    if (!navigator.locks) throw new Error('Abra o sistema pelo endereço HTTPS em um navegador atualizado.');
    if (liberarAba) liberarAba();
    contaTravada = null;
    await new Promise((resolve, reject) => {
      navigator.locks.request('michele-edicao:' + config.url + ':' + conta.id, { ifAvailable: true }, lock => {
        if (!lock) { reject(new Error('Esta conta já está aberta em outra aba deste navegador. Feche a outra aba e tente novamente.')); return; }
        contaTravada = conta.id;
        const espera = new Promise(liberar => { liberarAba = liberar; });
        resolve();
        return espera;
      }).catch(reject);
    });
  }
  async function lerRemoto() {
    const { data, error } = await cliente.from('michele_dados').select('dados,revisao').eq('usuario_id', usuario.id).maybeSingle();
    if (error?.code === 'PGRST205') throw new Error('Falta instalar o banco do sistema no Supabase. Execute o arquivo SQL de instalação no SQL Editor. Os dados deste navegador foram preservados.');
    if (error) throw new Error('Não foi possível carregar o banco. Verifique a conexão e a instalação do SQL do sistema.');
    return data;
  }
  async function conectar(conta) {
    await reservarAba(conta);
    usuario = conta;
    const remoto = await lerRemoto();
    const journalKey = 'michele_nuvem_pendente:' + config.url + ':' + conta.id;
    store = new NuvemStore({ storage: local, journalKey, uuid: () => crypto.randomUUID(), status,
      salvar: async operacao => {
        const { data, error } = await cliente.rpc('michele_salvar', {
          p_dados: operacao.dados, p_revisao: operacao.revisao, p_operacao: operacao.id,
          p_usuario: conta.id
        });
        if (error) throw error;
        return data;
      }
    });
    store.carregar(remoto);
    // Recupere primeiro o envio interrompido; nunca o substitua pelos dados remotos.
    if (store.pendente()) await store.flush();
    if (!remoto && !Object.keys(store.dados).length) {
      const existentes = CHAVES.filter(chave => local.getItem(chave) !== null);
      if (existentes.length && confirm('Esta conta ainda não tem dados na nuvem. Enviar os cadastros já salvos neste navegador para esta conta?')) {
        const migracao = existentes.map(chave => [chave, limpar(chave, local.getItem(chave))]);
        for (const [chave, valor] of migracao) store.setItem(chave, valor);
        await store.flush();
      }
    }
    window.iniciarComDadosNuvem({ id: conta.id, nome: conta.email, usuario: conta.email, cargo: 'Administrador', status: 'Ativo' });
    await store.flush();
  }
  async function sincronizar() {
    if (!ativo) return;
    if (!store?.pronto) throw new Error('Entre novamente na sua conta para enviar as alterações pendentes.');
    await store.flush();
  }
  async function login() {
    if (iniciando) return;
    iniciando = true;
    const erro = document.getElementById('login-erro');
    erro.textContent = 'Conectando…';
    try {
      await sdk();
      const { data, error } = await cliente.auth.signInWithPassword({
        email: document.getElementById('login-usuario').value.trim(),
        password: document.getElementById('login-senha').value
      });
      if (error) throw new Error('Não foi possível entrar. Confira o e-mail, a senha e sua conexão.');
      await conectar(data.user);
      document.getElementById('login-senha').value = '';
      erro.textContent = '';
    } catch (e) { erro.textContent = e.message; }
    finally { iniciando = false; }
  }
  async function iniciar() {
    mostrarLogin();
    document.querySelector('label[for="login-usuario"]').textContent = 'E-mail';
    const input = document.getElementById('login-usuario');
    input.type = 'email'; input.placeholder = 'Seu e-mail de acesso';
    document.getElementById('p-senha').closest('.form-group')?.setAttribute('hidden', '');
    const help = document.createElement('p');
    help.textContent = 'Este cadastro organiza os profissionais e comissões. O acesso à nuvem usa a conta de e-mail do sistema.';
    document.getElementById('aba-profissionais').prepend(help);
    status('conectando', 'Entre na sua conta para acessar os dados da nuvem.');
    try {
      await sdk();
      const { data, error } = await cliente.auth.getSession();
      if (error) throw error;
      if (data.session) await conectar(data.session.user);
    } catch (e) { document.getElementById('login-erro').textContent = e.message; }
  }
  async function sair() {
    try {
      await sincronizar();
      const { error } = await cliente.auth.signOut();
      if (error) throw error;
      sessionStorage.removeItem('michele_usuario_atual');
      location.reload();
    } catch (e) { alert('Não foi possível sair com segurança: ' + e.message); }
  }
  function exportarPendentes() {
    if (!store) return;
    const dados = { versao: 'Michele Cortinas - Backup', data: new Date().toISOString() };
    for (const [chave, valor] of Object.entries(store.dados)) dados[chave] = JSON.parse(valor);
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'backup-michele-pendente-' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportarLocais() {
    // Inclui os valores originais, mesmo se algum cadastro legado tiver JSON inválido.
    const dados = { versao: 'Michele Cortinas - Backup local original', data: new Date().toISOString(), originais: {} };
    for (const chave of CHAVES) {
      const valor = local.getItem(chave);
      if (valor === null) continue;
      dados.originais[chave] = valor;
      try { dados[chave] = JSON.parse(valor); } catch (_) { /* O original continua no backup. */ }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'backup-michele-original-' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function recarregar() {
    const aviso = store?.pendente()
      ? 'Você exportou as alterações pendentes? Carregar a nuvem descarta esta cópia pendente e os formulários abertos. O backup pode ser consultado para refazer as alterações.'
      : 'Carregar os dados mais recentes da nuvem? Os formulários que ainda não foram salvos serão descartados.';
    if (!confirm(aviso)) return;
    if (store) local.removeItem(store.journalKey);
    location.reload();
  }
  async function verificarAtualizacao() {
    if (!store?.pronto || store.pendente() || store.executando || document.hidden) return;
    try {
      const remoto = await lerRemoto();
      if (remoto && remoto.revisao > store.revisao)
        status('atualizado', 'Há alterações de outro dispositivo. Carregue a versão mais recente antes de editar.');
    } catch (_) { status('erro', 'Não foi possível consultar a nuvem. Verifique a conexão.'); }
  }
  window.MicheleNuvem = { ativo, iniciar, login, sair, sincronizar, exportarPendentes, exportarLocais, recarregar };
  window.addEventListener('beforeunload', e => {
    if (store?.pendente()) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('online', () => sincronizar().catch(() => {}));
  window.addEventListener('focus', verificarAtualizacao);
  if (ativo) setInterval(verificarAtualizacao, 30000);
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('nuvem-tentar').onclick = () => sincronizar().catch(() => {});
    document.getElementById('nuvem-exportar').onclick = exportarPendentes;
    document.getElementById('nuvem-recarregar').onclick = recarregar;
    const backupLocal = document.getElementById('nuvem-backup-local');
    backupLocal.hidden = !CHAVES.some(chave => local.getItem(chave) !== null);
    backupLocal.onclick = exportarLocais;
    if (!ativo) status('local', 'Acesso por usuário e senha mantido. Os dados continuam neste navegador; a sincronização com a nuvem ainda não está ativa.');
  });
})();
