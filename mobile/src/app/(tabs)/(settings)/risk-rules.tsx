import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { BottomSheet, Frame, Item, Text, cn } from 'panelui-native';
import { Fragment, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { queryKeys, useApiRequest, useRiskRules } from '@/api/hooks';
import type { RiskRules } from '@/api/types';
import { t } from '@lingui/core/macro';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Icon } from '@/components/icon';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { Swipe } from '@/components/swipe';
import { errorMessage } from '@/lib/errors';
import {
  activeRiskRules,
  availableRiskRules,
  formatRiskRuleValue,
  setRiskRuleValue,
  type RiskRuleDef,
} from '@/lib/risk-rules';

/**
 * One row of a rule sheet: icon badge, title, optional second line. The same
 * anatomy as the Segmented picker sheet's rows, so every option list in the
 * app reads as one component.
 */
function SheetRow({
  icon,
  title,
  detail,
  destructive,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  detail?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const [foreground, destructiveColor] = useCSSVariable([
    '--color-foreground',
    '--color-destructive',
  ]) as [string, string];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      // Press feedback dims the row (the app's pressable idiom) — a filled
      // accent slab bled across the sheet read as a mispainted band.
      className="min-h-[52px] flex-row items-center gap-3 py-2 active:opacity-60"
    >
      <View
        className="h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-fill"
        style={{ borderCurve: 'continuous' }}
      >
        <Icon name={icon} size={15} tintColor={destructive ? destructiveColor : foreground} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={cn('text-[17px]', destructive ? 'text-destructive' : 'text-foreground')}
          numberOfLines={1}
        >
          {title}
        </Text>
        {detail ? (
          <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * One active limit, in the trades-list row anatomy: a tap (or the leading
 * swipe) opens its value form, a long press previews it, the trailing swipe
 * removes it. Lives inside the section's `Frame.Panel`, whose own
 * overflow-hidden clips the tiles at the panel corners; the moving row
 * carries `bg-card` so the tiles stay hidden behind it at rest. The row is
 * hand-composed at Frame.Row's metrics (px-4 py-3.5, sm/medium title, xs
 * description) — Frame's compound parts can't leave their root, and
 * Link.Trigger needs a bare Pressable to clone.
 */
function ActiveRuleRow({
  badge,
  def,
  value,
  onEdit,
  onRemove,
}: {
  badge: React.ReactNode;
  def: RiskRuleDef;
  value: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Swipe>
      <Swipe.Start>
        <Swipe.Action
          color="info"
          icon={<Icon name="pencil" />}
          label={t`Edit`}
          onPress={onEdit}
        />
      </Swipe.Start>
      <Swipe.End>
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" />}
          label={t`Remove`}
          onPress={onRemove}
        />
      </Swipe.End>
      <Link href={{ pathname: '/risk-rule-form', params: { key: def.key } }} asChild>
        <Link.Trigger>
          <Pressable>
            <View className="flex-row items-center gap-3 bg-card px-4 py-3.5">
              {badge}
              <View className="flex-1 gap-0.5">
                <Text size="sm" weight="medium">
                  {def.label()}
                </Text>
                <Text size="xs" muted>
                  {def.detail()}
                </Text>
              </View>
              <Text size="sm" className="tabular-nums">
                {formatRiskRuleValue(def, value)}
              </Text>
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
      </Link>
    </Swipe>
  );
}

/**
 * Risk rules (web RulesTab parity), adaptive to how much is set: with no
 * active limits the whole catalog lists inline (the options ARE the screen);
 * once any exist the actives take the page and a header + opens a picker
 * sheet of the rest, so the screen never grows with the catalog. An active
 * rule edits on tap (or previews on long press) and swipes for Edit/Remove;
 * values edit on the pushed risk-rule-form screen.
 */
export default function RiskRulesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const rules = useRiskRules();
  const [addOpen, setAddOpen] = useState(false);
  // The inline badges are expo-symbols views — tint is a JS value.
  const [primary, foreground] = useCSSVariable(['--color-primary', '--color-foreground']) as [
    string,
    string,
  ];

  const save = useMutation({
    mutationFn: (body: RiskRules) => api('/settings/risk-rules', { method: 'PUT', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.riskRules() }),
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  function pushValueForm(def: RiskRuleDef) {
    router.push({ pathname: '/risk-rule-form', params: { key: def.key } });
  }

  const active = activeRiskRules(rules.data);
  const available = availableRiskRules(rules.data);
  const hasActive = active.length > 0;

  const ruleBadge = (def: RiskRuleDef) => (
    <View
      className="h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-fill"
      style={{ borderCurve: 'continuous' }}
    >
      <Icon name={def.icon} size={15} tintColor={foreground} />
    </View>
  );

  return (
    <SettingsForm>
      {/* The + lives in the header once a list exists; while it's empty the
          options ARE the screen, so a second entry point would be noise. */}
      <Stack.Screen
        options={{
          headerRight:
            hasActive && available.length > 0
              ? () => (
                  <HeaderIconButton
                    systemImage="plus"
                    label={t`Add a limit`}
                    onPress={() => setAddOpen(true)}
                  />
                )
              : undefined,
        }}
      />

      {hasActive ? (
        <SettingsSection
          title={t`Active limits`}
          footer={t`Used by Check compliance on New Trade. Add only the limits you want enforced.`}
        >
          {/* A rule row carries a badge and a second line the settings
              vocabulary has no slot for, so it is composed from the Frame row
              parts the other rows are built on rather than bent out of
              NavRow. */}
          {active.map(({ def, value }) => (
            <ActiveRuleRow
              key={def.key}
              badge={ruleBadge(def)}
              def={def}
              value={value}
              onEdit={() => pushValueForm(def)}
              onRemove={() => save.mutate(setRiskRuleValue(rules.data, def.key, null))}
            />
          ))}
        </SettingsSection>
      ) : rules.isLoading && rules.data == null ? (
        <SettingsSection title={t`Active limits`}>
          <Frame.Row>
            <Frame.Content>
              <Text size="sm" muted>
                {t`Loading…`}
              </Text>
            </Frame.Content>
          </Frame.Row>
        </SettingsSection>
      ) : (
        /* Empty state: the whole catalog inline — a bare "no rules yet" row
           plus a hidden picker made the first add a two-hop scavenger hunt. */
        <SettingsSection
          title={t`Add a limit`}
          footer={t`Used by Check compliance on New Trade. Add only the limits you want enforced.`}
        >
          {available.map((def) => (
            <Frame.Row key={def.key} onPress={() => pushValueForm(def)}>
              {ruleBadge(def)}
              <Frame.Content>
                <Frame.Title>{def.label()}</Frame.Title>
                <Frame.Description>{def.detail()}</Frame.Description>
              </Frame.Content>
              <Frame.Actions>
                <Icon name="plus.circle.fill" size={22} tintColor={primary} />
              </Frame.Actions>
            </Frame.Row>
          ))}
        </SettingsSection>
      )}

      {/* Rule picker — a sheet rather than one + row per unset rule, so the
          screen keeps its height however long the catalog grows. */}
      <BottomSheet open={addOpen} onOpenChange={setAddOpen}>
        <BottomSheet.Content>
          <BottomSheet.Header title={t`Add a limit`} />
          {/* Capped ScrollView, not BottomSheet.Body — same reasoning as the
              Segmented picker sheet: Body is a flex-1 scroller that collapses
              in a sheet sized to its options. */}
          <ScrollView className="max-h-[440px]" bounces={false}>
            {available.map((def, index) => (
              <Fragment key={def.key}>
                {index > 0 ? <Item.Separator className="ml-[42px]" /> : null}
                <SheetRow
                  icon={def.icon}
                  title={def.label()}
                  detail={def.detail()}
                  // A push (unlike the old alert prompt) survives the sheet's
                  // dismissal animation, so no settle delay is needed.
                  onPress={() => {
                    setAddOpen(false);
                    pushValueForm(def);
                  }}
                />
              </Fragment>
            ))}
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet>
    </SettingsForm>
  );
}
