import { webAccountConfigured } from '../account-config';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
export const metadata: Metadata = {
  title: 'OTPGuard — Email codes, in Chrome',
  description: 'Find a recent Gmail code in your browser. Choose when to fill.',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {webAccountConfigured() ? (
          <ClerkProvider
            appearance={{
              variables: {
                colorPrimary: '#d0fa75',
                colorPrimaryForeground: '#111807',
                colorBackground: '#141919',
                colorForeground: '#edf3e8',
                colorMuted: '#1b2221',
                colorMutedForeground: '#a9b5ad',
                colorInput: '#080b0b',
                colorInputForeground: '#edf3e8',
                colorBorder: '#738279',
                borderRadius: '3px',
                fontFamily: 'Instrument, Arial, sans-serif',
              },
            }}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
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
