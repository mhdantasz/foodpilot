'use client';

import { useEffect, useEffectEvent, useRef } from 'react';

/** Keyboard containment and focus restoration for the app's small modal forms. */
export function useModalFocus(open: boolean, onClose: () => void, canClose = true) {
  const container = useRef<HTMLDivElement>(null);
  const dismiss = useEffectEvent(() => { if (canClose) onClose(); });
  useEffect(() => {
    if (!open || !container.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = container.current;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const firstInput = root.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea');
    (firstInput || focusable()[0] || root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); root.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return container;
}
