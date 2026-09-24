import { StyleSheet, View, type ViewProps, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { lightPalette as p } from "@/lib/theme";

/** Soft blurred pastel mesh background matching the mockup (not hard circles). */
export function SoftBackground({ children, style, ...rest }: ViewProps) {
  const { width, height } = useWindowDimensions();
  const w = Math.max(width, 320);
  const h = Math.max(height, 640);

  return (
    <View style={[styles.root, style]} {...rest}>
      <Svg
        pointerEvents="none"
        width={w}
        height={h}
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${w} ${h}`}
      >
        <Defs>
          <RadialGradient id="blobMint" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#C8F5E8" stopOpacity="0.85" />
            <Stop offset="55%" stopColor="#C8F5E8" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#C8F5E8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blobPeach" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFD8B8" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#FFD8B8" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FFD8B8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blobLilac" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#E8D4FF" stopOpacity="0.8" />
            <Stop offset="55%" stopColor="#E8D4FF" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#E8D4FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blobSky" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#D6E8FF" stopOpacity="0.7" />
            <Stop offset="60%" stopColor="#D6E8FF" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#D6E8FF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Soft diffused blobs — large radii so edges fade like a blur */}
        <Circle cx={w * 0.08} cy={h * 0.06} r={w * 0.55} fill="url(#blobMint)" />
        <Circle cx={w * 0.95} cy={h * 0.12} r={w * 0.5} fill="url(#blobPeach)" />
        <Circle cx={w * 0.15} cy={h * 0.72} r={w * 0.58} fill="url(#blobLilac)" />
        <Circle cx={w * 0.85} cy={h * 0.55} r={w * 0.42} fill="url(#blobSky)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.background, overflow: "hidden" },
});
