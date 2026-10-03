import { webAccountConfigured } from '../account-config';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
export const metadata: Metadata = {
  title: 'OTPGuard · Account & security',
  description:
    'Local-first account and security dashboard with explicit capability limits.',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {webAccountConfigured() ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
