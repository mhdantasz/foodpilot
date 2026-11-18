'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LoaderCircle, X } from 'lucide-react';
import { provisionSellerLoginAction } from '@/app/(app)/equipe/account-actions';
import type { Seller } from '@/lib/sellers/types';
import { useModalFocus } from '@/components/use-modal-focus';

type LoginResult = { ok: boolean; message: string; username?: string; password?: string };

function suggestedUsername(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 40);
}

export function TeamLoginModal({ sellers, initialSellerId, onClose }: { sellers: Seller[]; initialSellerId?: string; onClose: () => void }) {
  const firstSeller = sellers.find(seller => seller.id === initialSellerId) ?? sellers[0];
  const [sellerId, setSellerId] = useState(firstSeller?.id ?? '');
  const [name, setName] = useState(firstSeller?.name ?? '');
  const [username, setUsername] = useState(suggestedUsername(firstSeller?.name ?? ''));
  const [generatePin, setGeneratePin] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<LoginResult | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const modal = useModalFocus(true, onClose, !pending);
  const hasCredentials = result?.ok && result.username && result.password;

  function chooseSeller(value: string) {
    const seller = sellers.find(item => item.id === value);
    setSellerId(value); setName(seller?.name ?? ''); setUsername(suggestedUsername(seller?.name ?? '')); setResult(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || hasCredentials || !sellerId) return;
    startTransition(async () => {
      const form = new FormData();
      form.set('seller_id', sellerId); form.set('name', name.trim()); form.set('username', username.trim().toLowerCase());
      form.set('generate_pin', generatePin ? 'true' : 'false');
      if (!generatePin) form.set('password', password);
      try {
        const response = await provisionSellerLoginAction(form);
        setResult(response);
        if (response.ok) { setPassword(''); setShowPassword(false); }
      } catch {
        setResult({ ok: false, message: 'Não foi possível confirmar a criação. Confira a lista de usuários antes de tentar novamente.' });
      }
    });
  }

  async function copyCredentials() {
    if (!result?.username || !result.password) return;
    try {
      await navigator.clipboard.writeText(`Usuário: ${result.username}\nSenha: ${result.password}`);
      setCopyMessage('Usuário e senha copiados. Compartilhe apenas com o vendedor.');
    } catch { setCopyMessage('Não foi possível copiar. Revele a senha e copie os campos manualmente.'); }
  }

  return <div className="seller-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="seller-login-title" onClick={() => { if (!pending) onClose(); }}>
    <div ref={modal} tabIndex={-1} className="seller-modal-card" onClick={event => event.stopPropagation()}>
      <div className="seller-modal-header"><h3 id="seller-login-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={20} aria-hidden="true" />Gerar login de vendedor</h3><button type="button" className="icon-button" disabled={pending} onClick={onClose} aria-label="Fechar geração de login"><X size={20} /></button></div>
      {result?.message && <p role={result.ok ? 'status' : 'alert'} className={`form-message ${result.ok ? 'success' : 'error'}`}>{result.message}</p>}
      {hasCredentials ? <section className="commerce-form" aria-label="Login criado">
        <p>Guarde os dados agora. A senha é exibida somente nesta confirmação e não ficará disponível para consulta depois.</p>
        <label>Usuário criado<input value={result.username} readOnly autoComplete="off" /></label>
        <label>Senha de acesso<input value={result.password} type={showPassword ? 'text' : 'password'} readOnly autoComplete="off" /></label>
        <div className="commerce-actions"><button type="button" className="action-button secondary" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}{showPassword ? 'Ocultar senha' : 'Revelar senha'}</button><button type="button" className="action-button secondary" onClick={copyCredentials}><Copy size={17} />Copiar acesso</button></div>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <p className="muted">O acesso começa sem produtos. Cadastre os produtos no painel e configure as ofertas e os preços deste vendedor para liberá-los.</p>
        <button type="button" className="action-button" onClick={onClose}><Check size={17} />Concluir</button>
      </section> : sellers.length === 0 ? <div className="commerce-form"><p>Cadastre um vendedor sem conta vinculada para gerar um novo login.</p><button type="button" className="action-button secondary" onClick={onClose}>Voltar</button></div> : <form onSubmit={submit} className="commerce-form">
        <p className="muted">Escolha o vendedor e defina o usuário. Produtos e preços são liberados separadamente por você.</p>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, display: 'grid', gap: 14 }}>
          <label>Vendedor<select value={sellerId} onChange={event => chooseSeller(event.target.value)} required>{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}{seller.location ? ` · ${seller.location}` : ''}</option>)}</select></label>
          <label>Nome do usuário<input value={name} onChange={event => setName(event.target.value)} required minLength={1} maxLength={100} autoComplete="off" /></label>
          <label>Usuário para entrar<input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} required minLength={3} maxLength={40} pattern="[a-z0-9._-]{3,40}" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-describedby="seller-username-help" /></label>
          <p id="seller-username-help" className="muted">Use letras minúsculas, números, ponto, hífen ou sublinhado. O vendedor entra com esse usuário e a senha.</p>
          <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 10 }}><legend style={{ marginBottom: 8, fontWeight: 600 }}>Senha de acesso</legend><label className="check-label"><input type="radio" name="password_mode" checked={generatePin} onChange={() => setGeneratePin(true)} />Gerar senha aleatória com 5 números</label><label className="check-label"><input type="radio" name="password_mode" checked={!generatePin} onChange={() => setGeneratePin(false)} />Criar uma senha</label></fieldset>
          {!generatePin && <label>Senha definida por você<input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={5} maxLength={128} autoComplete="new-password" /><button type="button" className="action-button secondary" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</button></label>}
          <p className="muted">Nenhum produto é liberado automaticamente ao criar o login.</p>
          <div className="commerce-actions" style={{ justifyContent: 'flex-end' }}><button type="button" className="action-button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="action-button" disabled={pending || !sellerId || !name.trim() || !/^[a-z0-9._-]{3,40}$/.test(username) || (!generatePin && password.length < 5)} aria-busy={pending}>{pending && <LoaderCircle className="loading-icon" size={17} />}{pending ? 'Criando acesso…' : 'Gerar login'}</button></div>
        </fieldset>
      </form>}
    </div>
  </div>;
}
