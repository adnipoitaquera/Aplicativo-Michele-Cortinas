-- Modelo usado pelo botão Preparar nuvem. Não contém cadastros nem senhas.
begin;
set local standard_conforming_strings = on;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists michele_privado;
revoke all on schema michele_privado from public, anon, authenticated;

create table if not exists michele_privado.empresa (
  id boolean primary key default true check (id),
  dados jsonb not null,
  revisao bigint not null default 1,
  operacao uuid,
  atualizado_em timestamptz not null default now()
);
create table if not exists michele_privado.usuarios (
  id text primary key,
  login text not null unique,
  senha_hash text not null,
  cadastro jsonb not null,
  falhas integer not null default 0,
  bloqueado_ate timestamptz
);
create table if not exists michele_privado.sessoes (
  token_hash text primary key,
  usuario_id text not null references michele_privado.usuarios(id) on delete cascade,
  expira_em timestamptz not null
);
alter table michele_privado.empresa enable row level security;
alter table michele_privado.usuarios enable row level security;
alter table michele_privado.sessoes enable row level security;
revoke all on all tables in schema michele_privado from public, anon, authenticated;

create or replace function michele_privado.validar(p_dados jsonb) returns void
language plpgsql set search_path = '' as $$
declare k text; v jsonb;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'Dados inválidos'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('michele_clientes','michele_fornecedores','michele_pedidos','michele_profissionais',
      'michele_produtos_voal','michele_produtos_forro','michele_produtos_persiana',
      'michele_produtos_acessorios','michele_produtos_motorizacao','michele_produtos_personalizados',
      'michele_config_empresa','michele_numero_orcamento','michele_numero_pedido')
      or jsonb_typeof(p_dados->k) <> 'string' then raise exception 'Cadastro inválido'; end if;
    v := (p_dados->>k)::jsonb;
    if k in ('michele_numero_orcamento','michele_numero_pedido') then
      if jsonb_typeof(v) <> 'number' then raise exception 'Número inválido'; end if;
      if (v::text)::numeric < 0 or (v::text)::numeric > 9007199254740991
        or trunc((v::text)::numeric) <> (v::text)::numeric then raise exception 'Número inválido'; end if;
    elsif k = 'michele_config_empresa' then
      if jsonb_typeof(v) <> 'object' then raise exception 'Configuração inválida'; end if;
    else
      if jsonb_typeof(v) <> 'array' then raise exception 'Lista inválida'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]')) p where p ? 'senha')
    then raise exception 'As senhas devem ser enviadas separadamente dos cadastros'; end if;
end; $$;

create or replace function michele_privado.conta(p_token text) returns jsonb
language plpgsql set search_path = '' as $$
declare c jsonb;
begin
  if p_token is null or length(p_token) <> 64 then raise exception 'MICHELE_SESSAO: entre novamente'; end if;
  select u.cadastro into c from michele_privado.sessoes s join michele_privado.usuarios u on u.id=s.usuario_id
    where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expira_em > now()
      and lower(coalesce(u.cadastro->>'status',''))='ativo';
  if c is null then raise exception 'MICHELE_SESSAO: entre novamente'; end if;
  return c;
end; $$;

create or replace function michele_privado.atualizar_contas(p_lista jsonb, p_senhas jsonb, p_conservar text default null) returns void
language plpgsql set search_path = '' as $$
declare c jsonb; h text; s text;
begin
  if jsonb_typeof(p_lista) <> 'array' or jsonb_typeof(p_senhas) <> 'object' then raise exception 'Usuários inválidos'; end if;
  for c in select value from jsonb_array_elements(p_lista) loop
    if nullif(c->>'id','') is null or nullif(trim(c->>'usuario'),'') is null then raise exception 'Informe código e usuário'; end if;
    select senha_hash into h from michele_privado.usuarios where id=c->>'id';
    s := p_senhas->>(c->>'id');
    if s is not null and s <> '' then
      if octet_length(s) > 72 then raise exception 'Senha excede 72 bytes'; end if;
      h := extensions.crypt(s, extensions.gen_salt('bf',10));
    end if;
    if h is null then raise exception 'Informe a senha do novo usuário'; end if;
    insert into michele_privado.usuarios(id,login,senha_hash,cadastro)
      values(c->>'id',lower(trim(c->>'usuario')),h,c-'senha')
      on conflict(id) do update set login=excluded.login,senha_hash=excluded.senha_hash,cadastro=excluded.cadastro;
    if s is not null and s <> '' then
      delete from michele_privado.sessoes where usuario_id=c->>'id'
        and token_hash is distinct from encode(extensions.digest(p_conservar,'sha256'),'hex');
    end if;
  end loop;
  delete from michele_privado.usuarios where id not in (select value->>'id' from jsonb_array_elements(p_lista));
