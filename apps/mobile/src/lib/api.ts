import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store";
import { getApiBaseUrl } from "@/lib/config";

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Always resolve at request time so Settings overrides apply immediately.
  config.baseURL = getApiBaseUrl();
  const user = useAuthStore.getState().user;
  if (user?.userId) {
    config.headers.Authorization = `Bearer dev:${user.userId}`;
  }
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
