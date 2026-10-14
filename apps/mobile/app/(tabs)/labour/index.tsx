import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Phone } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { PeopleTabs, type PeopleTab } from "@/components/people/PeopleTabs";
import { memberIdsFromCrew } from "@/components/people/CrewFormScreen";
import { useCrews, useLabour, usePrefetchDetail } from "@/hooks/useApi";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

type Tab = PeopleTab;

export default function PeopleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "crews" ? "crews" : "workers");
  useEffect(() => {
    if (params.tab === "crews" || params.tab === "workers") setTab(params.tab);
  }, [params.tab]);
  const labour = useLabour();
  const crews = useCrews();
  const prefetch = usePrefetchDetail();

  const tabs = (
    <PeopleTabs
      value={tab}
      onChange={setTab}
      counts={{ workers: labour.data?.items?.length, crews: crews.data?.items?.length }}
    />
  );

  if (tab === "crews") {
    return (
      <ModuleListScreen
        title="People"
        items={crews.data?.items ?? []}
        loading={crews.isLoading}
        refreshing={crews.isRefetching}
        errorMessage={crews.isError ? (crews.error as { userMessage?: string })?.userMessage : undefined}
        onBack={() => router.back()}
        onRetry={() => crews.refetch()}
        onRefresh={() => crews.refetch()}
        onAdd={() => router.push("/(tabs)/labour/crews/new" as never)}
        emptyTitle="No crews yet"
        emptySubtitle="Group your workers into crews for scheduling and attendance."
        headerExtra={tabs}
        renderItem={(item) => (
          <CrewRow
            crew={item}
            onPress={() => {
              prefetch("crews", item.id);
              router.push(`/(tabs)/labour/crews/${String(item.id)}` as never);
            }}
          />
        )}
      />
    );
  }

  return (
    <ModuleListScreen
      title="People"
      items={labour.data?.items ?? []}
      loading={labour.isLoading}
      refreshing={labour.isRefetching}
      errorMessage={labour.isError ? (labour.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => labour.refetch()}
      onRefresh={() => labour.refetch()}
      onAdd={() => router.push("/(tabs)/labour/new" as never)}
      emptyTitle="No workers yet"
      emptySubtitle="Add your first worker to start building crews."
      headerExtra={tabs}
      renderItem={(item) => (
        <WorkerRow
          worker={item}
          onPress={() => {
            prefetch("labour", item.id);
            router.push(`/(tabs)/labour/${String(item.id)}` as never);
          }}
        />
      )}
    />
  );
}

function WorkerRow({ worker, onPress }: { worker: AthenaRecord; onPress: () => void }) {
  const name = String(worker.name || "Unnamed worker");
  const trade = String(worker.trade || worker.skill || "").trim();
  const phone = String(worker.phone || "").trim();
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${trade}`}>
      <Avatar name={name} seed={String(worker.id)} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        {trade ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {trade.charAt(0).toUpperCase() + trade.slice(1)}
          </Text>
        ) : null}
      </View>
      {phone ? (
        <Pressable
          style={styles.iconBtn}
          onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Call ${name}`}
        >
          <Phone size={18} color={p.text} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function CrewRow({ crew, onPress }: { crew: AthenaRecord; onPress: () => void }) {
  const name = String(crew.name || "Unnamed crew");
  const count = memberIdsFromCrew(crew.members).length;
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Avatar name={name} seed={String(crew.id)} variant="group" />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle}>
          {count} worker{count === 1 ? "" : "s"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 16, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
  },
});
