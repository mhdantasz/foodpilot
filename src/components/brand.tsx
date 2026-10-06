import Link from 'next/link';
import { ChefHat } from 'lucide-react';
export function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="Pronto — início"><span className="brand-mark"><ChefHat size={23} aria-hidden="true" /></span>pronto<span className="brand-dot">.</span></Link>;
}
