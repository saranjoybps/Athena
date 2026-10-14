import { Linking } from "react-native";
import Toast from "react-native-toast-message";

type Place = { lat?: unknown; lng?: unknown; mapsUrl?: unknown; address?: unknown; pinCode?: unknown } | null | undefined;

/** Google Maps link for a site: exact GPS pin first, then the saved link, then the typed address. */
export function mapsUrlFor(place: Place, fallbackAddress?: string): string {
  if (place?.lat != null && place?.lng != null && place.lat !== "" && place.lng !== "") {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  const saved = String(place?.mapsUrl || "").trim();
  if (saved) return saved;
  const address = [place?.address, place?.pinCode].map((v) => String(v || "").trim()).filter(Boolean).join(" ") || (fallbackAddress || "").trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";
}

export function openMaps(url: string) {
  if (!url) {
    Toast.show({ type: "info", text1: "No location saved", text2: "Add the address or GPS pin on the site." });
    return;
  }
  Linking.openURL(url).catch(() => Toast.show({ type: "error", text1: "Couldn't open maps" }));
}
