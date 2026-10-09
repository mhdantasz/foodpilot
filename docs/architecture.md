# Arquitetura — Fases 1 a 5

Next.js App Router, React, TypeScript estrito e Tailwind CSS 4; Supabase Auth/PostgreSQL/RLS para identidade e negócios. pnpm-lock fixa dependências. A Fase 1 foi estendida sem recriar o projeto. O núcleo comercial da Fase 3 usa os mesmos clientes, contexto e layout protegidos.

## Organização

- src/app/(auth): login, cadastro, recuperação, redefinição e onboarding; layout público dinâmico.
- src/app/(app): dashboard e módulos privados; layout protegido com AppShell existente.
- src/app/auth/confirm: verificação de email/recuperação e cookies de sessão.
- src/components: shell, sidebar, navegação mobile, Brand, SessionSync e componentes base.
- src/features/auth: Actions, validações, formulários e Configurações.
- src/features/dashboard: dashboard com métricas reais de hoje, sem números fictícios.
- src/features/modules: estrutura anterior preservada, ainda usada por Configurações.
- src/features/operations: DAL, Actions, pagamentos, fiados, reservas, despesas, WhatsApp e análises da Fase 4.
- src/config: navegação única; URLs da Fase 1 foram mantidas.
- src/lib/auth/context: DAL central de currentUser, profile, membership e currentBusiness.
- src/lib/supabase: clientes browser/server e renovação de cookies no Proxy.
- src/types: contratos de identidade e schema da migration.
- supabase: configuração local, migration versionada e templates de email.
- scripts: checks de navegador, PostgreSQL isolado e Supabase real.

## V1 pessoal — Fase 5

Mantidos App Router/SSR, clients Supabase existentes, Proxy de cookies, contexto central, AppShell, tokens, rotas e componentes comerciais. Nenhuma dependência nova. A mudança de histórico financeiro necessária é aditiva e versionada; não há outra arquitetura de autenticação, armazenamento local de vendas ou serviço de sincronização.

Branding em `src/config/branding.ts` alimenta Brand, shell, metadata, manifest e página offline. Ícones PNG derivam do SVG existente e podem ser regenerados por `pnpm icons:generate`. `manifest.ts` usa standalone, start/scope `/`, português, ícones 192/512/maskable e apple-touch-icon. Viewport inclui safe areas; navegação e ação Nova venda existentes continuam responsivas.

`AppLifecycle` registra service worker e observa online/offline. Document capture impede submit e botões de gravação identificados quando `navigator.onLine` é falso; falhas de rede ainda são tratadas no servidor. A detecção não garante que Supabase esteja disponível apenas porque o navegador está online. Campos da página aberta permanecem, mas não existe promessa de persistência do rascunho após fechar/recarregar. SW armazena somente `/offline` público: nenhuma página autenticada, CSV, resposta RSC, POST ou dado de negócio entra no cache.

`SessionSync` mantém revalidação ao retornar à página/restauração e na reconexão, evitando refresh por visibilidade durante preenchimento ou operação em andamento. Refresh/nova aba validam o usuário no servidor. Dois navegadores independentes compartilham somente o PostgreSQL: atualizar/abrir refaz a consulta; não há Realtime. Uma indisponibilidade recuperável de Auth gera erro de conexão, sem tratar como usuário novo e redirecionar ao onboarding.

`cancel_sale` segue wrappers públicos invoker → implementação privada definer, com identidade/owner derivados do banco. Locks cliente→venda seguem a ordem dos pagamentos. Atualiza estado/auditoria/devolução numa única transação, mantendo itens/recibos. Totais, perfis e rankings excluem canceladas. Caixa líquido desconta devolução no dia do cancelamento, mantendo a data do recebimento original. UI exige motivo e confirmação física da devolução; o aplicativo não executa transferência bancária. Resposta confirmada do banco alimenta o resumo local para evitar props SSR antigas durante revalidação.

`/exportar` é Route Handler protegido pelo mesmo contexto SSR, mesmo fora do grupo visual privado. Allowlist de tipo/período, filtro business server-side mais RLS e view invoker. Paginação keyset por UUID, corte de criação e limite explícito de 10.000 linhas; exceder retorna 422, nunca arquivo truncado. Exportação não é snapshot transacional entre páginas: uma edição simultânea pode ser refletida; para cópia consistente do banco usar dump. Vendas considera data da venda **ou do cancelamento**, preservando devoluções de vendas antigas no período escolhido. CSV UTF-8/BOM/`;`/CRLF, moeda pt-BR, escape de aspas e neutralização de fórmulas em textos. `private, no-store`, sem cache no SW. Exportação de pagamentos consulta status das vendas em blocos de 100 IDs, evitando consulta por recibo.

Configurações altera nome/telefone do próprio profile e nome do negócio pelo owner com RLS e retorno confirmado. BRL/fuso permanecem read-only porque alterá-los sem conversão histórica redefine períodos/valores existentes. Locais reutilizam CRUD/desativação da Fase 3, sem tabela de filiais. Dashboard usa uma única chamada de métricas operacionais, consulta somente cinco vendas recentes e relações id/nome, sem baixar todas as compras ou repetir resumos de clientes. Análises seguem agregadas no banco.

Publicação/backup e limites do plano gratuito estão em [deployment.md](deployment.md). Não há URL hospedada presumida a partir do repositório; APP_URL e callbacks exigem a origem real do deploy.

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

As entidades comerciais possuem business_id, UNIQUE(business_id,id), FKs compostas e RLS. create_sale resolve o negócio por auth.uid, bloqueia o catálogo, calcula os valores e grava snapshots numa transação idempotente. A Fase 4 mantém essa assinatura e acrescenta credit, status pendente/parcial/pago e ledger payments. Cancelamento/estorno de vendas e recebimentos continuam fora do escopo.

