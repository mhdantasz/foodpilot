'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function SessionSync() {
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') router.refresh();
    });
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !document.activeElement?.closest('input,textarea,form') && !document.querySelector('fieldset[disabled]')) router.refresh();
    };
    const restorePage = (event: PageTransitionEvent) => { if (event.persisted) refreshVisible(); };
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('pageshow', restorePage);
    window.addEventListener('online', refreshVisible);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('pageshow', restorePage);
      window.removeEventListener('online', refreshVisible);
    };
  }, [router]);
  return null;
}
