import manifest from '@/app/manifest';
import { sellerAppName } from '@/config/branding';

export function GET() {
  return Response.json({ ...manifest(), id: '/vendedor', name: sellerAppName, short_name: sellerAppName, start_url: '/vendedor', description: 'Registre suas vendas e acompanhe seu histórico.' }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}
