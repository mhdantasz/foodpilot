# Fase 2 — entrega e evidências

Projeto existente preservado. Em 06/10/2026, o núcleo de identidade foi aplicado ao Supabase de desenvolvimento “Sistema Vendas - Dev”. Isolamento A/B do banco hospedado e check:ui completo em produção passaram. Núcleo da Fase 2 validado, inclusive Auth/SSR e isolamento com dois JWTs reais. Fase 2 concluída nos critérios solicitados. Recuperação pelo email real também aprovada: callback PKCE, nova senha escolhida pelo operador e login no dashboard.

| Item | Resultado |
| --- | --- |
| A. Arquivos | Proxy/DAL, grupos públicos/privados, callback, features/auth, tipos, SessionSync, clients/env, shell/dashboard, scripts, migrations/config/templates e docs. Nesta rodada: tenant-isolation.sql, segunda migration, oito page.tsx explícitos, ModuleRoute, teste UI com confirmação habilitada e documentação. Removida a rota genérica [module]/page.tsx. Package/lock e gitignore preservam dependências e arquivos locais. Criado também scripts/test-password-reset.mjs. |
| B. Migrations | 20261006051550_identity_and_business.sql e 20261006052408_restrict_platform_event_trigger.sql, aplicadas remotamente. Versões locais iguais ao histórico remoto. |
| C. Tabelas | Apenas profiles, businesses e business_members. Nenhuma tabela comercial. |
| D. Cadastro | Validação server-side; Supabase Auth e trigger de profile atômico. Cadastro inicial real por SDK após bloqueio de rede do servidor restrito; email confirmado pelo operador. A submissão da tela de cadastro passou em produção com a conta já existente, sem criar outra identidade. |
| E. Login | signInWithPassword; getUser valida identidade no servidor; cookies SSR. Login correto/incorreto testados em seis larguras. |
| F. Onboarding | Nome, alimento e categoria do local. Usuário sem negócio redirecionado ao onboarding; três passos, sucesso e Começar aprovados com conta real. |
| G. Negócio | complete_onboarding usa auth.uid, transação e advisory lock por usuário. Cria business + owner juntos; retries retornam associação existente. Negócio real “Doces de teste” criado, sem valores comerciais. |
| H. Membership | UNIQUE(business_id,user_id), owner/member. Escrita direta sem grant. Owner da conta confirmado no banco. Schema permite N:N futuro. |
| I. Contexto | getCurrentContext centraliza currentUser/profile/membership/currentBusiness; cache por renderização; primeiro vínculo determinístico. Layout e páginas exigem requireBusiness. |
| J. RLS | Profile próprio, membership própria, negócios associados e UPDATE de business só owner. Grants de UPDATE por colunas. Sem recursão, USING(true), bypass frontend ou service role no cliente. |
| K. Isolamento A/B | 16 controles no PostgreSQL hospedado aprovados: próprio permitido; UUID/SELECT/UPDATE alheios bloqueados; INSERT membership negado; retry, profiles e memberships isolados. Papéis authenticated e identidades distintas, fixtures revertidos. 39 verificações PGlite aprovadas. Também 21 testes Auth/PostgREST com JWTs A/B reais aprovados, incluindo retries concorrentes e anônimo. Na rodada final, A/B são fixtures administrativas exclusivas de desenvolvimento, separadas da conta pessoal, importadas com bcrypt. Não representam cadastro público nem mecanismo da aplicação. |
| L. Autenticação | Cadastro real, confirmação habilitada, email/senha/confirmação inválidos, login correto/incorreto, logout, privado sem sessão, sem/com business, refresh de página e nova aba aprovados. Recuperação por email, callback PKCE, redefinição, logout automático, senha antiga rejeitada e nova aceita aprovados; operador escolheu sua senha pessoal e entrou no dashboard. Renovação após expiração efetiva e reutilização/expiração do link não foram forçadas. |
| M. Responsividade | 375/390/430/1280/1440/1920px. Telas públicas, onboarding, dashboard, configurações e módulos privados. Sem overflow/erros de console. Screenshots em test-results. |
| N. Lint | pnpm lint aprovado sem warnings. |
| O. Typecheck | pnpm typecheck aprovado. |
| P. Build | pnpm build aprovado. Páginas privadas dinâmicas e Proxy. |
| Q. UI | pnpm check:ui aprovado em produção na porta 3002 com Supabase real: 54 verificações de rotas autenticadas, 60 redirecionamentos sem sessão, validações/loading/404, onboarding/login/logout. |
| R. Variáveis | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; ANON_KEY como fallback; APP_URL. .env.local/.env.test.local ignorados. Sem chave privada/senha de banco. Senha aleatória da conta de teste somente no arquivo local ignorado. |
| S. Configuração externa | Migrations já aplicadas. Confirmação de email habilitada. Site URL http://localhost:3001 e callbacks /auth/confirm nas portas 3000/3001/3002 salvos. Template padrão funciona com PKCE no mesmo navegador. Templates token_hash opcionais dependem de SMTP próprio/edição no painel. SMTP tem limites/destinatários permitidos; configurar provedor apropriado antes do uso público. |
| T. Não implementado | Produtos, clientes, vendas, fiados, reservas, estoque, despesas, métricas, gráficos reais, pagamentos, funcionários, permissões avançadas, assinaturas, checkout, IA, WhatsApp, notificações e PWA instalável. |
| U. Decisões/riscos | AppShell no layout privado. Rotas explícitas corrigem HTTP 404 de produção sem mudar URLs. SECURITY DEFINER restrito, search_path seguro. JWT externo pode durar até expiração após logout. FKs RESTRICT exigem processo futuro de exclusão. Proteção de senhas vazadas apontada desabilitada no Auth; avaliar plano/configuração. |
| V. Fase 3 | Iniciar catálogo/clientes e vendas transacionais: business_id, FKs compostas entre tenants, centavos inteiros e limites diários pelo timezone do negócio. |