## UI, hospedagem e PWA

Tokens da Fase 1 preservados. Sidebar em 1024px+, bottom navigation/Mais abaixo disso, cards compactos, safe-area, foco visível e largura máxima. Formulários têm controles de toque, carregamento e mensagem humana; campos não são apagados por erros de validação. 404 permanece. PWA instalável/offline continua futuro; não há service worker que armazene sessões ou dados privados.

Sem serviços pagos adicionais ou deploy nesta etapa. Limites e termos dos planos Vercel/Supabase devem ser revisados antes de uso comercial. PGlite é só teste: o backend da aplicação é Supabase. Os testes SQL isolados não substituem Auth/PostgREST real; ambas as camadas de teste são executadas e relatadas por fase.

## Camada comercial da Fase 3

src/features/commerce concentra data.ts (DAL autenticada e consultas), actions.ts (validação e escrita), catálogo, cadastros, composição e histórico de vendas. Todos os endpoints de escrita chamam requireBusiness por commerceContext, reutilizando getCurrentContext. React cache deduplica somente por requisição. Nunca há cache global de dados por negócio.

O navegador escolhe IDs de registros e quantidade; não decide business_id, custo ou lucro. A RPC usa a membership no banco, na mesma ordem da DAL. Um request_id estável durante submissões/retries identifica a tentativa; uma nova venda deliberada ganha nova chave. RLS impede acessos alheios e FKs compostas impedem relacionamentos cruzados. Sales/items não permitem escritas diretas.

Históricos são paginados em 50 vendas; os itens carregados correspondem somente à página. Cadastros têm busca/filtros locais e carregamento em blocos de 1.000 via API, com limite explícito de segurança de 100.000 registros por entidade. Para crescimento maior, introduzir busca/paginação server-side no catálogo e clientes; não truncar silenciosamente. Agregações financeiras continuam no banco.

Mobile usa listas/cards, campos decimal/tel e total/finalização fixos acima da navegação; desktop mantém sidebar e composição em colunas. Rotas explícitas novas não mudam o AppShell ou os grupos de Auth. /vendas?acao=nova continua compatível e redireciona para /vendas/nova.

## Operação e financeiro da Fase 4

operations/data.ts reutiliza commerceContext e o mesmo cliente server; React cache continua restrito à requisição. Não existe novo client Supabase nem chave administrativa na aplicação. payments/reservations/reservation_items/expenses são somente leitura direta para authenticated. As escritas são wrappers públicos invoker de funções em commerce_private, fora da API REST, definer com auth.uid/membership explícitos e search_path vazio.

Ledger de pagamentos append-only: uma linha por recebimento alocado a uma venda. Venda rápida paga pode ter customer_id nulo; fiado exige cliente. sale_balances, view SECURITY INVOKER, deriva pago e saldo dos recibos sob RLS. Não há saldo editável no navegador. Pagamento/quitacão usa lock por chave e por cliente/vendas, compara payload, valida saldo e distribui o valor nas vendas mais antigas. Vendas pagas da Fase 3 receberam um recibo histórico integral no horário da venda, pois somente paid era permitido.

Nova venda e nova reserva compartilham o compositor existente, com o mínimo de campos específicos. Reserva salva snapshots de nome/preço/custo/quantidade e data local convertida pelo banco. Conversão bloqueia a reserva e grava venda, itens, eventual recibo e vínculo de conversão na mesma transação. Retry com o mesmo método devolve a venda existente; método diferente ou reserva cancelada é recusado. Catálogo/cliente arquivados após a reserva não apagam o compromisso nem seus preços históricos.

Despesas têm criação idempotente e edição no próprio tenant via RPC, categoria simples, valor positivo em centavos e data local convertida no PostgreSQL. Não há exclusão ou trilha de versões de edição nesta fase. Históricos comerciais/reservas/despesas/pagamentos são limitados a 50 registros por página. Agregações financeiras e rankings acontecem no banco, não pelo download das vendas para o navegador.

Faturamento inclui fiados; recebido conta payments por paid_at. CPV usa snapshots. Lucro bruto = faturamento − CPV; resultado = lucro bruto − despesas. A receber é saldo histórico, independente do filtro de faturamento. Dashboard deixa cada conceito explícito. Métricas, janela semanal, dias zerados e previsão estão documentados no schema e no relatório da Fase 4.

WhatsApp é apenas link wa.me validado, com texto URL-encoded opcional. Nenhuma API/mensagem automática. Telefone local exige DDD e recebe 55; números internacionais exigem prefixo +/00, ou 55 completo para o Brasil. Sem número válido, a ação leva à edição do cliente. Não se verifica se o número possui conta WhatsApp.

Estados busy/erro/sucesso e refs de bloqueio impedem double submit no cliente; banco continua sendo a autoridade. Ações de pagamento, reserva e despesa em handlers usam startTransition; revalidatePath devolve a árvore SSR atualizada na mesma resposta, sem refresh concorrente. Confirmação de pagamento fica visível mesmo quando a venda sai das pendências após a atualização. Layout loading/error e proteção SSR existentes são reutilizados.

Listas de clientes/categorias/locais e ativação de produtos incorporam a linha devolvida pelo banco após a gravação confirmada, evitando mostrar status antigo enquanto a árvore SSR se atualiza. Não há alteração otimista antes da confirmação. Props com updated_at igual ou mais recente prevalecem; revalidatePath continua invalidando os dados no servidor. Essas ações em handlers usam startTransition, sem refresh concorrente redundante, conforme o guia do Next.js instalado. A regressão cobre desativação e criação de cadastros já inativos.
