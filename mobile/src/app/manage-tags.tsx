import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useSetups, useTags } from '@/api/hooks';
import { ChipGroup } from '@/components/chips';
import { t } from '@lingui/core/macro';
import { EMOTIONAL_STATES, TRADE_GRADES, intFromGrade } from '@/lib/journal';
import { toggleExtraChip, toggleTagHidden, useTagBarState } from '@/lib/tag-bar';

/** Card-block section (DESIGN.md): icon + quiet label over a chip row. */
function Section({
  icon,
  label,
  children,
}: {
  icon: SFSymbol;
  label: string;
  children: React.ReactNode;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <SymbolView name={icon} size={13} tintColor={theme.colors.mutedForeground} />
        <Text style={styles.section}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Picker for the quick-filter chip bar, styled like the trade form's journal
 * block: each taxonomy is a row of toggle chips — tinted means it shows as a
 * chip on the trades list. Options mirror the journal form; nothing is
 * created here.
 */
export default function ManageTagsScreen() {
  const router = useRouter();
  const { data: tags } = useTags();
  const { data: setups } = useSetups();
  const { hiddenTagIds, extras } = useTagBarState();

  const pickedKeys = extras.map((extra) => extra.key);
  const customTags = (tags ?? []).filter((tag) => tag.kind !== 'mistake');
  const mistakeTags = (tags ?? []).filter((tag) => tag.kind === 'mistake');
  const grades = TRADE_GRADES.map((grade) => ({ grade, int: intFromGrade(grade) }));

  return (
    // Form sheets lay non-scroll children on top of each other — the sheet's
    // content root must be a ScrollView.
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t`Quick filters`}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.done}>{t`Done`}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {t`Choose which journal options show as filter chips on the trades list.`}
      </Text>

      {customTags.length > 0 ? (
        <Section icon="tag" label={t`Tags`}>
          <ChipGroup
            options={customTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            selected={customTags.filter((tag) => !hiddenTagIds.includes(tag.id)).map((t2) => t2.id)}
            onToggle={toggleTagHidden}
          />
        </Section>
      ) : null}

      {mistakeTags.length > 0 ? (
        <Section icon="exclamationmark.triangle" label={t`Mistake type`}>
          <ChipGroup
            options={mistakeTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            selected={mistakeTags
              .filter((tag) => !hiddenTagIds.includes(tag.id))
              .map((t2) => t2.id)}
            onToggle={toggleTagHidden}
            tone="neg"
          />
        </Section>
      ) : null}

      {setups && setups.length > 0 ? (
        <Section icon="square.grid.2x2" label={t`Setups`}>
          <ChipGroup
            options={setups.map((setup) => ({ value: setup.id, label: setup.name }))}
            selected={setups
              .filter((setup) => pickedKeys.includes(`setup:${setup.id}`))
              .map((setup) => setup.id)}
            onToggle={(id) => {
              const setup = setups.find((s) => s.id === id);
              if (setup) toggleExtraChip(`setup:${id}`, setup.name);
            }}
          />
        </Section>
      ) : null}

      <Section icon="face.smiling" label={t`Emotion`}>
        <ChipGroup
          options={EMOTIONAL_STATES.map((emotion) => ({ value: emotion, label: emotion }))}
          selected={EMOTIONAL_STATES.filter((emotion) =>
            pickedKeys.includes(`emotion:${emotion}`),
          )}
          onToggle={(emotion) => toggleExtraChip(`emotion:${emotion}`, emotion)}
        />
      </Section>

      <Section icon="star" label={t`Setup rating`}>
        <ChipGroup
          options={grades.map(({ grade }) => ({ value: grade, label: grade }))}
          selected={grades
            .filter(({ int }) => pickedKeys.includes(`sgrade:${int}`))
            .map(({ grade }) => grade)}
          onToggle={(grade) => {
            const int = intFromGrade(grade);
            if (int != null) toggleExtraChip(`sgrade:${int}`, t`Setup ${grade}`);
          }}
        />
      </Section>

      <Section icon="bolt" label={t`Execution rating`}>
        <ChipGroup
          options={grades.map(({ grade }) => ({ value: grade, label: grade }))}
          selected={grades
            .filter(({ int }) => pickedKeys.includes(`egrade:${int}`))
            .map(({ grade }) => grade)}
          onToggle={(grade) => {
            const int = intFromGrade(grade);
            if (int != null) toggleExtraChip(`egrade:${int}`, t`Exec ${grade}`);
          }}
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: theme.colors.foreground },
  doneButton: {
    paddingHorizontal: theme.spacing.md + 2,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  done: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  pressed: { opacity: 0.6 },
  hint: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  // Borderless card blocks (DESIGN.md) — each taxonomy gets its own surface.
  sectionCard: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs + 2 },
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
}));
