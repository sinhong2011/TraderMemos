import {
  Button,
  Host,
  HStack,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text as UIText,
  Toggle,
} from '@expo/ui/swift-ui';
import { foregroundStyle, monospacedDigit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import { formatDate, formatCurrency, formatTime } from '@/lib/format';
import {
  accountBaseCurrency,
  DISPLAY_CURRENCIES,
  isDefaultDisplayPrefs,
  marketTimezoneOptions,
  resetDisplayPrefs,
  resolveDisplayTimezone,
  resolveMarketTimezone,
  setDisplayCurrency,
  setMarketTimezone,
  setMaxScreenshotsPerTrade,
  setPrivacyMode,
  setTimeFormat,
  setTimezone,
  setTradeDateBasis,
  TIMEZONE_LOCAL,
  timezoneOptions,
  useDisplayPrefs,
  type DisplayCurrencyCode,
  type MarketTimezonePref,
  type TimezonePref,
} from '@/lib/prefs';

/** Sentinel for the "follow account base currency" picker row. */
const CURRENCY_BASE = '__base__';

/** Sample amount for the preview rows — big enough to show grouping separators. */
const SAMPLE_AMOUNT = 1234.56;

/**
 * Late-session UTC instant used by the preview. 21:15Z is after the New York
 * close but already the next morning in Asia, so a market timezone east of the
 * dateline visibly moves the trading day away from the displayed timestamp —
 * which is the whole point of keeping two clocks.
 */
function sampleInstant(): string {
  return `${new Date().toISOString().slice(0, 10)}T21:15:00Z`;
}

/**
 * Display preferences — privacy, currency, clocks. Every pref here is abstract
 * until you see it applied, so the screen opens with a live preview of a sample
 * amount and timestamp; the sections below then read as "what money looks like
 * → what a day is → what a clock reads → journaling caps".
 *
 * The market timezone is the consequential pick (it re-buckets every calendar
 * day and hourly stat), so it sits with the trade date basis under Trading day;
 * the display timezone only re-labels clock times and stays under Clock.
 */
export default function DisplaySettingsScreen() {
  const prefs = useDisplayPrefs();
  const { theme } = useUnistyles();
  const { data: accounts } = useAccounts();

  const baseCurrency = accountBaseCurrency(accounts);
  const previewCurrency = prefs.displayCurrency ?? baseCurrency;
  const at = sampleInstant();
  // The trading day follows the market clock, not the display one — format it
  // straight off that zone instead of reusing the display-tz formatters.
  const marketDay = new Date(at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: resolveMarketTimezone(prefs.marketTimezone),
  });

  // iOS idiom: single numeric value edits via a native prompt, not an inline field.
  function editMaxScreenshots() {
    Alert.prompt(
      t`Screenshots per trade`,
      t`Leave blank for no limit.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            const raw = (text ?? '').trim();
            if (raw === '') {
              setMaxScreenshotsPerTrade(null);
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed < 1) {
              Alert.alert(t`Could not save`, t`Enter a number of 1 or more.`);
              return;
            }
            setMaxScreenshotsPerTrade(parsed);
          },
        },
      ],
      'plain-text',
      prefs.maxScreenshotsPerTrade != null ? String(prefs.maxScreenshotsPerTrade) : '',
      'number-pad',
    );
  }

  function confirmReset() {
    Alert.alert(
      t`Reset display settings?`,
      t`Privacy, currency, clocks, and caps go back to their defaults.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Reset`, style: 'destructive', onPress: () => resetDisplayPrefs() },
      ],
    );
  }

  return (
    <Host style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        {/* Live consequence of every setting below — amounts mask under privacy
            mode, and the trading day drifts off the timestamp when the two
            timezones disagree. */}
        <Section
          title={t`Preview`}
          footer={
            <UIText>{t`A sample amount and a late-session timestamp, rendered with the settings below.`}</UIText>
          }
        >
          <LabeledContent label={t`Amount`}>
            <UIText modifiers={[monospacedDigit()]}>
              {formatCurrency(SAMPLE_AMOUNT, previewCurrency)}
            </UIText>
          </LabeledContent>
          <LabeledContent label={t`Timestamp`}>
            <UIText modifiers={[monospacedDigit()]}>{`${formatDate(at)} · ${formatTime(at)}`}</UIText>
          </LabeledContent>
          <LabeledContent label={t`Trading day`}>
            <UIText modifiers={[monospacedDigit()]}>{marketDay}</UIText>
          </LabeledContent>
        </Section>

        {/* Privacy and currency both answer "what does money look like", so they
            share a section instead of each orphaning one row. */}
        <Section
          title={t`Amounts`}
          footer={
            <UIText>
              {prefs.displayCurrency
                ? t`Privacy mode hides amounts everywhere — stats and ratios stay visible. Read-only amounts convert with the latest FX rate; forms keep the account currency (${baseCurrency}).`
                : t`Privacy mode hides amounts everywhere — stats and ratios stay visible. Amounts show in each account's own currency.`}
            </UIText>
          }
        >
          <Toggle
            label={t`Privacy mode`}
            isOn={prefs.privacyMode}
            onIsOnChange={(value) => setPrivacyMode(value)}
          />
          <Picker
            label={t`Display currency`}
            modifiers={[pickerStyle('menu')]}
            selection={prefs.displayCurrency ?? CURRENCY_BASE}
            onSelectionChange={(value) =>
              setDisplayCurrency(value === CURRENCY_BASE ? null : (value as DisplayCurrencyCode))
            }
          >
            <UIText key={CURRENCY_BASE} modifiers={[tag(CURRENCY_BASE)]}>
              {t`Account currency`}
            </UIText>
            {DISPLAY_CURRENCIES.map((code) => (
              <UIText key={code} modifiers={[tag(code)]}>
                {code}
              </UIText>
            ))}
          </Picker>
        </Section>

        {/* Both rows decide which calendar day a trade lands on. */}
        <Section
          title={t`Trading day`}
          footer={
            <UIText>{t`The market timezone defines the day — calendar cells, date filters, and hourly stats all follow it. Close date (last activity) matches realized P&L; open date groups by entry.`}</UIText>
          }
        >
          <Picker
            label={t`Market timezone`}
            modifiers={[pickerStyle('menu')]}
            selection={prefs.marketTimezone}
            onSelectionChange={(value) => setMarketTimezone(value as MarketTimezonePref)}
          >
            {marketTimezoneOptions().map((option) => (
              <UIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </UIText>
            ))}
          </Picker>
          <Picker
            label={t`Trade lands on`}
            modifiers={[pickerStyle('menu')]}
            selection={prefs.tradeDateBasis}
            onSelectionChange={(value) => setTradeDateBasis(value === 'open' ? 'open' : 'close')}
          >
            <UIText key="close" modifiers={[tag('close')]}>
              {t`Close date`}
            </UIText>
            <UIText key="open" modifiers={[tag('open')]}>
              {t`Open date`}
            </UIText>
          </Picker>
        </Section>

        <Section
          title={t`Clock`}
          footer={
            <UIText>
              {prefs.timezone === TIMEZONE_LOCAL
                ? t`Formats clock times only — never which day a trade belongs to. 12-hour reads 1:30 PM, 24-hour reads 13:30. This device is on ${resolveDisplayTimezone(TIMEZONE_LOCAL)}.`
                : t`Formats clock times only — never which day a trade belongs to. 12-hour reads 1:30 PM, 24-hour reads 13:30.`}
            </UIText>
          }
        >
          <Picker
            label={t`Display timezone`}
            modifiers={[pickerStyle('menu')]}
            selection={prefs.timezone}
            onSelectionChange={(value) => setTimezone(value as TimezonePref)}
          >
            {timezoneOptions().map((option) => (
              <UIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </UIText>
            ))}
          </Picker>
          <Picker
            label={t`Time format`}
            modifiers={[pickerStyle('menu')]}
            selection={prefs.timeFormat}
            onSelectionChange={(value) => setTimeFormat(value === 'h23' ? 'h23' : 'h12')}
          >
            <UIText key="h12" modifiers={[tag('h12')]}>
              {t`12-hour`}
            </UIText>
            <UIText key="h23" modifiers={[tag('h23')]}>
              {t`24-hour`}
            </UIText>
          </Picker>
        </Section>

        {/* Value on the right with a chevron — same row idiom as the P&L goal. */}
        <Section
          title={t`Screenshots`}
          footer={
            <UIText>{t`Caps how many images one trade keeps, so a busy day of chart grabs doesn't fill the device.`}</UIText>
          }
        >
          <Button onPress={editMaxScreenshots}>
            <HStack spacing={8}>
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {t`Per trade`}
              </UIText>
              <Spacer />
              <UIText
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  monospacedDigit(),
                ]}
              >
                {prefs.maxScreenshotsPerTrade != null
                  ? String(prefs.maxScreenshotsPerTrade)
                  : t`No limit`}
              </UIText>
              <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Button>
        </Section>

        {isDefaultDisplayPrefs(prefs) ? null : (
          <Section>
            <CenteredButton
              role="destructive"
              label={t`Reset to defaults`}
              onPress={confirmReset}
            />
          </Section>
        )}
      </SettingsForm>
    </Host>
  );
}
