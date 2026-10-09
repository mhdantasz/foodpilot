# Entrega da Fase 4 — 06/10/2026

**FASE 4 CONCLUÍDA — MVP OPERACIONAL**. Fluxo real ponta a ponta aprovado nas seis larguras, sem edição manual do banco; ambiente de desenvolvimento local, sem deploy público.

## Relatório A–T

| Item | Entrega |
| --- | --- |
| A. Banco | Quatorze tabelas, PostgreSQL/Supabase real; núcleo anterior preservado. Nova view sale_balances SECURITY INVOKER. Nenhum saldo editável ou dado fictício no produto. |
| B. Migrations | 20261006080801_operational_mvp.sql e 20261006081925_operations_fk_indexes.sql aplicadas ao projeto existente. Cinco versões locais/remotas alinhadas; três anteriores intactas. CLI criou os arquivos; versão local alinhada ao histórico registrado pela aplicação remota. |
| C. Fiado | Método credit, cliente obrigatório, pending/partially_paid/paid. /fiados mostra saldo real, clientes devendo, vendas abertas, idade da pendência, busca e filtros recentes/30+ dias. Perfil/detalhe da venda mostram original/pago/saldo. |
| D. Payments | Ledger append-only e transacional; parciais/totais/quitar tudo com validação do saldo no banco. Chave/payload, lock de cliente e vendas, excesso recusado, nenhuma escrita direta. Histórico por venda/cliente preservado. |
| E. WhatsApp | Entrar em contato no perfil/fiados, link wa.me e texto opcional com nome/saldo. Telefone validado/normalizado; ausente ou incompleto leva a Adicionar telefone. Sem API/envio automático. |
| F. Reservas | /reservas e /reservas/nova; cliente obrigatório, catálogo/quantidades/data/local/notas; Hoje/Amanhã/Próximas/Todas. Reservada/preparada/entregue/cancelada/convertida. Conversão atômica conserva snapshots e referencia uma única venda. |
| G. Despesas | Criar/editar/listar, categorias solicitadas, centavos positivos, data local e filtro Hoje/7/30/mês. Criação idempotente. Sem DELETE. |
| H. Dashboard | Hoje: faturamento/lucro bruto/vendas/ticket. Financeiro: a receber, recebido hoje, despesas de hoje e resultado. Operação: reservas/devedores/vendas recentes e ações rápidas. Previsão mensal simples, aproximada ou Dados insuficientes. |
| I. Analytics | /analises: 7/30 dias/mês atual; financeiro, ranking de compras/gasto de clientes, frequência/gasto semanal, unidades/média diária por sabor, produtos por volume/receita e locais. Agregação SQL; não baixa vendas ao navegador. |
| J. Métricas | CPV histórico; lucro = receita − CPV; resultado = lucro − despesas; caixa por pagamentos. Semanas/dias/previsão incluem dias zerados e mínimos de observação documentados. Dinheiro BIGINT em centavos; médias NUMERIC. |
| K. Mobile | 375/390/430 px: fluxo completo por UI, toque, sem overflow global, total fixo no compositor, carregamento/double submit, decimal/tel. Viewport reduzido representa espaço de teclado; aparelho físico não emulado. |
| L. Desktop | 1280/1440/1920 px: mesmo fluxo completo, composição em colunas, listas/grades, tabelas e filtros; sidebar/design system preservados. |
| M. RLS | Quatro novas tabelas SELECT só por membership, sem INSERT/UPDATE/DELETE diretos; view invoker. FKs compostas inclusive sale/customer; wrappers invoker e funções internas definer com auth.uid/search_path/grants explícitos. Ataques A/B e FKs privilegiadas testados. |
| N. Integração | 21 originais + 58 comerciais + 34 operacionais: Supabase Auth/PostgREST reais, JWTs A/B distintos, concorrência, parciais/quitação, conversão, isolamento. |
| O. UI tests | check:ui completo; regressão comercial 152 checks; operacional 126 checks nas seis larguras. Fluxo comercial/financeiro escrito somente pela UI; SDK nos testes apenas confirma resultados. WhatsApp realmente aberto, sem enviar mensagem. |
| P. Lint | Aprovado, sem warnings. |
| Q. Typecheck | Aprovado. |
| R. Build | Aprovado em Next.js 16.3.8, com rotas privadas dinâmicas e Proxy original. |
| S. Limitações | Sem cancelamento/estorno de vendas/recebimentos, exclusão financeira, auditoria de versões de despesa ou edição de reserva. Email SMTP não repetido; teclado físico não emulado; desenvolvimento local, sem deploy público. Detalhes abaixo. |
| T. Itens adiados | Assinatura/checkout, funcionários/roles avançados, WhatsApp API/automação, IA/forecasting avançado, recomendação de produção, estoque avançado, multi-filial, fidelidade, push, PDF sofisticado. Fase 5 não iniciada. |

