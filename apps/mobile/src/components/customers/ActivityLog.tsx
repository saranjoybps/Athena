import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BellRing,
  ClipboardList,
  FileText,
  FolderKanban,
  IndianRupee,
  MapPin,
  Receipt,
  Ruler,
  UserRound,
} from "lucide-react-native";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { lightPalette as p } from "@/lib/theme";

export type ActivityEvent = {
  id: string;
  kind: string;
  at: string;
  title: string;
  detail?: string;
  refId?: string | null;
  amount?: string | null;
};

const KIND: Record<string, { Icon: typeof UserRound; fg: string; bg: string }> = {
  customer: { Icon: UserRound, fg: p.clayDark, bg: p.claySoft },
  site: { Icon: MapPin, fg: p.clay, bg: p.peach },
  survey: { Icon: ClipboardList, fg: p.blue, bg: p.sky },
  measurement: { Icon: Ruler, fg: p.green, bg: p.mint },
  estimate: { Icon: FileText, fg: p.purple, bg: p.lilac },
  project: { Icon: FolderKanban, fg: "#0F766E", bg: "#CCFBF1" },
  invoice: { Icon: Receipt, fg: "#B45309", bg: p.butter },
  payment: { Icon: IndianRupee, fg: "#15803D", bg: p.greenSoft },
  followup: { Icon: BellRing, fg: "#BE185D", bg: "#FCE7F3" },
};

const PAGE = 8;

export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const [shown, setShown] = useState(PAGE);
  if (!events.length) return <Text style={styles.empty}>Activity appears here as you add sites, estimates and payments.</Text>;
  const visible = events.slice(0, shown);
  return (
    <View>
      {visible.map((ev, i) => {
        const meta = KIND[ev.kind] || KIND.customer;
        const last = i === visible.length - 1;
        return (
          <View key={ev.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: meta.bg }]}>
                <meta.Icon size={15} color={meta.fg} strokeWidth={2.4} />
              </View>
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>
                  {ev.title}
                </Text>
                {ev.amount && Number(ev.amount) > 0 ? <Text style={styles.amount}>{formatCurrency(ev.amount)}</Text> : null}
              </View>
              {ev.detail ? (
                <Text style={styles.detail} numberOfLines={2}>
                  {ev.detail.charAt(0).toUpperCase() + ev.detail.slice(1)}
                </Text>
              ) : null}
              <Text style={styles.time}>{formatDateTime(ev.at)}</Text>
            </View>
          </View>
        );
      })}
      {events.length > shown ? (
        <Pressable onPress={() => setShown((n) => n + PAGE * 2)} style={styles.more} hitSlop={6}>
          <Text style={styles.moreText}>Show older activity ({events.length - shown})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: p.muted, fontSize: 13, paddingBottom: 14 },
  row: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 30 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  line: { flex: 1, width: 2, backgroundColor: p.border, marginVertical: 2 },
  body: { flex: 1, minWidth: 0, paddingBottom: 16 },
  titleRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  title: { flex: 1, color: p.text, fontWeight: "700", fontSize: 14, marginTop: 5 },
  amount: { color: p.text, fontWeight: "800", fontSize: 13, marginTop: 5 },
  detail: { color: p.muted, fontSize: 13, marginTop: 2 },
  time: { color: p.faint, fontSize: 12, marginTop: 3 },
  more: { paddingVertical: 8, paddingBottom: 14 },
  moreText: { color: p.clayDark, fontWeight: "800", fontSize: 13 },
});
