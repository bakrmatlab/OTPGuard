import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
export const metadata: Metadata = {
  title: 'OTPGuard',
  description: 'OTPGuard workspace foundation',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
