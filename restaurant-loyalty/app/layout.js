import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'Fidélité — Le Restaurant',
  description: 'Programme de fidélité du restaurant',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#ea580c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
