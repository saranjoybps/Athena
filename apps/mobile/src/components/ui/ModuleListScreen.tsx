import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { lightPalette as p, spacing, tabBarClearance, softShadow } from "@/lib/theme";

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
  headerRight?: React.ReactNode;
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
  headerRight,
}: Props<T>) {
  const addBtn = onAdd ? (
    <Pressable
      onPress={onAdd}
      style={styles.addBtn}
      accessibilityRole="button"
      accessibilityLabel={`Add ${title}`}
      hitSlop={8}
    >
      <Plus size={22} color="#fff" strokeWidth={2.6} />
    </Pressable>
  ) : null;

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} right={headerRight ?? addBtn} />
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={p.clay} /> : undefined
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState title={emptyTitle} subtitle={emptySubtitle} actionLabel={onAdd ? "Add new" : undefined} onAction={onAdd} />
            ) : null
          }
          renderItem={({ item }) => renderItem(item)}
        />
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pad: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: tabBarClearance, flexGrow: 1 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
});
