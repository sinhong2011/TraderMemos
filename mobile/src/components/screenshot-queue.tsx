import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Button, Menu } from 'panelui-native';
import { Alert, Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { getJournalPrefs } from '@/lib/journal-prefs';
import type { QueuedScreenshot } from '@/lib/trade-form';

/** The server only accepts these (content-sniffed); Photos picks re-encode to jpeg. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * Screenshot picker for the new-trade form: images queue locally per symbol
 * block and upload to that symbol's trade once it saves. Same Photos/Files
 * menu as the attachments card — only the timing differs.
 */
export function ScreenshotQueue({
  screenshots,
  onChange,
}: {
  screenshots: QueuedScreenshot[];
  onChange: (next: QueuedScreenshot[]) => void;
}) {
  // expo-image is not a core RN component, so its box is styled with values
  // read off the theme rather than with classes.
  const [foreground, muted] = useCSSVariable(['--color-foreground', '--color-muted']) as [
    string,
    string,
  ];

  function remainingRoom(): number {
    const max = getJournalPrefs().maxScreenshotsPerTrade;
    const room = max != null ? max - screenshots.length : Number.POSITIVE_INFINITY;
    if (room <= 0) {
      Alert.alert(
        t`Screenshot limit reached`,
        t`Raise the cap under Settings → Display to queue more.`,
      );
    }
    return room;
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
    onChange([
      ...screenshots,
      ...picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? `screenshot-${asset.assetId ?? 'img'}.jpg`,
        type: (ALLOWED_TYPES as readonly string[]).includes(asset.mimeType ?? '')
          ? asset.mimeType!
          : 'image/jpeg',
      })),
    ]);
  }

  async function pickFromFiles() {
    const room = remainingRoom();
    if (room <= 0) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [...ALLOWED_TYPES],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (picked.canceled) return;
    const assets = Number.isFinite(room) ? picked.assets.slice(0, room) : picked.assets;
    onChange([
      ...screenshots,
      ...assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'image/jpeg',
      })),
    ]);
  }

  return (
    // Standalone actions center (the CenteredButton idiom); thumbnails keep
    // their left-aligned grid above.
    <View className="items-center gap-2">
      {screenshots.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 self-stretch">
          {screenshots.map((shot, index) => (
            <Pressable
              key={`${shot.uri}-${index}`}
              onPress={() => onChange(screenshots.filter((_, i) => i !== index))}
              accessibilityRole="button"
              accessibilityLabel={t`Remove ${shot.name}`}
              className="active:opacity-70"
            >
              <Image
                source={{ uri: shot.uri }}
                style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: muted }}
                contentFit="cover"
              />
              <View className="absolute -right-[5px] -top-[5px] h-[18px] w-[18px] items-center justify-center rounded-full bg-destructive">
                <Icon name="xmark" size={9} weight="bold" tintColor="#FFFFFF" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Menu presentation="bottom-sheet">
        <Menu.Trigger>
          <Button
            variant="outline"
            size="sm"
            startContent={<Icon name="photo.badge.plus" size={16} tintColor={foreground} />}
          >
            {t`Add screenshot`}
          </Button>
        </Menu.Trigger>
        <Menu.Content width="full" className="shadow-none rounded-none">
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
    </View>
  );
}
