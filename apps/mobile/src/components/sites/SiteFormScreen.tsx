import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Crosshair, MapPin, PencilLine, RefreshCw, Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formStyles as f } from "@/components/ui/formStyles";
import { useCustomers } from "@/hooks/useApi";
import { customerDisplayName } from "@/lib/customers";
import { SITE_TYPES, siteAutoName } from "@/lib/workflow";
import { OptionOrOtherField } from "@/components/ui/OptionOrOtherField";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius } from "@/lib/theme";

export type LocationMode = "gps" | "manual";

export type SiteValues = {
  customerId: string;
  name: string;
  siteType: string;
  mode: LocationMode;
  address: string;
  pinCode: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  accessInstructions: string;
};

type Errors = Partial<Record<keyof SiteValues | "location", string>>;

export function siteValuesFrom(site: AthenaRecord): SiteValues {
  const lat = site.lat == null || site.lat === "" ? null : Number(site.lat);
  const lng = site.lng == null || site.lng === "" ? null : Number(site.lng);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng) && lat != null && lng != null;
  return {
    customerId: String(site.customerId || ""),
    name: String(site.name || ""),
    siteType: String(site.siteType || ""),
    mode: site.locationSource === "manual" || !hasGps ? "manual" : "gps",
    address: String(site.address || ""),
    pinCode: String(site.pinCode || ""),
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    accuracy: null,
    accessInstructions: String(site.accessInstructions || ""),
  };
}

