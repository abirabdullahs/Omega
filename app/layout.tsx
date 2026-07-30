import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Omega | Abir Hossen Abdullah',
  description: 'Premium mentorship platform by Abir Hossen Abdullah (abirabdullah.me). Manage students, tasks, and curriculum progress.',
  keywords: ['Omega', 'Abir Hossen Abdullah', 'abirabdullah.me', 'Mentorship', 'Learning Management'],
  authors: [{ name: 'Abir Hossen Abdullah', url: 'https://abirabdullah.me' }],
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-neutral-50 text-neutral-900 antialiased font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
