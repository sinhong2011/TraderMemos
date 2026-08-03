import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useApiRaw, useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { GlassButton } from '@/components/glass-button';
import { t } from '@lingui/core/macro';
import { getPrefs } from '@/lib/prefs';

/** The server only accepts these; the picker can hand back HEIC on iOS. */
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Trade screenshots — the read-only gallery grown into full manage: add from
 * Photos (multipart POST, field "file"), long-press to remove. Respects the
 * max-screenshots display pref like the web uploader.
 */
export function AttachmentsCard({ trade }: { trade: TradeDetail }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const apiRaw = useApiRaw();
  const api = useApiRequest();
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trade(trade.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.attachments(trade.id) });
  };

  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      api<void>(`/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert(t`Could not delete`, err.message),
  });

  async function pickAndUpload() {
    const max = getPrefs().maxScreenshotsPerTrade;
    const room = max != null ? max - trade.attachments.length : Number.POSITIVE_INFINITY;
    if (room <= 0) {
      Alert.alert(
        t`Screenshot limit reached`,
        t`This trade already has ${trade.attachments.length} screenshots — raise the cap under Settings → Display.`,
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: Number.isFinite(room) ? room : 0,
      quality: 0.9,
    });
    if (picked.canceled || picked.assets.length === 0) return;

    setUploading(true);
    try {
      // One at a time, like the web uploader — partial success stays visible.
      for (const asset of picked.assets) {
        const type = ALLOWED_TYPES.has(asset.mimeType ?? '') ? asset.mimeType! : 'image/jpeg';
        const name = asset.fileName ?? `screenshot-${asset.assetId ?? 'img'}.jpg`;
        const formData = new FormData();
        // RN FormData file part; never set Content-Type manually (boundary).
        formData.append('file', { uri: asset.uri, name, type } as unknown as Blob);
        const response = await apiRaw(`/trades/${trade.id}/attachments`, {
          method: 'POST',
          formData,
        });
        if (!response.ok) {
          throw new Error(t`Upload failed (${response.status})`);
        }
      }
      invalidate();
    } catch (err) {
      Alert.alert(t`Could not upload`, err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(attachmentId: string, filename: string) {
    Alert.alert(t`Remove screenshot?`, filename, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate(attachmentId) },
    ]);
  }

  if (!session) return null;

  return (
    <DashboardCard title={t`Screenshots`}>
      {trade.attachments.length > 0 ? (
        <View style={styles.shots}>
          {trade.attachments.map((attachment) => (
            <Pressable
              key={attachment.id}
              onLongPress={() => confirmDelete(attachment.id, attachment.filename)}
              accessibilityLabel={attachment.filename}
              accessibilityHint={t`Long-press to remove`}
            >
              <Image
                source={{
                  uri: new URL(
                    `/api/v1/attachments/${attachment.id}/file`,
                    session.serverUrl,
                  ).toString(),
                  headers: { Authorization: `Bearer ${session.accessToken}` },
                }}
                style={styles.shot}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.action}>
        {uploading ? (
          <ActivityIndicator />
        ) : (
          <GlassButton
            label={t`Add from Photos`}
            systemImage="photo.badge.plus"
            onPress={() => void pickAndUpload()}
          />
        )}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  shot: {
    width: 104,
    height: 104,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  action: { alignItems: 'flex-start' },
}));
