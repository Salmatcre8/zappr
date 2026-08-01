import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'zappr — Bitcoin Social + Payments',
  description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
};

// Light (warm bone) is the default; only honour an explicit 'dark' choice.
const themeInit = `try{var t=localStorage.getItem('zappr-theme');if(t!=='dark')document.documentElement.classList.add('light');}catch(e){document.documentElement.classList.add('light');}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script defer src="https://cloud.umami.is/script.js" data-website-id="bc0c10a2-0c70-4d8c-b7eb-d0520c442f1d"></script>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
