import { randomUUID } from 'node:crypto';
import { catalogData, peopleData } from '@/features/commerce/data';
import { SaleComposer } from '@/features/commerce/sale-composer';
export const metadata = { title: 'Nova venda' };
export default async function Page() { const [catalog, people] = await Promise.all([catalogData(), peopleData()]); return <SaleComposer {...catalog} {...people} requestId={randomUUID()} />; }
