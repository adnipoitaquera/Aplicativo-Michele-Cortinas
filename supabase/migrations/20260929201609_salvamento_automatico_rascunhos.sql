begin;
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
commit;
