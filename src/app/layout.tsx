import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'zappr — Bitcoin Social + Payments',
  description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
};

const themeInit = `try{var t=localStorage.getItem('zappr-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
