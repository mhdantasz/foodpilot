# Banco de dados — Fases 2 a 5

PostgreSQL/Supabase. Quatorze tabelas efetivamente implementadas, com RLS e grants explícitos. A Fase 4 adiciona somente o núcleo operacional solicitado; não há tabela de métricas, IA ou estoque avançado.

## Migrations reproduzíveis

| Versão | Conteúdo |
| --- | --- |
| 20261006051550_identity_and_business.sql | profiles, businesses, business_members, Auth trigger e onboarding |
| 20261006052408_restrict_platform_event_trigger.sql | Restringe função administrativa de event trigger da plataforma |
| 20261006064249_catalog_and_sales.sql | Sete tabelas comerciais, FKs compostas, índices, RLS e RPCs |
| 20261006080801_operational_mvp.sql | Payments, reservas/itens, despesas, fiado, ledger, conversão e agregações |
| 20261006081925_operations_fk_indexes.sql | Índices completos das FKs compostas de venda/cliente |
| 20261006215613_personal_v1.sql | Cancelamento/estorno auditável e agregações que excluem canceladas |

As duas migrations da Fase 2 permanecem intactas. A terceira foi criada com Supabase CLI e aplicada ao projeto de desenvolvimento hbkrcznikmrelkxxcjfq. O arquivo local foi alinhado à versão efetivamente registrada pela ferramenta de aplicação remota. O SQL local é o mesmo aplicado. Reconstrução: ambiente Supabase local com Docker, `supabase db reset`; hospedado novo: revisar destino e executar `supabase db push`. Nunca executar reset no banco de operação.

## Identidade preservada

- profiles: id = auth.users.id; full_name, phone/avatar_url opcionais; created_at/updated_at. Sem email duplicado ou senha. Trigger transacional cria o profile.
- businesses: name, business_type, sales_channel, currency BRL, timezone America/Manaus, timestamps. sales_channel continua sendo personalização conceitual do onboarding.
- business_members: business_id, user_id, role owner/member, created_at; UNIQUE(business_id,user_id). N:N permitido. UI e RPCs escolhem o primeiro vínculo por created_at/id.

## Núcleo comercial

Todas as sete tabelas possuem id UUID, business_id NOT NULL, created_at timestamptz e UNIQUE(business_id,id). Cadastros possuem active, updated_at e trigger de atualização. Sem exclusão física disponível ao usuário.

| Tabela | Campos específicos | Relações |
| --- | --- | --- |
| categories | name, active, sort_order | 1:N products |
| products | name, description opcional, category_id opcional, active | N:1 categories; 1:N variants |
| product_variants | product_id, name, sale_price_cents, cost_price_cents, active | N:1 products |
| customers | name, phone/notes opcionais, active | 1:N sales |
| locations | name, active | 1:N sales |
| sales | customer_id/location_id opcionais; request_id/request_payload; subtotal_cents, total_cents, cost_total_cents, profit_cents; payment_method/status; notes; sold_at/updated_at | N:1 customer/location; 1:N items |
| sale_items | sale_id, product_variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_cents, unit_cost_cents, line_total_cents, line_cost_cents | N:1 sales/variants |

Na Fase 3, pagamento era pix/cash/card/other e status paid. A Fase 4 preserva esses registros e acrescenta credit (fiado), pending e partially_paid. A venda/item continua imutável para escrita direta da aplicação; somente a RPC de pagamento atualiza seu status. Não há descontos/estorno.

## Integridade entre negócios

Cada referência comercial inclui business_id: products → categories; variants → products; sales → customers/locations; sale_items → sales/variants. FKs `(business_id,referenced_id) REFERENCES tabela(business_id,id)` bloqueiam relações cruzadas inclusive com RLS ignorado por uma role administrativa. Sem cascata destrutiva sobre histórico.

Nomes têm de 1 a 100 caracteres após trim; descrições/observações até 2.000. Categorias e locais têm índice único por negócio e nome normalizado (trim, espaços repetidos, lowercase). Sabores têm unicidade por negócio/produto/nome. Telefone é opcional: remove somente pontuação de apresentação, preserva prefixo + e dígitos, valida de 6 a 20 dígitos; não inventa DDI.

## Escritas e RLS

