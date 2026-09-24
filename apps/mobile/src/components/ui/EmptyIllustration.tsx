import Svg, { Circle, Ellipse, Path, Rect, G } from "react-native-svg";
import { lightPalette as p } from "@/lib/theme";

/** Friendly empty-state illustration (soft 3D-ish scene, orange accent). */
export function EmptyIllustration({ size = 120 }: { size?: number }) {
  const w = size;
  const h = size * 0.85;
  return (
    <Svg width={w} height={h} viewBox="0 0 240 200" fill="none">
      {/* soft ground glow */}
      <Ellipse cx="120" cy="168" rx="78" ry="12" fill={p.clayMid} opacity={0.7} />
      {/* floating accents */}
      <Circle cx="42" cy="48" r="10" fill={p.mint} />
      <Circle cx="200" cy="40" r="14" fill={p.peach} />
      <Circle cx="210" cy="110" r="8" fill={p.lilac} />
      <Rect x="28" y="88" width="22" height="28" rx="6" fill={p.sky} />
      <Path d="M34 96h10M34 102h8M34 108h6" stroke={p.blue} strokeWidth="2" strokeLinecap="round" />
      {/* folder card */}
      <G>
        <Path
          d="M150 72h36c6 0 10 4 10 10v46c0 6-4 10-10 10h-40c-6 0-10-4-10-10V86c0-8 4-14 14-14z"
          fill="#FFF"
          stroke={p.borderStrong}
          strokeWidth="1.5"
        />
        <Path d="M152 72v-6c0-4 3-7 7-7h12l6 6h19" fill={p.claySoft} stroke={p.clayMid} strokeWidth="1.5" />
        <Circle cx="178" cy="108" r="10" fill={p.claySoft} />
        <Path d="M174 108h8M178 104v8" stroke={p.clay} strokeWidth="2" strokeLinecap="round" />
      </G>
      {/* person simplified */}
      <Circle cx="96" cy="78" r="18" fill="#FFE0C2" />
      <Path d="M78 78c2-14 12-22 22-20 8 2 14 10 14 20" fill="#2D2A3A" />
      <Path
        d="M66 158c2-28 14-42 30-42s28 14 30 42"
        fill={p.clay}
      />
      <Path d="M72 118c8 6 18 8 24 6" stroke="#FFE0C2" strokeWidth="8" strokeLinecap="round" />
      {/* laptop */}
      <Rect x="88" y="112" width="56" height="34" rx="4" fill="#2D2A3A" />
      <Rect x="92" y="116" width="48" height="24" rx="2" fill="#E8F1FF" />
      <Path d="M84 148h64l4 6H80l4-6z" fill="#1E1B2E" />
      <Circle cx="112" cy="126" r="3" fill={p.clay} />
      <Path d="M102 134h20" stroke={p.clay} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
