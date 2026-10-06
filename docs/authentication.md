# Autenticação — Fase 2

## Configuração indispensável

O código utiliza Supabase Auth real, sem autenticação fictícia. Configure um projeto Supabase de desenvolvimento, aplique `supabase/migrations/20261006051550_identity_and_business.sql` pela CLI e copie `.env.example` para `.env.local`. Preencha URL, Publishable Key pública (ou chave anon legada) e APP_URL (origem da aplicação; por exemplo http://localhost:3001 se usar essa porta). Nunca envie senhas ou chaves privadas no chat, nem versione arquivos .env.local.

No projeto de desenvolvimento, Site URL foi configurada como http://localhost:3001, com callbacks explícitos http://localhost:3000/auth/confirm, http://localhost:3001/auth/confirm e http://localhost:3002/auth/confirm. Para outro ambiente, ajuste a origem e APP_URL.

O template padrão funciona via PKCE: solicite e abra o link no mesmo navegador, preservando os cookies do verifier. O callback troca o código e usa o redirectType do SDK para enviar recovery à redefinição. Também repassa sb_flow_id validado pelo SDK, suportando os flows atuais. Não decide o destino por next fornecido na URL.

O painel atual exige SMTP próprio ou upgrade para editar templates. Quando disponível, os templates versionados em supabase/templates permitem confirmação por token_hash inclusive em outro navegador:

```html
<!-- Confirm signup -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup">Confirmar email</a>
<!-- Reset password -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Redefinir senha</a>
```

O callback só aceita signup ou recovery, valida o token com verifyOtp e decide o destino internamente. Não aceita `next` arbitrário. Também suporta `code` via exchangeCodeForSession para confirmação e recuperação PKCE no mesmo navegador. O SDK preserva o tipo recovery no verifier; a resposta leva à redefinição. Para abrir o email em outro navegador, utilize o template token_hash documentado após configurar SMTP/edição de templates. Links expiram e são de uso único conforme Supabase. Serviços de escaneamento de email podem consumir links de uso único; considerar confirmação intermediária se isso ocorrer.

O envio de emails depende da configuração de Auth, das restrições de destinatários e dos limites do provedor. Em ambiente público, configure SMTP apropriado; sem isso não há garantia de entrega para qualquer destinatário. No Supabase local, os emails ficam no Inbucket, porta 54324. Envio de recuperação pelo formulário já foi aceito no projeto real. O fluxo completo por link foi validado: email entregue, aberto no mesmo navegador, callback enviou à redefinição, operador salvou sua própria senha e entrou no dashboard. A senha pessoal não foi coletada. Redefinição com sessão validada, logout automático, rejeição da senha antiga e login com a nova foram aprovados em scripts/test-password-reset.mjs.

## Fluxos

- `/cadastro`: nome (2–100 caracteres), email, senha (8–128 caracteres), confirmação. Validação server-side; metadata só transporta full_name. Trigger cria o profile junto com auth.users. Se Auth retornar sessão, vai ao onboarding; caso contrário mostra instrução para confirmar email. A resposta não revela se um endereço já existe.
- `/login`: email/senha com signInWithPassword. Mensagens humanas, inclusive email não confirmado. Redirect para `/` deixa a DAL decidir entre aplicação e onboarding.
- `/esqueci-senha`: resetPasswordForEmail com callback de origem confiável. Mensagem neutra não revela existência de conta.
- `/auth/confirm`: valida token e cria sessão por cookies; recovery → `/redefinir-senha`; signup → `/onboarding`, que encaminha quem já tem negócio.
- `/redefinir-senha`: exige usuário verificado por getUser; updateUser modifica a senha somente desse usuário. Uma sessão normal autenticada também autoriza alterar sua própria senha. Após mudança, signOut global e retorno ao login. Links inválidos/expirados são rejeitados.
- Logout em Configurações e onboarding: signOut global, revalidação do layout e login. Erro de logout é mostrado e não é tratado como sucesso.

## Sessão e proteção

`@supabase/ssr` usa cookies; não há sessão autoritativa baseada em React ou localStorage. `src/proxy.ts` renova tokens via getClaims e propaga cookies tanto à requisição quanto à resposta. `getCurrentContext`, em `src/lib/auth/context.ts`, revalida identidade com getUser (Auth server), consulta profile e vínculo próprio e resolve business sob RLS. React cache deduplica na mesma renderização, sem cache global ou ISR de dados privados. Proxy acrescenta Cache-Control privado/no-store. Todos os layouts dependentes de sessão são dinâmicos.

Layout privado e cada página revalidam a DAL. Sem sessão → login; sessão sem vínculo → onboarding; vínculo válido → aplicação. Server Actions tratam requisições como não confiáveis: onboarding verifica identidade novamente e RPC usa auth.uid. Server Actions têm a proteção de origem do Next.js contra CSRF. Não usar Proxy sozinho como autorização.

SessionSync mantém o cliente browser único do SSR, observa SIGNED_OUT e revalida ao voltar a uma aba ou restaurar página do histórico. Requisições ao servidor continuam sendo a fonte de autorização. JWTs Supabase já emitidos podem continuar válidos para chamadas diretas ao PostgREST até expirar, mesmo depois de logout; na aplicação a DAL usa getUser para verificar a sessão atual. Não prometer revogação instantânea de todos os JWTs externos. Para requisitos futuros mais estritos, avaliar validação de session_id em operações sensíveis e validade curta do token.

## Onboarding e negócio atual

Três passos curtos: nome, tipo principal do alimento e categoria principal do local de venda. `businesses.sales_channel` é um atributo opcional e limitado de personalização; não é uma location nem cria dependência comercial. Nenhuma quarta tabela é necessária.

RPC complete_onboarding cria business e owner em uma transação. Usa advisory lock por auth.uid e retorna a associação existente em retries. O banco permite vários negócios por usuário; nesta fase a DAL escolhe o primeiro por created_at e id, de forma determinística e consistente com a RPC. Não existe ID de negócio enviado pelo cliente como prova de acesso.

Após resposta de sucesso o onboarding mostra “Seu negócio está pronto.”. Começar navega ao início e atualiza o router para resolver o novo vínculo no servidor. Botões ficam desabilitados durante processamento; os formulários preservam campos após erros. Não há flash de dashboard antes da resolução da sessão/vínculo.

## Quando faltam credenciais

A aplicação continua inicializando. Rotas privadas redirecionam ao login, que informa a configuração pendente. Não há modo que libere o dashboard privado, usuário fictício ou bypass de autenticação. Configuração inválida/inacessível não autoriza entrada. Falhas nas consultas de profile/business geram mensagem de carregamento, sem inventar onboarding ou persistência.

Referências: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [profiles e trigger](https://supabase.com/docs/guides/auth/managing-user-data), [recuperação](https://supabase.com/docs/guides/auth/passwords).
