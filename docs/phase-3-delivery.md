# Entrega da Fase 3 — 06/10/2026

**FASE 3 CONCLUÍDA**

O projeto existente ganhou catálogo, clientes, locais e vendas reais no Supabase de desenvolvimento. Auth, SSR, cookies, onboarding, contexto, AppShell e isolamento da Fase 2 foram preservados. Nenhum módulo da Fase 4 foi iniciado. Todas as vendas de validação pertencem a negócios dedicados; consulta administrativa confirmou zero vendas na conta pessoal.

## Relatório A–Z

| Item | Entrega |
| --- | --- |
| A. Arquivos | Lista por área abaixo; Fase 1/2 preservadas, sem recriação de projeto. |
| B. Migrations | Nova 20261006064249_catalog_and_sales.sql, aplicada ao projeto hbkrcznikmrelkxxcjfq. Três versões locais/remotas correspondentes; antigas intactas. |
| C. Tabelas | categories, products, product_variants, customers, locations, sales, sale_items. Total do núcleo: dez tabelas com identidade. |
| D. Constraints/FKs | UNIQUE(business_id,id), FKs compostas nas seis relações comerciais, checks de dinheiro/quantidade/pagamento; categorias/locais/sabores com unicidade normalizada. |
| E. RLS | SELECT das sete tabelas somente para membro. INSERT/UPDATE dos cinco cadastros com USING/WITH CHECK e colunas restritas. Financeiro somente leitura direta; escrita exclusivamente transacional pela RPC. Sem DELETE. |
| F. Produtos | /produtos: criação, edição, pesquisa, categoria/status, ativar/desativar, cards responsivos; persistência real. |
| G. Variantes | Sabores/opções com preço/custo/atividade; padrão Tradicional. Produto + sabores gravados atomicamente por save_product, SECURITY INVOKER. |
| H. Categorias | /categorias: criar, editar, pesquisar e desativar; duplicatas por negócio bloqueadas. Acessível no catálogo/configurações. |
| I. Clientes | /clientes: nome, telefone/observações opcionais, pesquisa, edição, atividade, total/contagem/última compra reais. Sem exclusão destrutiva. |
| J. Locais | /locais: cadastro, edição, pesquisa, atividade. Criação manual deliberada: sales_channel do onboarding é categoria, não identifica um local comercial. Único local ativo é pré-selecionado na venda. |
| K. Venda | /vendas/nova: pesquisa/categoria, carrinho, quantidades, remover, cliente/local opcionais, cadastro rápido sem perder carrinho e pagamento PIX/dinheiro/cartão/outro. RPC calcula os valores pelo catálogo, grava cabeçalho/itens juntos e reverte tudo em erro. Lock + chave única + comparação de payload impedem duplicação em retries/concorrência. |
| L. Snapshots | Nomes, preço e custo copiados em sale_items. Edição posterior não modifica venda antiga; comprovado em SQL, API e UI. |
| M. Centavos | Todos os campos monetários BIGINT. Helpers BRL textuais, formatação, soma/lucro seguros; nenhum FLOAT/DOUBLE PRECISION no schema financeiro. Caso 1200 × 2, custo 430 × 2: receita 2400, custo 860, lucro 1540. |
| N. Timezone | sales_period converte o dia do timezone do negócio para limites UTC inclusivo/exclusivo. Manaus antes/depois de 04:00 UTC testado. Dias de 23/25h de New York também testados para comprovar configuração por negócio. |
| O. Dashboard | Faturamento, lucro, vendas e ticket médio de hoje agregados no banco, respeitando timezone. Zero reais/zero vendas quando vazio; atividade recente somente de vendas reais. |
| P. Perfil | /clientes/[id]: telefone, observações, total comprado, compras, ticket, última compra e histórico paginado, com estados vazios. UUID de cliente alheio não abre perfil. |
| Q. Histórico | /vendas com Hoje/7/30 dias e filtro de cliente; 50 vendas por página. /vendas/[id] mostra itens históricos, pagamento, local, receita/custo/lucro. UUID de venda alheia não abre detalhe. |
| R. Responsividade | 375, 390, 430, 1280, 1440 e 1920px. Cards/listas mobile, colunas desktop, total/finalização fixos acima da navegação no celular. Nomes longos e ausência de overflow verificados. |
| S. SQL/RLS | 39 checks originais + 68 comerciais aprovados em PostgreSQL/PGlite, aplicando todas as migrations. Inclui FKs mesmo com role administrativa, rollback, snapshots, limites, dinheiro e timezone. |
| T. Integração | 21 checks originais + 58 comerciais aprovados no Supabase real. JWTs distintos A/B, SELECT/UPDATE/INSERT alheios negados, referências alheias recusadas, quatro requisições concorrentes gerando uma venda, schema interno fora da API REST. |
| U. UI | check:ui aprovado: 18 telas públicas, 60 redirecionamentos anônimos e 54 páginas autenticadas, além de validações/onboarding/sessão/logout/404. check:ui:commerce: 152 verificações aprovadas em seis larguras. check:ui:keyboard: seis checks de foco/tel/decimal e viewport reduzido. Sem erros JS/console inesperados. |
| V. Lint | pnpm lint aprovado, sem warnings. |
| W. Typecheck | pnpm typecheck aprovado. |
| X. Build | pnpm build aprovado em Next.js 16.3.8; páginas privadas dinâmicas e Proxy preservados. |
| Y. Limitações | Venda paid integral e imutável: sem correção/cancelamento/estorno, fiado, parcial, reservas, estoque, despesas, funcionários, assinaturas, WhatsApp, IA, advanced analytics ou PWA. SMTP e teclado físico: detalhes abaixo. |
| Z. Fase 4 | Definir correção/cancelamento/estorno auditável e, conforme prioridade de negócio, pagamentos/fiado com saldo transacional e histórico. Manter snapshots, RLS, FKs e testes A/B. Não avançado automaticamente. |