SELECT das sete tabelas exige membership vigente em business_members com user_id = auth.uid(). Cadastros admitem INSERT/UPDATE no próprio negócio; UPDATE tem USING e WITH CHECK. Privilégios de UPDATE só permitem campos mutáveis, sem id/business_id/product_id. DELETE não é concedido.

sales/sale_items não concedem INSERT/UPDATE/DELETE diretos: impedir alteração de preço, lucro ou snapshots é mais forte que uma política de tenant isolada. A escrita ocorre exclusivamente pela RPC create_sale. Todas as funções públicas são SECURITY INVOKER, exceto o onboarding preservado da Fase 2.

## Transações

save_product é SECURITY INVOKER: cria/edita produto e sabores na mesma transação, respeitando RLS. Sabores existentes podem ser desativados; não são excluídos. Entre 1 e 50 sabores por submissão.

create_sale é wrapper SECURITY INVOKER para commerce_private.create_sale, SECURITY DEFINER em schema não exposto. Necessário para gravar as duas tabelas financeiras, cujos grants diretos estão revogados. Identidade vem de auth.uid(); negócio da membership ordenada; todos os cadastros são conferidos por business_id e active. search_path vazio, EXECUTE revogado de PUBLIC/anon e concedido somente a authenticated. Nenhum SQL dinâmico ou papel/negócio fornecido pelo navegador.

Advisory lock por `(business_id,request_id)` serializa retries. UNIQUE(business_id,request_id) protege também a constraint. O payload é comparado: retry igual retorna a venda; payload diferente com a mesma chave é rejeitado. O catálogo é bloqueado FOR SHARE durante a leitura. Quantidades inteiras entre 1 e 9.999, carrinho de 1 a 100 linhas. Preços/custos vêm do banco; valores enviados pelo cliente não são usados. Qualquer falha reverte cabeçalho e todos os itens.

## Dinheiro e snapshots

Todos os campos monetários persistidos são BIGINT em centavos, sem FLOAT/DOUBLE PRECISION. Preço/custo unitário de 0 a 1.000.000.000 centavos. Receita/custo total até 1.000.000.000.000 centavos por venda; subtotal = total; lucro = total − custo. Lucro negativo é permitido quando custo supera receita. Cada subtotal de item deve ser quantidade × preço/custo unitário. Helpers centrais em src/lib/money.ts fazem conversão textual BRL, apresentação, soma e lucro com inteiros seguros.

sale_items guarda nomes, preço e custo históricos. Editar produto/sabor amanhã não modifica vendas anteriores. Ticket médio é agregado no PostgreSQL com NUMERIC e arredondamento ao centavo; não utiliza ponto flutuante nem é persistido como métrica.

## Datas, consultas e índices

sold_at/created_at são timestamptz. sales_period transforma o dia local do negócio em limites UTC: `sold_at >= starts_at AND sold_at < ends_at`. Hoje, ontem, semana, mês, 7/30 dias usam timezone do negócio. Em Manaus, 03:00 UTC ainda pertence ao dia anterior local. Interface usa Intl com business.timezone.

sales_metrics agrega faturamento/custo/lucro/count/ticket/última compra sob RLS. customer_summaries agrupa compras por cliente. O dashboard não baixa todas as vendas no navegador. Histórico paginado em 50 vendas, com itens buscados apenas dessas vendas. Cadastros são carregados em páginas de 1.000 para respeitar o limite da API, sem truncamento silencioso.

Índices: business/date de vendas; business/customer/date; business/location; business/sale em itens; business/variant em itens; business/category em produtos; business/product em variantes (índice único); business/name de clientes. Uniques (business_id,id) também cobrem buscas e FKs de tenant.

## Verificação e evolução

`pnpm test:rls` preserva o núcleo da Fase 2. `pnpm test:commerce:rls` cobre políticas, FKs mesmo como administrador, rollback, snapshots, inteiros e limites de Manaus. `pnpm test:integration` e `pnpm test:commerce:integration` usam JWTs A/B no Supabase real. Resultados estão no [relatório da Fase 3](phase-3-delivery.md).

Futuro: cancelamento/estorno auditável e movimentos de estoque precisam de migrations e regras próprias. Não editar migrations aplicadas nem recalcular histórico a partir do catálogo atual.

## Tabelas operacionais da Fase 4

Todas têm UUID, business_id, created_at, UNIQUE(business_id,id), RLS e grants SELECT somente para authenticated. Escritas financeiras/transições ocorrem apenas por RPC. Sem DELETE.