## Integridade financeira e decisões

Pagamento de uma venda fiado de 5000 centavos: saldo 5000/pending → receber 2000 → saldo 3000/partially_paid → receber 3000 → saldo 0/paid. Excesso, zero e negativo falham sem escrever. Quatro chamadas concorrentes com a mesma chave geram um recibo; duas chamadas com chaves diferentes tentando pagar o saldo integral resultam em uma aceita e outra recusada. Quitar tudo aloca o valor nas vendas mais antigas, com um recibo por venda; retry não soma outra vez. A UI não marca status pago diretamente.

A regressão identificou status antigo nas listas após desativar cliente/produto. As ações agora devolvem o cadastro confirmado pelo banco e as listas incorporam essa linha até receber props SSR igualmente recentes ou mais novas. Isso também cobre criação de cadastros inativos. Os handlers usam startTransition conforme o guia instalado do Next.js; refresh redundante que concorria com a revalidação foi removido. Não há alteração local antes da confirmação nem substituição da fonte de contexto/autorização.

A mesma correção de transição/revalidação foi aplicada aos handlers operacionais de pagamentos, reservas e despesas, após a regressão detectar status antigo ao preparar uma reserva. O cartão de reserva também incorpora a linha confirmada por SELECT autenticado após a RPC; props mais novas prevalecem. As transações/RPCs e a proteção de tenant não foram alteradas nessa correção.

Vendas pagas da Fase 3 receberam recibos históricos integrais pelo total/sold_at existentes. Essa reconstrução é justificada pela regra anterior, que somente permitia paid integral. Nenhum preço/custo histórico foi recalculado. Venda rápida paga sem cliente continua válida; seu pagamento tem customer_id nulo. Fiado sempre exige cliente. Pagamento geral sem venda/alocação livre não foi implementado, dispensando uma tabela auxiliar.

Reserva guarda nome, preço e custo acordados no momento do cadastro. Conversão mantém cliente/local e snapshots, mesmo se o catálogo ou cliente tiver sido arquivado posteriormente. Reserva de 2 Ninho a 2500 e 1 Coxinha a 700 gera receita 5700, custo 2200 e dois itens corretos. Quatro conversões concorrentes retornam o mesmo UUID. Retry com outro método é recusado. Reserva cancelada não converte. Saldo da venda convertida depende do método escolhido: PIX/dinheiro/cartão/outro gera recibo integral; fiado gera pendência.

Todas as funções financeiras resolvem o business pela membership de auth.uid, na mesma ordem da DAL existente. Não aceitam business_id/user_id/papel do cliente. SECURITY DEFINER só no schema commerce_private não exposto, porque escrita direta financeira permanece revogada; wrappers públicos SECURITY INVOKER. search_path vazio, objetos qualificados, EXECUTE revogado de PUBLIC/anon, sem SQL dinâmico nessas funções. RLS e FKs compostas somam proteções, em vez de depender de filtros de tela.

## Fórmulas e períodos

Faturamento inclui fiados e segue sold_at. Recebido segue paid_at, independentemente da data da venda. CPV usa o custo snapshot; lucro bruto = receita − CPV. Resultado após despesas = lucro bruto − expenses do período. Exemplo controlado no teste: 100000 − 40000 = 60000 de lucro; menos 10000 de despesas = 50000 de resultado. Não é fluxo de caixa nem contabilidade fiscal completa. A receber é saldo de todas as vendas abertas; filtros de análise não limitam a dívida histórica.

