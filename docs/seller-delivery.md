# Vendedores — entrega e continuidade

Data: 18/11/2026. Responsável: coordenador neste chat. Estado: primeira versão local implementada e revisada; homologação real e publicação pendentes.

## Fonte e escopo
Repositório existente `mhdantasz/foodpilot`, checkout `C:/Dantas-OS/foodpilot`, branch `codex/seller-operations`. Main publica automaticamente na Vercel: nenhum push/merge em main nesta etapa. Nenhum banco remoto modificado.

Contrato em [seller-contract.md](seller-contract.md). Não foram importados dados financeiros, contas de vendedores ou o exemplo de Tyrone como vendas reais.

## Operação implementada
- Login Supabase existente, conta individual por vendedor e convite de uso único emitido pelo gerente.
- Vendedor isolado do papel legado `business_members`; não acessa clientes, despesas, custos ou vendas de terceiros.
- Preço e comissão fixa por item/oferta, definidos pelo gerente por vendedor. Porção de salgados deve ser cadastrada como a unidade comercial correta (por exemplo, porção de 20).
- Vendas em centavos calculadas no servidor, snapshots de catálogo/comissão e retries idempotentes.
- Métricas de receita, comissão, unidades, dias e médias com denominadores explícitos; ranking por IDs estáveis.
- Cancelamento auditável e exclusivo do gerente; bloqueado após fechamento para preservar o histórico pago.
- Fechamento de 7 dias completos em America/Manaus, sem sobreposição. Registro de pagamento preserva autor/data; não transfere dinheiro nem integra a maquininha.

## Orquestração e evidência
- Interno: descoberta do Food Pilot, backend/RLS/RPC e testes locais.
- Externo: CLI oficial Antigravity autenticada, sandbox mantido. Piloto Gemini Flash Low criou `docs/external-route-check.md` sem ler segredos. Interface delegada a Flash Medium, arquivos delimitados no briefing.
- A primeira tentativa de UI foi recusada por permissão de comando em modo não interativo; segunda instrução restringiu o executor a leitura/edição de arquivos, mantendo validação de terminal com o coordenador.
- Revisor interno independente identificou incompatibilidade do email com callback contendo query e bypass do onboarding; ambos corrigidos. Revisão do SQL não encontrou bloqueio de privilégio/integridade nos testes disponíveis.
- Saldo numérico não disponível. Sem cobrança/excedente, API paga ou troca automática de fornecedor por cota.

## Verificação
Use executáveis locais quando o wrapper pnpm tentar consultar registry em sandbox:
```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node scripts/test-sellers-rls.mjs
node scripts/test-seller-invitation-return.mjs
node node_modules/next/dist/bin/next build
```
Neste Windows, Turbopack falhou ao iniciar subprocesso tanto no sandbox quanto fora dele. O build completo passou com `node node_modules/next/dist/bin/next build --webpack` (também disponível como `pnpm build:portable`). Não foi necessário alterar o compilador padrão de produção.

Resultados finais: TypeScript e ESLint sem erros;26 testes de vendedores,7 testes de convite/retorno de autenticação,68 regressões comerciais,42 operacionais e14 de cancelamento aprovados (157 no conjunto). Testes locais do build confirmaram `/equipe` e `/vendedor` redirecionando visitantes para `/login`, dados privados com `Cache-Control: private, no-store`, `/convite` com `Referrer-Policy: no-referrer` e `/preview-vendedores` retornando404 em produção.

Revisão visual pela ferramenta de navegador em390×844: carrinho recalcula preço/comissão; falha preserva quantidade/chave; configuração abre oferta existente correta; novo vendedor não recebe comissão fictícia; Escape fecha modal e restaura foco; Tab permanece no modal. Captura em `C:/Dantas-OS/cofre/50 Entregas/Vendedores - previa mobile.jpg`.

Para reabrir a prévia sem configurar Supabase: `node scripts/preview-sellers.mjs` ou `pnpm preview:sellers`. URLs: `http://127.0.0.1:3018/preview-vendedores` e `http://127.0.0.1:3018/preview-vendedores?view=seller`. Demonstração exige modo development e flag específica; nunca aparece em produção. Os valores mostrados são fictícios e não alteram registros reais.

Testes PostgreSQL locais usam PGlite. Não substituem fluxo real Supabase Auth/PostgREST/email nem prova de concorrência em sessões simultâneas. O ambiente local não recebeu credenciais de produção. A prévia sem Supabase verifica páginas públicas e preservação do convite; não implica login real validado.

## Homologação e ativação
1. Aplicar somente a nova migration em banco de teste identificado, com esquema existente. Nunca executar reset no banco de operação.
2. Configurar a prévia com credenciais públicas desse ambiente; preservar templates de confirmação existentes (callback permanece sem query). Não copiar service role para o app.
3. Testar gerente, dois vendedores e um usuário sem vínculo: convite/cadastro/email, registro no celular, isolamento direto pela API, suspensão, cancelamento e fechamento/pagamento.
4. Validar concorrência real de venda/fechamento e aceitação/onboarding e revisar os advisors do ambiente.
5. Revisar implantação e backup antes de migrar produção. Habilitar contas reais e preços/comissões deliberadamente; nenhum valor de remuneração foi presumido definitivo.

## Limites funcionais explícitos
- Vendas da equipe estão neste módulo e não são somadas automaticamente ao dashboard pessoal legado; `/equipe` é a visão consolidada dos vendedores.
- Histórico mostrado é limitado às 100 vendas mais recentes do período; filtros permitem reduzir o intervalo. Não há importação histórica, exportação ou processamento bancário nesta etapa.
- Conta vinculada como vendedor não cria negócio próprio; quem já tem membership precisa de conta individual sem negócio para aceitar.
- Confirmação de email no mesmo aparelho preserva convite em cookie HttpOnly de até7 dias. Em outro aparelho, reabrir o convite original ou inserir o código na área do vendedor.

Próxima ação: escolher ambiente de homologação separado e executar a sequência acima. O único projeto Supabase visível chama-se “Sistema Vendas - Dev”, mas os registros do Food Pilot apontam seu uso pela produção: o nome “Dev” não foi tratado como autorização para migrá-lo ou cadastrar testes nele.
