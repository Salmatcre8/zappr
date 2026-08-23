/*
  The zappr mark — the z that is a lightning bolt (brand guidelines 01).

  Geometry is verbatim from the brand SVGs: two polygons on a 100-unit grid
  with the 6 degree lean baked into the transform. Per guidelines 08, never
  stretch, rotate, or add an offset shadow — and never re-apply the skew.

  Fills with `currentColor` so the mark inherits whatever palette token the
  surrounding element already sets, which keeps the "one orange moment per
  screen" rule enforceable at the call site.
*/
export default function ZapprMark({
  size = 32,
  className = '',
  title,
}: {
  size?: number;
  className?: string;
  /** Supply only when the mark is the sole label for a control. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <g transform="translate(5.25,0) skewX(-6)" fill="currentColor">
        <polygon points="20,16 80,16 80,31 64.3,48 39.3,48 55,31 20,31" />
        <polygon points="58.8,54 45,69 80,69 80,84 20,84 20,69 33.8,54" />
      </g>
    </svg>
  );
}
