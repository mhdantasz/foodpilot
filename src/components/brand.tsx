import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { branding } from '@/config/branding';
export function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} className="brand" aria-label={`${branding.appName} — início`}><span className="brand-mark"><ChefHat size={23} aria-hidden="true" /></span>{branding.shortName.toLocaleLowerCase('pt-BR')}<span className="brand-dot">.</span></Link>;
}
