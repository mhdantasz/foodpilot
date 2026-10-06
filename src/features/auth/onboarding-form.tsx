'use client';
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CircleCheck, LoaderCircle } from 'lucide-react';
import { completeOnboarding } from './actions';
import { businessTypes, salesChannels, type FormState } from './validation';
export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [channel, setChannel] = useState('');
  const [state, action, pending] = useActionState(completeOnboarding, {} as FormState);
  if (state.success) return <div className="onboarding-success"><CircleCheck size={46} /><h2>Seu negócio está pronto.</h2><p>Um espaço para cuidar de {name} com tranquilidade.</p><button className="action-button" onClick={() => { router.push('/'); router.refresh(); }}>Começar <ArrowRight size={18} /></button></div>;
  const valid = step === 1 ? name.trim().length >= 2 && name.trim().length <= 100 : step === 2 ? !!type : !!channel;
  return <form action={action} className="auth-form"><input type="hidden" name="name" value={name} /><input type="hidden" name="business_type" value={type} /><input type="hidden" name="sales_channel" value={channel} /><fieldset disabled={pending}>
    <div className="step-indicator" aria-label={`Passo ${step} de 3`}>{[1,2,3].map(n => <span key={n} className={n <= step ? 'complete' : ''} />)}<small>{step} de 3</small></div>
    {step === 1 ? <label>Nome do negócio<input value={name} onChange={e => setName(e.target.value)} autoComplete="organization" maxLength={100} placeholder="Ex.: Doces da Ana" required /></label> : <fieldset className="choice-field"><legend>{step === 2 ? 'O que você vende?' : 'Onde você costuma vender?'}</legend><p className="field-hint">Escolha a opção principal. Isso ajuda a conhecer seu negócio.</p><div className="choice-grid">{(step === 2 ? businessTypes : salesChannels).map(([value,label]) => <label className="choice" key={value}><input type="radio" name={`step-${step}`} value={value} checked={(step === 2 ? type : channel) === value} onChange={() => step === 2 ? setType(value) : setChannel(value)} /><span>{label}</span></label>)}</div></fieldset>}
    {state.error && <p className="form-message error" role="alert">{state.error}</p>}
    <div className="onboarding-actions">{step > 1 && <button type="button" className="action-button secondary" onClick={() => setStep(step-1)} disabled={pending}><ArrowLeft size={17} />Voltar</button>}{step < 3 ? <button type="button" className="action-button" disabled={!valid} onClick={() => setStep(step+1)}>Continuar <ArrowRight size={17} /></button> : <button type="submit" className="action-button" disabled={!valid || pending} aria-busy={pending}>{pending && <LoaderCircle className="loading-icon" size={17} />}{pending ? 'Preparando…' : 'Preparar meu negócio'}</button>}</div>
    <p className="field-hint">Moeda: real brasileiro · Fuso: Manaus</p>
  </fieldset></form>;
}
