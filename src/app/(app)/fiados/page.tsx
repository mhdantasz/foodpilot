import { finances } from '@/features/operations/data';
import { DebtList } from '@/features/operations/debt-list';
export const metadata={title:'Fiados'};
export default async function Page(){return <DebtList records={await finances()}/>;}
