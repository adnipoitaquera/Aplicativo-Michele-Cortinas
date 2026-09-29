# Conectar o sistema ao Supabase

**Estado atual:** o login existente por usuário e senha foi restaurado a pedido do responsável. `enabled: false` em `supabase-config.js` mantém os cadastros locais e impede a substituição do acesso por e-mail. A tabela `michele_dados` foi detectada no projeto, mas a sincronização permanece desativada até adaptar a autenticação aos usuários existentes. Não ative a integração por e-mail como solução para esse requisito. As instruções abaixo descrevem a implementação anterior e precisam dessa adaptação antes de serem usadas.

A conexão está configurada para o projeto `ckreezktfiodjjqcbzbu`. A chave pública foi aceita pelo serviço de autenticação. Na verificação de 25/09/2026, a API informou que a tabela `public.michele_dados` ainda não existe no cache do esquema; execute o SQL de instalação antes de entrar no sistema. O salvamento real ainda depende dessa instalação e de uma conta de acesso.

## Instalação

1. No projeto Supabase, abra **SQL Editor** e execute o arquivo `supabase/migrations/202609250001_dados_sistema.sql` uma vez. Ele cria a tabela, a função de gravação e a política de acesso.
2. Em **Authentication → Users**, crie a conta de acesso com e-mail e senha e confirme o e-mail. O login antigo `admin` não dá acesso à nuvem.
3. A URL e a chave pública **anon** já estão em `supabase-config.js`. Para trocar de projeto, atualize esses valores com a URL e uma chave pública **publishable** (ou **anon**). Nunca use uma chave secreta ou `service_role`.
4. Publique os arquivos do site juntos, incluindo `supabase-config.js`, `nuvem-store.js`, `supabase-sync.js`, `supabase-sync.css` e os arquivos de estilos já usados pelo sistema. Abra o site por HTTPS. Para desenvolvimento, use um servidor em `localhost`.
5. No navegador onde estão os dados antigos, entre com a conta criada. Se a base dessa conta estiver vazia, o sistema oferece enviar os cadastros locais. Confira a conta antes de aceitar. A cópia local original é preservada; as senhas antigas dos profissionais não são enviadas.
6. Espere a mensagem **Todas as alterações salvas na nuvem**. Em outro dispositivo, abra o mesmo site e entre com **o mesmo e-mail e senha**.

O Supabase guarda o banco e autentica o acesso. A hospedagem do site precisa servir os arquivos atualizados; preencher a configuração não publica o site automaticamente.

Antes de entrar, o botão **Baixar cópia dos dados deste navegador** permite guardar os cadastros originais mesmo se o banco ainda não estiver instalado. O backup inclui os valores originais, sem reformatá-los, além do formato convencional de importação para os cadastros válidos. Guarde esse arquivo em local privado, pois pode conter as senhas do antigo acesso local.

Abrir a conta na nuvem não normaliza, renumera nem regrava automaticamente os registros existentes. A migração inicial valida todos os cadastros antes do primeiro envio e não substitui uma base já preenchida. Os próximos números de pedido e orçamento consideram o histórico sem alterar seus documentos anteriores.

## Dados e acesso

São enviados clientes, fornecedores, profissionais, pedidos, orçamentos, ambientes e acabamentos dos pedidos, catálogos e preços de produtos, categorias personalizadas, configurações da empresa e logotipo, além dos contadores de pedidos e orçamentos. Formulários ainda não gravados pelo botão correspondente não são considerados cadastros salvos.

Cada conta possui uma base própria, protegida por `auth.uid()`. O acesso dessa conta é administrativo. Os profissionais cadastrados são registros para vendedores e comissões; não criam contas de autenticação. Contas com e-mails diferentes não compartilham a base nesta versão. Para compartilhar a empresa com acessos individuais de funcionários, será necessário acrescentar membros e permissões no banco.

