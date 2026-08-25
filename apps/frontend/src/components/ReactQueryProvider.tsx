'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Wraps the app in TanStack Query's QueryClientProvider.
 *
 * The QueryClient is created inside useState so each browser tab gets its own
 * instance and server renders never share state between requests.
 *
 * Default options:
 *  - staleTime: 5 min  — most API data is stable enough not to refetch on every mount
 *  - gcTime: 10 min    — keep unused cache entries around for quick back-navigation
 *  - retry: 1          — one automatic retry on network error, then throw
 *  - refetchOnWindowFocus: true — refresh stale data when the user returns to the tab
 */
export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
