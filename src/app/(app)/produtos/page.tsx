import { catalogData } from '@/features/commerce/data';
import { Catalog } from '@/features/commerce/catalog';
export const metadata = { title: 'Produtos' };
export default async function Page() { return <Catalog {...await catalogData()} />; }
