import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateChangeOrder, useProjects } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { formStyles as f } from "@/components/ui/formStyles";
import { formatCurrency } from "@/lib/format";
import { goBackOr, projectPath } from "@/lib/nav";
import { lightPalette as p } from "@/lib/theme";

type Errors = Partial<Record<"projectId" | "reason" | "cost" | "price", string>>;

const money = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

export default function NewChangeOrder() {
  const router = useRouter();
  const { projectId: projectIdParam } = useLocalSearchParams<{ projectId?: string }>();
  const { data } = useProjects();
  const create = useCreateChangeOrder();
  const projects = (data?.items ?? []).filter((pr) => pr.status !== "completed");
  const locked = Boolean(projectIdParam);
  const [projectId, setProjectId] = useState(projectIdParam ? String(projectIdParam) : "");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const errors: Errors = {};
  if (submitted) {
    if (!projectId) errors.projectId = "Choose the project";
    if (!reason.trim()) errors.reason = "Describe the extra work or change";
    if (!(Number(price) > 0)) errors.price = "Enter what the customer will pay";
    if (cost.trim() && !(Number(cost) >= 0)) errors.cost = "Enter a valid cost";
  }
  const project = (data?.items ?? []).find((pr) => String(pr.id) === projectId);
  const back = projectId ? projectPath(projectId, "money") : "/(tabs)/projects";

  async function submit() {
    setSubmitted(true);
    if (!projectId || !reason.trim() || !(Number(price) > 0)) return;
    try {
      await create.mutateAsync({
        projectId,
        reason: reason.trim(),
        additionalScope: scope.trim() || null,
        additionalCost: cost.trim() || "0",
        sellingPrice: price,
      });
      Toast.show({ type: "success", text1: "Change order saved", text2: "Approve it on the project to add it to the contract value." });
      goBackOr(router, back);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't save change order", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    }
  }

  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Change order" subtitle="Extra work outside the estimate" onBack={() => goBackOr(router, back)} />

          <View style={f.card}>
            <Text style={f.cardTitle}>Project</Text>
            <Text style={f.cardHint}>Once approved, the price is added to this project's contract value and can be invoiced.</Text>
            {locked ? (
              <View style={[f.readonly, { marginBottom: 16 }]}>
                <Text style={f.readonlyText}>{project ? String(project.name || project.number) : "Loading…"}</Text>
                {project?.contractValue ? <Text style={f.readonlyDetail}>Current contract {formatCurrency(String(project.contractValue))}</Text> : null}
              </View>
            ) : (
              <FormField label="Project" required error={errors.projectId}>
                <SelectDropdown
                  options={projects.map((pr) => ({ id: String(pr.id), label: String(pr.name || pr.number), detail: pr.number ? String(pr.number) : undefined }))}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Choose a project"
                  error={errors.projectId}
                />
              </FormField>
            )}
          </View>

          <View style={f.card}>
            <Text style={f.cardTitle}>What changed?</Text>
            <Text style={f.cardHint}>Write it the way the customer should read it.</Text>
            <FormField label="Reason" required value={reason} onChangeText={setReason} placeholder="e.g. Customer added false ceiling in hall" error={errors.reason} />
            <FormField label="Extra scope" value={scope} onChangeText={setScope} multiline placeholder="Areas, quantities, materials…" />
          </View>

          <View style={f.card}>
            <Text style={f.cardTitle}>Price</Text>
            <Text style={f.cardHint}>Your cost is internal and is added to the project's estimated cost on approval.</Text>
            <FormField label="Customer price (₹)" required value={price} onChangeText={(v) => setPrice(money(v))} keyboardType="decimal-pad" placeholder="0" error={errors.price} />
            <FormField label="Your cost (₹)" value={cost} onChangeText={(v) => setCost(money(v))} keyboardType="decimal-pad" placeholder="0" error={errors.cost} />
            {Number(price) > 0 && Number(cost) > 0 ? (
              <Text style={{ color: Number(price) >= Number(cost) ? "#15803D" : p.red, fontWeight: "700", marginTop: -6, marginBottom: 16 }}>
                Margin {formatCurrency(Number(price) - Number(cost))}
              </Text>
            ) : null}
          </View>

          <Pressable style={[f.primary, create.isPending && f.disabled]} onPress={submit} disabled={create.isPending}>
            {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>Save change order</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
