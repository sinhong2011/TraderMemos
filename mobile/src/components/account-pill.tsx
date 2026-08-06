import {
  Button as UIButton,
  HStack,
  Image as UIImage,
  Menu,
  Text as UIText,
} from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  fixedSize,
  font,
  foregroundStyle,
  lineLimit,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Account } from '@/api/types';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

/** Caption and value share this size — the caption is set apart by weight and
 * color, not by shrinking it, so the pill reads as one line of type. */
const PILL_FONT_SIZE = 15;

/**
 * The trade form's account scope as a single control: one capsule carrying the
 * "Account" caption, the account name, and the pull-down chevron.
 *
 * Caption and value live *inside* the button rather than beside it, so the
 * whole capsule is one tap target and one object on the screen — a loose label
 * next to a separate pill read as two unrelated things, and left the caption
 * un-tappable. Being a native `Menu`, the pull-down is a real UIMenu: checkmark
 * on the active account, and the press highlight iOS draws for its own controls.
 *
 * Glass capsule, matching the circular scan button pinned at the other end of
 * the same row — the two chrome controls of the header are then one family.
 */
export function AccountPill({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
}) {
  const { theme } = useUnistyles();
  const name = accounts.find((account) => account.id === value)?.name ?? '';

  // Nothing to switch between: a capsule here would promise a menu that isn't
  // there, so the pair degrades to plain type at the same two sizes.
  if (accounts.length <= 1) {
    return (
      <View style={styles.staticRow}>
        <Text style={styles.staticCaption}>{t`Account`}</Text>
        <Text style={styles.staticValue}>{name}</Text>
      </View>
    );
  }

  return (
    <AppHost matchContents>
      <Menu
        label={
          // `fixedSize` is what keeps the name whole: the host proposes a width
          // to the label before RN has settled the row, and a compressible
          // HStack answers by truncating to fit it ("Test…") — then the capsule
          // sizes to that. Fixed horizontally, the label reports its ideal width
          // instead and the capsule grows to match.
          <HStack spacing={8} modifiers={[fixedSize({ horizontal: true })]}>
            <UIText
              modifiers={[
                font({ size: PILL_FONT_SIZE }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {t`Account`}
            </UIText>
            {/* Name and chevron ride tighter than the caption gap: the glyph
                belongs to the value it opens, not to the row. */}
            <HStack spacing={5}>
              <UIText modifiers={[font({ size: PILL_FONT_SIZE, weight: 'medium' }), lineLimit(1)]}>
                {name}
              </UIText>
              <UIImage systemName="chevron.up.chevron.down" size={11} />
            </HStack>
          </HStack>
        }
        modifiers={[
          buttonStyle('glass'),
          buttonBorderShape('capsule'),
          // Menu triggers paint in the accent color by default — this is
          // chrome, so it stays in the text color and lets `hierarchical`
          // above grade the caption down from it.
          tint(theme.colors.foreground),
        ]}
      >
        {accounts.map((account) => (
          <UIButton
            key={account.id}
            label={account.name}
            systemImage={account.id === value ? 'checkmark' : undefined}
            onPress={() => onChange(account.id)}
          />
        ))}
      </Menu>
    </AppHost>
  );
}

const styles = StyleSheet.create((theme) => ({
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  staticCaption: {
    fontSize: PILL_FONT_SIZE,
    color: theme.colors.mutedForeground,
  },
  staticValue: {
    fontSize: PILL_FONT_SIZE,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
}));
