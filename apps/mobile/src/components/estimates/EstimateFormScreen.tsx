import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Check, ChevronDown, ChevronUp, Hammer, Package, Plus, Ruler, Trash2, Wrench } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown, type SelectOption } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OptionOrOtherField } from "@/components/ui/OptionOrOtherField";
import { formStyles as f } from "@/components/ui/formStyles";
import { SiteScopeField, useSiteScope } from "@/components/sites/SiteScopeField";
import { useMaterials, useTools } from "@/hooks/useApi";
import {
  GST_OPTIONS,
  KIND_LABEL,
  estimateTotals,
  gstPercentFrom,
  lineAmount,
  lineCost,
  lineErrors,
  lineFromApi,
  lineQuantity,
  lineToApi,
  newLine,
  unitOptions,
  type EstimateLine,
  type LineKind,
} from "@/lib/estimates";
import { formatCurrency, formatDate } from "@/lib/format";
import { materialSelectOptions } from "@/lib/materialOptions";
import { formatQty, measurementLineOptions, measurementTitle } from "@/lib/measurements";
import { WORK_TYPES, estimateAutoTitle, workTypeLabel } from "@/lib/workflow";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export type EstimateValues = {
  customerId: string;
  siteId: string;
  surveyId: string;
  measurementId: string;
  workType: string;
  title: string;
  lines: EstimateLine[];
  gstPercent: string;
  discount: string;
  assumptions: string;
  paymentTerms: string;
};

export function emptyEstimate(customerId?: string, siteId?: string, defaultGst?: string): EstimateValues {
  return {
    customerId: customerId || "",
    siteId: siteId || "",
    surveyId: "",
    measurementId: "",
    workType: "",
    title: "",
    lines: [],
    gstPercent: defaultGst?.trim() || "18",
    discount: "",
    assumptions: "",
    paymentTerms: "",
  };
}

export function estimateValuesFrom(e: AthenaRecord): EstimateValues {
  const items = (Array.isArray(e.items) ? e.items : []) as Record<string, unknown>[];
  const discount = Number(e.discount || 0);
  return {
    customerId: String(e.customerId || ""),
    siteId: String(e.siteId || ""),
    surveyId: String(e.surveyId || ""),
    measurementId: String(e.measurementId || ""),
    workType: String(e.workType || ""),
    title: String(e.title || ""),
    lines: items.map(lineFromApi),
    gstPercent: gstPercentFrom(e.taxRate),
    discount: discount > 0 ? String(discount) : "",
    assumptions: String(e.assumptions || ""),
    paymentTerms: String(e.paymentTerms || ""),
  };
}

export function estimateBody(v: EstimateValues) {
  return {
    customerId: v.customerId,
    siteId: v.siteId,
    surveyId: v.surveyId || null,
    measurementId: v.measurementId || null,
    workType: v.workType && v.workType !== "other" ? v.workType.trim() : null,
    title: v.title.trim(),
    items: v.lines.map(lineToApi),
    taxRate: String((Number(v.gstPercent) || 0) / 100),
    discount: v.discount.trim() || "0",
    assumptions: v.assumptions.trim() || null,
    paymentTerms: v.paymentTerms.trim() || null,
  };
}

type Props = {
  mode: "create" | "edit";
  number?: string;
  version?: number;
  initial: EstimateValues | null;
  siteLocked: boolean;
  customerFixed?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  lockedReason?: string;
  saving: boolean;
  onBack: () => void;
  onAddSite?: (customerId: string) => void;
  onAddMeasurement?: (siteId: string, customerId: string) => void;
  onSubmit: (values: EstimateValues) => Promise<void>;
};

