import { analytics } from '@/features/operations/data';
import { AnalyticsPanel } from '@/features/operations/analytics';
export const metadata={title:'Análises'};
export default async function Page({searchParams}:{searchParams:Promise<{periodo?:string}>}){const q=await searchParams,period=['7days','30days','month'].includes(q.periodo??'')?q.periodo!:'30days';return <AnalyticsPanel data={await analytics(period)} period={period}/>;}
