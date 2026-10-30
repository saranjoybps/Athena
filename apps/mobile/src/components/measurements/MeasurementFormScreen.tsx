import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Camera, ImagePlus, Trash2, X } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MeasurementEditor } from "@/components/ui/MeasurementEditor";
import { formStyles as f } from "@/components/ui/formStyles";
import { SiteScopeField, useSiteScope } from "@/components/sites/SiteScopeField";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import { pickFromGallery, takePhoto, type PickedFile } from "@/lib/files";
import { formatDate } from "@/lib/format";
import {
  aggregateOutputs,
  buildMeasurementPayload,
  createMeasurementItem,
  formatQty,
  invalidItems,
  parseMeasurementItems,
  type MeasurementItem,
} from "@/lib/measurements";
import { measurementAutoTitle, workTypeLabel } from "@/lib/workflow";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius } from "@/lib/theme";

type Photo = { name: string; url: string; publicId?: string };

export type ScopeType = "" | "area" | "quantity" | "length" | "time" | "fixed";

export type MeasurementValues = {
  customerId: string;
  siteId: string;
  surveyId: string;
  projectId: string;
  scopeType: ScopeType;
  scope: Record<string, string>;
  title: string;
  items: MeasurementItem[];
  notes: string;
  photos: Photo[];
  /** Kept from older records; no longer edited here (pricing lives in the estimate). */
  billBySqft: boolean;
  perSqftRate: string | null;
};

export function measurementValuesFrom(m: AthenaRecord): MeasurementValues {
  const photos = (Array.isArray(m.photos) ? m.photos : [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      return { name: String(r.name || "photo"), url: String(r.url || ""), publicId: r.publicId ? String(r.publicId) : undefined };
    })
    .filter((ph) => ph.url);
  return {
    customerId: String(m.customerId || ""),
    siteId: String(m.siteId || ""),
    surveyId: String(m.surveyId || ""),
    projectId: String(m.projectId || ""),
    scopeType: (["area", "quantity", "length", "time", "fixed"].includes(String(m.measurementType || "")) ? String(m.measurementType) : "") as ScopeType,
    scope: scopeFromRecord(m),
    title: String(m.title || ""),
    items: parseMeasurementItems(m),
    notes: String(m.notes || ""),
    photos,
    billBySqft: Boolean(m.billBySqft),
    perSqftRate: m.perSqftRate != null ? String(m.perSqftRate) : null,
  };
}

type Props = {
  mode: "create" | "edit";
  initial: MeasurementValues | null;
  siteLocked: boolean;
  customerFixed?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onAddSite?: (customerId: string) => void;
  onSubmit: (values: MeasurementValues) => Promise<void>;
  onDelete?: () => void;
};

