import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

describe('locale middleware', () => {
  it.each(['en', 'es', 'fr', 'ar'])(
    'redirects to %s for a matching Accept-Language header and stores the locale',
    (locale: string) => {
      const request = new NextRequest('https://example.com/', {
        headers: { 'accept-language': locale },
      });

      const response = middleware(request);

      expect(response.headers.get('location')).toBe(`https://example.com/${locale}`);
      expect(response.cookies.get('NEXT_LOCALE')?.value).toBe(locale);
    }
  );

  it('prefers the locale cookie over Accept-Language', () => {
    const request = new NextRequest('https://example.com/', {
      headers: {
        'accept-language': 'es',
        cookie: 'NEXT_LOCALE=fr',
      },
    });

    const response = middleware(request);

    expect(response.headers.get('location')).toBe('https://example.com/fr');
  });

  it('falls back to English for unsupported Accept-Language values', () => {
    const request = new NextRequest('https://example.com/', {
      headers: { 'accept-language': 'de' },
    });

    const response = middleware(request);

    expect(response.headers.get('location')).toBe('https://example.com/en');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('en');
  });
});