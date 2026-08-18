import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { queryKeys, useApiRequest, useTags } from '@/api/hooks';
import type { Tag } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { Swipe } from '@/components/swipe';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_TAG_COLOR, kindLabel } from '@/lib/tags';

/**
 * One tag, in the trades-list row anatomy: a tap (or the leading swipe) opens
 * it for editing, a long press previews the edit form, the trailing swipe
 * deletes it.
 */
function TagRow({ tag, onEdit, onDelete }: { tag: Tag; onEdit: () => void; onDelete: () => void }) {
  return (
    <Swipe resetKey={tag.id}>
      <Swipe.Start>
        <Swipe.Action
          color="info"
          icon={<Icon name="pencil" />}
          label={t`Edit`}
          onPress={onEdit}
        />
      </Swipe.Start>
      <Swipe.End>
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" />}
          label={t`Delete`}
          onPress={onDelete}
        />
      </Swipe.End>
      <Link href={{ pathname: '/tag-form', params: { id: tag.id } }} asChild>
        {/* Link.Trigger clones its child and overwrites `style`, so the
            Pressable stays bare and an inner View carries the row's surface
            (the trade-row rule). */}
        <Link.Trigger>
          <Pressable>
            <View className="flex-row items-center gap-3 rounded-lg bg-card p-4">
              {/* The dot is the tag's own color — the one thing on the row that
                  is data rather than theme, so it stays an inline style. */}
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
              />
              <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
                {tag.name}
              </Text>
              <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                {kindLabel(tag.kind)}
              </Text>
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
      </Link>
    </Swipe>
  );
}

/**
 * Tag management (web JournalTab parity), built as a list rather than a
 * settings form: the tag list is unbounded and a form section renders every
 * row eagerly. Creation lives behind the bar's + button so the screen stays a
 * list; a row's swipe actions edit and delete.
 */
export default function TagsScreen() {
  const router = useRouter();
  // `FlashList` is not a core component Uniwind can take a `className` on, so
  // its content fill has to be a JS value.
  const [background, foreground] = useCSSVariable([
    '--color-background',
    '--color-foreground',
  ]) as [string, string];
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
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight: () => addButton }} />
      {tags.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4 pt-[120px]">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 48, backgroundColor: background }}
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
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListFooterComponent={
            (tags.data ?? []).length > 0 ? (
              // No horizontal inset of its own — the helper text lines up with
              // the card edges above it, not 4pt inside them.
              <Text className="pt-4 text-xs leading-[17px] text-muted-foreground">
                {t`Tags annotate trades with mistakes, habits, and custom labels. Tap a row to edit it, or swipe to delete.`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View className="min-h-[320px]">
              <EmptyState
                title={t`No tags yet`}
                systemImage="tag"
                description={t`Tap + to add one — tags annotate trades with mistakes, habits, and custom labels.`}
              />
            </View>
          }
        />
      )}
    </>
  );
}
