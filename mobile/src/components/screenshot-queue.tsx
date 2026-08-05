import { Button as UIButton, Host, Menu } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { getPrefs } from '@/lib/prefs';
import type { QueuedScreenshot } from '@/lib/trade-form';

/** The server only accepts these (content-sniffed); Photos picks re-encode to jpeg. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * Screenshot picker for the new-trade form: images queue locally per symbol
 * block and upload to that symbol's trade once it saves. Same Photos/Files
 * glass menu as the attachments card — only the timing differs.
 */
export function ScreenshotQueue({
  screenshots,
  onChange,
}: {
  screenshots: QueuedScreenshot[];
  onChange: (next: QueuedScreenshot[]) => void;
}) {
  const { theme } = useUnistyles();

  function remainingRoom(): number {
    const max = getPrefs().maxScreenshotsPerTrade;
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
    <View style={styles.wrap}>
      {screenshots.length > 0 ? (
        <View style={styles.thumbs}>
          {screenshots.map((shot, index) => (
            <Pressable
              key={`${shot.uri}-${index}`}
              onPress={() => onChange(screenshots.filter((_, i) => i !== index))}
              accessibilityRole="button"
              accessibilityLabel={t`Remove ${shot.name}`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Image source={{ uri: shot.uri }} style={styles.thumb} contentFit="cover" />
              <View style={styles.removeBadge}>
                <SymbolView name="xmark" size={9} weight="bold" tintColor="#FFFFFF" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // Standalone actions center (the CenteredButton idiom); thumbnails keep
  // their left-aligned grid above.
  wrap: { gap: theme.spacing.sm, alignItems: 'center' },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignSelf: 'stretch',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.7 },
  removeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.destructive,
  },
}));
