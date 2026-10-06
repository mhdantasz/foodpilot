# Banco de dados — Fases 2 e 3

PostgreSQL/Supabase. Dez tabelas efetivamente implementadas, com RLS e grants explícitos. Nenhuma tabela de métricas, estoque, pagamentos parciais ou fiado foi antecipada.

## Migrations reproduzíveis

| Versão | Conteúdo |
| --- | --- |
| 20261006051550_identity_and_business.sql | profiles, businesses, business_members, Auth trigger e onboarding |
| 20261006052408_restrict_platform_event_trigger.sql | Restringe função administrativa de event trigger da plataforma |
| 20261006064249_catalog_and_sales.sql | Sete tabelas comerciais, FKs compostas, índices, RLS e RPCs |

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

Pagamento nesta fase: pix, cash, card, other; status exclusivamente paid. Não há descontos, fiado, estorno ou pagamento parcial. Venda registrada é imutável para as roles da aplicação.

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

Futuro: cancelamento/estorno auditável, contas a receber, reservas, despesas e movimentos de estoque precisam de migrations e regras próprias. Não editar as migrations aplicadas nem recalcular histórico a partir do catálogo atual.
