import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, ImageIcon, Lock, Upload, X } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { useOrgBranding, useUpdateOrgBranding, type OrgBranding } from "@/hooks/useApi";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import { GST_OPTIONS } from "@/lib/estimates";
import { DEFAULT_DAYS, INDIAN_STATES } from "@/lib/organization";
import { pickFromGallery } from "@/lib/files";
import { hasPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

type Values = {
  companyName: string;
  phone: string;
  email: string;
  companyAddress: string;
  gstNumber: string;
  pan: string;
  bankName: string;
  bankBranch: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  upiId: string;
  termsConditions: string;
  estimateTerms: string;
  website: string;
  brandColor: string;
  logoUrl: string;
  signatureUrl: string;
  sealUrl: string;
  state: string;
  defaultGstRate: string;
  estimateValidityDays: string;
  invoiceDueDays: string;
  signatoryName: string;
  signatoryDesignation: string;
};
type ImageKey = "logoUrl" | "signatureUrl" | "sealUrl";
type Errors = Partial<Record<keyof Values, string>>;

const BRAND_COLORS = ["#EA580C", "#B45309", "#15803D", "#0F766E", "#1E3A5F", "#6D28D9", "#9F1239", "#334155"];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_RE = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;
const stateOptions = INDIAN_STATES.map((s) => ({ id: s, label: s }));

function valuesFrom(b: OrgBranding): Values {
  return {
    companyName: b.company_name || "",
    phone: b.phone || "",
    email: b.email || "",
    companyAddress: b.company_address || "",
    gstNumber: b.gst_number || "",
    pan: b.pan || "",
    bankName: b.bank_name || "",
    bankBranch: b.bank_branch || "",
    bankAccountHolder: b.bank_account_holder || "",
    bankAccountNumber: b.bank_account_number || "",
    bankIfscCode: b.bank_ifsc_code || "",
    upiId: b.upi_id || "",
    termsConditions: b.terms_conditions || "",
    estimateTerms: b.estimate_terms || "",
    website: b.website || "",
    brandColor: b.brand_color || "",
    logoUrl: b.logo_url || "",
    signatureUrl: b.signature_url || "",
    sealUrl: b.seal_url || "",
    state: b.state || "",
    defaultGstRate: b.default_gst_rate || "",
    estimateValidityDays: b.estimate_validity_days || "",
    invoiceDueDays: b.invoice_due_days || "",
    signatoryName: b.signatory_name || "",
    signatoryDesignation: b.signatory_designation || "",
  };
}

function daysError(v: string): string | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? undefined : "Enter 0 to 365 days";
}

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.companyName.trim()) e.companyName = "Enter your business name";
  const phone = v.phone.replace(/\D/g, "");
  if (v.phone.trim() && (phone.length < 10 || phone.length > 13)) e.phone = "Enter a valid phone number";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email";
  if (v.gstNumber.trim() && !GSTIN_RE.test(v.gstNumber.trim())) e.gstNumber = "GSTIN should be 15 characters, e.g. 29ABCDE1234F1Z5";
  if (v.pan.trim() && !PAN_RE.test(v.pan.trim())) e.pan = "PAN should look like ABCDE1234F";
  if (v.bankIfscCode.trim() && !IFSC_RE.test(v.bankIfscCode.trim())) e.bankIfscCode = "IFSC should be 11 characters, e.g. HDFC0001234";
  if (v.bankAccountNumber.trim() && !/^\d{6,18}$/.test(v.bankAccountNumber.trim())) e.bankAccountNumber = "Enter 6 to 18 digits";
  if (v.upiId.trim() && !UPI_RE.test(v.upiId.trim())) e.upiId = "UPI ID should look like name@bank";
  if (v.website.trim() && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v.website.trim())) e.website = "Enter a website like www.yourbusiness.com";
  const validity = daysError(v.estimateValidityDays);
  if (validity) e.estimateValidityDays = validity;
  const due = daysError(v.invoiceDueDays);
  if (due) e.invoiceDueDays = due;
  return e;
}

