import ZapprMark from './ZapprMark';

/*
  The zappr lockup (brand guidelines 03): the mark IS the z, so the wordmark
  only ever spells "appr". Writing out "zappr" beside the mark would set the
  letter twice.

  Proportions are lifted from logo/zappr-wordmark-ink.svg — the mark renders
  1.15x the wordmark's cap size, and the gap is mostly the mark's own side
  bearing (the glyph starts 20 units into a 100-unit box).
*/
export default function ZapprLogo({
  size = 22,
  className = '',
  markClassName = 'text-orange',
  wordClassName = 'text-bone',
}: {
  /** Wordmark font size in px; the mark scales from it. */
  size?: number;
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-label="zappr" role="img">
      <ZapprMark size={Math.round(size * 1.15)} className={markClassName} />
      <span
        aria-hidden="true"
        className={`font-mono font-bold ${wordClassName}`}
        style={{
          fontSize: size,
          lineHeight: 1,
          letterSpacing: '-0.055em',
          marginLeft: Math.max(1, Math.round(size * 0.03)),
        }}
      >
        appr
      </span>
    </span>
  );
}