## Arquivos criados e modificados

Criados:

- supabase/migrations/20261006064249_catalog_and_sales.sql.
- src/features/commerce/data.ts, actions.ts, catalog.tsx, simple-manager.tsx, sale-composer.tsx, sales-list.tsx, payments.ts.
- src/lib/money.ts, src/lib/business-time.ts.
- src/app/(app)/categorias/page.tsx, locais/page.tsx, vendas/nova/page.tsx, vendas/[id]/page.tsx e clientes/[id]/page.tsx.
- scripts/test-commerce-rls.mjs, test-commerce-integration.mjs, check-ui-commerce.mjs, check-ui-mobile-keyboard.mjs e prepare-ui-fixture.mjs.
- docs/phase-3-delivery.md.

Modificados:

- src/app/(app)/produtos/page.tsx, clientes/page.tsx e vendas/page.tsx: substituem os respectivos espaços preparatórios por módulos reais.
- src/features/dashboard/dashboard.tsx: dados reais e estados vazios.
- src/components/app-shell.tsx e ui.tsx: Nova venda aponta a /vendas/nova; nav reconhece detalhes. /vendas?acao=nova permanece compatível por redirect. Identidade visual, sidebar e navegação mobile/Mais preservadas.
- src/features/auth/account-settings.tsx: links para locais/categorias, preservando conta, moeda, fuso e logout.
- src/app/globals.css: estilos comerciais e foco/controles, preservando tokens. Header/dados longos quebram corretamente, link de pular conteúdo aparece ao receber foco.
- src/types/database.ts: contratos das sete tabelas e funções novas; src/types/business.ts preservado.
- package.json: novos comandos de verificação. Nenhuma dependência de aplicação adicionada; pnpm-lock.yaml preservado.
- scripts/check-ui-authenticated.mjs: substitui interações com placeholders removidos por catálogo/venda reais; mantém autenticação, sessão, navegação e logout. Fixture preconfirmada identificada no relatório.
- .env.test.example, README.md, docs/architecture.md, docs/database-schema.md e docs/security.md.

.env.local e .env.test.local continuam locais e ignorados. test-results é ignorado e contém screenshots, relatórios e SQL de fixture com credencial aleatória. Não há service role, secret key ou senha de banco no aplicativo. As migrations antigas e a integração Auth/SSR não foram modificadas.

## Decisões e limites técnicos

commerceContext reutiliza requireBusiness/getCurrentContext e o cliente server existente; consultas comerciais são centralizadas em data.ts, deduplicadas somente por requisição. Actions não aceitam business_id como autoridade. As funções do banco escolhem a membership na mesma ordem da DAL, mantendo N:N no schema para evolução futura.

O único definer comercial fica em commerce_private, fora do REST. É necessário porque INSERT/UPDATE financeiros não são concedidos diretamente. auth.uid, membership, atividade/tenant dos registros, search_path vazio, grants explícitos e validações protegem sua execução. O wrapper público permanece invoker. Não existe bypass disponível ao navegador nem autorização por metadata editável.