export default function OrganizationScreen() {
  const router = useRouter();
  const q = useOrgBranding();
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Organization" subtitle="Shown on quotes, invoices & receipts" onBack={() => router.back()} />
          {q.isLoading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {q.isError ? (
            <ErrorBanner
              message={(q.error as { userMessage?: string })?.userMessage || "Couldn't load organization details."}
              onRetry={() => q.refetch()}
            />
          ) : null}
          {q.data ? <OrganizationForm initial={valuesFrom(q.data)} onDone={() => router.back()} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function OrganizationForm({ initial, onDone }: { initial: Values; onDone: () => void }) {
  const canEdit = useAuthStore((s) => hasPermission(s.user, "settings.manage"));
  const update = useUpdateOrgBranding();
  const [values, setValues] = useState<Values>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState<ImageKey | null>(null);
  const errors = submitted ? validate(values) : {};

  function set<K extends keyof Values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function pickImage(key: ImageKey) {
    try {
      const [file] = await pickFromGallery();
      if (!file) return;
      setUploading(key);
      const res = await uploadUriToCloudinary(file.uri, { name: file.name, mimeType: file.mimeType, folder: "athena/branding" });
      set(key, res.url);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't upload image", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) {
      Toast.show({ type: "error", text1: "Check the highlighted fields" });
      return;
    }
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as Record<string, string>;
    try {
      await update.mutateAsync(body);
      Toast.show({ type: "success", text1: "Organization updated", text2: "New quotes and invoices will use these details." });
      onDone();
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't save details", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    }
  }

  const field = (key: keyof Values) => ({
    value: values[key],
    onChangeText: (v: string) => set(key, v),
    error: errors[key],
    editable: canEdit,
  });

  return (
    <View>
      {!canEdit ? (
        <View style={styles.notice}>
          <Lock size={16} color={p.amber} strokeWidth={2.4} />
          <Text style={styles.noticeText}>Only the workspace owner or an admin can change these details.</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Business</Text>
      <View style={styles.card}>
        <FormField label="Business name" required {...field("companyName")} autoCapitalize="words" placeholder="e.g. Sri Balaji Interiors" />
        <FormField label="Phone" {...field("phone")} keyboardType="phone-pad" maxLength={15} placeholder="10-digit mobile number" />
        <FormField label="Email" {...field("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="billing@yourbusiness.com" />
        <FormField label="Address" {...field("companyAddress")} multiline placeholder="Door no, street, area, city, PIN" />
        <FormField label="State" hint="Decides CGST + SGST or IGST on your bills">
          {canEdit ? (
            <SelectDropdown
              options={stateOptions}
              value={values.state}
              onChange={(v) => set("state", v)}
              placeholder="Select state"
              searchPlaceholder="Search state"
            />
          ) : (
            <Text style={styles.readonly}>{values.state || "Not set"}</Text>
          )}
        </FormField>
        <FormField label="Website" {...field("website")} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="www.yourbusiness.com" />
      </View>

      <Text style={styles.section}>Branding on estimates & invoices</Text>
      <View style={[styles.card, { paddingBottom: spacing.md, gap: 14 }]}>
        <ImagePickRow
          label="Logo"
          hint="Printed at the top of every estimate"
          url={values.logoUrl}
          busy={uploading === "logoUrl"}
          disabled={!canEdit || Boolean(uploading)}
          onPick={() => void pickImage("logoUrl")}
          onRemove={() => set("logoUrl", "")}
        />
        <ImagePickRow
          label="Signature"
          hint="Shown above “Authorised signatory”"
          url={values.signatureUrl}
          busy={uploading === "signatureUrl"}
          disabled={!canEdit || Boolean(uploading)}
          onPick={() => void pickImage("signatureUrl")}
          onRemove={() => set("signatureUrl", "")}
        />
        <ImagePickRow
          label="Company seal"
          hint="Stamp printed with the signature"
          url={values.sealUrl}
          busy={uploading === "sealUrl"}
          disabled={!canEdit || Boolean(uploading)}
          onPick={() => void pickImage("sealUrl")}
          onRemove={() => set("sealUrl", "")}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <FormField label="Signatory name" {...field("signatoryName")} autoCapitalize="words" maxLength={80} placeholder="e.g. R. Kumar" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Designation" {...field("signatoryDesignation")} autoCapitalize="words" maxLength={60} placeholder="e.g. Proprietor" />
          </View>
        </View>
        <View>
          <Text style={styles.fieldLabel}>Document colour</Text>
          <View style={styles.swatches}>
            {BRAND_COLORS.map((c) => {
              const on = (values.brandColor || BRAND_COLORS[0]).toUpperCase() === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => canEdit && set("brandColor", c)}
                  style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Colour ${c}`}
                >
                  {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Used for headings, the line-item table and the grand total.</Text>
        </View>
      </View>

      <Text style={styles.section}>Tax</Text>
      <View style={styles.card}>
        <FormField
          label="GSTIN"
          {...field("gstNumber")}
          onChangeText={(v) => set("gstNumber", v.toUpperCase().replace(/\s/g, ""))}
          autoCapitalize="characters"
          maxLength={15}
          placeholder="Leave empty if not GST registered"
        />
        <FormField
          label="PAN"
          {...field("pan")}
          onChangeText={(v) => set("pan", v.toUpperCase().replace(/\s/g, ""))}
          autoCapitalize="characters"
          maxLength={10}
          placeholder="ABCDE1234F"
        />
      </View>

      <Text style={styles.section}>Defaults for new estimates & invoices</Text>
      <View style={styles.card}>
        <FormField label="Default GST" hint="Pre-selected on every new estimate">
          {canEdit ? (
            <SelectDropdown options={GST_OPTIONS} value={values.defaultGstRate} onChange={(v) => set("defaultGstRate", v)} placeholder="GST 18%" />
          ) : (
            <Text style={styles.readonly}>{GST_OPTIONS.find((o) => o.id === values.defaultGstRate)?.label || "GST 18%"}</Text>
          )}
        </FormField>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <FormField
              label="Estimate valid for"
              {...field("estimateValidityDays")}
              onChangeText={(v) => set("estimateValidityDays", v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={3}
              placeholder={`${DEFAULT_DAYS} days`}
              hint="Days"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Invoice due in"
              {...field("invoiceDueDays")}
              onChangeText={(v) => set("invoiceDueDays", v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={3}
              placeholder={`${DEFAULT_DAYS} days`}
              hint="Days after billing"
            />
          </View>
        </View>
      </View>

      <Text style={styles.section}>Bank & UPI</Text>
      <View style={styles.card}>
        <FormField label="Account holder" {...field("bankAccountHolder")} autoCapitalize="words" />
        <FormField
          label="Account number"
          {...field("bankAccountNumber")}
          onChangeText={(v) => set("bankAccountNumber", v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={18}
        />
        <FormField
          label="IFSC code"
          {...field("bankIfscCode")}
          onChangeText={(v) => set("bankIfscCode", v.toUpperCase().replace(/\s/g, ""))}
          autoCapitalize="characters"
          maxLength={11}
        />
        <FormField label="Bank name" {...field("bankName")} autoCapitalize="words" />
        <FormField label="Branch" {...field("bankBranch")} autoCapitalize="words" />
        <FormField label="UPI ID" {...field("upiId")} autoCapitalize="none" autoCorrect={false} placeholder="yourname@okhdfcbank" />
      </View>

      <Text style={styles.section}>Terms</Text>
      <View style={styles.card}>
        <FormField
          label="Estimate terms"
          {...field("estimateTerms")}
          multiline
          placeholder="e.g. Rates valid for 30 days. Work starts after 40% advance. Extra work billed separately."
        />
        <FormField label="Invoice terms & conditions" {...field("termsConditions")} multiline placeholder="e.g. Payment due within 7 days of invoice" />
      </View>

      {canEdit ? (
        <Pressable style={[styles.primary, update.isPending && styles.disabled]} onPress={save} disabled={update.isPending}>
          {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save details</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

function ImagePickRow({
  label,
  hint,
  url,
  busy,
  disabled,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.imageRow}>
      <View style={styles.imageBox}>
        {busy ? <ActivityIndicator color={p.clay} /> : url ? <Image source={{ uri: url }} style={styles.image} resizeMode="contain" /> : <ImageIcon size={22} color={p.faint} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.imageLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.imageActions}>
          <Pressable onPress={onPick} disabled={disabled} style={[styles.smallBtn, disabled && styles.disabled]} accessibilityRole="button">
            <Upload size={14} color={p.text} />
            <Text style={styles.smallBtnText}>{url ? "Change" : "Upload"}</Text>
          </Pressable>
          {url ? (
            <Pressable onPress={onRemove} disabled={disabled} style={[styles.smallBtn, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel={`Remove ${label.toLowerCase()}`}>
              <X size={14} color={p.red} />
              <Text style={[styles.smallBtnText, { color: p.red }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fieldLabel: { color: p.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  hint: { color: p.muted, fontSize: 12, marginTop: 4 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  row: { flexDirection: "row", gap: 12 },
  readonly: { color: p.text, fontSize: 15, paddingVertical: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: p.text },
  imageRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  imageBox: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: 60, height: 60 },
  imageLabel: { color: p.text, fontWeight: "700", fontSize: 14 },
  imageActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  smallBtnText: { color: p.text, fontWeight: "700", fontSize: 12 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: p.amberSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  noticeText: { flex: 1, color: p.text, fontSize: 13, fontWeight: "600" },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    paddingBottom: 0,
  },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    ...softShadow,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
