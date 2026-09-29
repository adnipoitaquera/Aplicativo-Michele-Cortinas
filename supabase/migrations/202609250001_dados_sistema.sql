-- Execute no SQL Editor do projeto Supabase.
-- Uma conta acessa a mesma base em todos os seus dispositivos.
begin;

create table public.michele_dados (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  revisao bigint not null default 0,
  operacao_id uuid,
  atualizado_em timestamptz not null default now()
);
alter table public.michele_dados enable row level security;
revoke all on public.michele_dados from anon, authenticated;
grant select on public.michele_dados to authenticated;
create policy "Cada conta consulta seus dados" on public.michele_dados
  for select to authenticated using ((select auth.uid()) = usuario_id);

-- A comparação da revisão e a gravação acontecem sob o mesmo bloqueio.
-- Repetir uma operação após perda de conexão não grava a mesma alteração duas vezes.
create function public.michele_salvar(p_dados jsonb, p_revisao bigint, p_operacao uuid, p_usuario uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_atual public.michele_dados%rowtype;
  v_chave text;
  v_valor jsonb;
begin
  if v_usuario is null or p_usuario is distinct from v_usuario then
    raise exception 'Autenticação necessária na conta que abriu os dados';
  end if;
  if p_operacao is null or p_revisao is null or p_revisao < 0
     or p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos';
  end if;
  for v_chave in select jsonb_object_keys(p_dados) loop
    if v_chave not in (
      'michele_clientes', 'michele_fornecedores', 'michele_pedidos',
      'michele_profissionais', 'michele_produtos_voal', 'michele_produtos_forro',
      'michele_produtos_persiana', 'michele_produtos_acessorios',
      'michele_produtos_motorizacao', 'michele_produtos_personalizados',
      'michele_config_empresa', 'michele_numero_orcamento', 'michele_numero_pedido'
    ) then raise exception 'Cadastro desconhecido'; end if;
    if jsonb_typeof(p_dados -> v_chave) <> 'string' then
      raise exception 'Formato de cadastro inválido';
    end if;
    v_valor := (p_dados ->> v_chave)::jsonb;
    if v_chave in ('michele_numero_orcamento', 'michele_numero_pedido') then
      if jsonb_typeof(v_valor) <> 'number' or (v_valor::text)::numeric < 0
         or (v_valor::text)::numeric > 9007199254740991
         or trunc((v_valor::text)::numeric) <> (v_valor::text)::numeric then
        raise exception 'Numeração inválida';
      end if;
    elsif v_chave = 'michele_config_empresa' then
      if jsonb_typeof(v_valor) <> 'object' then raise exception 'Configurações inválidas'; end if;
    elsif jsonb_typeof(v_valor) <> 'array' then
      raise exception 'Lista de cadastros inválida';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(coalesce((p_dados ->> 'michele_profissionais')::jsonb, '[]'::jsonb)) p
    where p ? 'senha'
  ) then raise exception 'Senhas de profissionais não podem ser armazenadas'; end if;

  insert into public.michele_dados(usuario_id) values(v_usuario) on conflict do nothing;
  select * into v_atual from public.michele_dados where usuario_id = v_usuario for update;
  if v_atual.operacao_id = p_operacao then return v_atual.revisao; end if;
  if v_atual.revisao <> p_revisao then
    raise exception 'MICHELE_CONFLITO: existem alterações de outro dispositivo';
  end if;
  update public.michele_dados
    set dados = p_dados, revisao = revisao + 1, operacao_id = p_operacao, atualizado_em = now()
    where usuario_id = v_usuario returning revisao into v_atual.revisao;
  return v_atual.revisao;
end;
$$;
revoke all on function public.michele_salvar(jsonb, bigint, uuid, uuid) from public, anon;
grant execute on function public.michele_salvar(jsonb, bigint, uuid, uuid) to authenticated;
commit;
