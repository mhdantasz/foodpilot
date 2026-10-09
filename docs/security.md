# Segurança e verificação multi-tenant

## Superfície implementada

Quatorze tabelas, com RLS e grants explícitos. O núcleo de identidade descrito abaixo mantém suas regras: anon não possui SELECT ou escrita; authenticated lê o próprio profile, memberships e negócios associados. As seções comerciais/operacionais descrevem as extensões. O frontend não é o limite de segurança.

| Recurso | SELECT | UPDATE | INSERT / DELETE |
| --- | --- | --- | --- |
| profiles | id = auth.uid | próprio, com USING + WITH CHECK; somente nome/telefone/avatar | sem grant; criação por trigger |
| businesses | EXISTS membership própria | EXISTS owner próprio; somente nome/tipo/canal | sem grant; criação por RPC |
| business_members | user_id = auth.uid | sem grant | sem grant; owner criado só por RPC |

Membership não consulta businesses em suas políticas, evitando recursão. Política de businesses usa EXISTS em memberships que já são limitadas ao usuário. Não é necessária função SECURITY DEFINER de verificação de vínculo. IDs/papéis e timestamps não podem ser alterados pelos grants de UPDATE. Não há política USING(true).

## Funções e atomicidade

- handle_new_user: SECURITY DEFINER, search_path vazio, nomes de objetos qualificados, execução pública revogada. Trigger after insert de auth.users cria profile na mesma transação. full_name de metadata é limitado e não serve para autorização; roles não vêm de metadata.
- set_updated_at: função de trigger sem SECURITY DEFINER, EXECUTE público revogado.
- complete_onboarding: SECURITY DEFINER é necessário porque INSERT direto não está concedido. EXECUTE apenas authenticated, auth.uid não nulo e profile existente obrigatórios. Não aceita user_id, business_id ou role. Valida entradas, usa advisory transaction lock por usuário, reaproveita vínculo existente e cria owner fixo com business em uma única transação. search_path vazio e nenhuma query dinâmica.

As funções devem continuar pertencendo ao papel de migration confiável (postgres) e não a usuários da aplicação. Não conceder acesso a esse papel pelo frontend. DELETE em memberships/negócios não está exposto; FKs RESTRICT impedem apagamento inadvertido do último owner. Exclusão de conta ou negócio exige processo administrativo futuro explícito, inclusive resolução dessas referências.

## Teste SQL isolado executável

```sh
pnpm test:rls
```

Aplica os mesmos arquivos de migration em PostgreSQL via PGlite. Cria somente interfaces mínimas da plataforma de teste (auth.users, auth.uid e roles). As políticas, triggers e RPC são as de produção, executadas com SET ROLE authenticated/anon, sem bypass de RLS nos ataques. Cada teste define a identidade que o Supabase normalmente fornece via JWT. Esse harness não testa emissão de JWT, PostgREST ou entrega de email. PGlite é apenas devDependency e não é backend do aplicativo.

39 verificações aprovadas: A/B próprios, UUID alheio, SELECT sem filtro, UPDATE alheio, perfis, vínculos, INSERT indevido, alteração de papel/identidade, DELETE negado, falta de sessão/vínculo, parâmetros inválidos, defaults, unicidade, vários negócios futuros, retries e rollback com falha de membership. Resultado: test-results/rls-report.json. PGlite possui uma conexão; concorrência de requisições só é validada pelo teste Supabase real.

## Teste Supabase Auth + PostgREST real

### Isolamento executado no PostgreSQL hospedado

Em 06/10/2026, `supabase/tests/tenant-isolation.sql` passou no projeto existente. Cria duas identidades auth.users e negócios em uma transação; executa os ataques com SET ROLE authenticated e auth.uid próprios, sem bypass administrativo; encerra com ROLLBACK. Os 16 controles A/B passaram: acesso próprio, UUID alheio, SELECT sem filtro, UPDATE alheio, INSERT membership negado, retry idempotente, profile e membership próprios. Nenhum fixture foi mantido. Repita executando o arquivo completo pela ferramenta SQL administrativa de desenvolvimento. O teste comprova políticas no banco hospedado; não testa emissão de dois JWTs.

