import { Button as UIButton, Host, Menu } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { queryKeys, useApiRaw, useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { getPrefs } from '@/lib/prefs';

/** The server only accepts these (content-sniffed); HEIC from Photos gets
 *  re-encoded to jpeg by the picker, but a HEIC *file* would be rejected. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

type PickedImage = { uri: string; name: string; type: string };

/**
 * Trade screenshots — the read-only gallery grown into full manage: add from
 * Photos or image files (SwiftUI glass menu, like the trade form's Import),
 * long-press to remove. Respects the max-screenshots display pref like the
 * web uploader.
 */
export function AttachmentsCard({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
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

  /** Remaining slots under the max-screenshots pref, or Infinity. */
  function remainingRoom(): number {
    const max = getPrefs().maxScreenshotsPerTrade;
    const room = max != null ? max - trade.attachments.length : Number.POSITIVE_INFINITY;
    if (room <= 0) {
      Alert.alert(
        t`Screenshot limit reached`,
        t`This trade already has ${trade.attachments.length} screenshots — raise the cap under Settings → Display.`,
      );
    }
    return room;
  }

  async function uploadImages(files: PickedImage[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      // One at a time, like the web uploader — partial success stays visible.
      for (const file of files) {
        const formData = new FormData();
        // RN FormData file part; never set Content-Type manually (boundary).
        formData.append('file', file as unknown as Blob);
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

  async function pickFromPhotos() {
    const room = remainingRoom();
    if (room <= 0) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: Number.isFinite(room) ? room : 0,
      quality: 0.9,
    });
    if (picked.canceled) return;
    await uploadImages(
      picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? `screenshot-${asset.assetId ?? 'img'}.jpg`,
        type: (ALLOWED_TYPES as readonly string[]).includes(asset.mimeType ?? '')
          ? asset.mimeType!
          : 'image/jpeg',
      })),
    );
  }

  async function pickFromFiles() {
    const room = remainingRoom();
    if (room <= 0) return;
    // Original bytes get uploaded, so only offer types the server accepts.
    const picked = await DocumentPicker.getDocumentAsync({
      type: [...ALLOWED_TYPES],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (picked.canceled) return;
    const assets = Number.isFinite(room) ? picked.assets.slice(0, room) : picked.assets;
    if (assets.length < picked.assets.length) {
      Alert.alert(
        t`Screenshot limit reached`,
        t`Only the first ${assets.length} files fit under the cap.`,
      );
    }
    await uploadImages(
      assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'image/jpeg',
      })),
    );
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
          <Host matchContents>
            <Menu
              label={t`Add screenshot`}
              systemImage="photo.badge.plus"
              modifiers={[
                buttonStyle('glass'),
                buttonBorderShape('capsule'),
                controlSize('regular'),
                // Menu triggers default to the accent tint — keep it neutral.
                tint(theme.colors.foreground),
                ...(uploading ? [disabledModifier(true)] : []),
              ]}
            >
              <UIButton
                label={t`Photo Library`}
                systemImage="photo.on.rectangle"
                onPress={() => void pickFromPhotos()}
              />
              <UIButton
                label={t`Image files`}
                systemImage="folder"
                onPress={() => void pickFromFiles()}
              />
            </Menu>
          </Host>
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
