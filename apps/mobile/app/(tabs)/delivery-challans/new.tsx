import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateDeliveryChallan, useCustomers, useProjects } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DocumentFormChrome, DocSection } from "@/components/ui/DocumentFormChrome";
import { DateField } from "@/components/ui/DateField";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Line = { id: string; description: string; quantity: string; unit: string };

function newId() {
  return `dc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export default function NewDeliveryChallan() {
  const router = useRouter();
  const customers = useCustomers();
  const projects = useProjects();
  const create = useCreateDeliveryChallan();
  const customerItems = customers.data?.items ?? [];
  const projectItems = projects.data?.items ?? [];

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ id: newId(), description: "", quantity: "1", unit: "pcs" }]);

  useEffect(() => {
    if (!customerId && customerItems[0]?.id) setCustomerId(String(customerItems[0].id));
  }, [customerItems, customerId]);

  const canSave = useMemo(
    () => Boolean(customerId && lines.some((l) => l.description.trim())),
    [customerId, lines],
  );

  async function submit() {
    try {
      const doc = await create.mutateAsync({
        customerId,
        projectId: projectId || undefined,
        date,
        vehicleNumber: vehicleNumber || undefined,
        receiverName: receiverName || undefined,
        notes: notes || undefined,
        items: lines
          .filter((l) => l.description.trim())
          .map((l) => ({ description: l.description.trim(), quantity: l.quantity || "1", unit: l.unit || "pcs" })),
        status: "draft",
      });
      Toast.show({ type: "success", text1: "Challan saved" });
      router.replace(`/(tabs)/delivery-challans/${doc.id}`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New challan" subtitle="Outbound delivery" onBack={() => router.back()} />
        <DocumentFormChrome
          title="Delivery challan"
          subtitle="Customer, vehicle, lines — save as draft."
          accent="green"
          footerLabel="Save draft"
          footerBusy={create.isPending}
          footerDisabled={!canSave}
          onFooterPress={submit}
        >
          <DocSection title="Details">
            <Text style={styles.label}>Customer</Text>
            <View style={styles.chips}>
              {customerItems.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, customerId === c.id && styles.chipOn]}
                  onPress={() => setCustomerId(String(c.id))}
                >
                  <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]} numberOfLines={1}>
                    {String(c.name || c.id)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Project (optional)</Text>
            <View style={styles.chips}>
              <Pressable style={[styles.chip, !projectId && styles.chipOn]} onPress={() => setProjectId("")}>
                <Text style={[styles.chipText, !projectId && styles.chipTextOn]}>None</Text>
              </Pressable>
              {projectItems.slice(0, 12).map((pItem) => (
                <Pressable
                  key={pItem.id}
                  style={[styles.chip, projectId === pItem.id && styles.chipOn]}
                  onPress={() => setProjectId(String(pItem.id))}
                >
                  <Text style={[styles.chipText, projectId === pItem.id && styles.chipTextOn]} numberOfLines={1}>
                    {String(pItem.name || pItem.number || pItem.id)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <DateField label="Date" value={date} onChange={setDate} />
            <Text style={styles.label}>Vehicle number</Text>
            <TextInput
              style={styles.input}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder="KA-01-AB-1234"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Receiver name</Text>
            <TextInput style={styles.input} value={receiverName} onChangeText={setReceiverName} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={p.faint}
            />
          </DocSection>

          <DocSection title="Line items">
            {lines.map((line, idx) => (
              <View key={line.id} style={styles.lineCard}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineTitle}>Line {idx + 1}</Text>
                  <Pressable onPress={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== line.id) : prev))}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={line.description}
                  onChangeText={(v) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, description: v } : l)))}
                  placeholderTextColor={p.faint}
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Qty</Text>
                    <TextInput
                      style={styles.input}
                      value={line.quantity}
                      onChangeText={(v) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity: v } : l)))}
                      keyboardType="decimal-pad"
                      placeholderTextColor={p.faint}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      value={line.unit}
                      onChangeText={(v) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, unit: v } : l)))}
                      placeholderTextColor={p.faint}
                    />
                  </View>
                </View>
              </View>
            ))}
            <Pressable
              onPress={() => setLines((prev) => [...prev, { id: newId(), description: "", quantity: "1", unit: "pcs" }])}
            >
              <Text style={styles.addLine}>+ Add line</Text>
            </Pressable>
          </DocSection>
        </DocumentFormChrome>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  lineCard: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    backgroundColor: p.background,
  },
  lineHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineTitle: { fontWeight: "700", color: p.text },
  remove: { color: p.red, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  addLine: { color: p.clay, fontWeight: "700", marginTop: 4 },
});
