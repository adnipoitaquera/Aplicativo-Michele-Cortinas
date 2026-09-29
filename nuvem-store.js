/* Persistência independente da interface, com revisão e diário de recuperação. */
(function(root) {
  'use strict';
  const CHAVES = [
    'clientes', 'fornecedores', 'pedidos', 'profissionais', 'produtos_voal',
    'produtos_forro', 'produtos_persiana', 'produtos_acessorios',
    'produtos_motorizacao', 'produtos_personalizados', 'config_empresa',
    'numero_orcamento', 'numero_pedido'
  ].map(chave => 'michele_' + chave);
  function limpar(chave, valor) {
    if (!CHAVES.includes(chave)) throw new Error('Cadastro desconhecido: ' + chave);
    const dados = JSON.parse(String(valor));
    if (chave === 'michele_profissionais') {
      if (!Array.isArray(dados)) throw new Error('Profissionais inválidos');
      return JSON.stringify(dados.map(({ senha, ...cadastro }) => cadastro));
    }
    if (chave.includes('_numero_')) {
      if (!Number.isSafeInteger(dados) || dados < 0) throw new Error('Numeração inválida');
    } else if (chave === 'michele_config_empresa') {
      if (!dados || Array.isArray(dados) || typeof dados !== 'object') throw new Error('Configurações inválidas');
    } else if (!Array.isArray(dados)) throw new Error('Cadastro inválido');
    return String(valor);
  }
  class NuvemStore {
    constructor({ storage, journalKey, salvar, uuid, status = () => {}, gerenciarSenhas = false }) {
      Object.assign(this, { storage, journalKey, salvar, uuid, status });
      this.dados = {};
      this.confirmados = {};
      this.revisao = 0;
      this.operacao = null;
      this.pronto = false;
      this.conflito = false;
      this.executando = null;
      this.gerenciarSenhas = gerenciarSenhas;
      this.senhas = {};
    }
    carregar(remoto) {
      this.revisao = remoto?.revisao || 0;
      this.confirmados = { ...(remoto?.dados || {}) };
      this.dados = { ...this.confirmados };
      const salvo = this.storage.getItem(this.journalKey);
      if (salvo) {
        const journal = JSON.parse(salvo);
        this.revisao = journal.revisao;
        this.dados = journal.dados;
        this.senhas = journal.senhas || {};
        this.operacao = journal.operacao ? {
          id: journal.operacao.id, revisao: journal.operacao.revisao, senhas: journal.operacao.senhas || {},
          dados: { ...journal.dados, ...journal.operacao.anteriores }
        } : null;
        if (this.operacao) {
          for (const chave of journal.operacao.ausentes || []) delete this.operacao.dados[chave];
        }
      }
      this.pronto = true;
    }
    getItem(chave) { return this.dados[chave] ?? null; }
    setItem(chave, valor) {
      if (!this.pronto || this.conflito) throw new Error('Aguarde a conexão com a nuvem.');
      const normalizado = limpar(chave, valor);
      const senhasAnteriores = this.senhas;
      if (this.gerenciarSenhas && chave === 'michele_profissionais') {
        this.senhas = { ...this.senhas };
        for (const p of JSON.parse(valor)) if (p.id && p.senha) this.senhas[p.id] = p.senha;
      }
      if (this.dados[chave] === normalizado && JSON.stringify(senhasAnteriores) === JSON.stringify(this.senhas)) return;
      const anterior = this.dados;
      this.dados = { ...anterior, [chave]: normalizado };
      try { this.persistir(); } catch (erro) {
        this.dados = anterior;
        this.senhas = senhasAnteriores;
        this.status('erro', 'Não foi possível guardar a alteração neste dispositivo. Exporte um backup antes de sair.');
        throw erro;
      }
      this.status('pendente', 'Alterações aguardando envio à nuvem…');
    }
    pendente() {
      return !!this.operacao || Object.keys(this.senhas).length > 0 || JSON.stringify(this.dados) !== JSON.stringify(this.confirmados);
    }
    persistir() {
      let operacao = null;
      if (this.operacao) {
        const anteriores = {}, ausentes = [];
        for (const chave of Object.keys(this.dados)) {
          if (!(chave in this.operacao.dados)) ausentes.push(chave);
          else if (this.dados[chave] !== this.operacao.dados[chave]) anteriores[chave] = this.operacao.dados[chave];
        }
        operacao = { id: this.operacao.id, revisao: this.operacao.revisao, anteriores, ausentes, senhas: this.operacao.senhas || {} };
      }
      this.storage.setItem(this.journalKey, JSON.stringify({ revisao: this.revisao,
        dados: this.dados, operacao, senhas: this.senhas }));
    }
    async flush() {
      if (this.executando) return this.executando;
      this.executando = this.enviar();
      try { return await this.executando; } finally { this.executando = null; }
    }
    async enviar() {
      if (this.conflito) throw new Error('Exporte as alterações pendentes e carregue a versão da nuvem.');
      while (this.pendente()) {
        if (!this.operacao) {
          this.operacao = { id: this.uuid(), revisao: this.revisao, dados: { ...this.dados }, senhas: { ...this.senhas } };
          this.persistir();
        }
        this.status('enviando', 'Salvando na nuvem…');
        try {
          const revisao = await this.salvar(this.operacao);
          this.revisao = revisao;
          this.confirmados = this.operacao.dados;
          for (const [id, senha] of Object.entries(this.operacao.senhas || {})) {
            if (this.senhas[id] === senha) delete this.senhas[id];
          }
          this.operacao = null;
          this.persistir();
        } catch (erro) {
          this.conflito = String(erro.message).includes('MICHELE_CONFLITO');
          this.status(this.conflito ? 'conflito' : 'erro', this.conflito
            ? 'Outro dispositivo alterou os dados. Exporte suas alterações pendentes antes de carregar a nuvem.'
            : 'Não foi possível confirmar o salvamento na nuvem. As alterações estão pendentes neste dispositivo. Tente novamente.');
          throw erro;
        }
      }
      this.storage.removeItem(this.journalKey);
      this.status('salvo', 'Todas as alterações salvas na nuvem.');
    }
  }
  root.MicheleNuvemStore = { NuvemStore, CHAVES, limpar };
  if (typeof module !== 'undefined') module.exports = root.MicheleNuvemStore;
})(typeof window !== 'undefined' ? window : globalThis);
