import './globals.css';
import { StoreProvider } from '@/context/StoreContext';

export const metadata = {
  title: 'Shop',
  description: 'Application e-commerce',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <StoreProvider>
          <div className="app-shell">{children}</div>
        </StoreProvider>
      </body>
    </html>
  );
}
