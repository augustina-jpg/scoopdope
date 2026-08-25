'use client';

import { AuthProvider } from '@/lib/auth-context';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager';
import { ReactQueryProvider } from '@/components/ReactQueryProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        {children}
        <PushNotificationManager />
        <OfflineIndicator />
      </AuthProvider>
    </ReactQueryProvider>
  );
}
