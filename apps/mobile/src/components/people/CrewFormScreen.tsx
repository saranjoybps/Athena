import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { useCrews, useLabour } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MultiSelectDropdown, type DropdownOption } from "@/components/ui/MultiSelectDropdown";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type CrewValues = { name: string; memberIds: string[] };
type Errors = Partial<Record<"name" | "members", string>>;

export function memberIdsFromCrew(members: unknown): string[] {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (!m || typeof m !== "object") return "";
      const row = m as Record<string, unknown>;
      return String(row.labourId || row.workerId || "");
    })
    .filter(Boolean);
}

function nextCrewName(crews: { name?: unknown }[]): string {
  let highest = 0;
  for (const crew of crews) {
    const match = /^crew\s*(\d+)$/i.exec(String(crew.name || "").trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `Crew ${Math.max(highest, crews.length) + 1}`;
}

function validate(v: CrewValues): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter a crew name";
  if (v.memberIds.length === 0) errors.members = "Select at least one worker";
  return errors;
}

type Props = {
  mode: "create" | "edit";
  initial?: CrewValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onAddWorker: () => void;
  onSubmit: (values: CrewValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function CrewFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "New crew" : "Edit crew"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <CrewFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function CrewFields({ mode, initial, saving, deleting, onAddWorker, onSubmit, onDelete }: Props) {
  const labour = useLabour();
  const crews = useCrews();
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEdited, setNameEdited] = useState(mode === "edit");
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);
  const [submitted, setSubmitted] = useState(false);
  const busy = saving || Boolean(deleting);

  const crewsLoaded = crews.isSuccess || crews.isError;
  const suggestedName = useMemo(() => nextCrewName(crews.data?.items ?? []), [crews.data]);
  useEffect(() => {
    if (!nameEdited && crewsLoaded) setName(suggestedName);
  }, [nameEdited, crewsLoaded, suggestedName]);

  const options = useMemo<DropdownOption[]>(
    () =>
      (labour.data?.items ?? []).map((w) => {
        const trade = String(w.trade || w.skill || "").trim();
        const rate = w.dailyRate ? `₹${w.dailyRate}/day` : "";
        return {
          id: String(w.id),
          label: String(w.name || "Unnamed worker"),
          detail: [trade, rate].filter(Boolean).join(" · ") || undefined,
        };
      }),
    [labour.data],
  );

  const values: CrewValues = { name, memberIds };
  const errors = submitted ? validate(values) : {};

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    await onSubmit({ name: name.trim(), memberIds });
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(name.trim() ? `Delete crew "${name.trim()}"?` : "Delete crew?", "This crew will be removed permanently. Its workers stay in your team.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete crew", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <View>
      <View style={styles.card}>
        <FormField
          label="Crew name"
          required
          value={name}
          onChangeText={(v) => {
            setNameEdited(true);
            setName(v);
          }}
          error={errors.name}
          autoCapitalize="words"
        />
        <FormField label="Workers" required error={errors.members}>
          {labour.isLoading ? (
            <ActivityIndicator color={p.clay} style={{ alignSelf: "flex-start", marginVertical: 8 }} />
          ) : (
            <MultiSelectDropdown
              options={options}
              selected={memberIds}
              onChange={setMemberIds}
              placeholder="Select workers"
              noun={{ one: "worker", many: "workers" }}
              error={errors.members}
              emptyText="No workers in your team yet."
              emptyAction={{ label: "Add a worker", onPress: onAddWorker }}
            />
          )}
        </FormField>
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Create crew" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Delete crew</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
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
  danger: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: p.redSoft,
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
