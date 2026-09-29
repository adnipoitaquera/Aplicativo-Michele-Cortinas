-- Corrige a RPC que retornava sucesso sem persistir o documento da empresa.
-- Nenhum cadastro ou senha e alterado nesta migracao.
begin;
do $$
begin
  if to_regprocedure('public.michele_u_salvar(jsonb,text,text,text,text)') is not null then
    alter function public.michele_u_salvar(jsonb,text,text,text,text) set schema michele_privado;
    revoke all on function michele_privado.michele_u_salvar(jsonb,text,text,text,text) from public,anon,authenticated;
    alter function michele_privado.michele_u_salvar(jsonb,text,text,text,text) set search_path = public, pg_temp;
  end if;
end; $$;

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
revoke all on function public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.michele_u_salvar(text,jsonb,bigint,uuid,jsonb) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
