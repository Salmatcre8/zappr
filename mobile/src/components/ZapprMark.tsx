import Svg, { G, Polygon } from 'react-native-svg';

/*
  The zappr mark — the z that is a lightning bolt (brand guidelines §01).
  Geometry is verbatim from the brand SVGs: 100-unit grid, 6° lean baked in.
  Never stretch, recolour outside the palette, or rotate further.
*/
export default function ZapprMark({ size = 32, color }: { size?: number; color: string }) {
  return (
    <Svg viewBox="0 0 100 100" width={size} height={size}>
      <G transform="translate(5.25,0) skewX(-6)">
        <Polygon points="20,16 80,16 80,31 64.3,48 39.3,48 55,31 20,31" fill={color} />
        <Polygon points="58.8,54 45,69 80,69 80,84 20,84 20,69 33.8,54" fill={color} />
      </G>
    </Svg>
  );
}
