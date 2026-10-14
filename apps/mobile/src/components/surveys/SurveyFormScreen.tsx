import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { OptionOrOtherField, otherIsBlank } from "@/components/ui/OptionOrOtherField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DateField, todayIsoDate } from "@/components/ui/DateField";
import { formStyles as f } from "@/components/ui/formStyles";
import { SiteScopeField } from "@/components/sites/SiteScopeField";
import { WORK_TYPES } from "@/lib/workflow";
import type { AthenaRecord } from "@/types";
import { lightPalette as p } from "@/lib/theme";

export type SurveyValues = {
  customerId: string;
  siteId: string;
  projectType: string;
  date: string;
  clientRequirements: string;
  existingConditions: string;
  notes: string;
};

type Errors = Partial<Record<keyof SurveyValues, string>>;

export function surveyValuesFrom(s: AthenaRecord): SurveyValues {
  return {
    customerId: String(s.customerId || ""),
    siteId: String(s.siteId || ""),
    projectType: String(s.projectType || ""),
    date: String(s.date || "").slice(0, 10) || todayIsoDate(),
    clientRequirements: String(s.clientRequirements || ""),
    existingConditions: String(s.existingConditions || ""),
    notes: String(s.notes || ""),
  };
}

export function surveyBody(v: SurveyValues): Record<string, unknown> {
  return {
    customerId: v.customerId,
    siteId: v.siteId,
    projectType: v.projectType.trim(),
    date: v.date || null,
    clientRequirements: v.clientRequirements.trim() || null,
    existingConditions: v.existingConditions.trim() || null,
    notes: v.notes.trim() || null,
  };
}

function validate(v: SurveyValues): Errors {
  const e: Errors = {};
  if (!v.siteId) e.siteId = "Select the site this survey is for";
  if (!v.projectType) e.projectType = "Select the type of work";
  else if (otherIsBlank(v.projectType)) e.projectType = "Type the kind of work";
  if (!v.date) e.date = "Pick the survey date";
  if (!v.clientRequirements.trim()) e.clientRequirements = "Note what the customer wants done";
  return e;
}

type Props = {
  mode: "create" | "edit";
  initial: SurveyValues | null;
  number?: string;
  siteLocked: boolean;
  customerFixed?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onAddSite?: (customerId: string) => void;
  onSubmit: (values: SurveyValues) => Promise<void>;
  onDelete?: () => void;
};

export function SurveyFormScreen(props: Props) {
  const { mode, initial, number, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "New survey" : "Survey"} subtitle={number || "Requirements and site condition"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {initial ? <SurveyFields {...props} initial={initial} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function SurveyFields({ mode, initial, number, siteLocked, customerFixed, saving, deleting, onSubmit, onDelete, onAddSite }: Props & { initial: SurveyValues }) {
  const [values, setValues] = useState<SurveyValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values) : {};
  const busy = saving || Boolean(deleting);

  function set<K extends keyof SurveyValues>(key: K, value: SurveyValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length) return;
    await onSubmit(values);
  }

  return (
    <View>
      <View style={f.card}>
        <Text style={f.cardTitle}>Site</Text>
        <Text style={f.cardHint}>Surveys are always recorded for a site.</Text>
        <SiteScopeField
          customerId={values.customerId}
          siteId={values.siteId}
          locked={siteLocked}
          customerFixed={customerFixed}
          error={errors.siteId}
          onChange={(next) => setValues((prev) => ({ ...prev, ...next }))}
          onAddSite={onAddSite}
        />
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>Survey</Text>
        <Text style={f.cardHint}>What the customer wants and what you found on site.</Text>
        <OptionOrOtherField
          label="Type of work"
          required
          options={WORK_TYPES}
          value={values.projectType}
          onChange={(v) => set("projectType", v)}
          error={errors.projectType}
          placeholder="Select work type"
          otherLabel="Describe the type of work"
          otherPlaceholder="e.g. Wallpaper installation"
        />
        <FormField label="Survey date" required error={errors.date}>
          <DateField value={values.date} onChange={(v) => set("date", v)} error={Boolean(errors.date)} />
        </FormField>
        <FormField
          label="Customer requirements"
          required
          value={values.clientRequirements}
          onChangeText={(v) => set("clientRequirements", v)}
          error={errors.clientRequirements}
          multiline
          placeholder="Rooms to cover, colours, finish, timeline, budget"
        />
        <FormField
          label="Existing condition"
          value={values.existingConditions}
          onChangeText={(v) => set("existingConditions", v)}
          multiline
          placeholder="Cracks, dampness, peeling paint, old coats"
        />
        <FormField label="Notes" value={values.notes} onChangeText={(v) => set("notes", v)} multiline placeholder="Anything else to remember" />
      </View>

      <Pressable style={[f.primary, busy && f.disabled]} onPress={submit} disabled={busy}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>{mode === "create" ? "Save survey" : "Save changes"}</Text>}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable
          style={[f.danger, busy && f.disabled]}
          disabled={busy}
          onPress={() =>
            Alert.alert(number ? `Delete survey ${number}?` : "Delete survey?", "This survey will be permanently deleted. Measurements and estimates made from it are kept.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete survey", style: "destructive", onPress: onDelete },
            ])
          }
        >
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={f.dangerText}>Delete survey</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
