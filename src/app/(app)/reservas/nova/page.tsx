import { randomUUID } from 'node:crypto';
import { catalogData,peopleData,commerceContext } from '@/features/commerce/data';
import { SaleComposer } from '@/features/commerce/sale-composer';
export const metadata={title:'Nova reserva'};
export default async function Page(){const [catalog,people,context]=await Promise.all([catalogData(),peopleData(),commerceContext()]);return <SaleComposer {...catalog} {...people} requestId={randomUUID()} reservation timezone={context.business.timezone}/>;}