### Verificação adicional por dois JWTs

Executada em 06/10/2026: 21 testes reais Auth/PostgREST aprovados, com login A/B, negócios distintos, acesso próprio, UUID/SELECT/UPDATE alheios bloqueados, INSERT/alteração de vínculos negados, profiles isolados, anônimo e retries concorrentes. Evidência: test-results/integration-report.json. O primeiro teste utilizou a conta cadastrada pelo Auth com email confirmado como A. Para separar sua senha pessoal da automação, a rodada final usa duas fixtures A/B importadas administrativamente no desenvolvimento em auth.users/identities, com emails reservados example.invalid, bcrypt e senhas aleatórias em .env.test.local. A conta de cadastro/onboarding permanece separada; sua senha pessoal não foi coletada. Não houve service role no app nem mudança nas regras de confirmação. Essa preparação administrativa não faz parte do cadastro da aplicação; para reproduzir normalmente, crie as duas contas pela interface/Auth Admin oficial e configure o arquivo local.

Usar projeto exclusivo de desenvolvimento, com migration aplicada. Cadastre duas contas de teste A/B distintas, confirmadas e sem associação compartilhada; o teste cria o primeiro negócio via RPC se necessário. Copie .env.test.example para .env.test.local e configure as quatro variáveis TEST_USER_A_EMAIL/PASSWORD e TEST_USER_B_EMAIL/PASSWORD. URL/chave pública ficam em .env.local. Nenhuma service role é necessária.

```sh
pnpm test:integration
```

Autentica A/B via Auth e executa chamadas PostgREST com seus JWTs. Testa SELECT por UUID próprio/alheio, SELECT sem filtro, UPDATE alheio, INSERT e alteração de vínculo negados, perfil próprio/alheio, owner correto, anônimo e retries concorrentes. Escritas de ataque devem afetar zero linhas ou retornar 42501. O teste não executa limpeza privilegiada: registros de teste ficam no projeto de teste. Não executar em produção. Resultado só é escrito em integration-report.json quando todos passam; ausência de configuração encerra com erro, nunca passa silenciosamente.

## Testes de interface

```sh
pnpm check:ui:public
pnpm check:ui
```

Com servidor ativo e BASE_URL se a porta não for 3000. Ambos verificam telas públicas, validações, botão desabilitado durante requisição, 404 e redirecionamento de todas as rotas privadas em seis larguras. Erro HTTP 404 da rota deliberadamente inexistente é esperado; erros de JS/recursos de outras rotas não são ignorados.

check:ui completo utiliza uma conta nova TEST_SIGNUP_EMAIL/PASSWORD, também configurada como TEST_USER_A_EMAIL/PASSWORD. Primeiro executa cadastro/onboarding; depois login e logout em cada largura. Aceita confirmação habilitada: o operador confirma o email recebido enquanto o script aguarda até dez minutos. A conta B é exigida somente por test:integration. Use uma conta sem negócio por rodada. Sem configuração, o comando completo retorna exit code 1; public-only não é prova de conclusão.

Em 06/10/2026, check:ui passou em produção na porta 3002 com Supabase real: 375/390/430/1280/1440/1920px, 54 verificações de rotas autenticadas, 60 redirecionamentos sem sessão, sem overflow ou erros de console. O cadastro inicial foi realizado pelo SDK real após identificar bloqueio de rede no servidor restrito; o operador confirmou o email. A submissão da tela de cadastro, login confirmado, onboarding sem negócio, criação real, configurações, refresh, nova aba e logout passaram. A submissão repetida de cadastro não significa criação de outra identidade.

Emails de confirmação e recuperação precisam de teste manual com Inbucket/SMTP: cadastrar com confirmação habilitada, abrir link, pedir recuperação, abrir recovery, alterar senha, entrar com nova senha, rejeitar senha antiga e reutilização/expiração do link. Confirmação e recuperação pelo email real foram executadas: solicitação, entrega, callback PKCE no mesmo navegador, nova senha e login. scripts/test-password-reset.mjs comprovou rejeição da senha antiga, nova aceita, logout automático e proteção privada. Reutilização/expiração efetiva do link não foram forçadas nesta rodada. Não marcar fase completa só por build ou testes SQL.

