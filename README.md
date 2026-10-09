# Pronto · gestão de pequenos negócios de comida

Aplicação para pequenos vendedores de alimentos. As Fases 1 e 2 estabeleceram identidade visual, Auth/SSR, onboarding e isolamento. A Fase 3 acrescentou catálogo, clientes, locais e vendas reais. A Fase 4 acrescentou fiados, recebimentos parciais/totais, reservas, despesas, perfil financeiro, WhatsApp por link e análises operacionais. A Fase 5 prepara a V1 pessoal com PWA, aviso/bloqueio offline, cancelamento auditável, CSV e configurações básicas. O projeto existente e a autenticação foram preservados. [Guia de uso](docs/user-guide.md), [publicação/backup](docs/deployment.md) e [entrega da Fase 5](docs/phase-5-delivery.md).

## Instalar e executar

Node 22+ (verificações executadas com Node 24), pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra http://localhost:3000. Sem Supabase, o aplicativo inicia e rotas privadas levam ao login com aviso de configuração. Para outra porta use `pnpm dev --port 3001`; configure APP_URL com a mesma origem.

## Supabase

Copie .env.example para .env.local:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA-PUBLISHABLE-KEY
APP_URL=http://localhost:3000
```

URL e Publishable Key são públicas; nunca use service role ou secret key nesse campo. NEXT_PUBLIC_SUPABASE_ANON_KEY continua aceita por compatibilidade com a Fase 1 quando PUBLISHABLE_KEY não estiver preenchida. .env.local e .env.test.local são ignorados. APP_URL define o destino confiável dos emails. Reinicie o servidor após configurar e refaça build de produção, pois NEXT_PUBLIC é incorporado no build. Nesta sessão .env.local foi preenchido para o projeto existente com APP_URL em http://localhost:3001; migrations versionadas aplicadas ao projeto existente. Os testes de produção foram executados também na porta 3002.

### Projeto hospedado de desenvolvimento

Instale Supabase CLI conforme a documentação oficial. Com CLI disponível:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Revise o projeto selecionado antes de db push. A migration versionada cria as tabelas; não criar tabelas manualmente pelo painel. A aplicação usa somente a chave pública e o usuário autenticado; login da CLI é usado apenas para aplicação das migrations. Como alternativa, execute o arquivo SQL versionado completo por ferramenta de migrations autorizada, mantendo histórico da versão.

Site URL e callbacks locais já foram configurados no Auth. O template padrão funciona via PKCE no mesmo navegador; templates token_hash em supabase/templates são opcionais para abertura em outro navegador e exigem SMTP próprio/edição de templates no painel atual. [Guia de autenticação](docs/authentication.md) contém os caminhos e a configuração exata. O teste de cadastro aceita confirmação habilitada: aguarda até dez minutos pela confirmação do email pelo operador e então continua pelo login real. Use um email novo permitido pelo provedor. Entrega real de email depende das regras/SMTP do Supabase.

### Supabase local opcional

Com CLI e Docker/container runtime compatível instalados, a configuração já existe em supabase/config.toml; não recrie com init:

```sh
supabase start
supabase db reset
supabase status
```

db reset é destrutivo no banco local; use somente ambiente de teste. Pegue URL/chave anon do status para .env.local. Studio: porta 54323; emails de teste: 54324. A configuração local desativa confirmação para testes de onboarding e usa os templates versionados. Sem Docker, use projeto hospedado de desenvolvimento.

## Comandos e testes

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm start
pnpm test:rls
pnpm test:integration
pnpm check:supabase
pnpm check:ui:public
pnpm check:ui
pnpm test:commerce:rls
pnpm test:commerce:integration
pnpm check:ui:commerce
pnpm check:ui:keyboard
pnpm test:operations:rls
pnpm test:operations:integration
pnpm test:whatsapp
pnpm check:ui:operations
pnpm test:v1:rls
pnpm test:v1:integration
pnpm test:csv
pnpm check:ui:v1
pnpm check:pwa
pnpm check:ui:safe-areas
```

Para UI, mantenha servidor ativo e Chromium disponível: `pnpm exec playwright install chromium`. Use BASE_URL se necessário. Testes reais carregam .env.local e .env.test.local. Copie .env.test.example, configure contas A/B confirmadas em negócios separados e uma conta nova para signup, e siga [segurança/testes](docs/security.md). test:integration prepara negócios A/B via RPC. Os registros ficam no projeto exclusivo de teste; não executar em produção.

supabase/tests/tenant-isolation.sql permite repetir os ataques A/B no PostgreSQL hospedado, com fixtures transacionais descartados. test:rls aplica as migrations em PostgreSQL isolado (PGlite, apenas devDependency), validando políticas e transações. **Não substitui testes de Supabase Auth/PostgREST.** check:ui:public valida só telas públicas e redirecionamentos; check:ui exige também sessão, contas e onboarding reais e retorna erro se não puder executá-los. Os relatórios indicam o que realmente passou em test-results (ignorado).

