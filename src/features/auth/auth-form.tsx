'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowRight, LoaderCircle, LogOut } from 'lucide-react';
import { login, signup, forgotPassword, resetPassword, logout } from './actions';
import type { FormState } from './validation';
const initial: FormState = {};
type Mode = 'login' | 'cadastro' | 'esqueci-senha' | 'redefinir-senha';
const options = {
  login: { action: login, button: 'Entrar', busy: 'Entrando…' },
  cadastro: { action: signup, button: 'Criar conta', busy: 'Criando conta…' },
  'esqueci-senha': { action: forgotPassword, button: 'Enviar link', busy: 'Enviando…' },
  'redefinir-senha': { action: resetPassword, button: 'Salvar nova senha', busy: 'Salvando…' },
};
export function AuthForm({ mode }: { mode: Mode }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const option = options[mode];
  const [state, action, pending] = useActionState(option.action, initial);
  return <form action={action} noValidate className="auth-form"><fieldset disabled={pending || state.success}>
    {mode === 'cadastro' && <label>Nome<input value={fullName} onChange={e => setFullName(e.target.value)} name="full_name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Como podemos chamar você?" /></label>}
    {mode !== 'redefinir-senha' && <label>Email<input value={email} onChange={e => setEmail(e.target.value)} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" /></label>}
    {mode !== 'esqueci-senha' && <label>{mode === 'redefinir-senha' ? 'Nova senha' : 'Senha'}<input value={password} onChange={e => setPassword(e.target.value)} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} maxLength={128} aria-describedby={mode === 'login' ? undefined : 'password-hint'} /></label>}
    {(mode === 'cadastro' || mode === 'redefinir-senha') && <><p id="password-hint" className="field-hint">Use pelo menos 8 caracteres.</p><label>Confirmar senha<input value={confirmation} onChange={e => setConfirmation(e.target.value)} name="confirmation" type="password" autoComplete="new-password" required maxLength={128} /></label></>}
    {mode === 'login' && <Link className="auth-forgot" href="/esqueci-senha">Esqueci minha senha</Link>}
    {state.error && <p className="form-message error" role="alert">{state.error}</p>}
    {state.message && <p className="form-message success" role="status">{state.message}</p>}
    <button className="action-button" type="submit" disabled={pending || state.success} aria-busy={pending}>{pending ? <LoaderCircle className="loading-icon" size={18} /> : <ArrowRight size={18} />}{pending ? option.busy : option.button}</button>
  </fieldset>{mode === 'login' ? <p className="auth-switch">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p> : <p className="auth-switch"><Link href="/login">Voltar para entrar</Link></p>}</form>;
}
export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, initial);
  return <form action={action}><button type="submit" className="action-button secondary" disabled={pending} aria-busy={pending}><LogOut size={17} />{pending ? 'Saindo…' : 'Sair da conta'}</button>{state.error && <p role="alert" className="form-message error">{state.error}</p>}</form>;
}
