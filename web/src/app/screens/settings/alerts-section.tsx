import { Bell, Plus, Send, Smartphone, Webhook } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { FormInput } from "@/components/FormInput";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { AlertChannel, AlertSettings } from "@/lib/api/alerts";
import {
  useAlertChannels,
  useAlertEvents,
  useAlertSettings,
  useCreateWebhookChannel,
  useDeleteAlertChannel,
  useSaveAlertSettings,
  useSetAlertChannelEnabled,
  useTestAlertChannel,
} from "@/lib/hooks/useAlerts";
import { timezoneSelectOptions, TIMEZONE_LOCAL, resolveDisplayTimezone } from "@/lib/displayPrefs";
import { fmtDateTime } from "@/lib/format";
import {
  BtnGhost,
  DeleteButton,
  SettingsGroup,
  SettingsGroupRow,
  SettingsPanelBody,
  SettingsSection,
} from "./settings-ui";

/** Small bounded integer input that commits on blur/Enter. */
function IntInput({
  value,
  min,
  max,
  suffix,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (!Number.isFinite(n) || n < min || n > max || n === value) return;
    onCommit(n);
  };
  return (
    <span className="flex items-center gap-1.5">
      <FormInput
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-20 text-right tabular-nums"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix ? <span className="text-[12px] text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

function channelName(ch: AlertChannel): string {
  if (ch.label) return ch.label;
  if (ch.kind === "expo") return "Mobile push";
  try {
    return new URL(ch.target).host;
  } catch {
    return ch.target;
  }
}

function ChannelStatus({ ch }: { ch: AlertChannel }) {
  if (!ch.enabled) {
    return <span className="text-[11px] text-muted-foreground">Off</span>;
  }
  if (ch.last_status === "error") {
    return (
      <span className="max-w-48 truncate text-[11px] text-destructive" title={ch.last_error}>
        {ch.last_error || "Delivery failed"}
      </span>
    );
  }
  if (ch.last_status === "ok" && ch.last_sent_at) {
    return (
      <span className="text-[11px] text-muted-foreground">Sent {fmtDateTime(ch.last_sent_at)}</span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">Never sent</span>;
}

export function AlertsSection() {
  const toast = useToastManager();
  const settingsQ = useAlertSettings();
  const saveM = useSaveAlertSettings();
  const channelsQ = useAlertChannels();
  const createWebhookM = useCreateWebhookChannel();
  const setEnabledM = useSetAlertChannelEnabled();
  const deleteChannelM = useDeleteAlertChannel();
  const testM = useTestAlertChannel();
  const eventsQ = useAlertEvents(10);

  const settings = settingsQ.data;
  const enabled = settings?.enabled ?? false;

  const [webhookModal, setWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookLabel, setWebhookLabel] = useState("");
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const save = (patch: Partial<AlertSettings>) => {
    if (!settings) return;
    saveM.mutate(
      { ...settings, ...patch },
      {
        onError: (err) =>
          toast.add({
            title: "Could not save alert settings",
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  };

  const submitWebhook = async () => {
    const target = webhookUrl.trim();
    if (!/^https?:\/\//.test(target)) {
      setWebhookError("Enter an http(s) webhook URL");
      return;
    }
    try {
      await createWebhookM.mutateAsync({ target, label: webhookLabel.trim() || undefined });
      setWebhookModal(false);
      setWebhookUrl("");
      setWebhookLabel("");
      setWebhookError(null);
      toast.add({ title: "Webhook added" });
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : "Could not add webhook");
    }
  };

  const runTest = async (ch: AlertChannel) => {
    setTestingId(ch.id);
    try {
      const res = await testM.mutateAsync(ch.id);
      if (res.ok) {
        toast.add({ title: "Test alert sent", description: channelName(ch) });
      } else {
        toast.add({ title: "Test failed", description: res.error });
      }
    } catch (err) {
      toast.add({
        title: "Test failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTestingId(null);
    }
  };

  // Concrete IANA zones only — the server buckets "today" with this.
  const tzOptions = timezoneSelectOptions().filter((o) => o.value !== TIMEZONE_LOCAL);
  const tzValue = settings?.timezone || "UTC";

  const channels = channelsQ.data ?? [];
  const events = eventsQ.data ?? [];

  return (
    <>
      <SettingsSection
        title="Journal Alerts"
        description="Notifications when a journal rule is broken, evaluated on your own server after every trade write and on a background scan. Delivered to mobile push and webhooks — free, always."
      >
        {settingsQ.isLoading ? (
          <SettingsPanelBody>
            <ListSkeleton rows={4} />
          </SettingsPanelBody>
        ) : settingsQ.isError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-destructive">Failed to load alert settings.</p>
          </SettingsPanelBody>
        ) : settings ? (
          <SettingsGroup>
            <SettingsGroupRow label="Enable alerts" detail="Master switch for every rule below.">
              <Switch
                checked={enabled}
                onCheckedChange={(v) => save({ enabled: v })}
                aria-label="Enable alerts"
              />
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Risk rule broken"
              detail="A closed trade risked more than your max risk per trade (set under Risk Rules)."
            >
              <Switch
                checked={settings.rule_risk}
                disabled={!enabled}
                onCheckedChange={(v) => save({ rule_risk: v })}
                aria-label="Risk rule broken alerts"
              />
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Daily loss limit"
              detail="Realized P&L dipped below your max daily loss, even if the day recovered."
            >
              <Switch
                checked={settings.rule_daily_loss}
                disabled={!enabled}
                onCheckedChange={(v) => save({ rule_daily_loss: v })}
                aria-label="Daily loss limit alerts"
              />
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Consecutive losses"
              detail="This many losing trades in a row, ending today."
            >
              <span className="flex items-center gap-3">
                <IntInput
                  value={settings.loss_streak_n}
                  min={1}
                  max={50}
                  suffix="losses"
                  disabled={!enabled || !settings.rule_loss_streak}
                  ariaLabel="Loss streak threshold"
                  onCommit={(n) => save({ loss_streak_n: n })}
                />
                <Switch
                  checked={settings.rule_loss_streak}
                  disabled={!enabled}
                  onCheckedChange={(v) => save({ rule_loss_streak: v })}
                  aria-label="Consecutive losses alerts"
                />
              </span>
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Prop drawdown approaching"
              detail="A prop account has consumed this share of its drawdown budget. Breaches always alert."
            >
              <span className="flex items-center gap-3">
                <IntInput
                  value={Math.round(settings.prop_warn_pct * 100)}
                  min={1}
                  max={99}
                  suffix="%"
                  disabled={!enabled || !settings.rule_prop_drawdown}
                  ariaLabel="Prop drawdown warning percentage"
                  onCommit={(n) => save({ prop_warn_pct: n / 100 })}
                />
                <Switch
                  checked={settings.rule_prop_drawdown}
                  disabled={!enabled}
                  onCheckedChange={(v) => save({ rule_prop_drawdown: v })}
                  aria-label="Prop drawdown alerts"
                />
              </span>
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Unreviewed trades"
              detail="A weekly nudge when closed trades older than this have no journal notes."
            >
              <span className="flex items-center gap-3">
                <IntInput
                  value={settings.unreviewed_days}
                  min={1}
                  max={90}
                  suffix="days"
                  disabled={!enabled || !settings.rule_unreviewed}
                  ariaLabel="Unreviewed trades age threshold"
                  onCommit={(n) => save({ unreviewed_days: n })}
                />
                <Switch
                  checked={settings.rule_unreviewed}
                  disabled={!enabled}
                  onCheckedChange={(v) => save({ rule_unreviewed: v })}
                  aria-label="Unreviewed trades alerts"
                />
              </span>
            </SettingsGroupRow>
            <SettingsGroupRow
              label="Timezone"
              detail={`Sets when "today" rolls over for daily rules.`}
              last
            >
              <NativeSelect
                value={tzOptions.some((o) => o.value === tzValue) ? tzValue : "UTC"}
                disabled={!enabled}
                onChange={(e) => {
                  const v = e.target.value;
                  save({
                    timezone: v === TIMEZONE_LOCAL ? resolveDisplayTimezone(TIMEZONE_LOCAL) : v,
                  });
                }}
                aria-label="Alert timezone"
                className="w-full"
                wrapperClassName="w-full"
              >
                {tzOptions.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </SettingsGroupRow>
          </SettingsGroup>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Alert Channels"
        description="Where alerts get delivered. Webhooks post JSON that renders natively in Discord, Slack, and ntfy; mobile push registers itself when you sign in on the app."
        action={
          <BtnGhost onClick={() => setWebhookModal(true)} disabled={channelsQ.isLoading}>
            <Plus size={13} strokeWidth={1.5} />
            Add webhook
          </BtnGhost>
        }
      >
        {channelsQ.isLoading ? (
          <SettingsPanelBody>
            <ListSkeleton rows={2} />
          </SettingsPanelBody>
        ) : channelsQ.isError ? (
          <SettingsPanelBody>
            <p className="text-[12px] text-destructive">Failed to load alert channels.</p>
          </SettingsPanelBody>
        ) : channels.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <EmptyState
              title="No channels yet"
              hint="Add a Discord, Slack, or ntfy webhook — or sign in on the mobile app to register push."
              icon={<Bell size={28} strokeWidth={1.5} />}
            />
          </SettingsPanelBody>
        ) : (
          <SettingsGroup>
            {channels.map((ch, index) => (
              <SettingsGroupRow
                key={ch.id}
                label={
                  <span className="flex items-center gap-2">
                    {ch.kind === "expo" ? (
                      <Smartphone size={14} strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Webhook size={14} strokeWidth={1.5} aria-hidden />
                    )}
                    {channelName(ch)}
                  </span>
                }
                detail={
                  <span className="flex flex-col gap-0.5">
                    {ch.kind === "webhook" ? (
                      <span className="max-w-72 truncate" title={ch.target}>
                        {ch.target}
                      </span>
                    ) : null}
                    <ChannelStatus ch={ch} />
                  </span>
                }
                last={index === channels.length - 1}
              >
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingId === ch.id}
                    onClick={() => void runTest(ch)}
                  >
                    <Send size={13} strokeWidth={1.5} />
                    {testingId === ch.id ? "Sending…" : "Test"}
                  </Button>
                  <Switch
                    checked={ch.enabled}
                    onCheckedChange={(v) => setEnabledM.mutate({ id: ch.id, enabled: v })}
                    aria-label={`Enable ${channelName(ch)}`}
                  />
                  <DeleteButton
                    label={channelName(ch)}
                    onDelete={() => deleteChannelM.mutate(ch.id)}
                  />
                </span>
              </SettingsGroupRow>
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>

      {events.length > 0 ? (
        <SettingsSection
          title="Recent Alerts"
          description="The last alerts this server fired, newest first."
        >
          <SettingsGroup>
            {events.map((ev, index) => (
              <SettingsGroupRow
                key={ev.id}
                label={ev.title}
                detail={ev.body}
                last={index === events.length - 1}
              >
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {fmtDateTime(ev.fired_at)}
                </span>
              </SettingsGroupRow>
            ))}
          </SettingsGroup>
        </SettingsSection>
      ) : null}

      <Modal
        open={webhookModal}
        onOpenChange={(open) => {
          setWebhookModal(open);
          if (!open) setWebhookError(null);
        }}
        title="Add webhook"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setWebhookModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createWebhookM.isPending}
              onClick={() => void submitWebhook()}
            >
              {createWebhookM.isPending ? "Adding…" : "Add webhook"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Webhook URL" error={webhookError ?? undefined}>
            <FormInput
              type="url"
              placeholder="https://discord.com/api/webhooks/…"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookError(null);
              }}
              autoFocus
            />
          </Field>
          <Field label="Label (optional)">
            <FormInput
              placeholder="Trading Discord"
              value={webhookLabel}
              onChange={(e) => setWebhookLabel(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
