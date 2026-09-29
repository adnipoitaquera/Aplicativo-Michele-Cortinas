# Salvamento no Supabase — Michele Cortinas

O aplicativo usa o projeto `ckreezktfiodjjqcbzbu`, com `enabled: true` e `authMode: usuario` em `supabase-config.js`. O acesso continua com os usuários e senhas cadastrados no sistema; não é necessário criar login por e-mail.

## Estado verificado em 29/09/2026

- Banco instalado, com os usuários existentes preservados.
- Descontos, cartão até 12x e autorização do gerente disponíveis.
- Corrigida a função `michele_u_salvar`, que havia sido substituída por uma versão que retornava sucesso sem gravar o documento completo.
- Migração aplicada: `20260929200006_restaurar_salvamento_com_revisao.sql`.
- Função antiga preservada no esquema privado, sem acesso pela API pública.
- Teste transacional de login, gravação, leitura, repetição idempotente, conflito de revisão e sessão inválida concluído; todas as alterações do teste foram revertidas.
- A revisão e o hash dos dados originais permaneceram iguais após a verificação.

## Uso

1. Abra a versão atualizada do aplicativo e entre com seu usuário e senha.
2. Edite normalmente: clientes, fornecedores, profissionais, produtos, configurações e orçamentos são registrados automaticamente após uma breve pausa na digitação, sem clicar em Salvar. Campos incompletos ficam como rascunho recuperável; senhas não entram nos rascunhos. A conversão de orçamento em pedido continua sendo uma ação explícita.
3. Aguarde **Todas as alterações salvas na nuvem** no topo da tela.
4. Em outro dispositivo, entre com um usuário autorizado para consultar a mesma base.

Os dados do aplicativo ficam em `michele_privado.empresa`; os acessos usam `michele_privado.usuarios`. As tabelas públicas antigas não são o destino do salvamento atual e foram preservadas. A migração `20260929201609_salvamento_automatico_rascunhos.sql` permite rascunhos por usuário e impede alterações nos rascunhos de outro usuário. O cadastro é atualizado quando os campos obrigatórios estão válidos. Rascunhos são recuperados ao entrar novamente no sistema.

Se houver falha de rede, as alterações ficam pendentes no navegador. Não limpe os dados do navegador. Use **Exportar alterações pendentes** antes de descartar uma cópia ou recarregar em caso de conflito. O aplicativo só confirma o envio quando o servidor devolve a revisão esperada.

## Pagamentos

O administrador define o desconto máximo à vista no cadastro do profissional. Vendedores podem parcelar no cartão até 3x; de 4x a 12x precisam da senha de um administrador ou gerente ativo na mesma tela. A autorização registra o responsável e fica vinculada ao ambiente, bandeira, total e número de parcelas. O valor é dividido sem acréscimo, com ajuste de centavos na última parcela.

## Instalação e manutenção

Não execute a instalação inicial sobre esta base nem importe dados antigos por cima dos atuais. Para uma instalação nova, o botão **Preparar nuvem com meus dados** gera o SQL com os dados do navegador de origem. Esse arquivo contém informações privadas e não deve ir para o Git.

A pasta de migrações contém também scripts históricos de outras versões. Não execute todos indiscriminadamente com `db push`; confira as dependências e o histórico remoto antes de atualizar. A migração de reparo pressupõe o login por usuário e a validação de pagamentos já instalados.

Somente a chave pública do projeto fica no frontend. Nunca publique uma chave secreta, senha de banco ou `service_role`.

## Validação

`npm test`: 60 testes aprovados. A confirmação de gravação também foi testada no banco real em uma transação revertida.

O verificador do Supabase ainda aponta que a tabela pública antiga `clientes` não tem RLS. Ela não é usada pelo salvamento atual; suas permissões não foram alteradas para não interromper usos antigos. Revisão indicada: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public . As tabelas privadas têm RLS e acesso direto bloqueado; as RPCs validam sessão e cargo.
