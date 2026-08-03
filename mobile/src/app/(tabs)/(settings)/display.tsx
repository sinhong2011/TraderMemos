import { Button, Host, Picker, Section, Text as UIText, Toggle } from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';
import { Alert } from 'react-native';

import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import {
  DISPLAY_CURRENCIES,
  marketTimezoneOptions,
  setDisplayCurrency,
  setMarketTimezone,
  setMaxScreenshotsPerTrade,
  setPrivacyMode,
  setTimeFormat,
  setTimezone,
  setTradeDateBasis,
  timezoneOptions,
  useDisplayPrefs,
  type DisplayCurrencyCode,
  type MarketTimezonePref,
  type TimezonePref,
} from '@/lib/prefs';

/** Sentinel for the "follow account base currency" picker row. */
const CURRENCY_BASE = '__base__';

/**
 * Display preferences — privacy, currency, clocks. The market timezone is the
 * consequential pick here (it re-buckets every calendar day and hourly stat),
 * so it carries the explanatory footer; the display timezone only re-labels
 * clock times.
 */
export default function DisplaySettingsScreen() {
  const prefs = useDisplayPrefs();

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

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm>
        <Section
          title={t`Privacy`}
          footer={<UIText>{t`Hide amounts everywhere — stats and ratios stay visible.`}</UIText>}
        >
          <Toggle
            label={t`Privacy mode`}
            isOn={prefs.privacyMode}
            onIsOnChange={(value) => setPrivacyMode(value)}
          />
        </Section>

        <Section
          title={t`Currency`}
          footer={
            <UIText>
              {t`Converts read-only amounts with the latest FX rate. Forms keep the account currency.`}
            </UIText>
          }
        >
          <Picker
            label={t`Display currency`}
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

        <Section
          title={t`Time`}
          footer={
            <UIText>
              {t`The market timezone defines the trading day — calendar days and hourly stats follow it. The display timezone only formats clock times.`}
            </UIText>
          }
        >
          <Picker
            label={t`Market timezone`}
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
            label={t`Display timezone`}
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
            selection={prefs.timeFormat}
            onSelectionChange={(value) => setTimeFormat(value === 'h23' ? 'h23' : 'h12')}
          >
            <UIText key="h12" modifiers={[tag('h12')]}>
              {t`12-hour (1:30 PM)`}
            </UIText>
            <UIText key="h23" modifiers={[tag('h23')]}>
              {t`24-hour (13:30)`}
            </UIText>
          </Picker>
        </Section>

        <Section
          title={t`Trades`}
          footer={
            <UIText>
              {t`Close date matches realized P&L; open date groups by entry day.`}
            </UIText>
          }
        >
          <Picker
            label={t`Trade date basis`}
            selection={prefs.tradeDateBasis}
            onSelectionChange={(value) => setTradeDateBasis(value === 'open' ? 'open' : 'close')}
          >
            <UIText key="close" modifiers={[tag('close')]}>
              {t`Close date (last activity)`}
            </UIText>
            <UIText key="open" modifiers={[tag('open')]}>
              {t`Open date (entry)`}
            </UIText>
          </Picker>
          <Button
            systemImage="photo.on.rectangle"
            label={
              prefs.maxScreenshotsPerTrade != null
                ? t`Screenshots per trade — ${prefs.maxScreenshotsPerTrade}`
                : t`Screenshots per trade — No limit`
            }
            onPress={editMaxScreenshots}
          />
        </Section>
      </SettingsForm>
    </Host>
  );
}
