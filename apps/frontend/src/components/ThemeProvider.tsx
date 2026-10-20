'use client';

import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '@/store/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useThemeStore();
  const applied = useRef(false);

  // Prevent transition on initial load (avoid FOUC)
  useEffect(() => setMounted(true), []);

  // Apply theme class to <html> on every resolvedTheme change.
  // The Zustand persist middleware reads from localStorage synchronously, so
  // the store has the correct theme value immediately on hydration.
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Synchronously apply theme class on initial render to prevent SSR flash.
  // This runs before the browser paints, ensuring the correct theme is visible.
  if (!applied.current && typeof document !== 'undefined') {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(resolvedTheme);
    applied.current = true;
  }

  return (
    <div className={mounted ? 'transition-colors duration-300' : 'transition-none'}>
      {children}
    </div>
  );
}
