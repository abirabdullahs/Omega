import type {Metadata, Viewport} from 'next';
import { Hind_Siliguri } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { ToastProvider } from '@/components/ui/toast-provider';

// Hind Siliguri covers both Bengali and Latin glyphs, so it's used as the
// single app-wide font (via --font-hind-siliguri, mapped to Tailwind's
// font-sans in globals.css) rather than switching fonts per script.
const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Omega | Abir Hossen Abdullah',
  description: 'Premium mentorship platform by Abir Hossen Abdullah (abirabdullah.me). Manage students, tasks, and curriculum progress.',
  keywords: ['Omega', 'Abir Hossen Abdullah', 'abirabdullah.me', 'Mentorship', 'Learning Management'],
  authors: [{ name: 'Abir Hossen Abdullah', url: 'https://abirabdullah.me' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

// resizes-content makes the on-screen keyboard actually shrink the visual
// viewport (and therefore dvh units) instead of floating over the page.
// This is what keeps the chat header/input pinned in place instead of
// getting pushed off-screen when a mobile keyboard opens.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={hindSiliguri.variable}>
      <body suppressHydrationWarning className="bg-neutral-50 text-neutral-900 antialiased font-sans">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