| Tabela | Campos específicos e integridade |
| --- | --- |
| payments | customer_id nullable para venda rápida; sale_id obrigatório nesta implementação; request_id/request_payload; amount_cents BIGINT positivo; método pix/cash/card/other; paid_at, notes. Unique(business_id,request_id,sale_id), FKs business/sale, business/customer e business/sale/customer. |
| reservations | customer_id obrigatório, location_id opcional; request_id/payload unique por business; scheduled_for timestamptz; reserved/prepared/delivered/converted/cancelled; total/custo em centavos; converted_sale_id, conversion_method, notes, updated_at. FKs compostas para cliente/local e venda/cliente. Uma venda não converte duas reservas. converted exige referência de venda e vice-versa. |
| reservation_items | reservation_id, product_variant_id, snapshots de nomes/preço/custo, quantidade 1–9999, totais = quantidade × unitários. FKs compostas para reserva/variante. |
| expenses | description 1–200; category ingredients/packaging/transport/fees/other; amount_cents BIGINT positivo; incurred_at timestamptz; notes; request_id/payload unique por business; updated_at. Sem tabela de categorias financeira desnecessária. |

payments fica associado a uma venda nesta fase: quitação de cliente gera uma linha por venda, dispensando tabela auxiliar de alocações ou saldo livre. customer_id é sempre copiado/validado pela venda, não informado como autoridade. Quando presente, a FK tripla também impede recibo para outro cliente do mesmo negócio.

### Ledger e transações

sale_balances é view SECURITY INVOKER de sales LEFT JOIN pagamentos agregados por business/sale. paid_cents = soma de payments; balance_cents = total − pago. SELECT da view respeita RLS das duas tabelas. Status materializado só muda junto com o recebimento na mesma transação.

create_sale mantém a assinatura original. credit exige cliente e fica pending quando total > 0, sem recibo. Outros métodos geram recibo integral atômico e status paid. Venda de total zero não gera recebimento de zero nem dívida. A migration recriou os recebimentos das vendas antigas paid usando total e sold_at históricos; nenhum catálogo ou snapshot foi recalculado.

record_payment recebe chave UUID, cliente, venda opcional, centavos positivos e método de recebimento. Sem sale_id, aloca nas vendas abertas mais antigas. A identidade e o business vêm de auth.uid/membership. Lock de chave serializa retries; lock de cliente + vendas ordenadas serializa pagamentos concorrentes e nova venda fiado. Retry igual retorna confirmação; mesma chave com outro payload falha. Saldo/cliente/venda/tenant são validados no banco; excesso rejeitado e tudo revertido. Quitar tudo não altera status sozinho.

create_reservation valida cadastros ativos e próprios, bloqueia catálogo e cria cabeçalho/itens snapshots juntos. Chave/payload impedem retry duplicado. p_scheduled_local é horário de parede do negócio; PostgreSQL converte usando business.timezone. change_reservation bloqueia a reserva: prepared/delivered seguem para frente; cancelled é final antes da conversão. converted copia snapshots para venda, cria recibo se paga e referencia a venda atomicamente. Retry convertido com mesmo método retorna a venda existente; não gera outra. Cancelada/método diferente recusados. Produtos/clientes arquivados continuam referenciáveis pelo compromisso existente.

save_expense valida tenant/valor/data/categoria, torna criação idempotente e permite editar somente a própria despesa. p_day é date local, convertido a meia-noite no timezone do negócio. Edição não altera id/business/request de criação; não existe auditoria de versões ou exclusão nesta fase.

Índices por business/data em pagamentos, reservas e despesas; por business/customer, reservation e variant; e índices completos de três colunas nas FKs sale/customer. Advisor final não apontou FKs sem índice.

### Agregações e fórmulas