export function siteBody(v: SiteValues): Record<string, unknown> {
  const gps = v.mode === "gps" && v.lat != null && v.lng != null;
  return {
    customerId: v.customerId,
    name: v.name.trim(),
    siteType: v.siteType.trim() || null,
    address: v.address.trim(),
    pinCode: v.pinCode.trim() || null,
    lat: gps ? v.lat : null,
    lng: gps ? v.lng : null,
    locationSource: gps ? "gps" : "manual",
    mapsUrl: gps
      ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.address.trim(), v.pinCode.trim()].filter(Boolean).join(" "))}`,
    accessInstructions: v.accessInstructions.trim() || null,
  };
}

function validate(v: SiteValues): Errors {
  const e: Errors = {};
  if (!v.customerId) e.customerId = "Select the customer";
  if (!v.name.trim()) e.name = "Enter a site name";
  if (v.mode === "gps" && (v.lat == null || v.lng == null)) e.location = "Tap “Get current location”, or switch to Enter manually";
  if (!v.address.trim()) e.address = v.mode === "gps" ? "Confirm the address for this location" : "Enter the site address";
  if (v.pinCode.trim() && !/^[1-9][0-9]{5}$/.test(v.pinCode.trim())) e.pinCode = "Enter a valid 6-digit PIN code";
  return e;
}

function addressFrom(r: Location.LocationGeocodedAddress) {
  const street = [r.streetNumber, r.street].filter(Boolean).join(" ");
  const parts = [r.name && r.name !== r.streetNumber ? r.name : "", street, r.district, r.subregion !== r.city ? r.subregion : "", r.city, r.region];
  const seen = new Set<string>();
  return parts
    .map((s) => String(s || "").trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join(", ");
}

type Props = {
  mode: "create" | "edit";
  initial?: SiteValues | null;
  lockedCustomer?: AthenaRecord | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  blockedReason?: string;
  onBack: () => void;
  onSubmit: (values: SiteValues) => Promise<void>;
  onDelete?: () => void;
};

export function SiteFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title={mode === "create" ? "New site" : "Edit site"}
            subtitle={mode === "create" ? "Where the work will happen" : initial?.name}
            onBack={onBack}
          />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <SiteFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const EMPTY: SiteValues = {
  customerId: "",
  name: "",
  siteType: "",
  mode: "gps",
  address: "",
  pinCode: "",
  lat: null,
  lng: null,
  accuracy: null,
  accessInstructions: "",
};

function SiteFields({ mode, initial, lockedCustomer, saving, deleting, blockedReason, onSubmit, onDelete }: Props) {
  const customersQ = useCustomers();
  const [values, setValues] = useState<SiteValues>(initial ?? { ...EMPTY, customerId: String(lockedCustomer?.id || "") });
  const [nameTouched, setNameTouched] = useState(mode === "edit");
  const [submitted, setSubmitted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const errors = submitted ? validate(values) : {};
  const busy = saving || Boolean(deleting);

  const customer = lockedCustomer || (customersQ.data?.items ?? []).find((c) => String(c.id) === values.customerId);
  const customerOptions = useMemo(
    () =>
      (customersQ.data?.items ?? []).map((c) => ({
        id: String(c.id),
        label: customerDisplayName(c),
        detail: String(c.phone || "") || undefined,
      })),
    [customersQ.data?.items],
  );

  const autoName = siteAutoName({ siteType: values.siteType, address: values.address, customerName: customer ? customerDisplayName(customer) : "" });
  useEffect(() => {
    if (!nameTouched) setValues((prev) => (prev.name === autoName ? prev : { ...prev, name: autoName }));
  }, [autoName, nameTouched]);

  function set<K extends keyof SiteValues>(key: K, value: SiteValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function locate() {
    setLocating(true);
    setLocError(null);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.granted;
      if (!granted && current.canAskAgain !== false) granted = (await Location.requestForegroundPermissionsAsync()).granted;
      if (!granted) {
        setLocError("Location permission is off.");
        Alert.alert("Location access needed", "Allow location for Athena to capture the site's position, or enter the address manually.", [
          { text: "Enter manually", onPress: () => set("mode", "manual") },
          { text: "Open settings", onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocError("Turn on location (GPS) on your phone and try again.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = pos.coords;
      let address = "";
      let pin = "";
      try {
        const [r] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (r) {
          address = addressFrom(r);
          pin = /^[1-9][0-9]{5}$/.test(String(r.postalCode || "")) ? String(r.postalCode) : "";
        }
      } catch {
        // Coordinates are enough; the address can be typed.
      }
      setValues((prev) => ({
        ...prev,
        lat: Number(latitude.toFixed(6)),
        lng: Number(longitude.toFixed(6)),
        accuracy: accuracy != null ? Math.round(accuracy) : null,
        address: address || prev.address,
        pinCode: pin || prev.pinCode,
      }));
      if (!address) setLocError("Location captured. Couldn't look up the address — please type it below.");
    } catch (e) {
      setLocError((e as Error)?.message || "Couldn't get your location. Try again or enter it manually.");
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    setSubmitted(true);
    if (blockedReason) return;
    if (Object.keys(validate(values)).length > 0) return;
    await onSubmit(values);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(
      values.name.trim() ? `Delete site "${values.name.trim()}"?` : "Delete site?",
      "This site and its surveys, measurements, estimates and files will be permanently deleted. Sites with projects or invoices can't be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete site", style: "destructive", onPress: onDelete },
      ],
    );
  }

  const hasFix = values.lat != null && values.lng != null;

  return (
    <View>
      {blockedReason ? <ErrorBanner message={blockedReason} /> : null}
      <View style={f.card}>
        <Text style={f.cardTitle}>Site</Text>
        <Text style={f.cardHint}>Each site has its own surveys, measurements and estimates.</Text>
        <FormField label="Customer" required error={errors.customerId}>
          {lockedCustomer || mode === "edit" ? (
            <View style={f.readonly}>
              <Text style={f.readonlyText}>{customer ? customerDisplayName(customer) : "Customer"}</Text>
              {customer?.phone ? <Text style={f.readonlyDetail}>{String(customer.phone)}</Text> : null}
            </View>
          ) : (
            <SelectDropdown
              options={customerOptions}
              value={values.customerId}
              onChange={(v) => set("customerId", v)}
              placeholder={customersQ.isLoading ? "Loading customers…" : "Select customer"}
              searchPlaceholder="Search customers"
              error={errors.customerId}
              emptyText="No customers yet."
            />
          )}
        </FormField>
        <OptionOrOtherField
          label="Site type"
          options={SITE_TYPES}
          value={values.siteType}
          onChange={(v) => set("siteType", v)}
          placeholder="Select type"
          otherLabel="Describe the site"
          otherPlaceholder="e.g. Temple, hostel"
        />
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>Location</Text>
        <Text style={f.cardHint}>Capture it while you're at the site, or type the address.</Text>
        <View style={styles.modes}>
          <ModeButton
            on={values.mode === "gps"}
            icon={<Crosshair size={18} color={values.mode === "gps" ? "#fff" : p.text} />}
            label="Use current location"
            onPress={() => set("mode", "gps")}
          />
          <ModeButton
            on={values.mode === "manual"}
            icon={<PencilLine size={18} color={values.mode === "manual" ? "#fff" : p.text} />}
            label="Enter manually"
            onPress={() => set("mode", "manual")}
          />
        </View>

        {values.mode === "gps" ? (
          <View style={{ marginBottom: 16 }}>
            {hasFix ? (
              <View style={styles.fix}>
                <MapPin size={18} color={p.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fixTitle}>Location captured</Text>
                  <Text style={styles.fixMeta}>
                    {values.lat?.toFixed(5)}, {values.lng?.toFixed(5)}
                    {values.accuracy ? ` · ±${values.accuracy} m` : ""}
                  </Text>
                </View>
                <Pressable onPress={locate} disabled={locating} style={styles.refresh} hitSlop={6} accessibilityLabel="Refresh location">
                  {locating ? <ActivityIndicator size="small" color={p.clay} /> : <RefreshCw size={16} color={p.clayDark} />}
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.locate, errors.location && styles.locateError]} onPress={locate} disabled={locating}>
                {locating ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.locateText}>Getting location…</Text>
                  </>
                ) : (
                  <>
                    <Crosshair size={18} color="#fff" />
                    <Text style={styles.locateText}>Get current location</Text>
                  </>
                )}
              </Pressable>
            )}
            {errors.location && !hasFix ? <Text style={styles.err}>{errors.location}</Text> : null}
            {locError ? <Text style={styles.locHint}>{locError}</Text> : null}
          </View>
        ) : null}

        {values.mode === "manual" || hasFix ? (
          <>
            <FormField
              label="Address"
              required
              value={values.address}
              onChangeText={(v) => set("address", v)}
              error={errors.address}
              multiline
              placeholder="Door no, building, street, area, city"
            />
            <FormField
              label="PIN code"
              value={values.pinCode}
              onChangeText={(v) => set("pinCode", v.replace(/\D/g, "").slice(0, 6))}
              error={errors.pinCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6 digits"
            />
          </>
        ) : null}
      </View>

      <View style={f.card}>
        <FormField
          label="Site name"
          required
          value={values.name}
          onChangeText={(v) => {
            setNameTouched(true);
            set("name", v);
          }}
          error={errors.name}
          autoCapitalize="words"
          placeholder="e.g. Flat 4B — Anna Nagar"
        />
        {!nameTouched ? <Text style={styles.autoHint}>Suggested from the site type and address — you can change it.</Text> : null}
        <FormField
          label="Access notes"
          value={values.accessInstructions}
          onChangeText={(v) => set("accessInstructions", v)}
          multiline
          placeholder="Floor, gate code, parking, best time to visit"
        />
      </View>

      <Pressable style={[f.primary, (busy || Boolean(blockedReason)) && f.disabled]} onPress={submit} disabled={busy}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>{mode === "create" ? "Save site" : "Save changes"}</Text>}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[f.danger, busy && f.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={f.dangerText}>Delete site</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function ModeButton({ on, icon, label, onPress }: { on: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.mode, on && styles.modeOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {icon}
      <Text style={[styles.modeText, on && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 8, marginBottom: 14 },
  mode: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  modeOn: { backgroundColor: p.text, borderColor: p.text },
  modeText: { color: p.text, fontWeight: "700", fontSize: 13, textAlign: "center" },
  locate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  locateError: { borderWidth: 2, borderColor: p.red },
  locateText: { color: "#fff", fontWeight: "800" },
  fix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: p.greenSoft,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  fixTitle: { color: "#15803D", fontWeight: "800" },
  fixMeta: { color: p.muted, fontSize: 12, marginTop: 2 },
  refresh: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: p.surface },
  err: { color: p.red, fontSize: 12, fontWeight: "600", marginTop: 6 },
  locHint: { color: "#92400E", fontSize: 12, fontWeight: "600", marginTop: 8 },
  autoHint: { color: p.muted, fontSize: 12, marginTop: -10, marginBottom: 14 },
});
