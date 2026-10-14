import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, ClipboardList, FileText, MapPin, Ruler } from "lucide-react-native";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { measurementSummary, measurementTitle } from "@/lib/measurements";
import { estimateStatusMeta, siteTypeLabel, workTypeLabel } from "@/lib/workflow";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

type Row = Record<string, unknown>;

function IconTile({ children, bg }: { children: React.ReactNode; bg: string }) {
  return <View style={[styles.tile, { backgroundColor: bg }]}>{children}</View>;
}

export function StatusPill({ status }: { status: unknown }) {
  const meta = estimateStatusMeta(status);
  return (
    <View style={[styles.pill, { backgroundColor: meta.bg }]}>
      <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function SiteRow({ site, onPress }: { site: Row; onPress: () => void }) {
  const counts = (site.counts as Record<string, number> | undefined) || {};
  const type = siteTypeLabel(site.siteType);
  const chips = [
    counts.surveys ? `${counts.surveys} survey${counts.surveys === 1 ? "" : "s"}` : "",
    counts.measurements ? `${counts.measurements} measurement${counts.measurements === 1 ? "" : "s"}` : "",
    counts.estimates ? `${counts.estimates} estimate${counts.estimates === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <IconTile bg={p.claySoft}>
        <MapPin size={20} color={p.clay} strokeWidth={2.3} />
      </IconTile>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {String(site.name || "Site")}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {[type, String(site.address || "")].filter(Boolean).join(" · ") || "No address"}
        </Text>
        <View style={styles.chips}>
          {chips.length ? (
            chips.map((c) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))
          ) : site.counts ? (
            <View style={[styles.chip, styles.chipCta]}>
              <Text style={[styles.chipText, { color: p.clayDark }]}>Next: record a survey</Text>
            </View>
          ) : null}
        </View>
      </View>
      <DirectionsButton place={site} label={String(site.name || "site")} />
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

export function SurveyRow({ survey, siteName, onPress }: { survey: Row; siteName?: string; onPress: () => void }) {
  const work = workTypeLabel(survey.projectType) || "Site survey";
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <IconTile bg={p.sky}>
        <ClipboardList size={20} color={p.blue} strokeWidth={2.3} />
      </IconTile>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {work}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[survey.number, formatDate(String(survey.date || survey.createdAt || "")), siteName].filter(Boolean).map(String).join(" · ")}
        </Text>
        {survey.clientRequirements ? (
          <Text style={styles.note} numberOfLines={1}>
            {String(survey.clientRequirements)}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

export function MeasurementRow({ measurement, siteName, onPress }: { measurement: Row; siteName?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <IconTile bg={p.mint}>
        <Ruler size={20} color={p.green} strokeWidth={2.3} />
      </IconTile>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {measurementTitle(measurement)}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {measurementSummary(measurement)}
        </Text>
        <Text style={styles.note} numberOfLines={1}>
          {[formatDate(String(measurement.createdAt || "")), siteName].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

export function estimateTotal(e: Row) {
  return String((e.computed as { grandTotal?: string } | undefined)?.grandTotal || e.total || "0");
}

export function EstimateRow({ estimate, siteName, onPress }: { estimate: Row; siteName?: string; onPress: () => void }) {
  const version = Number(estimate.version || 1);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <IconTile bg={p.lilac}>
        <FileText size={20} color={p.purple} strokeWidth={2.3} />
      </IconTile>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {String(estimate.title || estimate.number || "Estimate")}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[estimate.number, version > 1 ? `v${version}` : "", siteName].filter(Boolean).map(String).join(" · ")}
        </Text>
        <View style={[styles.chips, { alignItems: "center" }]}>
          <StatusPill status={estimate.status} />
          {estimate.projectId ? (
            <View style={[styles.pill, { backgroundColor: p.greenSoft }]}>
              <Text style={[styles.pillText, { color: "#15803D" }]}>Project started</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.amount}>{formatCurrency(estimateTotal(estimate))}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 15, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  note: { color: p.faint, fontSize: 12, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: p.slateSoft },
  chipCta: { backgroundColor: p.claySoft },
  chipText: { color: p.muted, fontSize: 11, fontWeight: "700" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "800" },
  amount: { color: p.text, fontWeight: "800", fontSize: 14 },
});
