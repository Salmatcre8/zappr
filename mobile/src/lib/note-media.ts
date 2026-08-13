/*
  Nostr notes carry media as bare URLs in the content. Pull image links out
  so the UI can render them inline instead of showing the raw URL text.
*/
const IMAGE_RE = /https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif)(?:\?\S*)?/gi;

export function splitMedia(content: string): { text: string; images: string[] } {
  const images = Array.from(new Set(content.match(IMAGE_RE) ?? [])).slice(0, 4);
  let text = content;
  for (const u of images) text = text.split(u).join('');
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), images };
}
