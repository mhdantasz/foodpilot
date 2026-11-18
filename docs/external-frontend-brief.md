# Tarefa autorizada — interface do módulo de vendedores

Você é o executor externo Antigravity. Coordenador integra e revisa. Repo C:/Dantas-OS/foodpilot, branch codex/seller-operations. Leia AGENTS.md, docs/seller-contract.md, src/lib/sellers/types.ts, componentes UI e CSS existentes. Leia documentação Next instalada em node_modules/next/dist/docs/01-app/02-guides/server-actions.md e 01-getting-started/03-layouts-and-pages.md antes de código.

Implemente somente arquivos de sua frente: src/components/sellers/* (inclusive CSS próprio), src/app/(app)/equipe/page.tsx, src/app/vendedor/page.tsx, src/app/vendedor/layout.tsx. NÃO crie src/app/convite: coordenador cuida. Não altere arquivos compartilhados, package, migrations, backend, auth, env, configuração, remoto ou banco. Não leia credenciais/dados de clientes. Não acione subagentes ou CLI Maestri.

Use visual atual do Pronto: verde profundo, superfícies claras, cartões limpos, mobile-first de verdade. Texto português, corpo >=16px em telas do vendedor, alvos44px, foco visível, labels, estados loading/error/empty, feedback aria-live. Ícones lucide existentes, sem assets externos. Sem dados fictícios/seed. Layout separado de vendedor sem sidebar de gerente, com Brand, nome/local, logout e install-app se aplicável; forms e métricas acessíveis.

Contrato estável: leia src/lib/sellers/types.ts. Backend sendo implementado em paralelo, NÃO reimplemente.
- src/lib/sellers/data.ts exports getTeamDashboard(from?:string,to?:string), getSellerPortal(from?:string,to?:string), getSellerAccess().
- equipe actions imports src/app/(app)/equipe/actions.ts: createSellerAction(name,location), saveSellerOfferAction(seller_id,variant_id,price_cents,commission_cents,active='true'/'false'), createSellerInviteAction(seller_id), closeSellerWeekAction(seller_id,starts_on,ends_on,request_id), markSellerWeekPaidAction(week_id), cancelSellerSaleAction(sale_id,reason).
- vendedor actions imports src/app/vendedor/actions.ts: recordSellerSaleAction(request_id,payment_method,items JSON array [{offer_id,quantity}]), acceptSellerInviteAction(code).
- Todas ações recebem FormData e retornam Promise<{ok:boolean,message:string,inviteCode?:string}>. Veja types para campos opcionais adicionais. Use client wrapper com useActionState ou startTransition, capturando erro e pending sem perder request_id em falha. UUID de venda estável até sucesso para retries, então reset.
- Valores de formulário em centavos inteiros; UI aceita reais e converte com helper existente brlToCents, jamais parseFloat monetário. Comissão deve ser mostrada ao gerente antes de salvar, e ao vendedor por produto.
- páginas Server Components await searchParams Promise<{from?:string,to?:string}>. Datas selecionadas inclusivas; GET form com inputs date. Média explicitamente separa dias calendário de dias com vendas.

Gerente /equipe: cabeçalho operação, filtros, cartões receita/comissão/resultado (resultado após custo e comissão, sem despesas gerais), lista vendedores com métricas individuais e local, criar vendedor, convite mostrar link /convite?code=..., ofertas por variante (preço e comissão por unidade), histórico últimas100 vendas com cancelamento e motivo, ranking produtos, semanas fechadas pendentes/pagas e ação registrar pagamento. Criar fechamento com datas e chave UUID. Períodos semanais até7 dias e sem datas futuras. A UI deve explicar que pagamento é registro, não transferência bancária. Vendedor sem oferta ainda aparece com estado vazio.

Vendedor /vendedor: se portal.seller null, cartão para aceitar código do gerente (também link /convite); se inactive, avisar acesso suspenso e não renderizar formulário de venda. Se ativo, foco registro rápido: escolher quantidades por oferta, resumo de valor e comissão, forma Pix/cartão/dinheiro/outro, confirmar; mostrar sucesso antes de limpar e manter chave em falha. Seu histórico, comissão no período, rankings/médias e semanas. Nada de custos/lucro de dono ou dados de outro vendedor. Não inferir confirmação da maquininha.

Páginas tratam falhas de dados com mensagem clara, sem mascarar como ausência de vendas. Gerente deve checar owner antes de getTeamDashboard (requireBusiness). Vendedor requer requireUser somente e getSellerPortal, jamais requireBusiness.

Valide pnpm typecheck quando backend pronto; reporte arquivos e limites. Orçamento uma implementação e uma correção focal. Não alterar fora do escopo para corrigir typecheck de backend em andamento.