end; $$;

-- Somente o SQL Editor pode executar a importação inicial; não é uma API pública.
create or replace function michele_privado.importar_inicial(p_dados jsonb,p_senhas jsonb) returns void
language plpgsql set search_path = '' as $$
declare existente jsonb; anterior jsonb;
begin
  perform michele_privado.validar(p_dados);
  lock table michele_privado.empresa in exclusive mode;
  select dados into existente from michele_privado.empresa;
  if existente is not null then
    if existente <> p_dados then raise exception 'A nuvem já contém dados diferentes. Nenhum cadastro foi substituído.'; end if;
    return;
  end if;
  if to_regclass('public.michele_dados') is not null then
    execute 'select dados from public.michele_dados where dados <> ''{}''::jsonb limit 1' into anterior;
    if anterior is not null then raise exception 'Existem dados da integração anterior. Preserve o backup e revise a migração antes de continuar.'; end if;
  end if;
  if jsonb_array_length(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]'))=0 then
    raise exception 'Nenhum usuário encontrado no navegador de origem';
  end if;
  perform michele_privado.atualizar_contas((p_dados->>'michele_profissionais')::jsonb,p_senhas);
  insert into michele_privado.empresa(dados) values(p_dados);
end; $$;

create or replace function public.michele_u_status() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('instalado',exists(select 1 from michele_privado.empresa),'versao',1);
$$;

