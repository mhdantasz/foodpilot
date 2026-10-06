import { commerceContext, peopleData } from '@/features/commerce/data';
import { SimpleManager } from '@/features/commerce/simple-manager';
export const metadata = { title: 'Locais de venda' };
export default async function Page() { const [data, context] = await Promise.all([peopleData(), commerceContext()]); return <SimpleManager kind="locations" records={data.locations} timezone={context.business.timezone} />; }
