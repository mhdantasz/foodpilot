'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/context';
import { field, validateEmail, validatePassword, businessTypes, salesChannels, type FormState } from './validation';

const unavailable = { error: 'O acesso ainda precisa ser configurado. Consulte as instruções do Supabase no projeto.' };
function callbackUrl() {
  const raw = process.env.APP_URL || 'http://localhost:3000';
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('APP_URL inválida');
  return `${url.origin}/auth/confirm`;
}
export async function login(_state: FormState, data: FormData): Promise<FormState> {
  const email = field(data,'email').trim();
  const password = field(data,'password');
  if (!validateEmail(email)) return { error: 'Digite um email válido.' };
  if (!password || password.length > 128) return { error: 'Digite sua senha.' };
  const client = await createClient();
  if (!client) return unavailable;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error && (!error.status || error.status>=500 || error.name==='AuthRetryableFetchError')) return {error:'Não foi possível conectar agora. Confira sua conexão e tente novamente.'};
  if (error) return { error: error.code === 'email_not_confirmed' ? 'Confirme seu email antes de entrar. Veja sua caixa de entrada.' : 'Email ou senha incorretos. Tente novamente.' };
  revalidatePath('/', 'layout');
  redirect('/');
}
export async function signup(_state: FormState, data: FormData): Promise<FormState> {
  const fullName = field(data,'full_name').trim();
  const email = field(data,'email').trim();
  const password = field(data,'password');
  if (fullName.length < 2 || fullName.length > 100) return { error: 'Informe seu nome, entre 2 e 100 caracteres.' };
  if (!validateEmail(email)) return { error: 'Digite um email válido.' };
  const invalid = validatePassword(password, field(data,'confirmation'));
  if (invalid) return { error: invalid };
  const client = await createClient();
  if (!client) return unavailable;
  const { data: result, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: callbackUrl() } });
  if (error) return { error: error.code === 'over_email_send_rate_limit' || error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : 'Não foi possível criar a conta. Se já tem uma conta, entre ou recupere sua senha.' };
  if (!result.session) return { success: true, message: 'Confira sua caixa de entrada para confirmar o email. Se já possui uma conta, você pode entrar ou recuperar a senha.' };
  revalidatePath('/', 'layout');
  redirect('/onboarding');
}
export async function forgotPassword(_state: FormState, data: FormData): Promise<FormState> {
  const email = field(data,'email').trim();
  if (!validateEmail(email)) return { error: 'Digite um email válido.' };
  const client = await createClient();
  if (!client) return unavailable;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl() });
  if (error) return { error: 'Não foi possível enviar o link agora. Aguarde alguns minutos e tente novamente.' };
  return { success: true, message: 'Se esse email tem uma conta, você receberá um link para redefinir a senha. Confira também a pasta de spam.' };
}
export async function resetPassword(_state: FormState, data: FormData): Promise<FormState> {
  const password = field(data,'password');
  const invalid = validatePassword(password, field(data,'confirmation'));
  if (invalid) return { error: invalid };
  const client = await createClient();
  if (!client) return unavailable;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { error: 'Seu link expirou. Solicite um novo link de recuperação.' };
  const { error } = await client.auth.updateUser({ password });
  if (error) return { error: 'Não foi possível alterar a senha. Use uma senha diferente ou solicite um novo link.' };
  const { error: logoutError } = await client.auth.signOut();
  if (logoutError) return { error: 'A senha foi alterada, mas não foi possível encerrar a sessão. Tente sair da conta novamente.' };
  revalidatePath('/', 'layout');
  redirect('/login?senha=alterada');
}
export async function logout(): Promise<FormState> {
  const client = await createClient();
  if (!client) redirect('/login');
  const { error } = await client.auth.signOut();
  if (error) return { error: 'Não foi possível sair agora. Tente novamente.' };
  revalidatePath('/', 'layout');
  redirect('/login');
}
export async function completeOnboarding(_state: FormState, data: FormData): Promise<FormState> {
  await requireUser();
  const name = field(data,'name').trim();
  const businessType = field(data,'business_type');
  const channel = field(data,'sales_channel');
  if (name.length < 2 || name.length > 100) return { error: 'O nome do negócio deve ter entre 2 e 100 caracteres.' };
  if (!businessTypes.some(([key]) => key === businessType) || !salesChannels.some(([key]) => key === channel)) return { error: 'Escolha o que você vende e onde costuma vender.' };
  const client = await createClient();
  if (!client) return unavailable;
  const { error } = await client.rpc('complete_onboarding', { p_name: name, p_business_type: businessType, p_sales_channel: channel });
  if (error) return { error: 'Não foi possível preparar seu negócio. Tente novamente; nenhuma criação parcial será mantida.' };
  return { success: true, message: 'Seu negócio está pronto.' };
}
