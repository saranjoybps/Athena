import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formStyles as f } from "@/components/ui/formStyles";
import { useCustomers } from "@/hooks/useApi";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_TYPES,
  EMPTY_CUSTOMER,
  duplicatePhone,
  validateCustomer,
  type CustomerType,
  type CustomerValues,
} from "@/lib/customers";
import { lightPalette as p } from "@/lib/theme";

type Props = {
  mode: "create" | "edit";
  customerId?: string;
  initial?: CustomerValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  blockedReason?: string;
  onBack: () => void;
  onSubmit: (values: CustomerValues) => Promise<void>;
  onDelete?: () => void;
  onOpenCustomer?: (id: string) => void;
};

export function CustomerFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title={mode === "create" ? "New customer" : "Edit customer"}
            subtitle={mode === "create" ? "Contact and billing details" : initial?.name || undefined}
            onBack={onBack}
          />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <CustomerFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function CustomerFields({
  mode,
  customerId,
  initial,
  saving,
  deleting,
  blockedReason,
  onSubmit,
  onDelete,
  onOpenCustomer,
}: Props) {
  const customersQ = useCustomers();
  const [values, setValues] = useState<CustomerValues>(initial ?? EMPTY_CUSTOMER);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateCustomer(values) : {};
  const busy = saving || Boolean(deleting);
  const business = values.type === "company";
  const duplicate = duplicatePhone(customersQ.data?.items ?? [], values.phone, customerId);

  function set<K extends keyof CustomerValues>(key: K, value: CustomerValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSubmitted(true);
    if (blockedReason) return;
    if (Object.keys(validateCustomer(values)).length > 0) return;
    await onSubmit(values);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(
      values.name.trim() ? `Delete customer "${values.name.trim()}"?` : "Delete customer?",
      "This customer and all their sites, surveys, measurements, estimates and files will be permanently deleted. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete customer", style: "destructive", onPress: onDelete },
      ],
    );
  }

  return (
    <View>
      {blockedReason ? <ErrorBanner message={blockedReason} /> : null}

      <View style={f.card}>
        <Text style={f.cardTitle}>Customer</Text>
        <Text style={f.cardHint}>Who you are working for.</Text>
        <FormField label="Customer type" required>
          <SelectDropdown
            options={CUSTOMER_TYPES}
            value={values.type}
            onChange={(v) => set("type", (v || "individual") as CustomerType)}
            placeholder="Select type"
          />
        </FormField>
        {business ? (
          <FormField
            label="Business name"
            required
            value={values.company}
            onChangeText={(v) => set("company", v)}
            error={errors.company}
            autoCapitalize="words"
            placeholder="e.g. Sri Lakshmi Builders"
          />
        ) : null}
        <FormField
          label={business ? "Contact person" : "Full name"}
          required
          value={values.name}
          onChangeText={(v) => set("name", v)}
          error={errors.name}
          autoCapitalize="words"
          placeholder={business ? "Who should we talk to?" : "e.g. Ravi Kumar"}
        />
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>Contact</Text>
        <Text style={f.cardHint}>Used for calls, WhatsApp and emailing estimates.</Text>
        <FormField
          label="Phone"
          required
          value={values.phone}
          onChangeText={(v) => set("phone", v.replace(/[^\d+\s-]/g, ""))}
          error={errors.phone}
          keyboardType="phone-pad"
          maxLength={16}
          placeholder="10-digit mobile number"
        />
        {duplicate && !errors.phone ? (
          <View style={f.warn}>
            <Text style={f.warnText}>
              This number is already saved for {String(duplicate.name || "another customer")}.
            </Text>
            {onOpenCustomer ? (
              <Pressable onPress={() => onOpenCustomer(String(duplicate.id))} hitSlop={6}>
                <Text style={f.warnLink}>Open that customer</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <FormField
          label="Alternate phone"
          value={values.alternatePhone}
          onChangeText={(v) => set("alternatePhone", v.replace(/[^\d+\s-]/g, ""))}
          error={errors.alternatePhone}
          keyboardType="phone-pad"
          maxLength={16}
          placeholder="Optional"
        />
        <FormField
          label="Email"
          value={values.email}
          onChangeText={(v) => set("email", v.trim())}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Optional — needed to email estimates"
        />
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>Billing</Text>
        <Text style={f.cardHint}>Printed on estimates and invoices. Work locations are added as sites.</Text>
        <FormField
          label="Billing address"
          value={values.address}
          onChangeText={(v) => set("address", v)}
          multiline
          placeholder="Door no, street, area, city, PIN"
        />
        {business ? (
          <FormField
            label="GSTIN"
            value={values.gstin}
            onChangeText={(v) => set("gstin", v.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
            error={errors.gstin}
            autoCapitalize="characters"
            maxLength={15}
            placeholder="Optional — 15 characters"
          />
        ) : null}
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>More</Text>
        <Text style={f.cardHint}>Optional.</Text>
        <FormField label="How did they find you?">
          <SelectDropdown
            options={CUSTOMER_SOURCES}
            value={values.source}
            onChange={(v) => set("source", v)}
            placeholder="Select source"
            clearLabel="Not specified"
          />
        </FormField>
        <FormField
          label="Notes"
          value={values.notes}
          onChangeText={(v) => set("notes", v)}
          multiline
          placeholder="Preferences, best time to call, etc."
        />
      </View>

      {submitted && Object.keys(errors).length > 0 ? (
        <Text style={{ color: p.red, fontWeight: "600", marginBottom: 8, textAlign: "center" }}>
          Fix the highlighted fields to continue.
        </Text>
      ) : null}

      <Pressable style={[f.primary, (busy || Boolean(blockedReason)) && f.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={f.primaryText}>{mode === "create" ? "Save customer" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[f.danger, busy && f.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={f.dangerText}>Delete customer</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