export function EstimateFormScreen(props: Props) {
  const { mode, number, version, initial, loading, loadError, onRetry, onBack, lockedReason } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title={mode === "create" ? "New estimate" : "Edit estimate"}
            subtitle={mode === "create" ? "Work, materials and tool charges" : [number, version ? `saving as v${version + 1}` : ""].filter(Boolean).join(" · ") || undefined}
            onBack={onBack}
          />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {lockedReason ? (
            <View style={f.warn}>
              <Text style={f.warnText}>{lockedReason}</Text>
            </View>
          ) : null}
          {initial && !lockedReason ? <EstimateFields {...props} initial={initial} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function EstimateFields({ mode, initial, siteLocked, customerFixed, saving, onSubmit, onAddSite, onAddMeasurement }: Props & { initial: EstimateValues }) {
  const [values, setValues] = useState<EstimateValues>(initial);
  const [titleTouched, setTitleTouched] = useState(Boolean(initial.title));
  const [workTypeTouched, setWorkTypeTouched] = useState(Boolean(initial.workType));
  const [submitted, setSubmitted] = useState(false);
  const scope = useSiteScope(values.customerId, values.siteId);
  const materialsQ = useMaterials();
  const toolsQ = useTools();

  const set = <K extends keyof EstimateValues>(key: K, value: EstimateValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const siteName = scope.site ? String(scope.site.name || "") : "";
  const siteSurveys = useMemo(
    () =>
      ((scope.summary?.surveys as AthenaRecord[]) || [])
        .filter((s) => String(s.siteId || "") === values.siteId)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    [scope.summary, values.siteId],
  );
  const siteMeasurements = useMemo(
    () =>
      ((scope.summary?.measurements as AthenaRecord[]) || [])
        .filter((m) => String(m.siteId || "") === values.siteId)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    [scope.summary, values.siteId],
  );

  // New estimates start from the site's latest survey and measurement.
  useEffect(() => {
    if (mode !== "create") return;
    setValues((prev) => {
      const next = { ...prev };
      if (!prev.surveyId && siteSurveys[0]) next.surveyId = String(siteSurveys[0].id);
      if (!prev.measurementId && siteMeasurements[0]) next.measurementId = String(siteMeasurements[0].id);
      return next.surveyId === prev.surveyId && next.measurementId === prev.measurementId ? prev : next;
    });
  }, [mode, siteSurveys, siteMeasurements]);

  const survey = siteSurveys.find((s) => String(s.id) === values.surveyId);
  useEffect(() => {
    if (!workTypeTouched && survey?.projectType) setValues((prev) => (prev.workType ? prev : { ...prev, workType: String(survey.projectType) }));
  }, [survey, workTypeTouched]);

  const autoTitle = estimateAutoTitle({ workType: values.workType, siteName });
  useEffect(() => {
    if (!titleTouched && siteName) setValues((prev) => (prev.title === autoTitle ? prev : { ...prev, title: autoTitle }));
  }, [autoTitle, titleTouched, siteName]);

  const materials = useMemo(
    () =>
      (materialsQ.data?.items ?? [])
        .filter((m) => m.active !== false)
        .map((m) => ({
          id: String(m.id),
          name: String(m.name || m.sku || "Material"),
          unit: m.unit ? String(m.unit) : undefined,
          purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
          selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
        })),
    [materialsQ.data?.items],
  );
  const materialOptions = useMemo(() => materialSelectOptions(materials), [materials]);
  const tools = toolsQ.data?.items ?? [];
  const toolOptions: SelectOption[] = useMemo(
    () => tools.map((t) => ({ id: String(t.id), label: String(t.name || "Tool"), detail: t.qty != null ? `${String(t.qty)} in store` : undefined })),
    [tools],
  );

  const surveyOptions = siteSurveys.map((s) => ({
    id: String(s.id),
    label: `${workTypeLabel(s.projectType) || "Survey"}${s.number ? ` · ${String(s.number)}` : ""}`,
    detail: formatDate(String(s.date || s.createdAt || "")),
  }));
  const measurementOptions = siteMeasurements.map((m) => ({ id: String(m.id), label: measurementTitle(m), detail: formatDate(String(m.createdAt || "")) }));
  const selectedMeasurement = siteMeasurements.find((m) => String(m.id) === values.measurementId);
  const quantityOptions = selectedMeasurement ? measurementLineOptions([selectedMeasurement]) : [];

  const gstOptions = GST_OPTIONS.some((o) => o.id === values.gstPercent) ? GST_OPTIONS : [...GST_OPTIONS, { id: values.gstPercent, label: `GST ${values.gstPercent}%` }];
  const totals = estimateTotals(values.lines, values.discount, values.gstPercent);
  const errors = submitted ? validate(values, totals.gross) : {};

  function updateLine(key: string, patch: Partial<EstimateLine>) {
    setValues((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  }
  function addLine(kind: LineKind, patch: Partial<EstimateLine> = {}) {
    setValues((prev) => ({ ...prev, lines: [...prev.lines, newLine(kind, patch)] }));
  }
  function removeLine(key: string) {
    setValues((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== key) }));
  }

  function addFromMeasurement(opt: (typeof quantityOptions)[number]) {
    const groupLabel = opt.label.split(" — ")[0];
    addLine("work", {
      description: values.workType && values.workType !== "other" ? `${workTypeLabel(values.workType)} — ${groupLabel}` : opt.description,
      quantity: String(opt.quantity),
      unit: opt.unit,
      measurementId: opt.measurementId,
      measurementItemId: opt.group,
    });
    Toast.show({ type: "success", text1: `${groupLabel} added`, text2: `${formatQty(opt.quantity)} ${opt.unit} — enter the rate per ${opt.unit}.` });
  }

  async function submit() {
    setSubmitted(true);
    const e = validate(values, totals.gross);
    if (Object.keys(e).length) {
      Toast.show({ type: "error", text1: "Check the estimate", text2: e.lines || e.siteId || e.title || e.discount || "Some fields need attention." });
      return;
    }
    await onSubmit(values);
  }

  const sections: { kind: LineKind; title: string; hint: string; icon: React.ReactNode; add: string }[] = [
    { kind: "work", title: "Work", hint: "Measured work priced per unit (labour + finish).", icon: <Hammer size={16} color={p.clayDark} />, add: "Add work item" },
    { kind: "material", title: "Materials", hint: "Materials billed separately, in the material's own unit.", icon: <Package size={16} color={p.clayDark} />, add: "Add material" },
    { kind: "tool", title: "Tool & equipment charges", hint: "Hire charges: units × days × rate per day.", icon: <Wrench size={16} color={p.clayDark} />, add: "Add tool charge" },
  ];

  return (
    <View>
      <View style={f.card}>
        <Text style={f.cardTitle}>Site & scope</Text>
        <Text style={f.cardHint}>Estimates always belong to a site.</Text>
        <SiteScopeField
          customerId={values.customerId}
          siteId={values.siteId}
          locked={siteLocked}
          customerFixed={customerFixed}
          error={errors.siteId}
          onChange={(next) => setValues((prev) => ({ ...prev, ...next, surveyId: "", measurementId: "" }))}
          onAddSite={onAddSite}
        />
        <OptionOrOtherField
          label="Type of work"
          options={WORK_TYPES}
          value={values.workType}
          onChange={(v) => {
            setWorkTypeTouched(true);
            set("workType", v);
          }}
          placeholder="Select type of work"
          otherLabel="Describe the type of work"
          otherPlaceholder="e.g. Wallpaper installation"
        />
        {values.siteId && surveyOptions.length ? (
          <FormField label="Based on survey">
            <SelectDropdown options={surveyOptions} value={values.surveyId} onChange={(v) => set("surveyId", v)} placeholder="Select survey" clearLabel="Not linked to a survey" />
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
          placeholder="e.g. Interior painting — 2BHK"
        />
      </View>

      {values.siteId ? (
        <View style={f.card}>
          <View style={styles.cardHead}>
            <Ruler size={16} color={p.clayDark} />
            <Text style={f.cardTitle}>Quantities from measurement</Text>
          </View>
          {measurementOptions.length ? (
            <>
              <Text style={f.cardHint}>Tap a surface to add it as a work item, then enter the rate.</Text>
              <FormField label="Measurement">
                <SelectDropdown options={measurementOptions} value={values.measurementId} onChange={(v) => set("measurementId", v)} placeholder="Select measurement" clearLabel="Don't use a measurement" />
              </FormField>
              {quantityOptions.length ? (
                <View style={styles.qtyWrap}>
                  {quantityOptions.map((opt) => {
                    const added = values.lines.some((l) => l.measurementId === opt.measurementId && l.measurementItemId === opt.group);
                    return (
                      <Pressable key={opt.id} style={[styles.qtyChip, added && styles.qtyChipOn]} onPress={() => addFromMeasurement(opt)} accessibilityRole="button">
                        {added ? <Check size={14} color={p.green} strokeWidth={3} /> : <Plus size={14} color={p.clayDark} strokeWidth={3} />}
                        <Text style={[styles.qtyText, added && { color: p.green }]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : selectedMeasurement ? (
                <Text style={styles.muted}>This measurement has no quantities yet.</Text>
              ) : null}
            </>
          ) : (
            <View style={{ paddingBottom: spacing.md }}>
              <Text style={f.cardHint}>No measurement for this site yet. Measure first for accurate quantities, or enter them below.</Text>
              {onAddMeasurement ? (
                <Pressable onPress={() => onAddMeasurement(values.siteId, scope.customerId || values.customerId)}>
                  <Text style={f.warnLink}>+ Record a measurement</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {sections.map((section) => {
        const lines = values.lines.filter((l) => l.kind === section.kind);
        const subtotal = totals[section.kind];
        return (
          <View key={section.kind} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>{section.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionHint}>{section.hint}</Text>
              </View>
              {subtotal > 0 ? <Text style={styles.sectionTotal}>{formatCurrency(subtotal)}</Text> : null}
            </View>
            {lines.map((line, i) => (
              <LineCard
                key={line.key}
                line={line}
                index={i}
                errors={submitted ? lineErrors(line) : {}}
                materials={materials}
                materialOptions={materialOptions}
                tools={tools}
                toolOptions={toolOptions}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() => removeLine(line.key)}
              />
            ))}
            <Pressable style={styles.addBtn} onPress={() => addLine(section.kind)} accessibilityRole="button">
              <Plus size={16} color={p.clayDark} strokeWidth={2.6} />
              <Text style={styles.addText}>{section.add}</Text>
            </Pressable>
          </View>
        );
      })}
      {errors.lines && !values.lines.length ? <Text style={styles.err}>{errors.lines}</Text> : null}

      <View style={[f.card, { marginTop: 4 }]}>
        <Text style={f.cardTitle}>Tax & discount</Text>
        <Text style={f.cardHint}>Discount is taken off before GST.</Text>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <FormField label="GST">
              <SelectDropdown options={gstOptions} value={values.gstPercent} onChange={(v) => set("gstPercent", v || "0")} placeholder="GST" />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              label="Discount (₹)"
              value={values.discount}
              onChangeText={(v) => set("discount", v.replace(/[^\d.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0"
              error={errors.discount}
            />
          </View>
        </View>
      </View>

      <View style={styles.summary}>
        <SumRow label="Work" value={totals.work} />
        <SumRow label="Materials" value={totals.material} />
        <SumRow label="Tool charges" value={totals.tool} />
        {totals.discount > 0 ? <SumRow label="Discount" value={-totals.discount} /> : null}
        <SumRow label="Taxable amount" value={totals.taxable} />
        {totals.gst > 0 ? <SumRow label={`GST ${values.gstPercent}%`} value={totals.gst} /> : null}
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Estimate total</Text>
          <Text style={styles.grandValue}>{formatCurrency(totals.grand)}</Text>
        </View>
        {totals.cost > 0 ? (
          <Text style={styles.internal}>
            Internal cost {formatCurrency(totals.cost)} · Profit {formatCurrency(totals.profit)}
            {totals.taxable > 0 ? ` (${Math.round((totals.profit / totals.taxable) * 100)}%)` : ""} — not shown to the customer
          </Text>
        ) : null}
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>Notes & terms</Text>
        <Text style={f.cardHint}>Printed on the estimate PDF.</Text>
        <FormField label="Assumptions" value={values.assumptions} onChangeText={(v) => set("assumptions", v)} multiline placeholder="e.g. Furniture moved by the customer; 2 coats of emulsion" />
        <FormField label="Payment terms" value={values.paymentTerms} onChangeText={(v) => set("paymentTerms", v)} multiline placeholder="e.g. 40% advance, 50% on progress, 10% on completion" />
      </View>

      <Pressable style={[f.primary, saving && f.disabled]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>{mode === "create" ? "Create estimate" : "Save new version"}</Text>}
      </Pressable>
    </View>
  );
}

type MaterialOpt = { id: string; name: string; unit?: string; purchase?: string; selling?: string };

function LineCard({
  line,
  index,
  errors,
  materials,
  materialOptions,
  tools,
  toolOptions,
  onChange,
  onRemove,
}: {
  line: EstimateLine;
  index: number;
  errors: ReturnType<typeof lineErrors>;
  materials: MaterialOpt[];
  materialOptions: SelectOption[];
  tools: AthenaRecord[];
  toolOptions: SelectOption[];
  onChange: (patch: Partial<EstimateLine>) => void;
  onRemove: () => void;
}) {
  const hasCost = Boolean(line.labourCost || line.materialCost || line.equipmentCost || line.otherCost);
  const [showCost, setShowCost] = useState(hasCost);
  const bad = Object.keys(errors).length > 0;
  const amount = lineAmount(line);
  const qty = lineQuantity(line);
  const cleanNum = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

  function pickMaterial(id: string) {
    const m = materials.find((x) => x.id === id);
    if (!m) {
      onChange({ catalogMaterialId: "", unitPurchase: "" });
      return;
    }
    onChange({
      catalogMaterialId: m.id,
      description: m.name,
      unit: m.unit || line.unit,
      rate: m.selling || line.rate,
      unitPurchase: m.purchase || "",
      materialCost: "",
    });
    if (!m.selling) Toast.show({ type: "info", text1: "No selling price in catalog", text2: `Enter the rate per ${m.unit || "unit"} for ${m.name}.` });
  }

  function pickTool(id: string) {
    const t = tools.find((x) => String(x.id) === id);
    onChange(t ? { toolId: String(t.id), description: String(t.name || "Tool") } : { toolId: "" });
  }

  return (
    <View style={[styles.line, bad && styles.lineError]}>
      <View style={styles.lineHead}>
        <Text style={styles.lineNo}>
          {KIND_LABEL[line.kind]} {index + 1}
        </Text>
        <Text style={styles.lineAmount}>{formatCurrency(amount)}</Text>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Remove line">
          <Trash2 size={16} color={p.red} />
        </Pressable>
      </View>

      {line.kind === "material" ? (
        <FormField label="From catalog">
          <SelectDropdown
            options={materialOptions}
            value={line.catalogMaterialId}
            onChange={pickMaterial}
            placeholder="Select material"
            clearLabel="Not in catalog"
            searchPlaceholder="Search materials"
            emptyText="No materials in your catalog yet — type the name below."
          />
        </FormField>
      ) : null}
      {line.kind === "tool" ? (
        <FormField label="Tool">
          <SelectDropdown
            options={toolOptions}
            value={line.toolId}
            onChange={pickTool}
            placeholder="Select tool"
            clearLabel="Not in tool list"
            searchPlaceholder="Search tools"
            emptyText="No tools added yet — type the name below."
          />
        </FormField>
      ) : null}

      <FormField
        label={line.kind === "work" ? "Work description" : line.kind === "material" ? "Material name" : "Tool / equipment"}
        required
        value={line.description}
        onChangeText={(v) => onChange({ description: v })}
        error={errors.description}
        placeholder={line.kind === "work" ? "e.g. Interior emulsion — walls, 2 coats" : line.kind === "material" ? "e.g. Asian Royale 20L" : "e.g. Scaffolding"}
      />

      {line.kind === "tool" ? (
        <View style={styles.row3}>
          <NumField label="Units" value={line.toolUnits} error={errors.toolUnits} onChange={(v) => onChange({ toolUnits: v.replace(/\D/g, "") })} integer />
          <NumField label="Days" value={line.days} error={errors.days} onChange={(v) => onChange({ days: cleanNum(v) })} />
          <NumField label="Rate / day ₹" value={line.rate} error={errors.rate} onChange={(v) => onChange({ rate: cleanNum(v) })} />
        </View>
      ) : (
        <View style={styles.row3}>
          <NumField label="Quantity" value={line.quantity} error={errors.quantity} onChange={(v) => onChange({ quantity: cleanNum(v) })} />
          <View style={styles.cell}>
            <Text style={styles.numLabel}>Unit</Text>
            <SelectDropdown options={unitOptions(line.kind, line.unit)} value={line.unit} onChange={(v) => onChange({ unit: v || line.unit })} placeholder="Unit" />
          </View>
          <NumField label={`Rate ₹/${line.unit === "ls" ? "job" : line.unit}`} value={line.rate} error={errors.rate} onChange={(v) => onChange({ rate: cleanNum(v) })} />
        </View>
      )}

      <Text style={styles.calc}>
        {line.kind === "tool"
          ? `${line.toolUnits || 0} × ${line.days || 0} days × ${formatCurrency(Number(line.rate) || 0)} = ${formatCurrency(amount)}`
          : `${formatQty(qty)} ${line.unit} × ${formatCurrency(Number(line.rate) || 0)} = ${formatCurrency(amount)}`}
      </Text>

      {line.kind === "material" && line.unitPurchase ? (
        <Text style={styles.costNote}>
          Purchase {formatCurrency(Number(line.unitPurchase))}/{line.unit} · cost {formatCurrency(lineCost(line))}
        </Text>
      ) : null}

      {line.kind === "work" ? (
        <>
          <Pressable style={styles.costToggle} onPress={() => setShowCost((s) => !s)}>
            <Text style={styles.costToggleText}>Internal cost (optional)</Text>
            {showCost ? <ChevronUp size={14} color={p.muted} /> : <ChevronDown size={14} color={p.muted} />}
          </Pressable>
          {showCost ? (
            <View style={[styles.row3, { marginTop: 6 }]}>
              <NumField label="Labour ₹" value={line.labourCost} onChange={(v) => onChange({ labourCost: cleanNum(v) })} />
              <NumField label="Material ₹" value={line.materialCost} onChange={(v) => onChange({ materialCost: cleanNum(v) })} />
              <NumField label="Other ₹" value={line.otherCost} onChange={(v) => onChange({ otherCost: cleanNum(v) })} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function NumField({ label, value, error, onChange, integer }: { label: string; value: string; error?: string; onChange: (v: string) => void; integer?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.numLabel} numberOfLines={1}>
        {label}
      </Text>
      <TextInput
        style={[styles.numInput, error && styles.numInputError]}
        value={value}
        onChangeText={onChange}
        keyboardType={integer ? "number-pad" : "decimal-pad"}
        placeholder="0"
        placeholderTextColor={p.faint}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.cellErr}>{error}</Text> : null}
    </View>
  );
}

function SumRow({ label, value }: { label: string; value: number }) {
  if (!value && label !== "Taxable amount") return null;
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value < 0 ? `− ${formatCurrency(-value)}` : formatCurrency(value)}</Text>
    </View>
  );
}

function validate(v: EstimateValues, gross: number) {
  const e: Partial<Record<"siteId" | "title" | "lines" | "discount", string>> = {};
  if (!v.siteId) e.siteId = "Select the site this estimate is for";
  if (!v.title.trim()) e.title = "Give the estimate a title";
  if (!v.lines.length) e.lines = "Add at least one work item, material or tool charge";
  else if (v.lines.some((l) => Object.keys(lineErrors(l)).length)) e.lines = "Some lines are missing a description, quantity or rate";
  const discount = Number(v.discount || 0);
  if (v.discount.trim() && (!Number.isFinite(discount) || discount < 0)) e.discount = "Enter a valid amount";
  else if (discount > gross) e.discount = "Discount can't be more than the subtotal";
  return e;
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  muted: { color: p.muted, fontSize: 13, marginBottom: spacing.md },
  qtyWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4, marginBottom: spacing.md },
  qtyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  qtyChipOn: { borderColor: "#BBF7D0", backgroundColor: p.greenSoft },
  qtyText: { color: p.clayDark, fontWeight: "700", fontSize: 13 },
  section: { marginBottom: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: p.text, fontWeight: "800", fontSize: 16 },
  sectionHint: { color: p.muted, fontSize: 12 },
  sectionTotal: { color: p.text, fontWeight: "800" },
  line: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: 12, paddingBottom: 10, marginBottom: 8 },
  lineError: { borderColor: p.red },
  lineHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  lineNo: { flex: 1, color: p.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 },
  lineAmount: { color: p.text, fontWeight: "800", fontSize: 15 },
  iconBtn: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: p.redSoft },
  row2: { flexDirection: "row", gap: 10 },
  row3: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, minWidth: 0 },
  numLabel: { color: p.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  numInput: {
    borderWidth: 1,
    borderColor: p.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 11,
    color: p.text,
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: p.surface,
  },
  numInputError: { borderColor: p.red, backgroundColor: "#FFFBFB" },
  cellErr: { color: p.red, fontSize: 11, fontWeight: "600", marginTop: 3 },
  calc: { color: p.clayDark, fontWeight: "700", fontSize: 13, marginTop: 10 },
  costNote: { color: p.muted, fontSize: 12, marginTop: 4 },
  costToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, alignSelf: "flex-start" },
  costToggleText: { color: p.muted, fontWeight: "700", fontSize: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: p.clayMid,
    backgroundColor: p.surface,
  },
  addText: { color: p.clayDark, fontWeight: "800" },
  err: { color: p.red, fontSize: 12, fontWeight: "600", marginBottom: 10 },
  summary: { backgroundColor: p.text, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sumLabel: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
  sumValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)", marginTop: 8, paddingTop: 10 },
  grandLabel: { color: "#fff", fontWeight: "800", fontSize: 16 },
  grandValue: { color: "#fff", fontWeight: "800", fontSize: 22 },
  internal: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 8 },
});
