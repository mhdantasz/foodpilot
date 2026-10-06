import { House, ShoppingBag, Users, Package, Wallet, CalendarDays, Receipt, ChartNoAxesCombined, Settings, type LucideIcon } from 'lucide-react';
export type NavigationItem = { href: string; label: string; icon: LucideIcon };
export const navigation: NavigationItem[] = [
  { href: '/', label: 'Início', icon: House },
  { href: '/vendas', label: 'Vendas', icon: ShoppingBag },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/fiados', label: 'Fiados', icon: Wallet },
  { href: '/reservas', label: 'Reservas', icon: CalendarDays },
  { href: '/despesas', label: 'Despesas', icon: Receipt },
  { href: '/analises', label: 'Análises', icon: ChartNoAxesCombined },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];
