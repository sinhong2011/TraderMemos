import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Menu } from 'panelui-native';
import { Alert } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useLlmSettings } from '@/api/hooks';
import { Icon } from '@/components/icon';
import { GlassIconButton } from '@/components/glass-button';
import { t } from '@lingui/core/macro';
import { isVisionReady, SCAN_MAX_IMAGES, type ImportSource } from '@/lib/trade-import';

/**
 * "Scan to fill" trigger beside the account row — a circular glass button
 * wearing the viewfinder glyph in the neutral chrome color. The menu fans out
 * to broker screenshots from Photos or image files, or a CSV/JSON fill file.
 * Picking only collects the sources; parsing and review happen in the scan
 * overlay (trade-scan-overlay.tsx).
 */
export function TradePrefillBar({
  onSources,
}: {
  onSources: (sources: ImportSource[]) => void;
}) {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
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
    <Menu presentation="bottom-sheet">
      {/* `Menu.Trigger` clones its child with its own `onPress`, so the button
          keeps its chrome and only needs a placeholder handler. */}
      <Menu.Trigger>
        <GlassIconButton systemImage="text.viewfinder" label={t`Scan to fill`} onPress={() => {}} />
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
          onSelect={() => void pickImageFiles()}
        >
          {t`Image files`}
        </Menu.Item>
        <Menu.Item
          icon={<Icon name="doc.text" size={16} tintColor={foreground} />}
          onSelect={() => void pickDataFile()}
        >
          {t`CSV / JSON file`}
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
