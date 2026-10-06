import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';
export function WhatsappButton({id,name,phone,balance=0}:{id:string;name:string;phone:string|null;balance?:number}){
 const href=whatsappLink(phone,name,balance);
 return href?<a className="action-button secondary" href={href} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Entrar em contato</a>:<Link className="action-button secondary" href={`/clientes?editar=${id}`}>Adicionar telefone</Link>;
}
