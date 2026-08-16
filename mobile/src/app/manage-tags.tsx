import { useRouter } from 'expo-router';
import { type SFSymbol } from 'expo-symbols';
import { ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useSetups, useTags } from '@/api/hooks';
import { ChipGroup } from '@/components/chips';
import { DEFAULT_TAG_COLOR } from '@/lib/tags';
import { GlassIconButton } from '@/components/glass-button';
import { t } from '@lingui/core/macro';
import { EMOTIONAL_STATES, TRADE_GRADES, intFromGrade } from '@/lib/journal';
import { toggleExtraChip, toggleTagHidden, useTagBarState } from '@/lib/tag-bar';

/** Squircle corners on the section cards — no Tailwind utility maps to this. */
const CONTINUOUS = { borderCurve: 'continuous' } as const;

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
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  return (
    // Borderless card blocks (DESIGN.md) — each taxonomy gets its own surface.
    <View className="gap-3 rounded-lg bg-card p-4" style={CONTINUOUS}>
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={13} tintColor={mutedForeground} />
        <Text className="text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">
          {label}
        </Text>
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
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-12">
      <View className="flex-row items-center justify-between pt-2">
        <Text className="text-[22px] font-bold tracking-[-0.3px] text-foreground">{t`Quick filters`}</Text>
        {/* Same glass checkmark every other sheet commits with — a labelled
            "Done" pill was the one bespoke button in the set. */}
        <GlassIconButton systemImage="checkmark" label={t`Done`} onPress={() => router.back()} />
      </View>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">
        {t`Choose which journal options show as filter chips on the trades list.`}
      </Text>

      {customTags.length > 0 ? (
        <Section icon="tag" label={t`Tags`}>
          <ChipGroup
            options={customTags.map((tag) => ({
              value: tag.id,
              label: tag.name,
              color: tag.color || DEFAULT_TAG_COLOR,
            }))}
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
