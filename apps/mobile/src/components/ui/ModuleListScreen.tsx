import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, spacing } from "@/lib/theme";

type Props<T extends { id: string }> = {
  title: string;
  subtitle?: string;
  items: T[];
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string;
  onBack?: () => void;
  onRetry?: () => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  emptyTitle: string;
  emptySubtitle?: string;
  renderItem: (item: T) => React.ReactElement | null;
  headerExtra?: React.ReactNode;
};

export function ModuleListScreen<T extends { id: string }>({
  title,
  subtitle,
  items,
  loading,
  refreshing,
  errorMessage,
  onBack,
  onRetry,
  onRefresh,
  onAdd,
  emptyTitle,
  emptySubtitle,
  renderItem,
  headerExtra,
}: Props<T>) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <ScreenHeader
          title={title}
          subtitle={subtitle ?? `${items.length} records`}
          onBack={onBack}
          right={
            onAdd ? (
              <Pressable style={styles.fab} onPress={onAdd} hitSlop={8}>
                <Plus size={20} color="#fff" />
              </Pressable>
            ) : undefined
          }
        />
        {headerExtra}
      </View>
      {errorMessage ? (
        <View style={styles.pad}>
          <ErrorBanner message={errorMessage} onRetry={onRetry} />
        </View>
      ) : null}
      {loading && items.length === 0 ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={p.clay} /> : undefined
        }
        ListEmptyComponent={
          !loading ? <EmptyState title={emptyTitle} subtitle={emptySubtitle} actionLabel={onAdd ? "Add new" : undefined} onAction={onAdd} /> : null
        }
        renderItem={({ item }) => renderItem(item)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  pad: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 48 },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
  },
});
