import { commerceContext, peopleData } from '@/features/commerce/data';
import { SimpleManager } from '@/features/commerce/simple-manager';
export const metadata = { title: 'Clientes' };
export default async function Page({searchParams}:{searchParams:Promise<{editar?:string;novo?:string}>}) { const [data, context,query] = await Promise.all([peopleData(), commerceContext(),searchParams]); return <SimpleManager kind="customers" records={data.customers} summaries={data.summaries} timezone={context.business.timezone} initialEdit={query.editar} initialNew={query.novo==='1'}/>; }
