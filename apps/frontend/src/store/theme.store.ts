import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import { useAuthStore } from './auth.store';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => Promise<void>;
  syncTheme: (themePreference: Theme) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyThemeClass(theme: Theme, resolvedTheme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  html.classList.add(resolvedTheme);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: resolveTheme('system'),

      setTheme: async (theme) => {
        const resolved = resolveTheme(theme);
        applyThemeClass(theme, resolved);
        set({ theme, resolvedTheme: resolved });

        const user = useAuthStore.getState().user;
        if (user?.id) {
          try {
            await api.patch(`/users/${user.id}`, { theme });
          } catch {
            // silently fail — local preference is still saved
          }
        }
      },

      syncTheme: (themePreference) => {
        const resolved = resolveTheme(themePreference);
        applyThemeClass(themePreference, resolved);
        set({ theme: themePreference, resolvedTheme: resolved });
      },
    }),
    {
      name: 'scoopdope-theme',
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          state.resolvedTheme = resolved;
          applyThemeClass(state.theme, resolved);
        }
      },
    }
  )
);
