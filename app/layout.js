import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'TiKréol — Gestion de crèche, Made in 974',
  description: 'La solution locale de gestion de crèche pour La Réunion. Suivi temps réel, transmissions, finances CGSS.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
