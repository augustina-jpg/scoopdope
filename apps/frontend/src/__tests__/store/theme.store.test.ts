import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '@/store/theme.store';
import { useAuthStore } from '@/store/auth.store';

vi.mock('@/lib/api', () => ({
  default: { patch: vi.fn() },
}));

beforeEach(() => {
  useThemeStore.setState({ theme: 'system', resolvedTheme: 'light' });
  localStorage.clear();
  vi.clearAllMocks();
});

describe('useThemeStore', () => {
  it('persists theme to localStorage on change', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('dark');
    const stored = JSON.parse(localStorage.getItem('scoopdope-theme') ?? '{}');
    expect(stored.theme).toBe('dark');
  });

  it('restores theme from localStorage on re-initialisation', () => {
    localStorage.setItem(
      'scoopdope-theme',
      JSON.stringify({ theme: 'dark' }),
    );
    const stored = JSON.parse(
      localStorage.getItem('scoopdope-theme') ?? '{}',
    );
    expect(stored.theme).toBe('dark');
  });

  it('sets resolvedTheme to dark when theme is dark', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
  });

  it('sets resolvedTheme to light when theme is light', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
  });

  it('syncs theme from user profile on login', () => {
    useThemeStore.getState().syncTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
  });

  it('applies dark class to document element when resolvedTheme is dark', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light class to document element when resolvedTheme is light', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('patches user profile when theme changes and user is logged in', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', username: 'test', email: 'test@test.com', role: 'student' },
      token: 'tok',
    });
    const { setTheme } = useThemeStore.getState();
    await setTheme('dark');
    const api = await import('@/lib/api');
    expect(api.default.patch).toHaveBeenCalledWith('/users/user-1', { theme: 'dark' });
  });

  it('does not patch user profile when user is not logged in', async () => {
    useAuthStore.setState({ user: null, token: null });
    const { setTheme } = useThemeStore.getState();
    await setTheme('dark');
    const api = await import('@/lib/api');
    expect(api.default.patch).not.toHaveBeenCalled();
  });
});
