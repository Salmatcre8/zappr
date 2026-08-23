import type { Metadata, Viewport } from 'next';
import Script from "next/script";
import './globals.css';

/*
  Brand metadata. The icon set is generated from the mark's vector geometry by
  scripts/gen-brand-assets.js — icon.svg / apple-icon.png / opengraph-image.png
  are picked up by the App Router file conventions, so they need no manual
  <link> tags here.
*/
export const metadata: Metadata = {
  metadataBase: new URL('https://www.usezappr.xyz'),
  title: 'zappr — Bitcoin Social + Payments',
  description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
  applicationName: 'zappr',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'zappr — Bitcoin Social + Payments',
    description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
    url: 'https://www.usezappr.xyz',
    siteName: 'zappr',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zappr — Bitcoin Social + Payments',
    description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
  },
};

// Matches the two canvas tokens in globals.css so the browser chrome (address
// bar, iOS status bar) tracks the active theme instead of flashing white.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1EFE7' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0e' },
  ],
};

// Light (warm bone) is the default; only honour an explicit 'dark' choice.
const themeInit = `try{var t=localStorage.getItem('zappr-theme');if(t!=='dark')document.documentElement.classList.add('light');}catch(e){document.documentElement.classList.add('light');}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
  <Script
    src="https://cloud.umami.is/script.js"
    data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
    strategy="afterInteractive"
  />
)}
   <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
