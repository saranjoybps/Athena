import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import Toast from "react-native-toast-message";
import { useCreateSite, useCustomers, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { customerPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function NewSite() {
  const { customerId: customerParam } = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const { data } = useCustomers();
  const { data: sitesData } = useSites();
  const create = useCreateSite();
  const customers = data?.items ?? [];
  const [customerId, setCustomerId] = useState(customerParam || "");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [siteType, setSiteType] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => {
    if (customerParam) setCustomerId(customerParam);
  }, [customerParam]);

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(String(customers[0].id));
  }, [customers, customerId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(customerId)),
    [customers, customerId],
  );

  const autoName = useMemo(() => {
    const base = String(selectedCustomer?.name || "").trim() || "Customer";
    const count = (sitesData?.items || []).filter((s) => String(s.customerId) === String(customerId)).length;
    return count > 0 ? `${base} - Site ${count + 1}` : `${base} - Site`;
  }, [selectedCustomer, sitesData?.items, customerId]);

  useEffect(() => {
    if (!nameTouched) setName(autoName);
  }, [autoName, nameTouched]);

  async function useCurrentLocation() {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({ type: "error", text1: "Location permission denied" });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLat = pos.coords.latitude;
      const nextLng = pos.coords.longitude;
      setLat(nextLat);
      setLng(nextLng);
      Toast.show({ type: "success", text1: "Location set" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Could not get location", text2: (e as Error)?.message });
    } finally {
      setLocBusy(false);
    }
  }

  async function submit() {
    if (!customerId || !name.trim() || !location.trim()) {
      Toast.show({ type: "error", text1: "Customer, name, and site location required" });
      return;
    }
    try {
      await create.mutateAsync({
        customerId,
        name: name.trim(),
        address: location.trim(),
        siteType: siteType.trim() || null,
        accessInstructions: accessInstructions.trim() || null,
        lat: lat ?? null,
        lng: lng ?? null,
        mapsUrl: lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : null,
      });
      Toast.show({ type: "success", text1: "Site created" });
      router.replace(customerPath(customerId, "sites") as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="New site"
          onBack={() =>
            router.replace((customerId ? customerPath(customerId, "sites") : "/(tabs)/customers") as never)
          }
        />
        {!customerParam ? (
          <>
            <Text style={styles.label}>Customer</Text>
            <View style={styles.chips}>
              {customers.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, customerId === c.id && styles.chipOn]}
                  onPress={() => {
                    setCustomerId(c.id);
                    setNameTouched(false);
                  }}
                >
                  <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{String(c.name)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.locked}>Adding site for {String(selectedCustomer?.name || "customer")}</Text>
        )}
        <Text style={styles.label}>Site name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(v) => {
            setNameTouched(true);
            setName(v);
          }}
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Site location *</Text>
        <TextInput
          style={[styles.input, { minHeight: 70 }]}
          value={location}
          onChangeText={setLocation}
          multiline
          placeholder="Area, landmark, city…"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Site type</Text>
        <TextInput
          style={styles.input}
          value={siteType}
          onChangeText={setSiteType}
          placeholder="apartment / villa / office"
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>Access instructions</Text>
        <TextInput
          style={[styles.input, { minHeight: 70 }]}
          value={accessInstructions}
          onChangeText={setAccessInstructions}
          multiline
          placeholderTextColor={p.faint}
        />
        <Text style={styles.label}>GPS location</Text>
        <Pressable style={styles.locBtn} onPress={useCurrentLocation} disabled={locBusy}>
          {locBusy ? (
            <ActivityIndicator color={p.clayDark} />
          ) : (
            <Text style={styles.locBtnText}>Use current location</Text>
          )}
        </Pressable>
        {lat != null && lng != null ? (
          <Text style={styles.coords}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.coords}>Optional — capture job site coordinates.</Text>
        )}
        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create site</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  locked: { color: p.muted, marginBottom: 8 },
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
  chip: { borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  locBtn: {
    marginTop: 10,
    backgroundColor: p.claySoft,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: p.clayMid,
  },
  locBtnText: { color: p.clayDark, fontWeight: "700" },
  coords: { color: p.muted, fontSize: 12, marginTop: 6 },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
