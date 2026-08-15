import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Button, Menu, Spinner } from 'panelui-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRaw, useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { getJournalPrefs } from '@/lib/journal-prefs';

/** The server only accepts these (content-sniffed); HEIC from Photos gets
 *  re-encoded to jpeg by the picker, but a HEIC *file* would be rejected. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

type PickedImage = { uri: string; name: string; type: string };

/**
 * Trade screenshots — the read-only gallery grown into full manage: add from
 * Photos or image files (a pull-down, like the trade form's Import),
 * long-press to remove. Respects the max-screenshots display pref like the
 * web uploader.
 */
export function AttachmentsCard({ trade }: { trade: TradeDetail }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const apiRaw = useApiRaw();
  const api = useApiRequest();
  const [uploading, setUploading] = useState(false);
  // expo-image is not a core RN component, so its box is styled with values
  // read off the theme rather than with classes.
  const [foreground, muted] = useCSSVariable(['--color-foreground', '--color-muted']) as [
    string,
    string,
  ];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trade(trade.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.attachments(trade.id) });
  };

  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      api<void>(`/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
  });

  /** Remaining slots under the max-screenshots pref, or Infinity. */
  function remainingRoom(): number {
    const max = getJournalPrefs().maxScreenshotsPerTrade;
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
        // An expo-file-system `File`, not RN's `{uri,name,type}` descriptor —
        // Expo's fetch polyfill owns the global `fetch` and serialises a part
        // only from a string, a Blob, or something with `bytes()`. See
        // components/note-images.tsx.
        formData.append('file', new FsFile(file.uri) as unknown as Blob, file.name);
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
      Alert.alert(t`Could not upload`, errorMessage(err));
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
      // An iPhone library is HEIC and the server takes only png/jpeg/webp;
      // multi-select hands back the original representation untranscoded.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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
        <View className="flex-row flex-wrap gap-2">
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
                style={{ width: 104, height: 104, borderRadius: 10, backgroundColor: muted }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      {/* Standalone actions center (the CenteredButton idiom). */}
      <View className="items-center">
        {uploading ? (
          <Spinner />
        ) : (
          <Menu>
            <Menu.Trigger>
              <Button
                variant="outline"
                size="sm"
                startContent={<Icon name="photo.badge.plus" size={16} tintColor={foreground} />}
              >
                {t`Add screenshot`}
              </Button>
            </Menu.Trigger>
            <Menu.Content align="center">
              <Menu.Item
                icon={<Icon name="photo.on.rectangle" size={16} tintColor={foreground} />}
                onSelect={() => void pickFromPhotos()}
              >
                {t`Photo Library`}
              </Menu.Item>
              <Menu.Item
                icon={<Icon name="folder" size={16} tintColor={foreground} />}
                onSelect={() => void pickFromFiles()}
              >
                {t`Image files`}
              </Menu.Item>
            </Menu.Content>
          </Menu>
        )}
      </View>
    </DashboardCard>
  );
}
