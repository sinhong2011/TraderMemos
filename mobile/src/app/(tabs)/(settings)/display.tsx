import { Alert } from 'react-native';

import { useAccounts } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import {
  NumericText,
  SettingsPicker,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { useFormatters } from '@/lib/format';
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
 * → what a day is → what a clock reads". Formatting only: the screenshots cap
 * is a journaling rule and lives under Trading & journal on the hub.
 *
 * The market timezone is the consequential pick (it re-buckets every calendar
 * day and hourly stat), so it sits with the trade date basis under Trading day;
 * the display timezone only re-labels clock times and stays under Clock.
 */
export default function DisplaySettingsScreen() {
  const prefs = useDisplayPrefs();
  // The preview reformats on every pref below — including privacy mode, which
  // only reaches it through these bound formatters (see lib/format.ts).
  const { formatCurrency, formatDate, formatTime } = useFormatters();
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

  function confirmReset() {
    Alert.alert(
      t`Reset display settings?`,
      t`Privacy, currency, and clocks go back to their defaults.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Reset`, style: 'destructive', onPress: () => resetDisplayPrefs() },
      ],
    );
  }

  return (
    <SettingsForm>
      {/* Live consequence of every setting below — amounts mask under privacy
          mode, and the trading day drifts off the timestamp when the two
          timezones disagree. */}
      <SettingsSection
        title={t`Preview`}
        footer={t`A sample amount and a late-session timestamp, rendered with the settings below.`}
      >
        <SettingsRow label={t`Amount`}>
          <NumericText>{formatCurrency(SAMPLE_AMOUNT, previewCurrency)}</NumericText>
        </SettingsRow>
        <SettingsRow label={t`Timestamp`}>
          <NumericText>{`${formatDate(at)} · ${formatTime(at)}`}</NumericText>
        </SettingsRow>
        <SettingsRow label={t`Trading day`}>
          <NumericText>{marketDay}</NumericText>
        </SettingsRow>
      </SettingsSection>

      {/* Privacy and currency both answer "what does money look like", so they
          share a section instead of each orphaning one row. */}
      <SettingsSection
        title={t`Amounts`}
        footer={
          prefs.displayCurrency
            ? t`Privacy mode hides amounts everywhere — stats and ratios stay visible. Read-only amounts convert with the latest FX rate; forms keep the account currency (${baseCurrency}).`
            : t`Privacy mode hides amounts everywhere — stats and ratios stay visible. Amounts show in each account's own currency.`
        }
      >
        <SettingsToggle
          label={t`Privacy mode`}
          value={prefs.privacyMode}
          onValueChange={(value) => setPrivacyMode(value)}
        />
        <SettingsPicker
          label={t`Display currency`}
          selectedValue={prefs.displayCurrency ?? CURRENCY_BASE}
          onValueChange={(value) =>
            setDisplayCurrency(value === CURRENCY_BASE ? null : (value as DisplayCurrencyCode))
          }
          items={[
            { label: t`Account currency`, value: CURRENCY_BASE },
            ...DISPLAY_CURRENCIES.map((code) => ({ label: code, value: code })),
          ]}
        />
      </SettingsSection>

      {/* Both rows decide which calendar day a trade lands on. */}
      <SettingsSection
        title={t`Trading day`}
        footer={t`The market timezone defines the day — calendar cells, date filters, and hourly stats all follow it. Close date (last activity) matches realized P&L; open date groups by entry.`}
      >
        <SettingsPicker
          label={t`Market timezone`}
          selectedValue={prefs.marketTimezone}
          onValueChange={(value) => setMarketTimezone(value as MarketTimezonePref)}
          items={marketTimezoneOptions()}
        />
        <SettingsPicker
          label={t`Trade lands on`}
          selectedValue={prefs.tradeDateBasis}
          onValueChange={(value) => setTradeDateBasis(value === 'open' ? 'open' : 'close')}
          items={[
            { label: t`Close date`, value: 'close' },
            { label: t`Open date`, value: 'open' },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        title={t`Clock`}
        footer={
          // Last section on the screen, so its footer also says which of the
          // rows above travel with the account — this screen mixes both kinds.
          prefs.timezone === TIMEZONE_LOCAL
            ? t`Formats clock times only — never which day a trade belongs to. 12-hour reads 1:30 PM, 24-hour reads 13:30. This device is on ${resolveDisplayTimezone(TIMEZONE_LOCAL)}. Timezones, time format and display currency follow your account and apply on every device; privacy mode and theme stay on this phone.`
            : t`Formats clock times only — never which day a trade belongs to. 12-hour reads 1:30 PM, 24-hour reads 13:30. Timezones, time format and display currency follow your account and apply on every device; privacy mode and theme stay on this phone.`
        }
      >
        <SettingsPicker
          label={t`Display timezone`}
          selectedValue={prefs.timezone}
          onValueChange={(value) => setTimezone(value as TimezonePref)}
          items={timezoneOptions()}
        />
        <SettingsPicker
          label={t`Time format`}
          selectedValue={prefs.timeFormat}
          onValueChange={(value) => setTimeFormat(value === 'h23' ? 'h23' : 'h12')}
          items={[
            { label: t`12-hour`, value: 'h12' },
            { label: t`24-hour`, value: 'h23' },
          ]}
        />
      </SettingsSection>

      {/* Standalone action, not a row: a filled button inside a section card
          would fill the card edge to edge and read as a red panel. */}
      {isDefaultDisplayPrefs(prefs) ? null : (
        <CenteredButton role="destructive" label={t`Reset to defaults`} onPress={confirmReset} />
      )}
    </SettingsForm>
  );
}
