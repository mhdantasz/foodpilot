import { Compass } from 'lucide-react';
import { ActionButton, EmptyState } from '@/components/ui';
export default function NotFound() { return <main className="responsive-container"><EmptyState title="Essa página não foi encontrada." description="Volte ao início para continuar cuidando do seu negócio." icon={Compass} action={<ActionButton href="/">Voltar ao início</ActionButton>} /></main>; }
