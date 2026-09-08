import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
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
  (err: AxiosError<{ error?: { message?: string }; detail?: string; message?: string }>) => {
    const userMessage =
      err.response?.data?.error?.message ??
      err.response?.data?.detail ??
      err.response?.data?.message ??
      err.message ??
      "Unknown error";
    return Promise.reject(Object.assign(err, { userMessage }));
  },
);

export default apiClient;
