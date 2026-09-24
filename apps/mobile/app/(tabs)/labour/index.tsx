import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { useLabour } from "@/hooks/useApi";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

type Tab = "workers" | "crews";

/**
 * One People module: Workers (labour day rates) + Crews (name + linked workers).
 * Create crew / link labour: /(tabs)/more/crews/new and /(tabs)/more/crews/[id]
 */
export default function PeopleScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("workers");
  const labour = useLabour();
  const crews = useQuery({
    queryKey: ["crews"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/crews");
      return data;
    },
  });

  const workers = labour.data?.items ?? [];
  const crewItems = crews.data?.items ?? [];

  if (tab === "crews") {
    return (
      <ModuleListScreen
        title="People"
        subtitle="Workers & crews"
        items={crewItems}
        loading={crews.isLoading}
        refreshing={crews.isRefetching}
        errorMessage={crews.isError ? (crews.error as { userMessage?: string })?.userMessage : undefined}
        onBack={() => router.back()}
        onRetry={() => crews.refetch()}
        onRefresh={() => crews.refetch()}
        onAdd={() => router.push("/(tabs)/more/crews/new" as never)}
        emptyTitle="No crews yet"
        emptySubtitle="Create a crew, then tap workers to link them to the roster."
        headerExtra={
          <SegmentTabs
            padded={false}
            tabs={[
              { key: "workers", label: "Workers" },
              { key: "crews", label: "Crews" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
        renderItem={(item) => {
          const members = Array.isArray(item.members) ? item.members : [];
          const memberBit =
            members.length === 0
              ? "No labour linked"
              : `${members.length} worker${members.length === 1 ? "" : "s"}`;
          return (
            <RecordCard
              title={String(item.name || item.id)}
              subtitle={`${String(item.trade || "Crew")} · ${memberBit}`}
              onPress={() => router.push(`/(tabs)/more/crews/${String(item.id)}` as never)}
            />
          );
        }}
      />
    );
  }

  return (
    <ModuleListScreen
      title="People"
      subtitle="Workers & crews"
      items={workers}
      loading={labour.isLoading}
      refreshing={labour.isRefetching}
      errorMessage={labour.isError ? (labour.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => labour.refetch()}
      onRefresh={() => labour.refetch()}
      onAdd={() => router.push("/(tabs)/labour/new" as never)}
      emptyTitle="No workers yet"
      emptySubtitle="Add painters, masons, helpers — then build crews from them."
      headerExtra={
        <SegmentTabs
          padded={false}
          tabs={[
            { key: "workers", label: "Workers" },
            { key: "crews", label: "Crews" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={String(item.trade || item.skill || "")}
          meta={`${item.phone || ""} · ₹${item.dailyRate || "—"}/day`}
          onPress={() => router.push(`/(tabs)/labour/${item.id}` as never)}
        />
      )}
    />
  );
}
