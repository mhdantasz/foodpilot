# Arquitetura — Fases 1, 2 e 3

Next.js App Router, React, TypeScript estrito e Tailwind CSS 4; Supabase Auth/PostgreSQL/RLS para identidade e negócios. pnpm-lock fixa dependências. A Fase 1 foi estendida sem recriar o projeto. O núcleo comercial da Fase 3 usa os mesmos clientes, contexto e layout protegidos.

## Organização

- src/app/(auth): login, cadastro, recuperação, redefinição e onboarding; layout público dinâmico.
- src/app/(app): dashboard e módulos privados; layout protegido com AppShell existente.
- src/app/auth/confirm: verificação de email/recuperação e cookies de sessão.
- src/components: shell, sidebar, navegação mobile, Brand, SessionSync e componentes base.
- src/features/auth: Actions, validações, formulários e Configurações.
- src/features/dashboard: dashboard com métricas reais de hoje, sem números fictícios.
- src/features/modules: espaços futuros de fiados, reservas, despesas e análises avançadas.
- src/config: navegação única; URLs da Fase 1 foram mantidas.
- src/lib/auth/context: DAL central de currentUser, profile, membership e currentBusiness.
- src/lib/supabase: clientes browser/server e renovação de cookies no Proxy.
- src/types: contratos de identidade e schema da migration.
- supabase: configuração local, migration versionada e templates de email.
- scripts: checks de navegador, PostgreSQL isolado e Supabase real.

## Mudanças necessárias no layout

O AppShell saiu do layout raiz e passou ao grupo privado. Assim login/cadastro não exibem menus do negócio e dados privados só chegam depois da autorização server-side. O layout raiz conserva metadata, idioma, viewport, ícone e tokens. O grupo não altera URLs. Dashboard preserva painéis, cards e componentes, substituindo exemplos financeiros por estados vazios para o usuário real. demo-data foi removido: não há valores financeiros fictícios no produto autenticado.

## Usuário → associação → negócio

As oito rotas de módulos têm registros explícitos e reutilizam ModuleRoute. A rota genérica [module] iniciava streaming no layout privado e retornava HTTP 200 para uma página inexistente em produção. Os registros explícitos corrigem o 404 sem mudar URLs, AppShell, design system ou conteúdo dos módulos.

auth.users tem profiles 1:1. business_members associa profiles e businesses com role owner/member; o banco suporta N:N. A interface opera com o primeiro vínculo ordenado por created_at/id. Essa seleção é feita em uma única DAL e usa o JWT do usuário, submetida ao RLS. Não existe dono global, seleção de UUID no frontend ou filtro de aplicação como única proteção.

getCurrentContext usa getUser server-side, consulta profile e a primeira membership e depois carrega business protegido no banco. React cache deduplica consultas só na renderização atual. Falhas do banco são apresentadas como falhas de carregamento; não viram falso onboarding. Layout e páginas privadas exigem requireBusiness; onboarding exige requireUser. Todas as Server Actions relevantes verificam identidade, e a RPC não aceita IDs/papéis do cliente.

## Sessão

@supabase/ssr mantém cookies compartilhados entre requests/abas. Proxy chama getClaims para renovar tokens e repassa cookies à requisição e à resposta; a DAL usa getUser para obter o usuário atual no Auth server. Cache-Control privado/no-store, layouts dinâmicos e ausência de cache global impedem reutilização de dados entre contas. Client SessionSync revalida ao retornar a uma aba/restaurar histórico e observa SIGNED_OUT. Não autoriza acesso por estado React.

Clientes continuam opcionais quando faltam variáveis: a aplicação inicia e mostra login com aviso de configuração, mas nunca libera dados privados. Service role não aparece no projeto. [Autenticação](authentication.md) documenta callbacks, emails, recuperação, erros e requisitos externos.

## Banco e isolamento

As migrations da Fase 2 criam as três tabelas de identidade; a migration nova adiciona sete tabelas comerciais. Profile nasce por trigger transacional. Negócio e owner nascem por complete_onboarding, uma transação com advisory lock por usuário e retorno idempotente do vínculo existente. Grants limitados, RLS nas três tabelas e ausência de escrita direta em memberships previnem associação e promoção indevidas. As políticas não são recursivas.

SECURITY DEFINER é restrito à criação de profile/onboarding e à gravação atômica de vendas no schema commerce_private, com search_path vazio e privilégios explícitos. Não há helper privilegiado desnecessário. [Schema](database-schema.md) e [segurança](security.md) descrevem campos, regras e testes. Tipos em src/types/database.ts representam a migration; regenerar com Supabase CLI ao aplicar/evoluir o schema.

## Dinheiro, datas e dados comerciais futuros

Datas são timestamptz, armazenadas como instantes; “hoje” no dashboard usa Intl.DateTimeFormat com o timezone do negócio (America/Manaus por padrão). sales_period calcula limites locais e os converte para UTC no PostgreSQL, incluindo hoje, ontem, semana, mês e 7/30 dias. Valores monetários são BIGINT em centavos, sem FLOAT. Helpers centrais fazem parsing textual e operações com inteiros seguros.

As sete entidades comerciais possuem business_id, UNIQUE(business_id,id), FKs compostas e RLS. create_sale resolve o negócio por auth.uid, bloqueia o catálogo, calcula os valores e grava snapshots numa transação idempotente. sales_metrics e customer_summaries agregam no banco. Pagamento é integral/paid; cancelamento, estorno e competência versus caixa terão regras próprias em fases futuras.

## UI, hospedagem e PWA

Tokens da Fase 1 preservados. Sidebar em 1024px+, bottom navigation/Mais abaixo disso, cards compactos, safe-area, foco visível e largura máxima. Formulários têm controles de toque, carregamento e mensagem humana; campos não são apagados por erros de validação. 404 permanece. PWA instalável/offline continua futuro; não há service worker que armazene sessões ou dados privados.

Sem serviços pagos adicionais ou deploy nesta etapa. Limites e termos dos planos Vercel/Supabase devem ser revisados antes de uso comercial. PGlite é só teste: o backend da aplicação é Supabase. Os testes SQL isolados não substituem Auth/PostgREST real; ambas as camadas de teste são executadas e relatadas por fase.

## Camada comercial da Fase 3

src/features/commerce concentra data.ts (DAL autenticada e consultas), actions.ts (validação e escrita), catálogo, cadastros, composição e histórico de vendas. Todos os endpoints de escrita chamam requireBusiness por commerceContext, reutilizando getCurrentContext. React cache deduplica somente por requisição. Nunca há cache global de dados por negócio.

O navegador escolhe IDs de registros e quantidade; não decide business_id, custo ou lucro. A RPC usa a membership no banco, na mesma ordem da DAL. Um request_id estável durante submissões/retries identifica a tentativa; uma nova venda deliberada ganha nova chave. RLS impede acessos alheios e FKs compostas impedem relacionamentos cruzados. Sales/items não permitem escritas diretas.

Históricos são paginados em 50 vendas; os itens carregados correspondem somente à página. Cadastros têm busca/filtros locais e carregamento em blocos de 1.000 via API, com limite explícito de segurança de 100.000 registros por entidade. Para crescimento maior, introduzir busca/paginação server-side no catálogo e clientes; não truncar silenciosamente. Agregações financeiras continuam no banco.

Mobile usa listas/cards, campos decimal/tel e total/finalização fixos acima da navegação; desktop mantém sidebar e composição em colunas. Rotas explícitas novas não mudam o AppShell ou os grupos de Auth. /vendas?acao=nova continua compatível e redireciona para /vendas/nova. As fases não implementadas permanecem preparatórias.
