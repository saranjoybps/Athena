import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/** Warm gradient backdrop with soft glow rings for the home hero card. */
export function HeroBackdrop({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="heroFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FB923C" />
          <Stop offset="0.55" stopColor="#F97316" />
          <Stop offset="1" stopColor="#C2410C" />
        </LinearGradient>
        <LinearGradient id="heroShine" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#heroFill)" />
      <Circle cx={width - 40} cy={-10} r={110} fill="url(#heroShine)" />
      <Circle cx={width * 0.42} cy={height + 50} r={90} fill="#FFFFFF" opacity={0.07} />
      <Circle cx={-30} cy={30} r={70} fill="#FFFFFF" opacity={0.06} />
    </Svg>
  );
}

function Sparkle({ x, y, s, opacity = 0.9 }: { x: number; y: number; s: number; opacity?: number }) {
  return (
    <Path
      d={`M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`}
      fill="#FFFFFF"
      opacity={opacity}
    />
  );
}

/** Illustrated house + tower for the hero card (drawn in SVG so it scales crisply). */
export function HeroHouse({ size = 136 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.88} viewBox="0 0 140 123">
      <Circle cx={114} cy={22} r={12} fill="#FFEDD5" opacity={0.95} />
      <Ellipse cx={70} cy={114} rx={64} ry={7} fill="#7C2D12" opacity={0.22} />

      <G opacity={0.9}>
        <Rect x={84} y={30} width={38} height={82} rx={4} fill="#FFFFFF" opacity={0.32} />
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1].map((col) => (
            <Rect key={`${row}-${col}`} x={91 + col * 14} y={38 + row * 14} width={9} height={8} rx={1.5} fill="#FFFFFF" opacity={0.75} />
          )),
        )}
      </G>

      <Rect x={73} y={36} width={9} height={18} rx={1.5} fill="#9A3412" />
      <Rect x={18} y={60} width={72} height={52} rx={3} fill="#FFFFFF" />
      <Rect x={18} y={60} width={72} height={6} fill="#FFEDD5" />
      <Path d="M 8 64 L 54 26 L 100 64 Z" fill="#9A3412" />
      <Path d="M 8 64 L 54 26 L 58 29.3 L 15.5 64 Z" fill="#C2410C" />
      <Rect x={26} y={74} width={15} height={14} rx={2} fill="#FED7AA" stroke="#FDBA74" strokeWidth={1.4} />
      <Path d="M 33.5 74 V 88 M 26 81 H 41" stroke="#FDBA74" strokeWidth={1.4} />
      <Rect x={67} y={74} width={15} height={14} rx={2} fill="#FED7AA" stroke="#FDBA74" strokeWidth={1.4} />
      <Path d="M 74.5 74 V 88 M 67 81 H 82" stroke="#FDBA74" strokeWidth={1.4} />
      <Rect x={46} y={80} width={16} height={32} rx={2} fill="#F97316" />
      <Circle cx={58} cy={97} r={1.6} fill="#FFEDD5" />

      <Rect x={124} y={92} width={4} height={20} rx={1} fill="#7C2D12" opacity={0.7} />
      <Circle cx={126} cy={86} r={11} fill="#FFFFFF" opacity={0.55} />

      <Sparkle x={14} y={22} s={6} />
      <Sparkle x={34} y={8} s={3.5} opacity={0.7} />
      <Sparkle x={134} y={58} s={4} opacity={0.75} />
    </Svg>
  );
}
