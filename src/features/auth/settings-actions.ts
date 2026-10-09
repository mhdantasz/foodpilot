'use server';
import { revalidatePath } from 'next/cache';
import { commerceContext } from '@/features/commerce/data';
import type { FormState } from './validation';
export async function saveSettings(_state:FormState,form:FormData):Promise<FormState>{
 const {client,business,membership}=await commerceContext();
 const name=String(form.get('name')??'').trim().replace(/\s+/g,' ');
 if(membership.role!=='owner')return {error:'Somente o proprietário pode alterar o negócio.'};
 if(name.length<2||name.length>100)return {error:'Use entre 2 e 100 caracteres no nome do negócio.'};
 const result=await client.from('businesses').update({name}).eq('id',business.id).select('id').single();
 if(result.error)return {error:'Não foi possível salvar agora. Confira sua conexão e tente novamente.'};
 // O RLS continua validando o proprietário; nenhum ID de usuário/negócio vem do formulário.
 revalidatePath('/','layout');return {success:true,message:'Alterações salvas.'};
}
export async function saveProfile(_state:FormState,form:FormData):Promise<FormState>{
 const {client,user}=await commerceContext();const name=String(form.get('full_name')??'').trim();const phone=String(form.get('phone')??'').trim().replace(/[\s().-]/g,'');
 if(name.length<2||name.length>100)return {error:'Use entre 2 e 100 caracteres no seu nome.'};
 if(phone&&!/^\+?\d{8,15}$/.test(phone))return {error:'Confira o telefone com DDD.'};
 const r=await client.from('profiles').update({full_name:name,phone:phone||null}).eq('id',user.id).select('id').single();
 if(r.error)return {error:'Não foi possível salvar agora. Confira sua conexão e tente novamente.'};
 revalidatePath('/','layout');return {success:true,message:'Alterações salvas.'};
}
