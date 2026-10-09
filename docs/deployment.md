# Publicação e proteção dos dados — V1

## Estado desta entrega

Código preparado para Next.js na Vercel. Repositório existente: https://github.com/mhdantasz/foodpilot, branch `main`, raiz do projeto. As mudanças locais precisam constar na versão publicada; o conteúdo remoto anterior não representa automaticamente esta entrega. Nenhum novo repositório/projeto Supabase foi criado.

Não houve publicação nesta sessão: a CLI Vercel estava sem autenticação e não havia projeto/URL de destino confirmado. Não há URL pública nem teste hospedado declarado. A aplicação foi testada em build de produção local, usando o Supabase real de desenvolvimento. Não use `localhost:3001` como endereço do celular.

**Plano gratuito:** a Vercel descreve Hobby como pessoal e não comercial. Gerenciar vendas de um negócio pode caracterizar uso comercial, mesmo sem assinatura SaaS. Não foi contratado plano pago nem prometida elegibilidade Hobby. Verifique o enquadramento com a Vercel antes de uso operacional. O código não exige pagamento integrado nem serviço adicional pago. Se Hobby não for elegível, escolher outra hospedagem compatível com Next.js/SSR é uma decisão posterior; não migramos a arquitetura para contornar essa condição. Fontes: [Hobby](https://vercel.com/docs/plans/hobby), [fair use](https://vercel.com/docs/limits/fair-use-guidelines).

## Configuração reproduzível

1. Revise as alterações, confira que `.env.local`, `.env.test.local`, `.vercel` e `test-results` estão ignorados, e publique somente código/migrations/documentação na branch escolhida. Não inclua exportações pessoais nem dumps no Git.
2. Na Vercel, importe **o repositório existente**, selecione `main`, Framework **Next.js**, Root Directory raiz. Se já existir projeto Vercel, utilize-o.
3. Node.js **24.x**, gerenciador **pnpm 11.19.0** conforme `packageManager`. Instalação `pnpm install --frozen-lockfile`, build `pnpm build`; Output Directory padrão do Next.js. Não é exportação estática. A Vercel serve automaticamente a aplicação; `pnpm start` é para produção local. [Runtimes Node suportados](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
4. Configure as três variáveis abaixo no ambiente Production. Para Preview, use projeto Supabase de teste e origem Preview explícita; não compartilhe dados reais indiscriminadamente entre previews.
5. Faça o primeiro deploy, obtenha a origem HTTPS definitiva, ajuste `APP_URL` e URLs do Auth e **republique**. URL/chave `NEXT_PUBLIC` são incorporadas no build; alterar apenas o runtime não atualiza o navegador.

| Variável | Valor/origem |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Project URL do projeto escolhido |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable Key pública do mesmo projeto |
| APP_URL | `https://SEU-APP.vercel.app`, sem barra final |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` é fallback legado, não precisa duplicar a Publishable Key. **Não há service role, secret key ou senha do banco na aplicação.** Não crie variantes `NEXT_PUBLIC` para segredos.

Alternativa CLI, depois de autenticar a conta correta: `pnpm dlx vercel login`, `pnpm dlx vercel link`, configurar as variáveis no projeto e `pnpm dlx vercel --prod`. Revise o projeto selecionado antes de publicar. Não adicionar `.vercel` ao Git. O deploy por CLI pode enviar a versão local revisada; o deploy Git exige as alterações presentes na branch.

## Supabase existente e Auth

Projeto atual: **Sistema Vendas - Dev**, ref `hbkrcznikmrelkxxcjfq`, URL pública `https://hbkrcznikmrelkxxcjfq.supabase.co`. Não foi convertido implicitamente em produção nem limpo. Contém fixtures das verificações. Decida explicitamente se será usado diariamente antes de cadastrar dados reais. As fixtures pertencem a contas separadas; não devem aparecer na conta pessoal por RLS.

As seis migrations versionadas foram aplicadas ao projeto atual, inclusive `20261006215613_personal_v1.sql`. Em outro ambiente autorizado, `supabase link --project-ref REF`, `supabase db push --dry-run`, revisar e `supabase db push`. Nunca usar `db reset` no projeto hospedado com dados. Schema manual somente no painel não substitui migration.

No painel **Authentication → URL Configuration**:

- Site URL: a origem HTTPS definitiva da aplicação.
- Redirect URLs: `https://SEU-APP.vercel.app/auth/confirm`. Cadastro e recuperação solicitam esse callback. O servidor escolhe `/redefinir-senha` pelo tipo de recuperação validado pelo SDK/PKCE ou por OTP, sem aceitar um destino arbitrário na URL.
- Manter origens locais somente enquanto forem necessárias ao desenvolvimento; não liberar redirects arbitrários ou wildcard geral em produção.
- Confirmação de email permanece habilitada. Os templates/SMTP e as restrições de destinatário continuam conforme [autenticação](authentication.md). O template padrão PKCE requer abrir o link no navegador que iniciou o fluxo. Templates token_hash versionados são opcionais para abertura em outro navegador, exigindo configurar o provedor/template adequadamente.

Depois de trocar domínio/origem, repetir cadastro, confirmação, login, recuperação e logout. Não reutilizar um link de recuperação já consumido. Adicionar domínio próprio depois: configurar em Vercel Domains, apontar DNS, aguardar HTTPS e atualizar APP_URL/Site URL/Redirect URLs/redeploy. Domínio pago não é requisito.

## Teste depois de publicar

Primeiro teste com conta/negócio dedicados. Não executar as suítes de escrita na conta pessoal. Defina `BASE_URL` para a URL HTTPS e use `.env.test.local` privado apontando para o banco/contas de teste corretos.

Executar `pnpm check:ui`, `pnpm check:ui:commerce`, `pnpm check:ui:operations`, `pnpm check:ui:keyboard`, `pnpm check:ui:v1`, `pnpm check:pwa` e `pnpm check:ui:safe-areas`. O último aplica explicitamente regras CSS standalone e recortes de tela simulados, sem declarar instalação física. A suíte de cadastro/onboarding exige conta nova; o script `prepare-ui-fixture.mjs` é **exclusivo do desenvolvimento**, não uma rotina de produção. Veja os relatórios em `test-results`. Não publicar esses arquivos.

Em aparelhos físicos: instalar no Android/iOS, verificar safe areas/teclado, entrar no celular, cadastrar produto/cliente, registrar PIX e fiado, pagar parcialmente no PC e atualizar o celular; abrir WhatsApp sem envio involuntário, criar/converter reserva, lançar despesa, conferir dashboard/análises, exportar e sair. Esses testes hospedados/físicos ainda dependem da URL final; emulação local não prova instalação real em iOS/Android.

## Exportação, backup e recuperação

Os dados ficam no PostgreSQL do Supabase; senhas/sessões no Supabase Auth. O navegador usa cookies de sessão e não é o armazenamento principal. O service worker guarda **somente a página pública offline**, sem tabelas, CSV, sessões ou páginas privadas.

Exporte regularmente os quatro CSVs em Configurações e guarde-os com acesso restrito. Eles não incluem todas as relações/snapshots/Auth/schema e não há importador/restauração CSV nesta V1.

Para proteção completa, siga [backups oficiais](https://supabase.com/docs/guides/platform/backups) e [backup/restauração pela CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). No Free, não conte com backup diário recuperável/PITR disponível para você. Faça dump externo de schema, roles e dados conforme o guia, proteja credenciais e arquivos e **teste restauração em outro ambiente isolado**. Dumps podem conter dados pessoais e credenciais derivadas do Auth; nunca commitar ou compartilhar. Este projeto não executou dump/restauração com credenciais administrativas do banco nem criou um sistema próprio de backup.

Projetos Free com baixa atividade durante sete dias podem ser pausados. Consulte os limites e prazos atuais no painel/documentação, sem tratar o serviço gratuito como disponibilidade garantida. [Pausa de projetos](https://supabase.com/docs/guides/platform/free-project-pausing). Quotas de banco, tráfego, Auth e emails também devem ser acompanhadas no painel; não fixamos números comerciais que podem mudar.

Se houver erro: parar novas gravações, verificar conexão/projeto ativo, consultar histórico antes de repetir, preservar mensagens/horários, verificar Supabase Logs e saldo/recibos. Restaurar backup primeiro em ambiente separado, validar referências e isolamento, depois planejar recuperação. **Nunca restaurar sobre o banco ativo sem uma cópia e um plano revisado.** Antes de uso comercial, definir rotina de backup/restauração, responsável, monitoramento, política de acesso e hospedagem elegível.
