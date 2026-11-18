import Link from 'next/link';
import Image from 'next/image';
import { branding } from '@/config/branding';
export function Brand({ href = '/', name = branding.shortName }: { href?: string; name?: string }) {
  return <Link href={href} className="brand" aria-label={`${name} — início`}><Image src="/brand/md-logo.png" width={36} height={36} alt="" style={{ borderRadius: 10 }} />{name}</Link>;
}