## Limites conhecidos

A auditoria remota aponta complete_onboarding como SECURITY DEFINER executável por authenticated: intencional e necessário, protegido por auth.uid, owner fixo, grants mínimos e search_path vazio. [Aviso oficial](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). A chamada pública da função de event trigger rls_auto_enable foi revogada pela segunda migration. Também foi observado o aviso de proteção contra senhas vazadas desabilitada no Auth; avaliar habilitação conforme o plano antes do uso público. [Configuração oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Logout da aplicação não revoga instantaneamente JWTs externos já emitidos. Refresh após expiração efetiva e reutilização do link de email não foram forçados. Client cookies podem ser lidos por JavaScript conforme o modelo SSR do SDK; manter prevenção de XSS e não introduzir HTML arbitrário. Sem service role, grants administrativos na aplicação ou cache compartilhado de sessões. A Fase 3 adiciona os dados comerciais com proteção descrita abaixo.

## Segurança comercial da Fase 3

RLS ativado nas sete tabelas novas. Políticas leem a membership existente sem recursão e sem metadata editável. Cadastros têm SELECT/INSERT/UPDATE do próprio negócio, USING + WITH CHECK, colunas de identidade não editáveis e DELETE revogado. FKs compostas impedem cross-tenant independentemente do RLS.

sales/sale_items concedem somente leitura ao usuário. A criação usa public.create_sale (invoker) → commerce_private.create_sale (definer). O schema interno não consta da API REST, verificado pelo erro PGRST106 ao tentar acessá-lo. O definer é necessário para escrita financeira fechada: valida auth.uid, membership atual, IDs/atividade dos cadastros, limites e pagamento; calcula preços/custos; registra snapshots; mantém search_path vazio e grants explícitos. Não permite edição/exclusão histórica, execução anônima ou escolha de tenant pelo navegador.

Idempotência usa lock transacional e UNIQUE(business_id,request_id), com comparação de payload. A chave permanece estável nos retries e muda ao iniciar outra venda. FOR SHARE protege os valores do catálogo durante a venda. Qualquer erro reverte todos os registros.

SQL/RLS, ataques diretos pela API com dois JWTs, FKs como administrador, snapshots e interface real são testados separadamente. `test:commerce:integration` persiste fixtures exclusivamente em A/B; `check:ui:commerce` usa TEST_UI_EMAIL/PASSWORD quando configurado. Não executar essas suítes em produção ou com conta pessoal. As vendas de validação são reais no banco de desenvolvimento e ficam apenas nos negócios de teste.

`node scripts/prepare-ui-fixture.mjs` prepara uma identidade dedicada confirmada e um SQL em test-results/ui-fixture.sql (ignorado), sem executá-lo. Revise/aplique o arquivo pelo operador somente no projeto de desenvolvimento documentado. Isso gera credenciais aleatórias locais e preserva A/B. Execute check:ui antes de check:ui:commerce, pois onboarding exige conta sem negócio. A submissão de cadastro usa Auth real, mas uma identidade preconfirmada já existe: não prova nova entrega SMTP. A confirmação do projeto não é desativada. A entrega de confirmação/recuperação já foi validada manualmente na Fase 2 e não foi repetida nesta fase. Para repetir a entrega, use conta nova permitida pelo SMTP, TEST_SIGNUP_PRECONFIRMED=0 e confirmação manual.

Advisor após migration: sem novo aviso de RLS, FKs ou funções de venda expostas. Permanecem o [onboarding definer intencional](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) da Fase 2 e a [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) desabilitada no plano/configuração. Índices ainda não usados são INFO em banco pequeno; mantidos para FKs e consultas previstas. Não há necessidade de serviço pago para validar o núcleo comercial.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [sessões SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [PGlite](https://pglite.dev/docs/).

## Operação financeira da Fase 4

payments, reservations, reservation_items e expenses habilitam RLS imediatamente, revogam grants automáticos e concedem SELECT a authenticated somente quando business_id pertence à membership do usuário. Sem grants de INSERT/UPDATE/DELETE diretos. A view sale_balances usa security_invoker=true, portanto também respeita RLS em sales/payments. Não existe USING(true) ou metadata editável como autorização.

RPCs públicas record_payment/create_reservation/change_reservation/save_expense são invoker. Funções em commerce_private, schema não exposto no PostgREST, são definer apenas para executar as transações fechadas: auth.uid não nulo, membership atual ordenada, objetos qualificados, search_path vazio, validações e EXECUTE restrito. Nenhuma service_role no app. FKs compostas impedem vínculos cruzados de cliente/venda/pagamento/reserva/variante/local mesmo como administrador.

Pagamentos usam lock por chave, cliente e vendas ordenadas; validam saldo no banco e comparam payload em retries. Conversão bloqueia a reserva, copia snapshots e registra uma única venda/recibo/vínculo atomicamente. Pagamento não pode superar saldo. Requisições concorrentes foram validadas por Auth/PostgREST real; PGlite testa regras/rollback, mas possui uma conexão e não prova concorrência HTTP.

Novos checks: pnpm test:operations:rls (42 verificações), pnpm test:operations:integration (34), pnpm test:whatsapp (20) e pnpm check:ui:operations (126). Cobrem A/B, UUID direto, SELECT, escrita indevida, pagamento/quitacão/conversão/edição alheios, referências cruzadas, saldo parcial/final, idempotência, concorrência e métricas. Fluxo UI financeiro completo em seis larguras, sem edição manual de banco. Relatórios e credenciais ficam somente nos arquivos ignorados de teste.

Migrations 20261006080801 e 20261006081925 aplicadas; arquivos anteriores intactos. Advisor após DDL: sem novos avisos de exposição/RLS; índices completos de FKs corrigidos, INFO de índices novos sem uso aceitável. Permanecem [onboarding definer intencional](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção contra senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) da configuração anterior. Veja phase-4-delivery.md para evidências, restrições e configurações externas.

## Segurança operacional — Fase 5

Migration 20261006215613_personal_v1 aplicada sem apagar registros. RLS/grants anteriores preservados; sale_balances continua invoker. Cancelamento usa RPC invoker pública e função privada definer com search_path vazio, auth.uid/owner/negócio atual verificados, sem confiar em metadata editável. Os locks de cliente/venda seguem a ordem do pagamento. Auditoria registra UUID do responsável, instante, motivo e devolução exata dos recibos; venda/itens/payments não são apagados. Retry igual preserva a primeira auditoria. Não existe endpoint de edição de histórico nem chave administrativa no navegador.

Exportações exigem contexto SSR; parâmetros de URL não escolhem tenant. RLS mais filtro server-side limitam todas as consultas. CSV neutraliza fórmulas em texto e recebe private/no-store; SW não guarda CSV/dados/sessões. A página offline é pública e não contém informação de usuário. Arquivos exportados e backups contêm dados pessoais e devem ficar privados; não há importador CSV/restauração implementado.

Configurações permite apenas editar o próprio profile e nome do negócio por owner; moeda/fuso read-only evitam reinterpretar histórico. Headers adicionam nosniff, frame DENY, referrer policy e bloqueio de câmera/microfone/geolocalização que não são usados nesta V1. Não foi introduzida CSP ampla que quebraria o runtime Next; SW/offline possuem políticas próprias.

Testes novos: test:v1:rls (14, inclusive owner/member/anon, valores antigos e estorno em outro dia), test:v1:integration (7 no Supabase real, concorrência e isolamento A/B), test:csv (encoding/aspas/fórmulas) e check:ui:v1 (duas sessões independentes, offline/cache/CSV/cancelamento/configurações/renovação). Executar somente com contas dedicadas em desenvolvimento. test-results/ e credenciais ficam ignorados.

Advisor depois da DDL preservou os dois avisos anteriores: [complete_onboarding definer intencional](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção de senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nenhuma tabela sem RLS/view privilegiada nova. Performance mantém INFO de índices ainda sem uso; não há FK sem índice apontada. Backup/restauração e requisitos antes do uso comercial estão em [deployment.md](deployment.md).
