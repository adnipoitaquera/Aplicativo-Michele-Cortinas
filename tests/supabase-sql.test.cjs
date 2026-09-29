const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const { preparar } = require('../supabase-instalacao.js');
const api = require('../nuvem-store.js');
const modelo = fs.readFileSync(path.join(__dirname, '../supabase/instalar-login-usuario.sql'),'utf8');

test('SQL real: migração, login existente, gravação, permissões e conflitos', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated;');
  const profissionais = [
    { id: 'PROF-1', usuario: 'admin', nome: 'Administrador', senha: 'teste-admin', cargo: 'Administrador', status: 'Ativo' },
    { id: 'PROF-2', usuario: 'Elton', nome: 'Elton', senha: '1234', cargo: 'Vendedor', status: 'Ativo' },
    { id: 'PROF-3', usuario: 'gerente', nome: 'Gerente', senha: 'senha-gerente', cargo: 'Gerente', status: 'Ativo' }
  ];
  const local = new Map([
    ['michele_profissionais', JSON.stringify(profissionais)],
    ['michele_clientes', JSON.stringify([{ id:'CLI-1',nome:"D'Ávila'); drop table teste; --", campoLegado: 'preservado' }])],
    ['michele_pedidos', JSON.stringify([{ idDocumento:'ANTIGO', tipo:'Orçamento',numeroOrcamento:'000032',valorTotal:123.45 }])],
    ['michele_numero_orcamento','32'], ['michele_fornecedores','[]']
  ]);
  const sql = preparar({ getItem: k => local.get(k) ?? null },modelo,api);
  await db.exec(sql);
  // Simula uma base com a primeira migração aplicada e atualiza sem perder dados.
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609290001_autorizacoes.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609290002_parcelamento.sql'),'utf8'));
  await db.exec(`create function public.michele_u_salvar(p_dados jsonb, p_operacao text, p_revisao text, p_senhas text, p_token text)
    returns jsonb language sql security definer as $$ select '{"success":true}'::jsonb $$;`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260929200006_restaurar_salvamento_com_revisao.sql'),'utf8'));
  assert.equal((await db.query("select count(*)::int as n from pg_proc where pronamespace='public'::regnamespace and proname='michele_u_salvar'")).rows[0].n,1);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260929201609_salvamento_automatico_rascunhos.sql'),'utf8'));
  const chamar = async (nome,args,tipos) => {
    const params = args.map((_,i) => '$' + (i+1) + (tipos?.[i] ? '::'+tipos[i] : ''));
    const resultado = await db.query('select public.'+nome+'('+params.join(',')+') as resultado', args);
    return resultado.rows[0].resultado;
  };
  await db.exec('set role anon');
  const login = await chamar('michele_u_login',['elton','1234']);
  const adm = await chamar('michele_u_login',['admin','teste-admin']);
  const ler = token => chamar('michele_u_ler',[token]);
  const salvar = (token,dados,revisao,id=randomUUID(),senhas={}) => chamar('michele_u_salvar',
    [token,JSON.stringify(dados),revisao,id,JSON.stringify(senhas)],['text','jsonb','bigint','uuid','jsonb']);

  await t.test('autentica Elton/1234 e preserva cargo, dados e campos antigos', async () => {
    assert.equal(login.usuario.usuario,'Elton');
    assert.equal(login.usuario.cargo,'Vendedor');
    assert.equal(login.usuario.senha,undefined);
    const remoto = await ler(login.token);
    assert.deepEqual(JSON.parse(remoto.dados.michele_clientes),JSON.parse(local.get('michele_clientes')));
    assert.equal(remoto.dados.michele_pedidos,local.get('michele_pedidos'));
    assert.equal(local.get('michele_profissionais'),JSON.stringify(profissionais));
  });
  await t.test('nega consulta direta a senhas, dados e sessão inexistente', async () => {
    await assert.rejects(db.query('select * from michele_privado.usuarios'), /permission denied/);
    await assert.rejects(db.query('select * from michele_privado.empresa'), /permission denied/);
    await assert.rejects(ler('0'.repeat(64)), /MICHELE_SESSAO/);
    await assert.rejects(chamar('michele_u_login', [null,null]).then(r => { if (r.erro) throw new Error(r.erro); }), /inválidos/);
  });
  await t.test('grava orçamento e outro dispositivo lê a mesma informação', async () => {
    const remoto = await ler(login.token);
    const dados = { ...remoto.dados, michele_pedidos: JSON.stringify([...JSON.parse(remoto.dados.michele_pedidos),
      { idDocumento:'NOVO',tipo:'Orçamento',numeroOrcamento:'000033',valorTotal:765.43 }]), michele_numero_orcamento:'33' };
    const id = randomUUID();
    assert.equal(await salvar(login.token,dados,remoto.revisao,id),2);
    assert.equal(await salvar(login.token,dados,remoto.revisao,id),2);
    const outro = await chamar('michele_u_login',['Elton','1234']);
    assert.equal((await ler(outro.token)).dados.michele_pedidos,dados.michele_pedidos);
    await assert.rejects(salvar(outro.token,remoto.dados,remoto.revisao), /MICHELE_CONFLITO/);
  });
  await t.test('vendedor não altera fornecedores, usuários ou senhas', async () => {
    const remoto = await ler(login.token);
    await assert.rejects(salvar(login.token,{...remoto.dados,michele_fornecedores:'[{"razao":"Outro"}]'},remoto.revisao), /administrador/);
    await assert.rejects(salvar(login.token,remoto.dados,remoto.revisao,randomUUID(),{'PROF-1':'outra'}), /administrador/);
  });
  await t.test('autorização verifica senha e cargo, mantém vendedor e impede desconto forjado', async () => {
    const contexto = {acao:'desconto',referencia:'ambiente-teste',percentual:20};
    const autorizar = (usuario,senha) => chamar('michele_u_autorizar',[login.token,usuario,senha,JSON.stringify(contexto)],['text','text','text','jsonb']);
    assert.ok((await autorizar('admin','errada')).erro);
    assert.ok((await autorizar('Elton','1234')).erro);
    const autorizacao = await autorizar('admin','teste-admin');
    assert.equal(autorizacao.aprovador,'PROF-1');
    assert.equal((await ler(login.token)).usuario.id,'PROF-2');
    const remoto = await ler(login.token);
    const item = {subtotalBruto:100,subtotal:80,pagamento:{forma:'avista',percentual:20,desconto:20,total:80,referencia:'ambiente-teste',autorizacao:{id:randomUUID()}}};
    const dados = () => ({...remoto.dados,michele_pedidos:JSON.stringify([{idDocumento:'DESCONTO',itens:[item]}])});
    await assert.rejects(salvar(login.token,dados(),remoto.revisao), /exige autorização/);
    item.pagamento.autorizacao = autorizacao;
    item.pagamento.percentual = 30;
    await assert.rejects(salvar(login.token,dados(),remoto.revisao), /exige autorização/);
    item.pagamento.percentual = 20;
    item.subtotal = 1;
    await assert.rejects(salvar(login.token,dados(),remoto.revisao), /Total do pagamento/);
    item.subtotal = 80;
    await salvar(login.token,dados(),remoto.revisao);
  });
  await t.test('cartão valida limite, autorização do gerente e soma exata das parcelas', async () => {
    let remoto = await ler(login.token);
    const pagamento = {forma:'cartao',percentual:0,desconto:0,total:100,referencia:'cartao-teste',bandeira:'Visa',parcelas:3,valoresParcelas:[33.33,33.33,33.34]};
    const dados = () => ({...remoto.dados,michele_pedidos:JSON.stringify([{idDocumento:'CARTAO',itens:[{subtotalBruto:100,subtotal:100,pagamento}]}])});
    await salvar(login.token,dados(),remoto.revisao); remoto = await ler(login.token);
    pagamento.parcelas=12;
    pagamento.valoresParcelas=[...Array(11).fill(8.33),8.37];
    await assert.rejects(salvar(login.token,dados(),remoto.revisao),/Acima de 3 parcelas/);
    const contexto={acao:'parcelamento',referencia:'cartao-teste',parcelas:12,bandeira:'Visa',total:100};
    const autorizar = contexto => chamar('michele_u_autorizar',[login.token,'gerente','senha-gerente',JSON.stringify(contexto)],['text','text','text','jsonb']);
    await assert.rejects(autorizar({...contexto,parcelas:13}), /Parcelamento inválido/);
    pagamento.autorizacaoParcelas = await autorizar(contexto);
    assert.equal(pagamento.autorizacaoParcelas.aprovador,'PROF-3');
    assert.equal((await ler(login.token)).usuario.id,'PROF-2');
    pagamento.bandeira='Elo'; await assert.rejects(salvar(login.token,dados(),remoto.revisao),/Acima de 3 parcelas/);
    pagamento.bandeira='Visa'; pagamento.valoresParcelas[11]=8.33;
    await assert.rejects(salvar(login.token,dados(),remoto.revisao),/Valores das parcelas/);
    pagamento.valoresParcelas[11]=8.37;
    await salvar(login.token,dados(),remoto.revisao); remoto = await ler(login.token);
    pagamento.parcelas=13;
    await assert.rejects(salvar(login.token,dados(),remoto.revisao),/Parcelamento inválido/);
    pagamento.parcelas=12; pagamento.autorizacaoParcelas=null; pagamento.bandeira='Elo';
    const gerente=await chamar('michele_u_login',['gerente','senha-gerente']);
    await salvar(gerente.token,dados(),remoto.revisao);
  });
  await t.test('administrador cadastra fornecedores e altera a própria senha sem perder o envio atual', async () => {
    const remoto = await ler(adm.token);
    const dados = {...remoto.dados,michele_fornecedores:'[{"razao":"Fornecedor novo"}]'};
    await salvar(adm.token,dados,remoto.revisao,randomUUID(),{'PROF-1':'nova-senha'});
    assert.equal((await ler(adm.token)).dados.michele_fornecedores,dados.michele_fornecedores);
    assert.ok((await chamar('michele_u_login',['admin','teste-admin'])).erro);
    assert.ok((await chamar('michele_u_login',['admin','nova-senha'])).token);
  });
  await t.test('rascunhos automáticos preservam campos incompletos e isolam alterações por usuário', async () => {
    let remoto = await ler(login.token);
    const rascunho = {usuarioId:'PROF-2',tela:'clientes',estado:{campos:{'c-nome':{value:''},'c-telefone':{value:'11'}}}};
    const dados = lista => ({...remoto.dados,michele_rascunhos:JSON.stringify(lista)});
    await salvar(login.token,dados([rascunho]),remoto.revisao);
    remoto = await ler(login.token);
    assert.equal(JSON.parse(remoto.dados.michele_rascunhos)[0].estado.campos['c-telefone'].value,'11');
    await assert.rejects(salvar(login.token,dados([{...rascunho,usuarioId:'PROF-1'}]),remoto.revisao),/outro usuario/);
    await assert.rejects(salvar(login.token,dados([{...rascunho,tela:'profissionais'}]),remoto.revisao),/restrito/);
    await assert.rejects(salvar(login.token,dados([{...rascunho,estado:{campos:{'p-senha':{value:'nao-salvar'}}}}]),remoto.revisao),/Senhas/);
    await assert.rejects(salvar(login.token,dados([rascunho,rascunho]),remoto.revisao),/duplicado/);
  });
  await t.test('tentativas erradas são limitadas e logout invalida a sessão', async () => {
    for (let i=0;i<5;i++) assert.ok((await chamar('michele_u_login',['elton','errada'])).erro);
    assert.ok((await chamar('michele_u_login',['elton','1234'])).erro);
    await chamar('michele_u_sair',[login.token]);
    await assert.rejects(ler(login.token),/MICHELE_SESSAO/);
  });
  await t.test('instalação não sobrescreve os cadastros já gravados', async () => {
    await db.exec('reset role');
    const antes = await db.query('select dados from michele_privado.empresa');
    await assert.rejects(db.exec(sql), /Nenhum cadastro foi substituído/);
    await db.exec('rollback');
    assert.deepEqual((await db.query('select dados from michele_privado.empresa')).rows,antes.rows);
    const senhas = (await db.query('select senha_hash from michele_privado.usuarios')).rows;
    assert.ok(senhas.every(x => x.senha_hash.startsWith('$2')));
  });
});
