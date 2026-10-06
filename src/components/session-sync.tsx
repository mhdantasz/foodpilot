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
    const refreshVisible = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const restorePage = (event: PageTransitionEvent) => { if (event.persisted) router.refresh(); };
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('pageshow', restorePage);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('pageshow', restorePage);
    };
  }, [router]);
  return null;
}