Frequência: janela de até 30 dias até hoje, encurtada pelo primeiro dia de compra. Contagem na janela × 7 ÷ dias observados. Gasto semanal: faturamento do cliente na janela × 7 ÷ dias, arredondado ao centavo. Dias sem compras entram; pelo menos 14 dias de história e 2 compras na janela, senão Dados insuficientes. Gasto inclui fiado, não só pagamentos. No teste, 4 compras/20700 em 14 dias resultam em 2 compras por semana e 10350 centavos/semana.

Média por sabor = unidades vendidas no período ÷ dias de calendário do período. Dias zerados entram no denominador. 7/30 dias usam exatamente 7/30; mês atual usa primeiro dia até hoje. As duas métricas semanais dos clientes usam sua janela móvel, independentemente do filtro de ranking.

Previsão: receita acumulada no mês ÷ dias decorridos do mês × número de dias do mês; inclui dias zerados. Só após 7 dias desde a primeira venda do mês e 3 dias distintos com vendas. Arredondamento ao real inteiro, texto Aproximadamente, nenhuma promessa. Teste: 20700 centavos em 7 dias observados, mês de 31 dias, previsão 91700 centavos. No sexto dia ainda retorna insuficiente.

America/Manaus permanece o padrão. Timestamp persistido é timestamptz; entrada datetime-local/date representa horário/data do negócio, convertido no banco. Hoje/amanhã/períodos são limites locais, não adição cega de 24h. A regra existente de dias de 23/25h com timezone configurável continua testada.