create or replace function public.michele_u_login(p_login text,p_senha text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u michele_privado.usuarios%rowtype; t text;
begin
  select * into u from michele_privado.usuarios where login=lower(trim(p_login)) for update;
  if u.id is null or u.bloqueado_ate > now() then return jsonb_build_object('erro','Usuário ou senha inválidos. Aguarde alguns minutos se houver muitas tentativas.'); end if;
  if p_senha is null or octet_length(p_senha)>72 or lower(coalesce(u.cadastro->>'status',''))<>'ativo'
    or extensions.crypt(p_senha,u.senha_hash) is distinct from u.senha_hash then
    update michele_privado.usuarios set falhas=case when falhas>=4 then 0 else falhas+1 end,
      bloqueado_ate=case when falhas>=4 then now()+interval '10 minutes' else null end where id=u.id;
    return jsonb_build_object('erro','Usuário ou senha inválidos.');
  end if;
  update michele_privado.usuarios set falhas=0,bloqueado_ate=null where id=u.id;
  delete from michele_privado.sessoes where expira_em <= now();
  t := encode(extensions.gen_random_bytes(32),'hex');
  insert into michele_privado.sessoes values(encode(extensions.digest(t,'sha256'),'hex'),u.id,now()+interval '12 hours');
  return jsonb_build_object('token',t,'usuario',u.cadastro);
end; $$;

create or replace function public.michele_u_ler(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u jsonb; resultado jsonb;
begin
  u := michele_privado.conta(p_token);
  select jsonb_build_object('dados',dados,'revisao',revisao,'usuario',u) into resultado from michele_privado.empresa;
  if resultado is null then raise exception 'Instalação incompleta'; end if;
  return resultado;
end; $$;

create or replace function public.michele_u_salvar(p_token text,p_dados jsonb,p_revisao bigint,p_operacao uuid,p_senhas jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare u jsonb; e michele_privado.empresa%rowtype; k text;
begin
  u := michele_privado.conta(p_token);
  perform michele_privado.validar(p_dados);
  if p_operacao is null or p_revisao is null or jsonb_typeof(p_senhas) <> 'object' then raise exception 'Envio inválido'; end if;
  select * into e from michele_privado.empresa for update;
  if e.operacao=p_operacao then return e.revisao; end if;
  if e.revisao<>p_revisao then raise exception 'MICHELE_CONFLITO: outro dispositivo alterou os cadastros'; end if;
  if lower(coalesce(u->>'cargo','')) <> 'administrador' then
    for k in select jsonb_object_keys(e.dados || p_dados) loop
      if k not in ('michele_clientes','michele_pedidos','michele_numero_pedido','michele_numero_orcamento')
        and (e.dados->k) is distinct from (p_dados->k) then raise exception 'Acesso restrito ao administrador'; end if;
    end loop;
    if p_senhas <> '{}'::jsonb then raise exception 'Acesso restrito ao administrador'; end if;
  end if;
  if (e.dados->'michele_profissionais') is distinct from (p_dados->'michele_profissionais') or p_senhas <> '{}'::jsonb then
    perform michele_privado.atualizar_contas(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]'),p_senhas,p_token);
  end if;
  update michele_privado.empresa set dados=p_dados,revisao=revisao+1,operacao=p_operacao,atualizado_em=now() returning revisao into e.revisao;
  return e.revisao;
end; $$;

create or replace function public.michele_u_sair(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from michele_privado.sessoes where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;

revoke all on all functions in schema michele_privado from public,anon,authenticated;
revoke all on function public.michele_u_status(),public.michele_u_login(text,text),public.michele_u_ler(text),public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb),public.michele_u_sair(text) from public,anon,authenticated;
grant execute on function public.michele_u_status(),public.michele_u_login(text,text),public.michele_u_ler(text),public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb),public.michele_u_sair(text) to anon,authenticated;

create table if not exists michele_privado.autorizacoes (
  id uuid primary key default gen_random_uuid(),
  solicitante text not null,
  aprovador text not null,
  contexto jsonb not null,
  criado_em timestamptz not null default now()
);
alter table michele_privado.autorizacoes enable row level security;
revoke all on michele_privado.autorizacoes from public, anon, authenticated;

create or replace function public.michele_u_autorizar(p_token text,p_login text,p_senha text,p_contexto jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare solicitante jsonb; resposta jsonb; gerente jsonb; registro michele_privado.autorizacoes%rowtype;
begin
  solicitante := michele_privado.conta(p_token);
  if p_contexto is null or coalesce(p_contexto->>'acao','') not in ('desconto','campo','parcelamento')
    or coalesce(p_contexto->>'referencia','') = '' then raise exception 'Alteração inválida'; end if;
  if p_contexto->>'acao'='desconto' and ((p_contexto->>'percentual')::numeric not between 0 and 100
    or p_contexto->>'percentual' is null) then raise exception 'Percentual inválido'; end if;
  if p_contexto->>'acao'='parcelamento' then
    if coalesce(p_contexto->>'parcelas','') !~ '^(1[0-2]|[1-9])$'
      or coalesce(p_contexto->>'bandeira','') not in ('Visa','Mastercard','Elo','American Express','Hipercard','Diners Club','Outra')
      or p_contexto->>'total' is null or (p_contexto->>'total')::numeric < 0 then
      raise exception 'Parcelamento inválido: selecione de 1 a 12 parcelas e uma bandeira';
    end if;
  end if;
  -- Reutiliza a verificação de senha e o bloqueio por tentativas do login.
  resposta := public.michele_u_login(p_login,p_senha);
  if resposta ? 'erro' then return resposta; end if;
  gerente := resposta->'usuario';
  delete from michele_privado.sessoes where token_hash=encode(extensions.digest(resposta->>'token','sha256'),'hex');
  if coalesce(gerente->>'cargo','') not in ('Administrador','Gerente') then
    return jsonb_build_object('erro','Somente administrador ou gerente pode autorizar.');
  end if;
  insert into michele_privado.autorizacoes(solicitante,aprovador,contexto)
    values(solicitante->>'id',gerente->>'id',p_contexto) returning * into registro;
  return jsonb_build_object('id',registro.id,'aprovador',registro.aprovador,'nome',gerente->>'nome','contexto',registro.contexto,'data',registro.criado_em);
end; $$;
revoke all on function public.michele_u_autorizar(text,text,text,jsonb) from public;
grant execute on function public.michele_u_autorizar(text,text,text,jsonb) to anon,authenticated;

create or replace function michele_privado.validar_descontos(p_usuario jsonb,p_dados jsonb,p_anteriores jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare documento jsonb; item jsonb; pagamento jsonb; limite numeric; percentual numeric; bruto numeric; desconto numeric;
  parcelas integer; centavos bigint; base bigint; valores jsonb; contexto_parcelamento jsonb;
begin
  limite := coalesce((p_usuario->>'descontoMaximo')::numeric,0);
  for documento in select value from jsonb_array_elements(coalesce((p_dados->>'michele_pedidos')::jsonb,'[]')) loop
    if exists(select 1 from jsonb_array_elements(coalesce((p_anteriores->>'michele_pedidos')::jsonb,'[]')) antigo where antigo=documento) then continue; end if;
    for item in select value from jsonb_array_elements(coalesce(documento->'itens','[]')) loop
      pagamento := item->'pagamento';
      if pagamento is null or pagamento->>'forma' is null then continue; end if;
      percentual := (pagamento->>'percentual')::numeric;
      bruto := (item->>'subtotalBruto')::numeric;
      if percentual is null or percentual not between 0 and 100 or bruto is null or bruto<0 then raise exception 'Pagamento inválido'; end if;
      if pagamento->>'forma' <> 'avista' and percentual <> 0 then raise exception 'Desconto permitido somente à vista'; end if;
      if percentual > limite and not exists (
        select 1 from michele_privado.autorizacoes a where a.id::text=pagamento->'autorizacao'->>'id'
        and a.solicitante=p_usuario->>'id'
        and a.contexto=jsonb_build_object('acao','desconto','referencia',pagamento->>'referencia','percentual',percentual)
      ) then raise exception 'Desconto acima do limite exige autorização do administrador ou gerente'; end if;
      desconto := round(bruto*percentual/100,2);
      if (pagamento->>'desconto')::numeric is distinct from desconto
        or (pagamento->>'total')::numeric is distinct from round(bruto-desconto,2)
        or (item->>'subtotal')::numeric is distinct from round(bruto-desconto,2) then raise exception 'Total do pagamento inválido'; end if;
      if pagamento->>'forma'='cartao' then
        if coalesce(pagamento->>'parcelas','') !~ '^(1[0-2]|[1-9])$'
          or coalesce(pagamento->>'bandeira','') not in ('Visa','Mastercard','Elo','American Express','Hipercard','Diners Club','Outra') then
          raise exception 'Parcelamento inválido';
        end if;
        parcelas := (pagamento->>'parcelas')::integer;
        contexto_parcelamento := jsonb_build_object('acao','parcelamento','referencia',pagamento->>'referencia','parcelas',parcelas,'bandeira',pagamento->>'bandeira','total',(pagamento->>'total')::numeric);
        if parcelas > 3 and coalesce(p_usuario->>'cargo','') not in ('Administrador','Gerente') and not exists (
          select 1 from michele_privado.autorizacoes a
          where a.id::text=pagamento->'autorizacaoParcelas'->>'id' and a.solicitante=p_usuario->>'id' and a.contexto=contexto_parcelamento
        ) then raise exception 'Acima de 3 parcelas exige autorização do administrador ou gerente'; end if;
        centavos := round((pagamento->>'total')::numeric*100);
        base := centavos / parcelas;
        select jsonb_agg(case when n=parcelas then (centavos-base*(parcelas-1))::numeric/100 else base::numeric/100 end order by n)
          into valores from generate_series(1,parcelas) n;
        if pagamento->'valoresParcelas' is distinct from valores then raise exception 'Valores das parcelas inválidos'; end if;
      end if;
    end loop;
  end loop;
end; $$;
revoke all on function michele_privado.validar_descontos(jsonb,jsonb,jsonb) from public,anon,authenticated;
create or replace function public.michele_u_salvar(p_token text,p_dados jsonb,p_revisao bigint,p_operacao uuid,p_senhas jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare u jsonb; e michele_privado.empresa%rowtype; k text;
begin
  u := michele_privado.conta(p_token);
  perform michele_privado.validar(p_dados);
  if p_operacao is null or p_revisao is null or jsonb_typeof(p_senhas) <> 'object' then raise exception 'Envio inválido'; end if;
  select * into e from michele_privado.empresa for update;
  if e.operacao=p_operacao then return e.revisao; end if;
  if e.revisao<>p_revisao then raise exception 'MICHELE_CONFLITO: outro dispositivo alterou os cadastros'; end if;
  if lower(coalesce(u->>'cargo','')) <> 'administrador' then
    for k in select jsonb_object_keys(e.dados || p_dados) loop
      if k not in ('michele_clientes','michele_pedidos','michele_numero_pedido','michele_numero_orcamento')
        and (e.dados->k) is distinct from (p_dados->k) then raise exception 'Acesso restrito ao administrador'; end if;
    end loop;
    if p_senhas <> '{}'::jsonb then raise exception 'Acesso restrito ao administrador'; end if;
  end if;
  perform michele_privado.validar_descontos(u,p_dados,e.dados);
  if (e.dados->'michele_profissionais') is distinct from (p_dados->'michele_profissionais') or p_senhas <> '{}'::jsonb then
    perform michele_privado.atualizar_contas(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]'),p_senhas,p_token);
  end if;
  update michele_privado.empresa set dados=p_dados,revisao=revisao+1,operacao=p_operacao,atualizado_em=now() returning revisao into e.revisao;
  return e.revisao;
end; $$;


create or replace function michele_privado.validar(p_dados jsonb) returns void
language plpgsql set search_path = '' as $$
declare k text; v jsonb;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'Dados inválidos'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('michele_clientes','michele_fornecedores','michele_pedidos','michele_profissionais',
      'michele_produtos_voal','michele_produtos_forro','michele_produtos_persiana',
      'michele_produtos_acessorios','michele_produtos_motorizacao','michele_produtos_personalizados',
      'michele_config_empresa','michele_numero_orcamento','michele_numero_pedido','michele_rascunhos')
      or jsonb_typeof(p_dados->k) <> 'string' then raise exception 'Cadastro inválido'; end if;
    v := (p_dados->>k)::jsonb;
    if k in ('michele_numero_orcamento','michele_numero_pedido') then
      if jsonb_typeof(v) <> 'number' then raise exception 'Número inválido'; end if;
      if (v::text)::numeric < 0 or (v::text)::numeric > 9007199254740991
        or trunc((v::text)::numeric) <> (v::text)::numeric then raise exception 'Número inválido'; end if;
    elsif k = 'michele_config_empresa' then
      if jsonb_typeof(v) <> 'object' then raise exception 'Configuração inválida'; end if;
    else
      if jsonb_typeof(v) <> 'array' then raise exception 'Lista inválida'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]')) p where p ? 'senha')
    then raise exception 'As senhas devem ser enviadas separadamente dos cadastros'; end if;
end; $$;

create or replace function michele_privado.validar_rascunhos(p_usuario jsonb,p_dados jsonb,p_anteriores jsonb) returns void
language plpgsql set search_path = '' as $$
declare novos jsonb := coalesce((p_dados->>'michele_rascunhos')::jsonb,'[]'); antigos jsonb := coalesce((p_anteriores->>'michele_rascunhos')::jsonb,'[]');
begin
  if exists(select 1 from jsonb_array_elements(novos) r where nullif(r->>'usuarioId','') is null
    or coalesce(r->>'tela','') not in ('clientes','fornecedores','profissionais','produtos','configuracoes','orcamento')
    or jsonb_typeof(r->'estado') is distinct from 'object') then raise exception 'Rascunho invalido'; end if;
  if exists(select 1 from jsonb_array_elements(novos) r group by r->>'usuarioId',r->>'tela' having count(*)>1) then raise exception 'Rascunho duplicado'; end if;
  if novos::text ~ '"(p-senha|login-senha|senha|password)"[[:space:]]*:' then raise exception 'Senhas nao podem ser salvas em rascunhos'; end if;
  if (select coalesce(jsonb_agg(r order by r->>'usuarioId',r->>'tela'),'[]') from jsonb_array_elements(novos) r where r->>'usuarioId' is distinct from p_usuario->>'id')
    is distinct from
    (select coalesce(jsonb_agg(r order by r->>'usuarioId',r->>'tela'),'[]') from jsonb_array_elements(antigos) r where r->>'usuarioId' is distinct from p_usuario->>'id') then raise exception 'Nao e permitido alterar rascunhos de outro usuario'; end if;
  if coalesce(p_usuario->>'cargo','') <> 'Administrador' and exists(
    select 1 from jsonb_array_elements(novos) r where r->>'usuarioId'=p_usuario->>'id' and r->>'tela' not in ('clientes','orcamento')
    and not exists(select 1 from jsonb_array_elements(antigos) a where a=r)
  ) then raise exception 'Rascunho restrito ao administrador'; end if;
end; $$;
revoke all on function michele_privado.validar_rascunhos(jsonb,jsonb,jsonb) from public,anon,authenticated;
create or replace function public.michele_u_salvar(p_token text,p_dados jsonb,p_revisao bigint,p_operacao uuid,p_senhas jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare u jsonb; e michele_privado.empresa%rowtype; k text;
begin
  u := michele_privado.conta(p_token);
  perform michele_privado.validar(p_dados);
  if p_operacao is null or p_revisao is null or jsonb_typeof(p_senhas) <> 'object' then raise exception 'Envio inválido'; end if;
  select * into e from michele_privado.empresa for update;
  if not found then raise exception 'Instalação incompleta'; end if;
  if e.operacao=p_operacao then return e.revisao; end if;
  if e.revisao<>p_revisao then raise exception 'MICHELE_CONFLITO: outro dispositivo alterou os cadastros'; end if;
  if lower(coalesce(u->>'cargo','')) <> 'administrador' then
    for k in select jsonb_object_keys(e.dados || p_dados) loop
      if k not in ('michele_clientes','michele_pedidos','michele_numero_pedido','michele_numero_orcamento','michele_rascunhos')
        and (e.dados->k) is distinct from (p_dados->k) then raise exception 'Acesso restrito ao administrador'; end if;
    end loop;
    if p_senhas <> '{}'::jsonb then raise exception 'Acesso restrito ao administrador'; end if;
  end if;
  perform michele_privado.validar_rascunhos(u,p_dados,e.dados);
  perform michele_privado.validar_descontos(u,p_dados,e.dados);
  if (e.dados->'michele_profissionais') is distinct from (p_dados->'michele_profissionais') or p_senhas <> '{}'::jsonb then
    perform michele_privado.atualizar_contas(coalesce((p_dados->>'michele_profissionais')::jsonb,'[]'),p_senhas,p_token);
  end if;
  update michele_privado.empresa set dados=p_dados,revisao=revisao+1,operacao=p_operacao,atualizado_em=now() returning revisao into e.revisao;
  return e.revisao;
end; $$;
revoke all on function public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb) to anon,authenticated;
notify pgrst, 'reload schema';

-- MICHELE_IMPORTACAO_INICIAL
commit;
