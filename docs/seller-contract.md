# Operação de vendedores — contrato de implementação

Origem: pedido direto de Marcelo, 18/11/2026. Branch `codex/seller-operations`. Produção e banco remoto não são alterados nesta etapa.

## Escopo e decisões
- Estender Food Pilot existente. Login Supabase existente, PWA preservada.
- Gerente é `business_members.role = owner`. Vendedores NÃO recebem membership no negócio: módulo isolado evita acesso às RPCs e dados administrativos legados.
- Gerente cria vendedor com nome/local, gera convite de uso único com expiração; vendedor cria sua própria conta via cadastro existente e aceita convite, sem receber senha do gerente.
- Cada vendedor tem ofertas por variante: preço e comissão fixa por unidade vendida (centavos), ambos editáveis pelo gerente. Regra inicial configurável, sem assumir fórmula definitiva de R$44/dia. Salgados registrados por porção, não por unidade avulsa.
- Venda copia nomes, preço, custo e comissão no momento; mudanças futuras não recalculam histórico. Só gerente vê custo/lucro. Vendedor vê suas vendas e comissão.
- Pagamento pix/card/cash/other; app registra recebimentos, não processa nem confirma transação da maquininha.
- Venda idempotente por UUID; estorno auditável pelo gerente. Fechamento semanal usa datas em America/Manaus, inclui apenas vendas ativas, trava itens incluídos e gera valor persistido; marcar pago é registro interno, não transferência.
- Métricas por vendedor/produto e período: receita, comissão, unidades, dias com vendas, média por dia de calendário e por dia com vendas, ranking. Nunca apresentar média sem denominador.
- Sem importar receitas históricas fictícias. Exemplo Tyrone serve somente como cenário de teste/documentação, não seed real.

## Frentes e arquivos
Backend interno: `supabase/migrations/*seller*`, `scripts/test-sellers*.mjs`, `src/lib/sellers/types.ts`, `src/lib/sellers/data.ts`, `src/app/(app)/equipe/actions.ts`, `src/app/vendedor/actions.ts`. Não editar UI.
Frontend externo: `src/components/sellers/*`, `src/app/(app)/equipe/page.tsx`, `src/app/vendedor/page.tsx`, `src/app/vendedor/layout.tsx`, `src/app/convite/page.tsx` (se necessário). Não editar migrations, dependências ou auth compartilhada.
Coordenador: contexto/auth compartilhado, navegação/layout, convite se integração exigir, contratos, testes de integração e revisão final. Arquivos compartilhados têm dono único.

## Interface TypeScript
Implementações e nomes finais em `src/lib/sellers/types.ts` e `data.ts`, definidos antes da UI. Server actions retornam `{ok:boolean, message:string}`; formulários usam FormData e revalidam páginas. Valores monetários sempre inteiros em centavos.

## Aceite e orçamento
- Isolamento provado: vendedor A não lê B nem custos/admin; convite não muda role nem associa outro negócio por input.
- Testes de preço/comissão snapshot, retry sem duplicata, cancelamento, fechamento concorrente/idempotente e datas locais.
- Typecheck, lint, build e testes locais reproduzíveis. Banco remoto só com destino e autorização confirmados.
- Dois executores, uma execução e uma correção focal cada; saldo atual desconhecido. Piloto externo curto antes do lote, sem APIs pagas/excedentes. Parar e registrar em caso de cota/autenticação indisponível.
- Checkpoint: este arquivo + `docs/seller-delivery.md`; responsável integração: coordenador neste chat.
