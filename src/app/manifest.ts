import type { MetadataRoute } from 'next';

/*
  Web app manifest — zappr is used mostly from a phone browser, so "Add to
  Home Screen" should land the real mark rather than a screenshot of the page.
  Colours are the brand canvas tokens (guidelines 05): ink for the splash,
  Strike Orange as the theme accent.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'zappr — Bitcoin Social + Payments',
    short_name: 'zappr',
    description: 'Unified Nostr feed, Lightning wallet, and AI agent.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#1b1a17',
    theme_color: '#DD7B08',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
