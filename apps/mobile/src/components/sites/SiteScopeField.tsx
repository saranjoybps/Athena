import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MapPin, UserRound } from "lucide-react-native";
import { useCustomers, useCustomerSummary, useSite } from "@/hooks/useApi";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { customerDisplayName } from "@/lib/customers";
import { lightPalette as p, radius } from "@/lib/theme";

type Row = Record<string, unknown>;

/** Customer + site context for site-scoped records. The customer always follows the site. */
export function useSiteScope(customerId?: string, siteId?: string) {
  const siteQ = useSite(siteId || undefined);
  const resolvedCustomer = customerId || (siteQ.data?.customerId ? String(siteQ.data.customerId) : "");
  const summaryQ = useCustomerSummary(resolvedCustomer || undefined);
  const sites = ((summaryQ.data?.sites as Row[]) || []) as Row[];
  const site = (siteId && (sites.find((s) => String(s.id) === siteId) || siteQ.data)) || null;
  const customer = (summaryQ.data?.customer as Row) || null;
  return { customerId: resolvedCustomer, site: site as Row | null, customer, sites, summary: summaryQ.data, loading: summaryQ.isLoading || siteQ.isLoading };
}

type Props = {
  customerId: string;
  siteId: string;
  /** Opened from a site or editing an existing record — the site can't change. */
  locked: boolean;
  /** Customer was given by the caller; only the site is chosen. */
  customerFixed?: boolean;
  error?: string;
  onChange: (next: { customerId: string; siteId: string }) => void;
  onAddSite?: (customerId: string) => void;
};

export function SiteScopeField({ customerId, siteId, locked, customerFixed, error, onChange, onAddSite }: Props) {
  const scope = useSiteScope(customerId, siteId);
  const customersQ = useCustomers();

  const customerOptions = useMemo(
    () => (customersQ.data?.items ?? []).map((c) => ({ id: String(c.id), label: customerDisplayName(c), detail: String(c.phone || "") || undefined })),
    [customersQ.data?.items],
  );
  const siteOptions = useMemo(
    () => scope.sites.map((s) => ({ id: String(s.id), label: String(s.name || "Site"), detail: String(s.address || "") || undefined })),
    [scope.sites],
  );

  if (locked) {
    return (
      <View style={styles.locked}>
        <View style={styles.row}>
          <MapPin size={16} color={p.clay} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {scope.site ? String(scope.site.name || "Site") : "Loading site…"}
            </Text>
            {scope.site?.address ? (
              <Text style={styles.detail} numberOfLines={2}>
                {String(scope.site.address)}
              </Text>
            ) : null}
          </View>
          {scope.site ? <DirectionsButton place={scope.site} label={String(scope.site.name || "site")} size={32} /> : null}
        </View>
        <View style={[styles.row, styles.divider]}>
          <UserRound size={16} color={p.muted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {scope.customer ? customerDisplayName(scope.customer) : "Customer"}
            </Text>
            {scope.customer?.phone ? <Text style={styles.detail}>{String(scope.customer.phone)}</Text> : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      {customerFixed ? (
        <FormField label="Customer">
          <View style={styles.readonly}>
            <Text style={styles.title}>{scope.customer ? customerDisplayName(scope.customer) : "Customer"}</Text>
          </View>
        </FormField>
      ) : (
        <FormField label="Customer" required>
          <SelectDropdown
            options={customerOptions}
            value={customerId}
            onChange={(v) => onChange({ customerId: v, siteId: "" })}
            placeholder={customersQ.isLoading ? "Loading customers…" : "Select customer"}
            searchPlaceholder="Search customers"
          />
        </FormField>
      )}
      <FormField label="Site" required error={error}>
        <SelectDropdown
          options={siteOptions}
          value={siteId}
          onChange={(v) => onChange({ customerId: scope.customerId || customerId, siteId: v })}
          placeholder={!customerId ? "Select a customer first" : scope.loading ? "Loading sites…" : "Select site"}
          searchPlaceholder="Search sites"
          error={error}
          emptyText={customerId ? "This customer has no sites yet." : "Select a customer first."}
          emptyAction={customerId && onAddSite ? { label: "Add a site", onPress: () => onAddSite(customerId) } : undefined}
        />
      </FormField>
      {customerId && !scope.loading && siteOptions.length === 0 && onAddSite ? (
        <Pressable onPress={() => onAddSite(customerId)} style={styles.addSite}>
          <Text style={styles.addSiteText}>+ Add a site for this customer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { backgroundColor: p.slateSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  divider: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border },
  title: { color: p.text, fontWeight: "700", fontSize: 15 },
  detail: { color: p.muted, fontSize: 12, marginTop: 2 },
  readonly: { backgroundColor: p.slateSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, paddingVertical: 12 },
  addSite: { marginTop: -8, marginBottom: 14 },
  addSiteText: { color: p.clayDark, fontWeight: "800" },
});
