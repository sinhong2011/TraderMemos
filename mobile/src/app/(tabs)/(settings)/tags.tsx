import { ContentUnavailableView } from '@expo/ui/swift-ui';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { queryKeys, useApiRequest, useTags } from '@/api/hooks';
import type { Tag } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_TAG_COLOR, kindLabel } from '@/lib/tags';
import { AppHost } from '@/components/app-host';

/** One tag: tap to edit, trailing swipe to delete (the api-tokens idiom). */
function TagRow({ tag, onEdit, onDelete }: { tag: Tag; onEdit: () => void; onDelete: () => void }) {
  const { theme } = useUnistyles();
  const swipeable = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeable.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={t`Delete`}
          style={({ pressed }) => [
            styles.swipeAction,
            { backgroundColor: theme.colors.destructive },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="trash.fill" size={17} tintColor="#FFFFFF" />
          <Text style={styles.swipeLabel} numberOfLines={1}>
            {t`Delete`}
          </Text>
        </Pressable>
      )}
    >
      <Pressable onPress={onEdit} accessibilityRole="button">
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.pressed]}>
            <View style={[styles.dot, { backgroundColor: tag.color || DEFAULT_TAG_COLOR }]} />
            <Text style={styles.rowName} numberOfLines={1}>
              {tag.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {kindLabel(tag.kind)}
            </Text>
          </View>
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/**
 * Tag management (web JournalTab parity), built like api-tokens.tsx rather
 * than as a SwiftUI Form: the tag list is unbounded and a Form Section renders
 * every row eagerly. Creation lives behind the bar's + button so the screen
 * stays a list; rows open the edit sheet, swipe deletes.
 */
export default function TagsScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const tags = useTags();

  const remove = useMutation({
    mutationFn: (tagId: string) => api(`/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tags() }),
    onError: (err) => Alert.alert(t`Could not delete tag`, errorMessage(err)),
  });

  function confirmDelete(tag: Tag) {
    Alert.alert(t`Delete tag?`, t`Removes “${tag.name}” from every trade it annotates.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate(tag.id) },
    ]);
  }

  // Takes precedence over the list's empty state: "No tags yet" on an
  // unreachable server invites the user to recreate tags they already have.
  const loadFailed = tags.isError && tags.data == null;

  const addButton = (
    <Pressable
      onPress={() => router.push('/tag-form')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`New tag`}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
    >
      <Icon name="plus" size={18} tintColor={theme.colors.foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {tags.isLoading ? (
        <View style={[styles.page, styles.skeletonPage]}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : loadFailed ? (
        <ErrorState
          error={tags.error}
          onRetry={() => void tags.refetch()}
          retrying={tags.isRefetching}
        />
      ) : (
        <FlashList
          data={tags.data ?? []}
          keyExtractor={(tag) => tag.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={tags.isRefetching} onRefresh={() => void tags.refetch()} />
          }
          renderItem={({ item }) => (
            <TagRow
              tag={item}
              onEdit={() => router.push({ pathname: '/tag-form', params: { id: item.id } })}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            (tags.data ?? []).length > 0 ? (
              <Text style={styles.footnote}>
                {t`Tags annotate trades with mistakes, habits, and custom labels. Tap a row to edit it, swipe to delete.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <AppHost style={styles.empty}>
              <ContentUnavailableView
                title={t`No tags yet`}
                systemImage="tag"
                description={t`Tap + to add one — tags annotate trades with mistakes, habits, and custom labels.`}
              />
            </AppHost>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  addButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.mutedForeground,
    paddingTop: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: theme.radius.full },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  rowMeta: { fontSize: 13, color: theme.colors.mutedForeground },
  separator: { height: theme.spacing.sm },
  swipeAction: {
    width: 72,
    marginLeft: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.7 },
  swipeLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  empty: { minHeight: 320 },
  skeletonPage: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingTop: 120 },
  skeletonRow: { height: 56, borderRadius: theme.radius.lg },
}));
