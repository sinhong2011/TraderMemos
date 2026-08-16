import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { Image, type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Button, Menu, Spinner } from 'panelui-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useApiRaw, useApiRequest } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { MediaFile } from '@/api/types';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { appendNoteImage, noteMediaIds, removeNoteImage } from '@/lib/note-media';

/** The server only accepts these (content-sniffed); Photos picks re-encode to jpeg. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

type PickedImage = { uri: string; name: string; type: string };

export type NoteImagesController = {
  /** Media ids currently referenced by the note body, in body order. */
  ids: string[];
  /** No session means no server to read thumbnails from — render nothing. */
  ready: boolean;
  uploading: boolean;
  sourceFor: (id: string) => ImageSource;
  pickFromPhotos: () => Promise<void>;
  pickFromFiles: () => Promise<void>;
  confirmRemove: (id: string) => void;
};

/**
 * Chart screenshots inside a note.
 *
 * The body field is raw markdown here, so an inserted `![](tm-media:…)` would
 * otherwise be invisible — a line of syntax rather than a picture. This hook is
 * the viewfinder for it: it reads the ids back out of the body, hands them out
 * as thumbnail sources, and edits the markdown on add and remove. The note
 * stays a plain markdown string, so what the web's TipTap editor renders and
 * what this shows are the same note.
 *
 * Picker and strip are separate components off one controller because the
 * editor splits them: the "Add chart" button rides the bottom toolbar while the
 * thumbnails sit above it, and a single upload spinner has to cover both.
 */
export function useNoteImages(
  body: string,
  onChangeBody: (body: string) => void,
): NoteImagesController {
  const { session } = useSession();
  const apiRaw = useApiRaw();
  const api = useApiRequest();
  const [uploading, setUploading] = useState(false);

  async function uploadImages(files: PickedImage[]) {
    if (files.length === 0) return;
    setUploading(true);
    let next = body;
    try {
      // One at a time, like the attachments card — a partial batch keeps the
      // images that did land instead of losing the lot.
      for (const file of files) {
        const formData = new FormData();
        // An expo-file-system `File`, not RN's `{uri,name,type}` descriptor:
        // Expo's fetch polyfill owns the global `fetch` here, and it serialises
        // a multipart part only from a string, a Blob, or something with
        // `bytes()` — a bare uri descriptor throws "Unsupported FormDataPart
        // implementation" (expo/src/winter/fetch/convertFormData.ts).
        formData.append('file', new FsFile(file.uri) as unknown as Blob, file.name);
        const response = await apiRaw('/media', { method: 'POST', formData });
        if (!response.ok) throw new Error(t`Upload failed (${response.status})`);
        const media = (await response.json()) as MediaFile;
        // No alt text: a camera-roll filename is noise in a raw markdown field
        // and useless as a description.
        next = appendNoteImage(next, media.id);
      }
    } catch (err) {
      Alert.alert(t`Could not upload`, errorMessage(err));
    } finally {
      onChangeBody(next);
      setUploading(false);
    }
  }

  return {
    ids: noteMediaIds(body),
    ready: Boolean(session),
    uploading,
    sourceFor: (id) => ({
      uri: new URL(`/api/v1/media/${id}/file`, session?.serverUrl ?? '').toString(),
      headers: { Authorization: `Bearer ${session?.accessToken ?? ''}` },
    }),
    async pickFromPhotos() {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        quality: 0.9,
        // An iPhone library is HEIC, and the server takes only png/jpeg/webp.
        // Multi-select hands back the original representation untouched, so
        // without this the upload is rejected for every photo taken on a phone.
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (picked.canceled) return;
      await uploadImages(
        picked.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName ?? `chart-${asset.assetId ?? 'img'}.jpg`,
          type: (ALLOWED_TYPES as readonly string[]).includes(asset.mimeType ?? '')
            ? asset.mimeType!
            : 'image/jpeg',
        })),
      );
    },
    async pickFromFiles() {
      // Original bytes get uploaded, so only offer types the server accepts.
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...ALLOWED_TYPES],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (picked.canceled) return;
      await uploadImages(
        picked.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'image/jpeg',
        })),
      );
    },
    confirmRemove(id) {
      Alert.alert(t`Remove image?`, t`It is deleted from this note and from the server.`, [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Remove`,
          style: 'destructive',
          onPress: () => {
            onChangeBody(removeNoteImage(body, id));
            // The row is unreferenced the moment the body loses it; a failed
            // delete only leaks a file, so it must not block the edit.
            void api<void>(`/media/${id}`, { method: 'DELETE' }).catch(() => {});
          },
        },
      ]);
    },
  };
}

/**
 * Attached charts, as a single scrolling row. It scrolls sideways rather than
 * wrapping: the editor gives it a fixed band above the toolbar, and a wrapping
 * grid would eat the writing surface as soon as a note carried four charts.
 */
export function NoteImageStrip({ images }: { images: NoteImagesController }) {
  // expo-image is not a core RN component, so its box is styled with a value
  // read off the theme rather than with classes.
  const [muted] = useCSSVariable(['--color-muted']) as [string];
  if (!images.ready || images.ids.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-4"
      className="grow-0"
      keyboardShouldPersistTaps="handled"
    >
      {images.ids.map((id) => (
        <Pressable
          key={id}
          onPress={() => images.confirmRemove(id)}
          accessibilityRole="button"
          accessibilityLabel={t`Remove image`}
          className="active:opacity-70"
        >
          <Image
            source={images.sourceFor(id)}
            style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: muted }}
            contentFit="cover"
            transition={150}
          />
          <View className="absolute -right-[5px] -top-[5px] h-[18px] w-[18px] items-center justify-center rounded-full bg-destructive">
            <Icon name="xmark" size={9} weight="bold" tintColor="#FFFFFF" />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** The toolbar's "Add chart" pull-down — Photos or Files. */
export function NoteImageButton({ images }: { images: NoteImagesController }) {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  if (!images.ready) return null;
  if (images.uploading) {
    // Holds the toolbar row's height while the picker's button is swapped out.
    return (
      <View className="w-[88px] items-center">
        <Spinner />
      </View>
    );
  }
  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Button
          variant="outline"
          size="sm"
          startContent={<Icon name="photo.badge.plus" size={16} tintColor={foreground} />}
        >
          {t`Chart`}
        </Button>
      </Menu.Trigger>
      <Menu.Content width="full" className="shadow-none rounded-none">
        <Menu.Item
          icon={<Icon name="photo.on.rectangle" size={16} tintColor={foreground} />}
          onSelect={() => void images.pickFromPhotos()}
        >
          {t`Photo Library`}
        </Menu.Item>
        <Menu.Item
          icon={<Icon name="folder" size={16} tintColor={foreground} />}
          onSelect={() => void images.pickFromFiles()}
        >
          {t`Image files`}
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
