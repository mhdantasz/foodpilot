import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { branding } from '@/config/branding';
export function Brand({ href = '/', name = branding.shortName }: { href?: string; name?: string }) {
  return <Link href={href} className="brand" aria-label={`${name} — início`}><span className="brand-mark"><ChefHat size={23} aria-hidden="true" /></span>{name}</Link>;
}