A tabela só permite consulta da própria conta. Gravações passam pela função `michele_salvar`, que confirma a identidade da conta, valida as chaves e compara a revisão em uma transação. Não há acesso anônimo aos dados nem permissão de escrita direta na tabela.

## Salvamento e recuperação

As alterações são enviadas automaticamente ao salvar ou editar campos com salvamento automático. A faixa no topo diferencia envio pendente, falha e confirmação. Em uma falha de conexão, um diário local, separado por projeto e conta, preserva os dados para tentar novamente. A confirmação só aparece após resposta do banco. O navegador avisa antes de fechar com envios pendentes e o botão Sair aguarda o envio.

Os cadastros são gravados juntos em um documento JSON com controle de revisão. Se dois dispositivos editarem a mesma versão, a segunda gravação é recusada para não substituir o trabalho do primeiro. Exporte a cópia pendente, carregue a versão da nuvem e refaça as alterações necessárias consultando o backup. Importar um backup inteiro substitui os cadastros correspondentes; não faz mesclagem automática.

O sistema verifica atualizações de outros dispositivos ao voltar à janela e a cada 30 segundos. Ele oferece recarregar sem descartar automaticamente formulários abertos. Uma única aba de edição por conta é permitida no mesmo navegador para preservar o diário local. Dispositivos diferentes podem abrir a mesma conta, sujeitos ao controle de conflitos.

Para uma operação maior, com muitos usuários editando ao mesmo tempo ou uma base volumosa, a evolução indicada é separar os registros em tabelas e aplicar conflitos por registro. Esta versão prioriza a preservação do formato atual e a migração dos cadastros existentes.

## Verificação

Execute `node --test tests/*.test.cjs`. Os testes locais verificam recuperação de falhas, resposta perdida, concorrência entre dispositivos, isolamento do diário, retirada das senhas, armazenamento cheio e os recursos existentes de impressão e materiais.

Depois da instalação, valide também no projeto real: login; cadastro de cliente, fornecedor e pedido; leitura em um segundo dispositivo; edição concorrente; desconexão e reconexão; e tentativa de consulta com outra conta. Os testes locais usam um servidor simulado e não substituem essa validação do banco e das políticas reais.

Referências: [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) e [políticas de acesso ao banco](https://supabase.com/docs/guides/database/postgres/row-level-security).
# Descontos e autorização do gerente

Para habilitar também **cartão em até 12x**, execute `supabase/migrations/202609290002_parcelamento.sql` no SQL Editor. Esse arquivo também inclui a estrutura de autorizações anterior; pode ser usado mesmo se a migração de descontos ainda não tiver sido aplicada. A instalação inicial já inclui o parcelamento.

Visa, Mastercard, Elo, American Express, Hipercard, Diners Club e Outra ficam disponíveis para seleção. Os valores são divididos sem acréscimo, com eventual ajuste de centavos na última parcela. Vendedores podem aplicar até 3x; acima disso, até 12x, o gerente ou administrador autoriza com usuário e senha na mesma tela. Gerentes e administradores conectados podem selecionar até 12x diretamente. A autorização fica vinculada ao ambiente, bandeira, total e número de parcelas. A proposta e a impressão mostram a condição efetivamente aplicada; uma seleção ainda não autorizada permanece apenas como simulação.

Para uma base já instalada com login por usuário, execute `supabase/migrations/202609290001_autorizacoes.sql` no SQL Editor antes de usar a autorização de descontos. A instalação inicial já inclui essa atualização. A migração preserva os cadastros existentes.

No cadastro de cada profissional, o administrador define **Desconto máximo à vista (%)**. O padrão é zero. Na aba Pagamento de cada ambiente, um percentual maior depende do usuário e senha de um administrador ou gerente ativo. A sessão do vendedor permanece aberta. O banco registra o responsável e valida o desconto na gravação; a senha não é guardada no orçamento. O botão de alteração de campo bloqueado permite uma alteração pontual nos campos do ambiente, sem conceder acesso geral aos cadastros administrativos.
