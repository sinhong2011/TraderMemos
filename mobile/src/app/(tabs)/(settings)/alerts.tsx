import { Section, Text as UIText, Toggle } from '@expo/ui/swift-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useAlertSettings, useApiRequest } from '@/api/hooks';
import type { AlertSettings } from '@/api/types';
import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';
import { SettingsForm } from '@/components/settings-form';
import { errorMessage } from '@/lib/errors';
import {
  deviceLabel,
  obtainPushToken,
  PushUnavailableError,
  usePushAlertStore,
} from '@/lib/push-alerts';

/**
 * Journal alerts: whether this device gets push, plus the master switch and
 * per-rule toggles (server-evaluated, delivered to every enabled channel).
 * Thresholds and webhook channels are edited on the web — this screen stays a
 * plain toggle list, per the settings idiom.
 */
export default function AlertsScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const settings = useAlertSettings();
  const pushToken = usePushAlertStore((s) => s.token);
  const [pushBusy, setPushBusy] = useState(false);

  const save = useMutation({
    mutationFn: (body: AlertSettings) => api('/settings/alerts', { method: 'PUT', body }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.alertSettings(), data),
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const patch = (change: Partial<AlertSettings>) => {
    if (!settings.data) return;
    save.mutate({ ...settings.data, ...change });
  };

  async function enablePush() {
    setPushBusy(true);
    try {
      const token = await obtainPushToken();
      await api('/me/push-tokens', {
        method: 'POST',
        body: { token, label: deviceLabel() },
      });
      usePushAlertStore.setState({ token });
    } catch (err) {
      if (err instanceof PushUnavailableError) {
        Alert.alert(
          t`Push unavailable`,
          t`Allow notifications for TraderMemos in iOS Settings, and use a physical device.`,
        );
      } else {
        Alert.alert(t`Could not register`, errorMessage(err));
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!pushToken) return;
    setPushBusy(true);
    try {
      await api('/me/push-tokens', { method: 'DELETE', body: { token: pushToken } });
      usePushAlertStore.setState({ token: null });
    } catch (err) {
      Alert.alert(t`Could not unregister`, errorMessage(err));
    } finally {
      setPushBusy(false);
    }
  }

  const s = settings.data;
  const enabled = s?.enabled ?? false;

  return (
    <AppHost>
      <SettingsForm>
        <Section
          footer={
            <UIText>{t`Alerts are evaluated on your server after every trade and delivered to each registered device and webhook. Free, always.`}</UIText>
          }
        >
          <Toggle
            label={t`Push to this device`}
            isOn={pushToken != null}
            onIsOnChange={(value) => {
              if (pushBusy) return;
              void (value ? enablePush() : disablePush());
            }}
          />
        </Section>

        {s ? (
          <Section
            title={t`Rules`}
            footer={
              <UIText>{t`Thresholds, timezone, and webhook channels are edited in web Settings → Rules.`}</UIText>
            }
          >
            <Toggle
              label={t`Enable alerts`}
              isOn={enabled}
              onIsOnChange={(value) => patch({ enabled: value })}
            />
            <Toggle
              label={t`Risk rule broken`}
              isOn={s.rule_risk}
              onIsOnChange={(value) => patch({ rule_risk: value })}
            />
            <Toggle
              label={t`Daily loss limit`}
              isOn={s.rule_daily_loss}
              onIsOnChange={(value) => patch({ rule_daily_loss: value })}
            />
            <Toggle
              label={t`${s.loss_streak_n} losses in a row`}
              isOn={s.rule_loss_streak}
              onIsOnChange={(value) => patch({ rule_loss_streak: value })}
            />
            <Toggle
              label={t`Prop drawdown`}
              isOn={s.rule_prop_drawdown}
              onIsOnChange={(value) => patch({ rule_prop_drawdown: value })}
            />
            <Toggle
              label={t`Unreviewed trades`}
              isOn={s.rule_unreviewed}
              onIsOnChange={(value) => patch({ rule_unreviewed: value })}
            />
          </Section>
        ) : null}
      </SettingsForm>
    </AppHost>
  );
}
