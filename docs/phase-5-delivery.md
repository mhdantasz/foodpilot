# Entrega da Fase 5 — V1 pessoal

Verificação em 06/10/2026, preservando o projeto e as Fases 1–4. Sem novos módulos SaaS ou dependências. Prioridade: consistência financeira, sessão, isolamento e utilização em celular/computador.

## A. URL da aplicação

Build de produção local em **http://localhost:3001**; não é URL pública e não funciona como localhost no celular. Repositório existente https://github.com/mhdantasz/foodpilot, branch `main`. CLI Vercel sem autenticação/projeto de destino confirmado; **deploy não realizado**. Código e procedimento de deploy preparados em [deployment.md](deployment.md), incluindo origem final, variáveis, callbacks e teste posterior. Mudanças locais ainda precisam integrar a versão publicada.

Vercel Hobby é descrito como pessoal não comercial: não foi prometido uso gratuito elegível para gestão comercial nem contratado plano pago. [Condições oficiais](https://vercel.com/docs/plans/hobby). Supabase Free atual foi preservado.

## B. PWA

Manifest do App Router: name/short_name/description centralizados em `src/config/branding.ts`, standalone, id/scope/start `/`, tema/fundo, pt-BR, ícones PNG 192/512/maskable512 e Apple180 derivados do SVG existente. Metadata Apple e viewport-fit cover. Instruções específicas em Configurações/guia. Chromium CDP: nenhum erro de manifest ou impedimento de instalação. Instalação física Android/iOS/desktop ainda não executada; precisa URL HTTPS final.

Service worker guarda somente `/offline` público. Não guarda Auth, páginas privadas, dados comerciais, CSV, RSC ou POST. Offline mostra aviso explícito e impede gravações por formulários/botões; mantém os campos da tela aberta, sem fila, rascunho permanente ou falsa confirmação.

## C. Supabase

Projeto existente **Sistema Vendas - Dev**, ref `hbkrcznikmrelkxxcjfq`, URL `https://hbkrcznikmrelkxxcjfq.supabase.co`. Seis migrations conferidas no histórico remoto, incluindo **20261006215613_personal_v1.sql**. Quatorze tabelas com RLS, sem novas tabelas na Fase 5. Nenhum dado existente apagado. Consulta administrativa ao final da validação confirmou zero vendas e zero despesas na conta pessoal; gravações das suítes foram em contas/negócios dedicados.

O nome/ambiente continua desenvolvimento; não se declara um projeto de produção separado que não existe. Antes de uso diário, decidir conscientemente destino e tratamento das fixtures, sem apagar dados pessoais.

## D. Variáveis

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_URL`. ANON_KEY apenas fallback legado. APP_URL local nesta entrega: http://localhost:3001; em deploy deve ser origem HTTPS final. `.env.local`/`.env.test.local`/`.vercel`/`test-results`/backups/exports ignorados. Nenhuma service role, secret key ou senha de banco no aplicativo ou relatório. Chave pública completa omitida.

## E. Auth

Preservado Auth Supabase com cookies SSR, getUser server-side, Proxy de renovação e contexto coerente. Validado login correto/incorreto, cadastro/validações, onboarding novo, acesso sem negócio, privadas sem sessão, reload, nova aba, logout e renovação de token real forçando apenas expires_at passado no cookie da conta de teste. Não esperou a duração natural de expiração do JWT. Cadastro UI desta rodada usou fixture Auth pré-confirmada; não se declarou novo envio SMTP.

Confirmação/recuperação por email reais foram verificadas na Fase 2 com participação do usuário; o código foi preservado, mas entrega de email **não foi repetida** nesta Fase 5. Antes da publicação, ajustar Site URL/Redirect URL e repetir com o domínio final. Falhas recuperáveis de Auth não são tratadas como usuário sem negócio. Ao retornar à tela/conectar, revalidação evita interromper campos em preenchimento/operação em andamento.

## F. Vendas

Fluxos PIX/dinheiro/cartão/outro/fiado, snapshots e idempotência preservados. Cancelamento auditável novo, owner-only, com motivo de 5–500 caracteres e confirmação explícita. Se recebeu, exige devolução externa do recebido e registra refunded_cents; não movimenta banco/cartão. Mantém venda, itens e recibos; registra cancelled_at/by/reason. Retry igual não altera auditoria nem duplica devolução. Corrigir = cancelar + nova venda. Retry de criação que aponta para venda já cancelada não mostra confirmação de venda ativa.

Canceladas não contam em faturamento/CPV/lucro/ticket/rankings/previsão nem fiado. Histórico identifica cancelada e valor original. Novos pagamentos não são aceitos quando não existe saldo. Sem edição arbitrária/exclusão histórica, cancelamento parcial ou estorno independente de recibo.

## G. Fiados

Lista com saldo, idade da pendência, filtros, perfil e WhatsApp existente. Dívida cancelada zera; não permanece cobrança indevida. Recebimento parcial/quitação mantêm ledger, validação transacional e locks. Dados de clientes inativos com histórico continuam consultáveis.

## H. Pagamentos

Recibos preservados mesmo após cancelamento. Caixa líquido soma recebimentos por paid_at e subtrai devoluções por cancelled_at, sem reescrever o dia do recebimento antigo; pode ser negativo. Concorrência pagamento/cancelamento validada no Supabase real sem saldo incorreto ou perda de recibo. Checkbox confirma ação externa do operador, sem integração bancária.

## I. Reservas

Criação, snapshots, status, cancelamento anterior à conversão e conversão idempotente mantidos. Conversão gera uma venda/recibo atômicos. A reserva convertida continua como registro histórico mesmo se aquela venda for cancelada; não ganha nova conversão. Itens/data da reserva não são editáveis depois de criada; cancelar/criar outra quando permitido.

## J. Despesas

Criação idempotente/edição/valores/data local e RLS preservados. Entram em resultado após despesas. Sem exclusão nem auditoria de versões; limitação documentada no guia. CSV disponível.

## K. Clientes

Cadastro/edição/desativação e perfil com compras, saldo, última compra, frequência e histórico mantidos. Feedback **Cliente criado**/**Alterações salvas** após confirmação do banco. Nenhuma exclusão casual; snapshots financeiros preservados. Telefone abre WhatsApp por link, sem mensagem automática.

## L. Analytics

Agregações reais no PostgreSQL; nenhum mock, gráfico fictício ou tabela de métricas criada. Canceladas excluídas das classificações e projeção. Home prioriza faturamento, lucro, vendas e a receber; recebido líquido explica devoluções. Frequência/médias/previsão mantêm critérios de dados suficientes e dias sem venda.

## M. Exportação

CSV de vendas/clientes/pagamentos/despesas, períodos hoje/7 dias/30 dias/mês/todo histórico. UTF-8 BOM, ponto e vírgula, CRLF, números pt-BR, aspas/quebras escapadas e fórmulas de texto neutralizadas. Vendas inclui vendas **ou cancelamentos** do período, com originais/recebido/devolvido/saldo/motivo/responsável/data. Pagamentos preserva recibos e marca vendas canceladas. Clientes usa cadastro; despesas usa competência.

Proteção SSR + business server-side + RLS; não aceita business_id do navegador. Teste B exportando com ID extra de A não vazou a venda de A. Anônimo redireciona ao login. Paginação keyset/limite 10.000; exceder gera erro, sem truncar silenciosamente. Leitura entre páginas não é snapshot transacional; CSV não é backup completo/importador. [Backup/recuperação](deployment.md).

## N. Mobile

Larguras 375/390/430/768, navegação/mais/Nova venda/forms/empty states/overflow/console e telas principais nas suítes. Safe areas superior/inferior e laterais protegidas e viewport correto. Teste adicional em 390×844 e 844×390 aplica as regras CSS reais de standalone explicitamente (CDP não altera display-mode) e emula safe-area-insets pelo Chromium; verifica geometria de conteúdo/navegação/Nova venda. Isso não simula instalação física. Foco tel/decimal e altura reduzida de 500px verificados; teclado nativo Android/iOS e instalação física não emulados. Screenshots de cancelamento/configurações/home/formulários/recortes inspecionados.

## O. Desktop

1280/1440/1920, sidebar, forms, resultados, histórico, configurações/CSV/instalação e cancelamento. Sem overflow ou erros de console nas verificações concluídas. Nenhum redesign do shell/tokens/404.

## P. Cross-device

Dois contextos Chromium **independentes**, um móvel/touch e outro desktop, com login real e gravações pela UI no Supabase: celular cria fiado de R$25; PC abre a mesma venda e recebe R$10; celular atualizado vê pago R$10/saldo R$15. Celular cancela com devolução; PC atualizado vê cancelamento, recibo original, devolução R$10/saldo zero. Nenhum mock de transporte/resposta/sessão. É emulação com banco real, não homologação em aparelhos físicos/URL hospedada.

## Q. Segurança

RLS nas 14 tabelas; grants/FKs compostas anteriores preservados. cancel_sale pública invoker, implementação privada definer/search_path vazio, autenticação/owner/tenant explícitos. Lock cliente→venda igual ao pagamento. Testes A/B, anon/member e escrita direta negada. CSV sem cache; SW apenas página pública. Headers nosniff/frame DENY/referrer/permissões restritas.

Advisor conservou dois avisos anteriores: [onboarding definer intencional](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção contra senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nenhum novo aviso de RLS/view/RPC financeira exposta. Performance final: INFO de índices ainda sem uso (reservations_customer_idx e sales_cancellation_actor_idx), sem FK sem índice apontada. Não removidos índices novos/FK apenas por baixo uso nesta base pequena.

## R. Performance

Dashboard deixou de repetir sales_metrics além de operational_metrics; limita consulta a cinco vendas recentes e só carrega id/nome de clientes/locais, sem RPC de resumo de clientes para aquela tela. Agregações/analytics permanecem server-side, contexto deduplicado por requisição. Exportação faz status de recibos por lotes de 100 IDs, não por linha. Cadastros ainda usam paginador com teto 100.000 herdado; para volume alto será necessária paginação/busca no servidor. Não se declarou benchmark de latência em produção.

## S. Lint

`pnpm lint`: passou, zero warnings aceitos pelo comando.

## T. Typecheck

`pnpm typecheck`: passou, TypeScript estrito.

## U. Build

`pnpm build`: passou, Next.js 16.3.8/Turbopack, Node24.21.0, sem warnings de compilação. Manifest/ícones/offline/exportar incluídos. Sem mudança de dependências; pnpm-lock preservado.

## V. Testes

| Verificação | Resultado |
| --- | --- |
| test:rls | 39 passaram |
| test:commerce:rls | 68 passaram |
| test:operations:rls | 42 passaram |
| test:v1:rls | 14 passaram, incluindo estorno em outro dia/owner/member/anon |
| test:integration | 21 passaram no Supabase real |
| test:commerce:integration | 58 passaram no Supabase real |
| test:operations:integration | 34 passaram no Supabase real |
| test:v1:integration | 7 passaram no Supabase real, inclusive concorrência |
| test:whatsapp | 20 passaram, nenhuma mensagem enviada |
| test:csv | passou: encoding, locale, aspas/quebras e fórmulas |
| check:ui | 21 telas públicas, 70 redirecionamentos e 63 páginas autenticadas; validações/sessão/logout/cadastro/onboarding passaram em 7 larguras |
| check:ui:commerce | 177 passaram em 7 larguras |
| check:ui:keyboard | 6 passaram em 375/390/430 e altura reduzida |
| check:ui:v1 | 24 passaram: cross-device, offline/cache, 5 períodos de CSV, isolamento, cancelamento, conta/negócio e renovação |
| check:pwa | passou: manifest e critérios Chromium sem impedimentos |
| check:ui:safe-areas | 2 cenários passaram, retrato/paisagem com recortes simulados e CSS standalone aplicado explicitamente |
| check:ui:operations | 147 passaram em 7 larguras |

SQL local aplica migrations em PGlite; não substitui Auth/PostgREST real, também executados. Relatórios/screenshot em `test-results` ignorado, sem credenciais no relatório. Suíte UI real usa fixtures exclusivas e confirma somente persistências do banco; atrasos de transporte para testar loading não inventam respostas.

Duas tentativas da suíte operacional foram interrompidas pela suspensão de rede do computador (`ERR_NETWORK_IO_SUSPENDED`). A execução completa foi repetida mantendo o sistema temporariamente ativo, sem alteração permanente de energia: 147 verificações concluídas e console sem erros. Instalação congelada do lockfile também verificada com `pnpm install --frozen-lockfile --offline --ignore-scripts`: up to date, pnpm11.19.0, nenhum lockfile/dependência alterado.

## W. Limitações restantes

Sem URL pública, Auth com domínio final, teste hospedado ou instalação/aparelho físico nesta sessão. Esses passos dependem da conta/projeto Vercel e enquadramento do plano. Não chamar localhost de aplicação hospedada. Não foi reexecutado email SMTP na Fase 5 nem realizado dump/restauração do banco; instruções oficiais documentadas. Free pode pausar por baixa atividade; backup diário/PITR recuperável não deve ser presumido.

Offline apenas aviso/bloqueio, sem sincronização/rascunho permanente. BRL/timezone read-only por segurança histórica. CSV limitado e sem importador. Despesas sem versões; reservas sem edição após salvar; cancelamento inteiro definitivo com devolução externa; sem edição de recibo. Sem novos módulos comerciais SaaS, planos/pagamentos online, funcionários, IA, push, WhatsApp automático, estoque avançado ou app nativo.

Durante navegação automatizada que abandona respostas em andamento, o runtime Next/React registrou `The destination stream closed early`; a origem foi localizada no handler de cancelamento de stream do React instalado. As verificações de páginas/console e persistência passaram; não foi ocultado log nem alterado código interno do framework. Acompanhar em hospedagem se ocorrer fora de navegação interrompida ou vier acompanhado de 5xx/erro visível.

## X. Próximos passos

Concluir vínculo/publicação na conta Vercel existente ou confirmar hospedagem elegível; configurar variáveis e callbacks da origem final; executar roteiro hospedado em contas de teste; instalar em aparelhos físicos; ensaiar backup/restauração isolados. Depois usar a V1, coletar falhas reais e priorizar correções antes de ampliar escopo. Não iniciar assinatura/funcionários/novos módulos apenas porque a base está pronta.

## Arquivos desta fase

Criados: migration personal_v1; `next.config.ts`; branding central; manifest/offline/exportar; AppLifecycle/InstallApp; ícones públicos/SW; CSV; SettingsActions/SettingsForm; CancelSale/ExportForm; scripts test-v1-rls/test-v1-integration/test-csv/check-ui-v1/check-ui-safe-areas/check-pwa/generate-icons; user-guide/deployment/este relatório.

Modificados: package.json (scripts), .env.example, .gitignore, README/architecture/database-schema/security; layout/metadata, Proxy, Brand/AppShell/SessionSync/erro/contexto Auth; AccountSettings; DAL/dashboard; tipos; Action de venda/cancelamento; compositor/botões financeiros; detalhe/lista de vendas; feedback de cadastro; larguras das três suítes UI existentes. Alterações da Fase 4 já presentes na árvore foram preservadas, inclusive correções de revalidação confirmada e seus testes. Nenhum reset/commit/push automático foi feito.