export function MeasurementFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title={mode === "create" ? "New measurement" : "Measurement"}
            subtitle={mode === "create" ? "Measurement sheet" : initial?.title || undefined}
            onBack={onBack}
          />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {initial ? <MeasurementFields {...props} initial={initial} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function MeasurementFields({ mode, initial, siteLocked, customerFixed, saving, deleting, onSubmit, onDelete, onAddSite }: Props & { initial: MeasurementValues }) {
  const [values, setValues] = useState<MeasurementValues>(initial);
  const [titleTouched, setTitleTouched] = useState(Boolean(initial.title));
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scope = useSiteScope(values.customerId, values.siteId);
  const busy = saving || Boolean(deleting) || uploading;

  const siteName = scope.site ? String(scope.site.name || "") : "";
  const autoTitle = measurementAutoTitle(siteName);
  useEffect(() => {
    if (!titleTouched && siteName) setValues((prev) => (prev.title === autoTitle ? prev : { ...prev, title: autoTitle }));
  }, [autoTitle, titleTouched, siteName]);

  const siteSurveys = useMemo(
    () =>
      (((scope.summary?.surveys as AthenaRecord[]) || []) as AthenaRecord[])
        .filter((s) => String(s.siteId || "") === values.siteId)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    [scope.summary, values.siteId],
  );
  const surveyOptions = siteSurveys.map((s) => ({
    id: String(s.id),
    label: `${workTypeLabel(s.projectType) || "Survey"} ${s.number ? `· ${String(s.number)}` : ""}`.trim(),
    detail: formatDate(String(s.date || s.createdAt || "")),
  }));

  useEffect(() => {
    if (mode === "create" && !values.surveyId && siteSurveys[0]) {
      setValues((prev) => ({ ...prev, surveyId: String(siteSurveys[0].id) }));
    }
  }, [mode, siteSurveys, values.surveyId]);

  const errors = submitted ? validate(values) : {};

  function set<K extends keyof MeasurementValues>(key: K, value: MeasurementValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function addPhotos(source: "camera" | "gallery") {
    try {
      const picked = source === "camera" ? ([await takePhoto()].filter(Boolean) as PickedFile[]) : await pickFromGallery();
      if (!picked.length) return;
      setUploading(true);
      const uploaded: Photo[] = [];
      for (const file of picked) {
        const res = await uploadUriToCloudinary(file.uri, { name: file.name, mimeType: file.mimeType, folder: `athena/measurements/${values.siteId || "unassigned"}` });
        uploaded.push({ name: file.name, url: res.url, publicId: res.publicId });
      }
      setValues((prev) => ({ ...prev, photos: [...prev.photos, ...uploaded] }));
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't upload photo", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setSubmitted(true);
    const e = validate(values);
    if (Object.keys(e).length) {
      if (e.items) Toast.show({ type: "error", text1: "Check the measurement lines", text2: e.items });
      return;
    }
    await onSubmit(values);
  }

  return (
    <View>
      <View style={f.card}>
        <Text style={f.cardTitle}>Site</Text>
        <Text style={f.cardHint}>Measurements always belong to a site.</Text>
        <SiteScopeField
          customerId={values.customerId}
          siteId={values.siteId}
          locked={siteLocked}
          customerFixed={customerFixed}
          error={errors.siteId}
          onChange={(next) => setValues((prev) => ({ ...prev, ...next, surveyId: "" }))}
          onAddSite={onAddSite}
        />
        {values.siteId ? (
          <FormField label="Based on survey">
            <SelectDropdown
              options={surveyOptions}
              value={values.surveyId}
              onChange={(v) => set("surveyId", v)}
              placeholder={surveyOptions.length ? "Select survey" : "No surveys for this site"}
              clearLabel="Not linked to a survey"
              emptyText="No surveys recorded for this site."
            />
          </FormField>
        ) : null}
        <FormField
          label="Title"
          required
          value={values.title}
          onChangeText={(v) => {
            setTitleTouched(true);
            set("title", v);
          }}
          error={errors.title}
          placeholder="e.g. Ground floor — all rooms"
        />
      </View>

      <Text style={styles.section}>Measurement sheet</Text>
      <Text style={styles.sectionHint}>Add any mix of rooms, areas, quantities, lengths, time, and fixed jobs on this one sheet. Each line keeps its own name and unit.</Text>
      <MeasurementEditor items={values.items} onChange={(items) => set("items", items)} showErrors={submitted} />
      {errors.items && !values.items.length ? <Text style={styles.err}>{errors.items}</Text> : null}

      <View style={[f.card, { marginTop: 16 }]}>
        <Text style={f.cardTitle}>Photos & notes</Text>
        <Text style={f.cardHint}>Optional reference for the estimate.</Text>
        <View style={styles.photoRow}>
          <Pressable style={styles.photoBtn} onPress={() => addPhotos("camera")} disabled={busy}>
            <Camera size={18} color={p.clayDark} />
            <Text style={styles.photoText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.photoBtn} onPress={() => addPhotos("gallery")} disabled={busy}>
            <ImagePlus size={18} color={p.clayDark} />
            <Text style={styles.photoText}>Gallery</Text>
          </Pressable>
        </View>
        {uploading ? <ActivityIndicator color={p.clay} style={{ marginBottom: 12 }} /> : null}
        {values.photos.length ? (
          <View style={styles.grid}>
            {values.photos.map((ph) => (
              <View key={ph.url}>
                <Image source={{ uri: ph.url }} style={styles.thumb} />
                <Pressable
                  style={styles.removePhoto}
                  onPress={() => set("photos", values.photos.filter((x) => x.url !== ph.url))}
                  hitSlop={6}
                  accessibilityLabel="Remove photo"
                >
                  <X size={12} color="#fff" strokeWidth={3} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <FormField label="Notes" value={values.notes} onChangeText={(v) => set("notes", v)} multiline placeholder="Surface condition, special areas, access" />
      </View>

      <Pressable style={[f.primary, busy && f.disabled]} onPress={submit} disabled={busy}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>{mode === "create" ? "Save measurement" : "Save changes"}</Text>}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable
          style={[f.danger, busy && f.disabled]}
          disabled={busy}
          onPress={() =>
            Alert.alert(initial.title.trim() ? `Delete measurement "${initial.title.trim()}"?` : "Delete measurement?", "This measurement sheet will be permanently deleted. Estimates already made from it keep their quantities.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete measurement", style: "destructive", onPress: onDelete },
            ])
          }
        >
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={f.dangerText}>Delete measurement</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const SCOPE_OPTIONS = [
  { id: "sheet", label: "Site sheet", detail: "Rooms, walls, ceilings and counts" },
  { id: "area", label: "Area", detail: "Walls, floors or ceilings, with openings" },
  { id: "quantity", label: "Quantity", detail: "Doors, windows, fixtures" },
  { id: "length", label: "Length", detail: "Pipes, wiring, skirting" },
  { id: "time", label: "Time", detail: "Planned hours or days" },
  { id: "fixed", label: "Fixed scope", detail: "One defined job" },
];

function scopeFromRecord(m: AthenaRecord): Record<string, string> {
  const inputs = (m.inputs as Record<string, unknown>) || {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (value == null || typeof value === "object") continue;
    out[key] = String(value);
  }
  const openings = inputs.openings;
  if (Array.isArray(openings) && openings[0] && typeof openings[0] === "object") {
    const first = openings[0] as Record<string, unknown>;
    out.openingWidth = String(first.width || "");
    out.openingHeight = String(first.height || "");
  }
  const segments = inputs.segments;
  if (Array.isArray(segments) && segments[0] && typeof segments[0] === "object") {
    const first = segments[0] as Record<string, unknown>;
    out.length = String(first.length || "");
    out.count = String(first.count || "");
  }
  const outputs = (m.outputs as Record<string, unknown>) || {};
  if (outputs.formula) out.preview = String(outputs.formula);
  return out;
}

function scopeInputs(type: ScopeType, scope: Record<string, string>): Record<string, unknown> {
  if (type === "area") {
    const openings = Number(scope.openingWidth) > 0 && Number(scope.openingHeight) > 0 ? [{ width: scope.openingWidth, height: scope.openingHeight, count: scope.openingCount || "1" }] : [];
    return { surface: scope.surface || "walls", length: scope.length, width: scope.width, height: scope.height, unit: "sqft", openings };
  }
  if (type === "quantity") return { item: scope.item, quantity: scope.quantity, unit: scope.unit || "piece" };
  if (type === "length") return { unit: scope.unit || "rft", segments: [{ length: scope.length, count: scope.count || "1" }] };
  if (type === "time") return { duration: scope.duration, unit: scope.unit || "days", crewSize: scope.crewSize || "" };
  return { title: scope.title, description: scope.description, inclusions: scope.inclusions, exclusions: scope.exclusions, location: scope.location };
}

function ScopeInputs({ scopeType, scope, onChange }: { scopeType: ScopeType; scope: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  const set = (key: string, value: string) => onChange({ ...scope, [key]: value });
  if (scopeType === "area") {
    return (
      <>
        <FormField label="Surface">
          <SelectDropdown options={[{ id: "walls", label: "Walls" }, { id: "floor", label: "Floor" }, { id: "ceiling", label: "Ceiling" }]} value={scope.surface || "walls"} onChange={(v) => set("surface", v)} />
        </FormField>
        <FormField label="Length (ft)" value={scope.length || ""} onChangeText={(v) => set("length", v)} keyboardType="decimal-pad" />
        <FormField label="Width (ft)" value={scope.width || ""} onChangeText={(v) => set("width", v)} keyboardType="decimal-pad" />
        {(scope.surface || "walls") === "walls" ? <FormField label="Height (ft)" value={scope.height || ""} onChangeText={(v) => set("height", v)} keyboardType="decimal-pad" /> : null}
        <FormField label="Opening width (ft)" hint="Optional deduction, such as a door." value={scope.openingWidth || ""} onChangeText={(v) => set("openingWidth", v)} keyboardType="decimal-pad" />
        <FormField label="Opening height (ft)" value={scope.openingHeight || ""} onChangeText={(v) => set("openingHeight", v)} keyboardType="decimal-pad" />
      </>
    );
  }
  if (scopeType === "quantity") {
    return (
      <>
        <FormField label="Item" value={scope.item || ""} onChangeText={(v) => set("item", v)} placeholder="Door" />
        <FormField label="Quantity" value={scope.quantity || ""} onChangeText={(v) => set("quantity", v)} keyboardType="decimal-pad" />
        <FormField label="Unit" value={scope.unit || "piece"} onChangeText={(v) => set("unit", v)} />
      </>
    );
  }
  if (scopeType === "length") {
    return (
      <>
        <FormField label="Segment length" value={scope.length || ""} onChangeText={(v) => set("length", v)} keyboardType="decimal-pad" />
        <FormField label="How many segments" value={scope.count || "1"} onChangeText={(v) => set("count", v)} keyboardType="number-pad" />
        <FormField label="Unit">
          <SelectDropdown options={[{ id: "rft", label: "Running feet" }, { id: "ft", label: "Feet" }, { id: "m", label: "Metres" }, { id: "rmt", label: "Running metres" }]} value={scope.unit || "rft"} onChange={(v) => set("unit", v)} />
        </FormField>
      </>
    );
  }
  if (scopeType === "time") {
    return (
      <>
        <FormField label="Planned duration" value={scope.duration || ""} onChangeText={(v) => set("duration", v)} keyboardType="decimal-pad" />
        <FormField label="Unit">
          <SelectDropdown options={[{ id: "days", label: "Days" }, { id: "hours", label: "Hours" }]} value={scope.unit || "days"} onChange={(v) => set("unit", v)} />
        </FormField>
        <FormField label="Crew size" hint="Optional. Planned worker-days only — not a schedule." value={scope.crewSize || ""} onChangeText={(v) => set("crewSize", v)} keyboardType="number-pad" />
      </>
    );
  }
  return (
    <>
      <FormField label="Scope title" value={scope.title || ""} onChangeText={(v) => set("title", v)} placeholder="Bathroom repair" />
      <FormField label="Description" value={scope.description || ""} onChangeText={(v) => set("description", v)} multiline />
      <FormField label="Inclusions" value={scope.inclusions || ""} onChangeText={(v) => set("inclusions", v)} multiline />
      <FormField label="Exclusions" value={scope.exclusions || ""} onChangeText={(v) => set("exclusions", v)} multiline />
      <FormField label="Location" value={scope.location || ""} onChangeText={(v) => set("location", v)} />
    </>
  );
}

function validate(v: MeasurementValues) {
  const e: Partial<Record<"siteId" | "title" | "items", string>> = {};
  if (!v.siteId) e.siteId = "Select the site you measured";
  if (!v.title.trim()) e.title = "Give this measurement a title";
  if (!v.items.length) e.items = "Add at least one line";
  else if (invalidItems(v.items).length) e.items = "Some lines are missing measurements";
  return e;
}

export function measurementBody(values: MeasurementValues) {
  return {
    customerId: values.customerId || null,
    siteId: values.siteId,
    surveyId: values.surveyId || null,
    projectId: values.projectId || null,
    ...buildMeasurementPayload(values.items, {
      title: values.title.trim(),
      notes: values.notes.trim() || null,
      billBySqft: values.billBySqft,
      perSqftRate: values.perSqftRate,
      photos: values.photos,
    }),
  };
}

/** "Walls 1,240 sqft · Ceiling 400 sqft" for toasts. */
export function measurementBrief(values: MeasurementValues) {
  return aggregateOutputs(values.items)
    .groups.slice(0, 2)
    .map((g) => `${g.label} ${formatQty(g.quantity)} ${g.unit}`)
    .join(" · ");
}

export function emptyMeasurement(customerId?: string, siteId?: string): MeasurementValues {
  return {
    customerId: customerId || "",
    siteId: siteId || "",
    surveyId: "",
    projectId: "",
    scopeType: "",
    scope: {},
    title: "",
    items: [createMeasurementItem("room")],
    notes: "",
    photos: [],
    billBySqft: false,
    perSqftRate: null,
  };
}

const styles = StyleSheet.create({
  section: { color: p.text, fontWeight: "800", fontSize: 16, marginTop: 4 },
  sectionHint: { color: p.muted, fontSize: 13, marginTop: 2, marginBottom: 10 },
  err: { color: p.red, fontSize: 12, fontWeight: "600", marginTop: 6 },
  photoRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  photoText: { color: p.clayDark, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: p.border },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
