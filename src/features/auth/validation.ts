export type FormState = { error?: string; message?: string; success?: boolean };
export function field(data: FormData, name: string) { const value = data.get(name); return typeof value === 'string' ? value : ''; }
export function validateEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function validatePassword(password: string, confirmation: string) {
  if (password.length < 8 || password.length > 128) return 'Use uma senha entre 8 e 128 caracteres.';
  if (password !== confirmation) return 'As senhas precisam ser iguais.';
  return null;
}
export const businessTypes = [['bolos','Bolos'],['salgados','Salgados'],['doces','Doces'],['marmitas','Marmitas'],['lanches','Lanches'],['bebidas','Bebidas'],['outro','Outro']] as const;
export const salesChannels = [['escola','Escola'],['faculdade','Faculdade'],['cursinho','Cursinho'],['trabalho','Trabalho'],['encomendas','Encomendas'],['outro','Outro']] as const;
