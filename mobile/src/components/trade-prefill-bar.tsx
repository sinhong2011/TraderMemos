import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useApiRaw, useLlmSettings } from '@/api/hooks';
import type { TradeExtract } from '@/api/types';
import { t } from '@lingui/core/macro';
import { parseFillFile } from '@/lib/fill-file';
import type { TradeFormValues } from '@/lib/trade-form';
import { blocksFromExtract, mergeTradeExtracts } from '@/lib/trade-prefill';

/** Cap multi-select screenshots so a single scan stays affordable (web parity). */
const SCAN_MAX_IMAGES = 8;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Single "Scan to fill" glass action above the new-trade form — a SwiftUI
 * Menu (iOS 26 glass popover anchored to the button) fanning out to broker
 * screenshots from Photos or image files (both OCR'd server-side via
 * POST /ocr/parse per image), or a CSV/JSON fill file parsed on-device.
 * Every source becomes one form block per underlying.
 */
export function TradePrefillBar({
  accountId,
  onPrefill,
}: {
  accountId: string;
  onPrefill: (blocks: TradeFormValues[]) => void;
}) {
  const { theme } = useUnistyles();
  const api = useApiRaw();
  const ocrSettings = useLlmSettings('ocr');
  const [busy, setBusy] = useState<'scan' | 'file' | null>(null);

  const visionReady =
    ocrSettings.data != null &&
    ocrSettings.data.enabled &&
    ocrSettings.data.base_url.trim() !== '' &&
    ocrSettings.data.api_key_set;

  function apply(extract: TradeExtract) {
    const { blocks, warnings } = blocksFromExtract(extract, accountId);
    onPrefill(blocks);
    if (warnings.length > 0) Alert.alert(t`Check the fills`, warnings.join('\n\n'));
  }

  /** Screenshot sources need the vision endpoint; CSV/JSON parses locally. */
  function requireVision(): boolean {
    if (visionReady) return true;
    Alert.alert(
      t`Set up Vision scan first`,
      t`Add an OpenAI-compatible vision endpoint and API key under Settings → AI, then scan broker screenshots straight into this form.`,
    );
    return false;
  }

  /** OCR the picked images through the server, then prefill. */
  async function scanImages(images: { uri: string; name: string; type: string }[]) {
    if (images.length === 0) return;
    setBusy('scan');
    try {
      const extracts: TradeExtract[] = [];
      for (const image of images.slice(0, SCAN_MAX_IMAGES)) {
        const formData = new FormData();
        // React Native FormData takes a {uri,name,type} descriptor for file parts.
        formData.append('file', image as unknown as Blob);
        const response = await api('/ocr/parse', { method: 'POST', formData });
        extracts.push((await response.json()) as TradeExtract);
      }
      apply(mergeTradeExtracts(extracts));
    } catch (err) {
      Alert.alert(t`Could not scan`, errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function pickFromPhotos() {
    if (!requireVision()) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: SCAN_MAX_IMAGES,
      quality: 0.8,
    });
    if (picked.canceled) return;
    await scanImages(
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
    if (picked.canceled) return;
    await scanImages(
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
    if (picked.canceled) return;
    setBusy('file');
    try {
      const asset = picked.assets[0];
      const text = await new File(asset.uri).text();
      apply(parseFillFile(asset.name, text));
    } catch (err) {
      Alert.alert(t`Could not read file`, errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Host matchContents>
      <Menu
        label={<UIImage systemName="square.and.arrow.down" size={15} />}
        modifiers={[
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          controlSize('regular'),
          // Menu triggers default to the accent tint — keep the glyph neutral.
          tint(theme.colors.foreground),
          accessibilityLabel(t`Import`),
          ...(busy != null ? [disabledModifier(true)] : []),
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
    </Host>
  );
}
