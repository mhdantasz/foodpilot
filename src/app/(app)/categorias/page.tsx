import { catalogData, commerceContext } from '@/features/commerce/data';
import { SimpleManager } from '@/features/commerce/simple-manager';
export const metadata = { title: 'Categorias' };
export default async function Page() { const [data, context] = await Promise.all([catalogData(), commerceContext()]); return <SimpleManager kind="categories" records={data.categories} timezone={context.business.timezone} />; }