## Rotas

| Públicas / Auth | Função |
| --- | --- |
| /login | Entrar, recuperar senha, criar conta |
| /cadastro | Nome, email, senha e confirmação |
| /esqueci-senha | Solicitar email de recuperação |
| /auth/confirm | Validar token / código e criar cookies |
| /redefinir-senha | Alterar senha; exige sessão validada |
| /onboarding | Três passos e criação transacional; exige sessão sem negócio |

Privadas: /, /vendas, /clientes, /produtos, /fiados, /reservas, /despesas, /analises e /configuracoes. Sem sessão → login; com sessão e sem negócio → onboarding; com negócio → aplicação. Configurações mostra conta, email, negócio, moeda, fuso e logout. Dashboard mostra resultados reais conforme o fuso do negócio. Também são privadas /vendas/nova, /vendas/[id], /clientes/[id], /reservas/nova, /categorias e /locais. Rota desconhecida retorna 404.

## Arquitetura e estrutura

Next.js 16 App Router, React, TypeScript estrito, Tailwind CSS 4, Supabase Auth/SSR/PostgreSQL e pnpm. src/app organiza grupos públicos/privados sem mudar URLs; components mantém o design system e shell; features/auth concentra fluxos; lib/auth/context resolve a identidade e o negócio; lib/supabase separa clients e Proxy; config/navigation permanece centralizada; types tipa a migration.

Banco: profiles, businesses, business_members, categories, products, product_variants, customers, locations, sales, sale_items, payments, reservations, reservation_items e expenses. Quatorze tabelas, RLS e FKs compostas. Escritas financeiras e conversão de reservas são transacionais e idempotentes. Valores em centavos BIGINT; períodos/datas locais pelo timezone do negócio. sale_balances é uma view SECURITY INVOKER, não uma tabela de saldos editáveis.

Leia [arquitetura](docs/architecture.md), [schema](docs/database-schema.md), [autenticação](docs/authentication.md), [segurança](docs/security.md) e [relatório da Fase 4](docs/phase-4-delivery.md). Os relatórios anteriores foram preservados como histórico.

## V1 pessoal: instalação e publicação

Branding central em `src/config/branding.ts`; manifest, ícones e service worker na raiz pública. Instalação exige HTTPS (localhost serve apenas para teste no próprio computador). O cache contém somente a página offline pública; não existe fila de vendas offline nem cache de dados privados. Configurações permite editar nome da conta/telefone e nome do negócio, gerenciar locais e exportar CSV. BRL/America/Manaus permanecem somente para consulta para preservar o histórico.

Cancelamento de venda é definitivo, exige motivo e confirmação da devolução de valores recebidos; mantém itens e recibos, registra data/responsável e exclui a venda dos resultados/fiado. Recebido líquido desconta devoluções na data do cancelamento. A sexta migration, `20261006215613_personal_v1.sql`, está aplicada ao projeto de desenvolvimento existente.

A versão foi verificada em build de produção local com Supabase real. Publicação Vercel ainda depende de conta/projeto autenticado e origem final para APP_URL/URLs do Auth. A Vercel restringe Hobby a uso pessoal não comercial; consulte [instruções e limites](docs/deployment.md) antes de usar em operação comercial. Não houve contratação de plano pago. Não há URL pública ou instalação física declarada nesta entrega.

## Limitações e próximos passos

Não foram implementados cancelamento/estorno de vendas ou pagamentos, estoque avançado, WhatsApp API/envio automático, notificações, IA, planos, checkout, funcionários, permissões avançadas ou PWA. Reservas podem ser canceladas antes da conversão. WhatsApp apenas abre wa.me; o operador decide enviar a mensagem. Não houve deploy público.

O histórico remoto de migrations corresponde aos cinco arquivos locais. Testes comerciais devem usar exclusivamente negócios e contas dedicados ao desenvolvimento: persistem vendas e cadastros de validação. Os testes locais incluem rollback, snapshots, FKs, dinheiro e timezone; os testes reais exercitam JWTs distintos e requisições concorrentes. check:ui:commerce exige um negócio já criado e prefere TEST_UI_EMAIL/PASSWORD, mantendo A/B separados. Na regressão de Auth, uma fixture preconfirmada pode testar a submissão de cadastro e o onboarding sem nova entrega SMTP; esse modo é explícito no relatório. A confirmação do projeto permanece habilitada. Para provar entrega de email, use destinatário permitido e confirme manualmente ou configure SMTP próprio. Veja docs/phase-3-delivery.md e docs/security.md.
