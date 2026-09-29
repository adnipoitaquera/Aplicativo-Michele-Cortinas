-- Parcelamento no cartão. Inclui a estrutura de autorizações, se ainda não instalada.
begin;
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

commit;
