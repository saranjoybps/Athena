import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/store";
import { getApiBaseUrl } from "@/lib/config";
import { getIdToken } from "@/lib/firebase";

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseUrl();
  // Waits for Firebase persistence so cold starts never omit the bearer token.
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const user = useAuthStore.getState().user;
  if (user?.orgId) {
    config.headers["X-Organization-Id"] = user.orgId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<{ error?: { message?: string; code?: string }; detail?: string; message?: string }>) => {
    const code = err.response?.data?.error?.code;
    if (err.response?.status === 403 && code === "trial_expired") {
      Toast.show({
        type: "error",
        text1: "Your trial has ended",
        text2: "Request an upgrade from Home, or contact Athena admin.",
      });
    }
    const detail = err.response?.data?.detail as unknown;
    const validationMessage = Array.isArray(detail)
      ? String((detail[0] as { msg?: string } | undefined)?.msg || "").replace(/^Value error,\s*/i, "") || undefined
      : typeof detail === "string"
        ? detail
        : undefined;
    const userMessage =
      err.response?.data?.error?.message ??
      validationMessage ??
      err.response?.data?.message ??
      err.message ??
      "Unknown error";
    return Promise.reject(Object.assign(err, { userMessage }));
  },
);

export default apiClient;
