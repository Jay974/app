import './globals.css';
import { Toaster } from 'sonner';
import { playfair, dancing, montserrat, cormorant, ebGaramond } from './fonts';

export const metadata = {
  title: 'Fidélité — La Terrasse de Bourbon',
  description: 'Carte de fidélité et cartes cadeaux — La Terrasse de Bourbon, Saint-Denis',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#1A2F1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${dancing.variable} ${montserrat.variable} ${cormorant.variable} ${ebGaramond.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-body">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
