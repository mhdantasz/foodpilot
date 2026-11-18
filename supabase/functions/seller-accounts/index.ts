// Supabase Edge entrypoint. No credentials are logged or persisted by this function.
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

type Payload = Record<string, unknown>;
class RequestFailure extends Error { constructor(public status: number, message: string) { super(message); } }
const genericLogin = 'Login ou senha inválidos. Confira os dados ou procure o gerente.';
const encoder = new TextEncoder();
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function loginName(value: unknown) { return text(value).trim().toLowerCase(); }
function usernameValid(value: string) { return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value); }
function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''); }
async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function derivedPassword(secret: string, username: string, password: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${username}\u0000${password}`)));
}

Deno.serve(async request => {
  if (request.method !== 'POST') return response({ ok: false, message: 'Método não permitido.' }, 405);
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new RequestFailure(400, 'Dados inválidos.');
    const body: Payload = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new RequestFailure(400, 'Dados inválidos.');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) throw new RequestFailure(503, 'A gestão de acessos ainda não está disponível.');
    const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    async function service(action: string, actor: string | null, input: Payload = {}) {
      const result = await fetch(`${url}/rest/v1/rpc/seller_account_service`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ p_action: action, p_actor: actor, p_input: input }) });
      const data = await result.json();
      if (!result.ok) throw new RequestFailure(result.status === 403 ? 403 : 400, typeof data.message === 'string' ? data.message : 'Não foi possível concluir a gestão do acesso.');
      return data;
    }
    const action = text(body.action);
    if (action === 'login') {
      const username = loginName(body.username), password = text(body.password);
      // CF's connecting IP is set by the edge proxy; the global budget remains
      // enforced when it is absent and bounds requests even if upstream headers vary.
      const ip = request.headers.get('cf-connecting-ip') || 'unavailable';
      const limit = await service('throttle', null, { username: usernameValid(username) ? username : 'invalid', ip_hash: await digest(ip) });
      if (!limit.allowed) throw new RequestFailure(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
      if (!usernameValid(username) || password.length < 5 || password.length > 128) throw new RequestFailure(401, genericLogin);
      const account = await service('lookup', null, { username });
      if (!account) throw new RequestFailure(401, genericLogin);
      const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${username}@seller.mdfoodcontrol.invalid`, password: await derivedPassword(account.secret, username, password) }) });
      const session = await auth.json();
      if (!auth.ok || !session.access_token || session.user?.id !== account.user_id) throw new RequestFailure(401, genericLogin);
      if (!await service('lookup', null, { username })) throw new RequestFailure(401, genericLogin);
      return response({ ok: true, access_token: session.access_token, refresh_token: session.refresh_token });
    }
    // Every administration request authenticates the real JWT, never client role metadata.
    const bearer = request.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ')) throw new RequestFailure(401, 'Entre na conta de gerente.');
    const identity = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: bearer } });
    const user = await identity.json();
    if (!identity.ok || !user.id) throw new RequestFailure(401, 'Entre na conta de gerente.');
    if (action === 'list') return response({ ok: true, accounts: await service('list', user.id) });
    const sellerId = text(body.seller_id);
    if (!/^[0-9a-f-]{36}$/i.test(sellerId)) throw new RequestFailure(400, 'Vendedor inválido.');
    if (action === 'create') {
      const username = loginName(body.username), name = text(body.name).trim(), password = text(body.password);
      if (!usernameValid(username) || name.length < 1 || name.length > 100 || password.length < 5 || password.length > 128) throw new RequestFailure(400, 'Informe nome, login de 3 a 40 caracteres e senha de 5 a 128 caracteres.');
      const prepared = await service('prepare', user.id, { seller_id: sellerId, username, name });
      const created = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ email: `${username}@seller.mdfoodcontrol.invalid`, password: await derivedPassword(prepared.secret, username, password), email_confirm: true, user_metadata: { full_name: name } }) });
      const newUser = await created.json();
      if (!created.ok || !newUser.id) throw new RequestFailure(400, 'Não foi possível criar este login. Escolha outro nome de usuário e tente novamente.');
      try { await service('bind', user.id, { seller_id: sellerId, username, name, user_id: newUser.id }); }
      catch (error) {
        // New unbound accounts have no financial history; compensate partial creation.
        await fetch(`${url}/auth/v1/admin/users/${newUser.id}`, { method: 'DELETE', headers: serviceHeaders });
        throw error;
      }
      return response({ ok: true, username, message: 'Login criado. Compartilhe os dados diretamente com o vendedor.' });
    }
    if (action === 'delete') {
      // Database revocation comes first, protecting existing JWTs even if Auth is unavailable.
      const deleted = await service('delete', user.id, { seller_id: sellerId });
      if (deleted.user_id) {
        const banned = await fetch(`${url}/auth/v1/admin/users/${deleted.user_id}`, { method: 'PUT', headers: serviceHeaders, body: JSON.stringify({ ban_duration: '876000h' }) });
        if (!banned.ok) return response({ ok: true, message: 'Acesso excluído e bloqueado no aplicativo. A revogação complementar no provedor de login está pendente; o histórico foi preservado.' });
      }
      return response({ ok: true, message: 'Acesso excluído. O histórico financeiro foi preservado.' });
    }
    throw new RequestFailure(400, 'Operação inválida.');
  } catch (error) {
    if (error instanceof RequestFailure) return response({ ok: false, message: error.message }, error.status);
    return response({ ok: false, message: 'Não foi possível concluir agora. Confira a conexão e tente novamente.' }, 503);
  }
});
