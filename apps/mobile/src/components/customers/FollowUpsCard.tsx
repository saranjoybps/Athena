import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { Check, Plus } from "lucide-react-native";
import { useAddFollowUp, useCompleteFollowUp } from "@/hooks/useApi";
import { FormField } from "@/components/ui/FormField";
import { DateField, todayIsoDate } from "@/components/ui/DateField";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius } from "@/lib/theme";

type FollowUp = Record<string, unknown>;

export function FollowUpsCard({ customerId, followUps }: { customerId: string; followUps: FollowUp[] }) {
  const add = useAddFollowUp();
  const complete = useCompleteFollowUp();
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState(todayIsoDate());
  const [submitted, setSubmitted] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const noteError = submitted && !note.trim() ? "Write what needs to be done" : undefined;
  const today = todayIsoDate();

  async function save() {
    setSubmitted(true);
    if (!note.trim()) return;
    try {
      await add.mutateAsync({ customerId, note: note.trim(), dueAt: dueAt || null });
      Toast.show({ type: "success", text1: "Follow-up added", text2: dueAt ? `Due ${formatDate(dueAt)}` : undefined });
      setNote("");
      setDueAt(todayIsoDate());
      setSubmitted(false);
      setAdding(false);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't add follow-up", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    }
  }

  async function markDone(f: FollowUp) {
    const id = String(f.id);
    setDoneId(id);
    try {
      await complete.mutateAsync({ followUpId: id, customerId });
      Toast.show({ type: "success", text1: "Follow-up completed" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't update follow-up", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    } finally {
      setDoneId(null);
    }
  }

  return (
    <View>
      {followUps.length === 0 && !adding ? <Text style={styles.empty}>No pending follow-ups.</Text> : null}
      {followUps.map((f) => {
        const due = String(f.dueAt || "").slice(0, 10);
        const overdue = Boolean(due) && due < today;
        const dueToday = due === today;
        return (
          <View key={String(f.id)} style={styles.item}>
            <Pressable
              onPress={() => markDone(f)}
              style={styles.check}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mark follow-up done"
              disabled={doneId === String(f.id)}
            >
              {doneId === String(f.id) ? <ActivityIndicator size="small" color={p.clay} /> : <Check size={14} color={p.faint} strokeWidth={3} />}
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.note}>{String(f.note || "")}</Text>
              {due ? (
                <Text style={[styles.due, overdue && { color: p.red }, dueToday && { color: p.clayDark }]}>
                  {overdue ? "Overdue · " : dueToday ? "Due today · " : "Due "}
                  {formatDate(due)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {adding ? (
        <View style={styles.form}>
          <FormField
            label="What needs to be done?"
            required
            value={note}
            onChangeText={setNote}
            error={noteError}
            multiline
            placeholder="e.g. Call to confirm colour shades"
            autoFocus
          />
          <FormField label="Due date">
            <DateField value={dueAt} onChange={setDueAt} />
          </FormField>
          <View style={styles.formActions}>
            <Pressable
              style={styles.cancel}
              onPress={() => {
                setAdding(false);
                setSubmitted(false);
                setNote("");
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.save, add.isPending && { opacity: 0.6 }]} onPress={save} disabled={add.isPending}>
              {add.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add follow-up</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
          <Plus size={16} color={p.clayDark} strokeWidth={2.6} />
          <Text style={styles.addText}>Add follow-up</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: p.muted, fontSize: 13, marginBottom: 10 },
  item: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: p.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  note: { color: p.text, fontWeight: "600", fontSize: 14 },
  due: { color: p.muted, fontSize: 12, marginTop: 3, fontWeight: "600" },
  form: { marginTop: 12 },
  formActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  cancel: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: p.borderStrong },
  cancelText: { color: p.text, fontWeight: "700" },
  save: { flex: 2, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: p.clay },
  saveText: { color: "#fff", fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  addText: { color: p.clayDark, fontWeight: "800" },
});