## Evidências reproduzíveis

Na configuração local final, .env.test.local contém apenas credenciais das fixtures A/B, independentes da conta pessoal. test:integration pode ser repetido. Para repetir cadastro/onboarding no check:ui, configure um novo email permitido e sem negócio em TEST_SIGNUP_EMAIL/PASSWORD, usando essa mesma conta em TEST_USER_A_EMAIL/PASSWORD durante o teste de UI. Não reutilize o email pessoal já cadastrado para simular uma nova identidade. O relatório completo aprovado foi preservado em ui-report.json; testes públicos posteriores gravam ui-public-report.json, sem substituir a evidência autenticada.

scripts/test-password-reset.mjs altera apenas a senha da conta dedicada A, atualiza seu arquivo local ignorado e registra password-report.json. O fluxo por email foi validado separadamente com participação do operador, sem copiar seu link ou senha para o repositório/chat.

- supabase/tests/tenant-isolation.sql: execute completo no desenvolvimento com ferramenta SQL administrativa; ataques usam SET ROLE authenticated e auth.uid. ROLLBACK descarta identidades/negócios. Exceções interrompem falhas.
- pnpm test:rls: aplica todas as migrations em PostgreSQL/PGlite, interfaces mínimas de Auth somente no teste. test-results/rls-report.json contém 39 verificações aprovadas; não simula login HTTP.
- pnpm check:ui: servidor ativo/BASE_URL correto e conta nova em .env.test.local. Com confirmação habilitada, confirme o email recebido enquanto o script aguarda. Auth/SSR/RLS reais, resultado em test-results/ui-report.json. Conta A da UI deve ser a mesma do cadastro, sem negócio prévio.
- pnpm test:integration: verificação adicional de dois JWTs via PostgREST. Executado nesta rodada com duas contas confirmadas e negócios distintos: 21 checks aprovados, registrados em test-results/integration-report.json. A/B da rodada final são fixtures importadas administrativamente em auth.users/identities, com bcrypt e credenciais locais; independentes da senha pessoal escolhida pelo operador. O código da aplicação não acessa nem escreve essas tabelas Auth diretamente.

## Preservação da Fase 1

### Arquivos por área

- Autenticação: src/features/auth/actions.ts, validation.ts, auth-card.tsx, auth-form.tsx, onboarding-form.tsx e account-settings.tsx; src/lib/auth/context.ts; src/app/auth/confirm/route.ts.
- Rotas criadas/organizadas: src/app/(auth)/layout.tsx e login, cadastro, esqueci-senha, redefinir-senha, onboarding/page.tsx; src/app/(app)/layout.tsx, page.tsx, loading.tsx e page.tsx em vendas, clientes, produtos, fiados, reservas, despesas, analises e configuracoes. Os módulos continuam com seu conteúdo preparatório.
- Sessão/tipos: src/proxy.ts, src/lib/supabase/proxy.ts, src/components/session-sync.tsx, src/components/brand.tsx e src/types/database.ts. Clients existentes src/lib/supabase/client.ts, server.ts e env.ts aproveitados/atualizados; src/types/business.ts conserva os contratos de domínio.
- Componentes existentes adaptados: src/components/app-shell.tsx, src/features/dashboard/dashboard.tsx, src/features/modules/module-page.tsx e module-config.ts; novo src/features/modules/module-route.tsx. src/app/layout.tsx, globals.css e error.tsx recebem a composição e estilos de autenticação. Demo financeiro removido; src/config/navigation.ts e identidade visual preservados.
- Banco: supabase/config.toml, as duas migrations listadas em B, supabase/templates/confirmation.html, recovery.html e supabase/tests/tenant-isolation.sql.
- Verificação: scripts/test-env.mjs, test-rls.mjs, test-integration.mjs, test-password-reset.mjs, check-ui-authenticated.mjs e check-supabase-connection.mjs; scripts/check-ui.mjs atualizado. Relatórios/screenshot em test-results, ignorados pelo Git.
- Configuração/documentação: package.json, pnpm-lock.yaml, .gitignore, .env.example, .env.test.example, README.md, docs/architecture.md, database-schema.md, authentication.md, security.md e phase-2-delivery.md. .env.local/.env.test.local são arquivos locais ignorados. docs/phase-1-delivery.md mantido como histórico.

recovery-email-report.json registra a confirmação manual e a inspeção do navegador: email real → callback PKCE → nova senha → login no dashboard, sem coletar senha ou guardar link/token. O relatório automatizado password-report.json cobre a operação autenticada de senha separadamente.

Tokens, componentes, AppShell, sidebar, navegação mobile/Mais, URLs e acessibilidade preservados. AppShell no layout privado protege identidade/dados antes de renderizar. Oito páginas reutilizam ModuleRoute: a rota genérica iniciava streaming e retornava HTTP 200 para URLs inexistentes em produção; o 404 agora retorna seu status correto. Dashboard preserva painéis com estados vazios, nome real, moeda/fuso do negócio. Nenhum valor financeiro fictício persistido.

## Segurança, datas e dinheiro

America/Manaus e BRL são padrões do banco. Datas timestamptz convertidas pelo timezone do negócio; UTC não define “hoje”. Dinheiro futuro será inteiro em centavos, sem FLOAT. O aviso de SECURITY DEFINER da aplicação no Advisor corresponde à complete_onboarding executável apenas por authenticated, necessário e restrito. Funções/grants e avisos externos documentados em docs/security.md.