Históricos consultam 50 vendas e só seus itens. Estatísticas são agregadas no banco. Cadastros são buscados em blocos de 1.000 sem truncamento silencioso; limite de segurança de 100.000 por entidade. Para volume maior, migrar a busca/listagem de catálogo/clientes para paginação server-side. Quantidade é inteira; entre 1 e 9.999 por linha, até 100 linhas. Até 50 sabores por submissão de produto. Preço/custo até 1 bilhão de centavos; receita/custo até 1 trilhão de centavos por venda. UI mantém inteiros seguros também nos resultados agregados.

Lucro nesta fase significa receita menos custo histórico do produto, não inclui despesas ou tributos. Preço/custo zero são permitidos; lucro negativo representa venda abaixo do custo. Não há desconto ou pagamento parcial. A confirmação de sucesso mostra o total salvo pelo banco, inclusive se o catálogo mudou antes da gravação.

## Evidências e repetição dos testes

Servidor de produção local validado em http://localhost:3001, com Supabase real e APP_URL correspondente. Com servidor ativo e contas dedicadas configuradas:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:rls
pnpm test:commerce:rls
pnpm test:integration
pnpm test:commerce:integration
pnpm check:ui
pnpm check:ui:commerce
pnpm check:ui:keyboard
```

Configure BASE_URL caso a porta seja diferente. Cada check grava JSON/screenshot em test-results: rls-report, commerce-rls-report, integration-report, commerce-integration-report, ui-report, commerce-ui-report, mobile-keyboard-report. password-report comprova também troca de senha autenticada, logout automático, senha antiga recusada, nova aceita e proteção privada. Esse teste alterou somente a conta dedicada A e atualizou sua credencial no arquivo ignorado.

check:ui precisa de identidade sem negócio para onboarding. TEST_UI_EMAIL/PASSWORD pode ser separado de A/B; deve corresponder à conta TEST_SIGNUP durante a regressão. Prepare uma conta nova por rodada. Opcionalmente, `node scripts/prepare-ui-fixture.mjs` cria credenciais aleatórias locais e prepara test-results/ui-fixture.sql, que o operador revisa/aplica somente no desenvolvimento antes do check. O script não executa SQL ou acessa uma chave administrativa. Execute check:ui antes de check:ui:commerce.

Nesta fase a identidade UI foi importada e preconfirmada para evitar nova dependência de SMTP. Cadastro foi submetido pela UI contra Auth real; onboarding/negócio/owner foram criados pela aplicação. O relatório marca authFixture=true e emailDeliveryRetested=false. Isso não é prova de nova identidade criada pelo endpoint de signup nem de entrega de email nesta rodada. O cadastro com confirmação e a recuperação por email já tinham sido validados com participação do operador na Fase 2; implementação/configuração preservadas. Para repetir email ponta a ponta, use destinatário permitido e confirmação manual ou SMTP próprio. A confirmação do projeto não foi desativada.

As suítes comerciais não usam respostas falsas ou sessões fabricadas no navegador. As interceptações apenas atrasam o transporte real para verificar botões desabilitados; o pedido segue para o servidor/Supabase. SQL/PGlite valida o banco e não simula a API Auth. Dados de teste são persistidos apenas nos negócios dedicados do desenvolvimento.

Mobile: Chromium com touch, larguras reais, inputmode decimal/type tel, foco, valores preservados e viewport reduzido a 500px para representar área ocupada pelo teclado. O teclado nativo de Android/iOS não é emulado; recomendável homologação em aparelho físico antes da abertura ao público. Screenshots mobile/desktop também foram inspecionados visualmente.

## Advisor e configuração externa

Advisor consultado logo após a única migration nova: nenhum aviso novo de tabelas sem RLS, FKs sem índice ou função de venda privilegiada exposta. Permanecem [onboarding definer intencional](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção contra senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) da configuração/plano. Índices sem uso têm nível INFO em um banco recém-criado; são necessários às consultas/FKs e foram mantidos. Uma reconsulta administrativa posterior foi recusada por autenticação do plugin; não houve DDL após a auditoria já realizada. App/Auth/PostgREST continuaram funcionando nos testes reais.

Não há passo manual de banco pendente para a Fase 3: migration já aplicada. Nenhuma dependência paga, deploy, migração destrutiva, troca de arquitetura ou chave privada foi introduzida. URL/chave pública, APP_URL e configuração de callbacks da Fase 2 permanecem válidas. Reavaliar SMTP, segurança de senhas e condições de hospedagem antes de operação pública; a aplicação segue no ambiente de desenvolvimento.