- operational_metrics: receita/CPV/lucro/vendas/ticket via sales_metrics; despesas por incurred_at; recebido por paid_at; saldo/devedores históricos; reservas de hoje ainda não canceladas/convertidas. Resultado = lucro bruto − despesas. Períodos são intervalos locais inclusivo/exclusivo da função sales_period.
- customer_finances: comprado/pago/pendente/count/ticket/última compra/vendas abertas/pendência mais antiga; janela semanal considera até 30 dias até hoje, limitados pelo primeiro dia de compra. Compras/semana = count na janela × 7 ÷ dias observados; gasto/semana = receita da janela × 7 ÷ dias, arredondada ao centavo. Inclui dias sem compra; exige pelo menos 14 dias desde a primeira compra e 2 compras na janela, senão NULL/Dados insuficientes. Receita usada inclui fiados; não significa dinheiro recebido.
- operational_analytics: agrupamentos por IDs de variante/produto/cliente/local no período. Financeiro integral; rankings limitados a 20 produtos/clientes e 50 sabores/locais. Média de unidades por dia = unidades ÷ dias de calendário selecionados, incluindo dias zerados. Mês atual considera primeiro dia até hoje, não dias futuros. A frequência individual permanece na janela móvel descrita acima, mesmo quando o ranking usa outro período.
- Previsão: faturamento observado no mês ÷ dias de calendário decorridos × dias do mês. Só existe após 7 dias desde a primeira venda do mês e pelo menos 3 dias distintos com vendas; dias zerados entram no denominador. Arredondada ao real inteiro e exibida como aproximada, nunca garantia. Somente cálculo agregado, sem tabela de previsão/IA.

Dinheiro persistido continua BIGINT. Médias SQL usam NUMERIC e round; quantidades e dias são inteiros. UI calcula apenas a apresentação da média de unidades, a partir de agregado e denominador retornados pelo banco, sem baixar vendas.

## Fase 5 — cancelamento auditável

Sexta migration: `20261006215613_personal_v1.sql`, aplicada ao projeto existente. Nenhuma tabela nova: permanecem as quatorze tabelas das fases anteriores. Campos adicionados a `sales`:

| Campo | Regra |
| --- | --- |
| status | active/cancelled; default active para histórico existente |
| cancelled_at | timestamptz; obrigatório quando cancelled |
| cancelled_by | UUID de profiles; FK RESTRICT, responsável autenticado |
| cancellation_reason | texto obrigatório de 5–500 caracteres quando cancelled |
| refunded_cents | BIGINT >=0 e <=total; default 0 |

Constraint associa estado e auditoria: ativa tem metadados nulos/devolução zero; cancelada exige data, responsável e motivo. Índices completos para cancelled_by/FK e índice por negócio/data do cancelamento. Grants de sales continuam somente SELECT para authenticated; não há UPDATE/DELETE financeiro direto nem INSERT escolhido pelo cliente.

`public.cancel_sale(p_id,p_reason,p_refund_confirmed default false)` é invoker e somente authenticated pode executar. Implementação privada, search_path vazio, verifica auth.uid/negócio atual/role owner. Primeiro bloqueia cliente, depois venda; soma recibos dentro da transação. Se houve recebimento, exige confirmação de devolução; grava exatamente o recebido em refunded_cents. Retry da venda já cancelada com o mesmo motivo retorna o mesmo ID sem alterar data/autor/valor; motivo divergente é recusado. Concorrência com pagamento fica serializada. Não aceita business_id/user_id do formulário.

`sale_balances` permanece SECURITY INVOKER; mantém ordem das colunas anteriores e acrescenta os cinco campos. paid_cents continua a soma dos recibos originais. balance_cents de cancelada é zero. payment_status original não é reescrito como se nunca tivesse ocorrido; status cancelled é a situação predominante na UI. Novos pagamentos são recusados porque não há saldo aberto. Retry de pagamento previamente confirmado retorna o recibo histórico, sem criar novo recebimento.

`sales_metrics`, `customer_summaries`, `customer_finances` e rankings/previsão de `operational_analytics/metrics` excluem canceladas. Recebido líquido = soma dos payments por paid_at − soma de refunded_cents por cancelled_at no intervalo; pode ser negativo. Receita/CPV/lucro desconsideram a venda cancelada inclusive nos períodos de origem, enquanto o caixa preserva o recebimento antigo e registra a devolução no dia do cancelamento. Cancelamento sem recebimento não inventa pagamento/estorno.

Itens, preços/custos snapshots, cliente/local, recibos originais, notas e vínculo com reserva convertida são preservados. Não há estorno parcial, cancelamento independente de recibo ou processamento bancário. Moeda/timezone não editáveis na UI nesta V1; dados em centavos e instantes UTC seguem sendo apresentados em America/Manaus/BRL.
