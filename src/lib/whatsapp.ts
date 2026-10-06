import { formatMoney } from './money';
// Local 10/11-digit numbers are Brazilian. Explicit international numbers retain their country code.
export function whatsappPhone(phone:string|null){
 if(!phone)return null;
 const value=phone.trim().replace(/[\s().-]/g,'');
 if(!/^(\+|00)?[0-9]+$/.test(value))return null;
 let digits=value.replace(/^\+/,'').replace(/^00/,'');
 if(!value.startsWith('+')&&!value.startsWith('00')){
  if(/^\d{10,11}$/.test(digits))digits='55'+digits;
  else if(!/^55\d{10,11}$/.test(digits))return null;
 }
 if(!/^[1-9]\d{7,14}$/.test(digits))return null;
 if(digits.startsWith('55')&&!/^55[1-9]\d{9,10}$/.test(digits))return null;
 return digits;
}
export function whatsappLink(phone:string|null,name:string,balance=0){
 const digits=whatsappPhone(phone);if(!digits)return null;
 const message=balance>0?`Olá, ${name}! Tudo bem? Passando para lembrar que ficou um valor pendente de ${formatMoney(balance)}. 🙂`: `Olá, ${name}! Tudo bem?`;
 return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
