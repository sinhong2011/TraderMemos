import {
  Button as UIButton,
  Image as UIImage,
  Menu,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useLlmSettings } from '@/api/hooks';
import { t } from '@lingui/core/macro';
import { isVisionReady, SCAN_MAX_IMAGES, type ImportSource } from '@/lib/trade-import';
import { AppHost } from '@/components/app-host';

/**
 * "Scan to fill" trigger beside the account row — a circular glass SwiftUI
 * Menu button wearing the viewfinder glyph in the neutral chrome color. The
 * popover fans out to broker screenshots from Photos or image files, or a
 * CSV/JSON fill file. Picking only collects the sources; parsing and review
 * happen in the scan overlay (trade-scan-overlay.tsx).
 */
export function TradePrefillBar({
  onSources,
}: {
  onSources: (sources: ImportSource[]) => void;
}) {
  const { theme } = useUnistyles();
  const ocrSettings = useLlmSettings('ocr');

  const visionReady = isVisionReady(ocrSettings.data);

  /** Screenshot sources need the vision endpoint; CSV/JSON parses locally. */
  function requireVision(): boolean {
    if (visionReady) return true;
    Alert.alert(
      t`Set up Vision scan first`,
      t`Add an OpenAI-compatible vision endpoint and API key under Settings → AI, then scan broker screenshots straight into this form.`,
    );
    return false;
  }

  async function pickFromPhotos() {
    if (!requireVision()) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: SCAN_MAX_IMAGES,
      quality: 0.8,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    onSources(
      picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName ?? 'screenshot.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      })),
    );
  }

  async function pickImageFiles() {
    if (!requireVision()) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/jpeg', 'image/webp', 'image/heic'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    onSources(
      picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'image/jpeg',
      })),
    );
  }

  async function pickDataFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/json', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    onSources([{ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'text/csv' }]);
  }

  return (
    <AppHost matchContents>
      <Menu
        label={<UIImage systemName="text.viewfinder" size={16} />}
        modifiers={[
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          controlSize('regular'),
          // Menu triggers default to the accent tint — keep the glyph neutral.
          tint(theme.colors.foreground),
          accessibilityLabel(t`Scan to fill`),
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
          onPress={() => void pickImageFiles()}
        />
        <UIButton
          label={t`CSV / JSON file`}
          systemImage="doc.text"
          onPress={() => void pickDataFile()}
        />
      </Menu>
    </AppHost>
  );
}
