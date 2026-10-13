import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (count, err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // One retry on 401 covers residual cold-start races after Firebase restores.
        if (status === 401) return count < 1;
        // Other 4xx (403, 404, 422…) are deterministic; retrying only duplicates the request.
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
        return count < 1;
      },
      retryDelay: (attempt) => (attempt === 0 ? 400 : 1000),
    },
  },
});