## Testes e evidências

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:rls
pnpm test:commerce:rls
pnpm test:operations:rls
pnpm test:integration
pnpm test:commerce:integration
pnpm test:operations:integration
pnpm test:whatsapp
pnpm check:ui
pnpm check:ui:commerce
pnpm check:ui:keyboard
pnpm check:ui:operations
```

Para UI, servidor ativo em BASE_URL. Nesta entrega: http://localhost:3001. Contas dedicadas em .env.test.local; senhas/chaves não são commitadas/exibidas. Configure o Supabase de desenvolvimento, nunca produção, pois testes persistem cadastros/vendas/reservas/despesas reais nos próprios negócios.

SQL/PGlite: 39 identidade + 68 comércio + 42 operação = 149 verificações. O harness aplica as cinco migrations e usa roles authenticated/anon reais do PostgreSQL, sem bypass nos ataques. Testes explícitos de FKs usam role administrativa deliberadamente para demonstrar proteção adicional. Não substitui Auth/HTTP; estes têm 113 verificações reais. Telefone/URL/texto: 20 verificações independentes, sem envio.

check:ui: regressão de cadastro/onboarding/sessão, reload/nova aba/logout/rotas/404, com 18 telas públicas, 60 redirecionamentos anônimos e 54 páginas autenticadas. A identidade de teste foi provisionada/preconfirmada somente como pré-condição, para não exigir nova entrega SMTP. O cadastro foi submetido pela UI; onboarding/business/owner foram criados pela aplicação. Isso não prova entrega de email nem criação de uma identidade nova pelo signup nesta rodada. Confirmação/Auth da Fase 2 preservados e não desabilitados.

check:ui:operations executa, em cada largura: login → produto de dois sabores → cliente → venda PIX → fiado (incluindo cliente obrigatório) → painel de fiados → receber 2000 → saldo 3000 → abrir wa.me → reserva 2 Ninho + 1 Coxinha → preparada → converter PIX → conferir itens → despesa → editar despesa → dashboard → análises → perfil/histórico → quitar saldo restante. Nenhuma operação comercial desse fluxo usa SQL ou SDK para escrita. SDK autenticado de leitura só confirma saldo/status/métricas. Interceptação atrasa o transporte real para validar busy/double submit, sem fabricar resposta. Por rodada, receita 13200, CPV 5200, lucro 8000, despesas 1200, resultado 6800, recebido antes de quitação 10200, pendente 3000.

Relatórios/screenshot ignorados em test-results: rls-report, commerce-rls-report, operations-rls-report, integration-report, commerce-integration-report, operations-integration-report, whatsapp-report, ui-report, commerce-ui-report, mobile-keyboard-report, operations-ui-report. Não commitar fixtures/credenciais/resultados de teste. Screenshots móveis e desktop inspecionados visualmente. Teclado nativo Android/iOS não emulado; viewport reduzido/teste de foco é evidência limitada e homologação física continua recomendada.

Consulta administrativa verificou zero vendas e zero despesas na conta pessoal após os testes. Os dados de validação pertencem exclusivamente a contas/negócios dedicados. Usuários A/B não consultam, pagam, quitam, editam ou convertem registros alheios, inclusive conhecendo UUIDs.

## Arquivos

Criados: duas migrations da Fase 4; src/features/operations/{data,actions,debt-list,payment-form,whatsapp-button,reservation-list,expense-manager,analytics}; src/lib/whatsapp.ts; /reservas/nova; scripts/test-operations-rls.mjs, test-operations-integration.mjs, test-whatsapp.mjs, check-ui-operations.mjs; este relatório.

Modificados: tipos de banco; DAL comercial exporta o paginador existente; método credit na Action/compositor; compositor reutilizado para reserva; labels/status e histórico/detalhe da venda; perfil do cliente; entrada de edição/novo cliente; atualização confirmada das listas de clientes/categorias/locais e do catálogo; transições das ações e cartão de reserva confirmado; quatro rotas operacionais; dashboard; estilos; package.json; regressão UI comercial aceita duas apresentações legítimas do total/pago; README, arquitetura, schema, segurança.

Sem novas dependências. pnpm-lock.yaml e a integração Supabase/Auth/Proxy/AppShell/tokens/404 foram preservados. .env.local/.env.test.local continuam ignorados; nenhuma service_role/secret/senha de banco no aplicativo. Operações administrativas ocorreram pelo plugin Supabase autorizado; a conexão expirada foi refeita pelo operador. As cinco migrations já estão aplicadas; nenhum passo manual de schema pendente.

## Limitações observáveis e configuração

- Uso em desenvolvimento local; sem deploy/hospedagem pública/PWA/offline. Confirme operação em aparelho físico e condições de hospedagem antes de disponibilizar a terceiros.
- Venda/recibo registrados não possuem cancelamento/estorno/edição; antes de confirmar, o operador deve conferir cliente, itens e valor. Não foi criado fluxo de correção improvisado.
- Despesa pode ser editada, sem auditoria de versões; não pode ser excluída. Reserva pode avançar/cancelar/converter, mas não editar itens/data após salvar; cancelamento seguido de nova reserva é o fluxo disponível.
- Recebimentos/reservas/despesas paginados em 50; rankings 20/50 explicitados. Cadastros ainda usam o carregamento por blocos com limite de 100000 da Fase 3. Valores positivos até 1 trilhão de centavos por pagamento/despesa; agregados devem caber em inteiro JavaScript seguro, com helpers que recusam ultrapassagem.
- Análises sem período personalizado; filtros essenciais solicitados estão disponíveis. Previsão é simples e não usa sazonalidade. Nenhum saldo antecipado ou pagamento livre sem venda.
- Telefones sem DDD não abrem link. Brasileiros locais recebem 55; internacionais devem conter +/00. Não se verifica conta WhatsApp/deliverability e o operador decide enviar o texto.
- Advisor de segurança conserva apenas os avisos anteriores: complete_onboarding definer público intencional e proteção contra senhas vazadas desabilitada no Auth. Nenhum novo aviso de tabela sem RLS/view definer/RPC financeira privilegiada exposta. Advisor de performance: FKs sem índice corrigidas pela segunda migration; índices novos ainda sem uso têm nível INFO e foram mantidos.

Nenhuma Fase 5 iniciada. A arquitetura, histórico e testes permanecem a base para evolução posterior.
