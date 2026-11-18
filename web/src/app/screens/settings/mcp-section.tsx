import { t } from "@lingui/core/macro";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToastManager } from "@/components/Toast";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { apiRootUrl, getBaseUrl } from "@/lib/api/client";
import { useMcpSettings, useSaveMcpSettings } from "@/lib/hooks/useMcpSettings";
import { cn } from "@/lib/cn";
import { SettingsCard, SettingsCardNote, SettingsGroupRow } from "./settings-ui";

/** The token is never filled in: snippets carry a placeholder the user swaps. */
const TOKEN_PLACEHOLDER = "<YOUR_TM_PAT>";

/**
 * Absolute MCP endpoint URL. The API base is either absolute (separately
 * hosted API) or a path on this origin (bundled deployment).
 */
export function mcpEndpointUrl(apiBase: string, endpointPath: string, origin: string): string {
  const url = apiRootUrl(apiBase, endpointPath);
  return /^https?:\/\//i.test(url) ? url : `${origin.replace(/\/+$/, "")}${url}`;
}

export type McpClientId = "grok-api" | "grok-build" | "claude-code" | "json";

export function mcpSnippet(client: McpClientId, url: string): string {
  switch (client) {
    case "grok-api":
      return `from xai_sdk import Client
from xai_sdk.tools import mcp

client = Client()  # reads XAI_API_KEY
chat = client.chat.create(
    model="grok-4.7",
    tools=[mcp(
        server_url="${url}",
        server_label="tradermemos",
        authorization="${TOKEN_PLACEHOLDER}",
    )],
)`;
    case "grok-build":
      return `grok mcp add --transport http tradermemos ${url} \\
  --header "Authorization: Bearer \${TRADERMEMOS_TOKEN}"`;
    case "claude-code":
      return `claude mcp add --transport http tradermemos ${url} \\
  --header "Authorization: Bearer \${TRADERMEMOS_TOKEN}"`;
    case "json":
      return JSON.stringify(
        {
          mcpServers: {
            tradermemos: {
              type: "http",
              url,
              headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
            },
          },
        },
        null,
        2,
      );
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToastManager();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            toast.add({ title: t`Copied` });
          },
          () => toast.add({ title: t`Couldn't copy — select the text instead` }),
        );
      }}
    >
      {copied ? (
        <Check size={13} strokeWidth={1.5} aria-hidden />
      ) : (
        <Copy size={13} strokeWidth={1.5} aria-hidden />
      )}
      {copied ? t`Copied` : t`Copy`}
    </Button>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <pre className="m-0 overflow-x-auto rounded-md bg-muted px-3.5 py-3 text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <div className="flex justify-end">
        <CopyButton value={code} label={label} />
      </div>
    </div>
  );
}

const SECTION_LABEL = "text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

export function McpSection() {
  const toast = useToastManager();
  const settingsQ = useMcpSettings();
  const save = useSaveMcpSettings();
  const [client, setClient] = useState<McpClientId>("grok-api");

  const settings = settingsQ.data;
  const available = settings?.available ?? true;
  const enabled = settings?.enabled ?? false;
  const allowWrites = settings?.allow_writes ?? false;
  const url = mcpEndpointUrl(
    getBaseUrl(),
    settings?.endpoint_path ?? "/api/v1/mcp",
    window.location.origin,
  );

  function update(next: { enabled: boolean; allow_writes: boolean }) {
    save.mutate(next, {
      onError: (err) =>
        toast.add({
          title: t`Couldn't save MCP settings`,
          description: err instanceof Error ? err.message : undefined,
        }),
    });
  }

  const clients: { id: McpClientId; label: string; hint: string }[] = [
    {
      id: "grok-api",
      label: t`Grok (xAI API)`,
      hint: t`xAI's servers call TraderMemos, so this URL must be reachable from the internet over HTTPS. Pass the token as-is in the authorization field.`,
    },
    {
      id: "grok-build",
      label: t`Grok Build`,
      hint: t`Runs on your machine. Set TRADERMEMOS_TOKEN in your shell first.`,
    },
    {
      id: "claude-code",
      label: t`Claude Code`,
      hint: t`Set TRADERMEMOS_TOKEN in your shell first.`,
    },
    {
      id: "json",
      label: t`Other clients`,
      hint: t`Most MCP clients (Cursor, VS Code, Windsurf…) accept this shape: a Streamable HTTP URL plus an Authorization header.`,
    },
  ];

  return (
    <SettingsCard
      id="mcp"
      title={t`MCP for AI assistants`}
      description={t`Let Grok, Claude, ChatGPT and other Model Context Protocol clients work with your journal using a personal access token. This is separate from the built-in AI coach.`}
    >
      {settingsQ.isLoading ? (
        <div className="px-5 py-3">
          <ListSkeleton rows={2} />
        </div>
      ) : settingsQ.isError ? (
        <SettingsCardNote tone="destructive">{t`Failed to load MCP settings.`}</SettingsCardNote>
      ) : (
        <>
          {!available ? (
            <SettingsCardNote>
              {t`MCP is turned off for this server (TM_MCP_ENABLED=false). Ask the server owner to enable it.`}
            </SettingsCardNote>
          ) : null}
          <SettingsGroupRow
            label={t`Allow MCP connections`}
            detail={t`When off, every token is refused at the MCP endpoint. The REST API is unaffected.`}
          >
            <span className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">
                {enabled ? t`On` : t`Off`}
              </span>
              <Switch
                checked={enabled}
                disabled={!available || save.isPending}
                onCheckedChange={(v) => update({ enabled: v, allow_writes: allowWrites })}
                aria-label={t`Allow MCP connections`}
              />
            </span>
          </SettingsGroupRow>
          <SettingsGroupRow
            label={t`Allow changes`}
            detail={t`Off: assistants can only read. On: they can also log executions and edit or delete trades and notes. Deletions can't be undone.`}
          >
            <span className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">
                {allowWrites ? t`Read & write` : t`Read-only`}
              </span>
              <Switch
                checked={allowWrites}
                disabled={!available || !enabled || save.isPending}
                onCheckedChange={(v) => update({ enabled, allow_writes: v })}
                aria-label={t`Allow changes`}
              />
            </span>
          </SettingsGroupRow>

          <div
            className={cn(
              "flex flex-col gap-5 px-5 pb-2 pt-3 transition-opacity duration-150 motion-reduce:transition-none",
              (!enabled || !available) && "opacity-60",
            )}
          >
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>{t`Endpoint`}</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-[12px] text-foreground">
                  {url}
                </code>
                <CopyButton value={url} label={t`Copy endpoint URL`} />
              </div>
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                {t`Streamable HTTP transport. Use the address your assistant can reach — behind a reverse proxy, that's your public URL.`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={SECTION_LABEL}>{t`Authentication`}</span>
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                {t`Send a personal access token (tm_pat_…) as "Authorization: Bearer <token>". Create one token per assistant under Access tokens above — the token is shown only once and never appears here.`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={SECTION_LABEL}>{t`Disconnecting`}</span>
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                {t`Revoke an assistant's token under Access tokens; it stops working on its next request. Turning off MCP above blocks all of them at once. Only a signed-in session can change these switches — a token can't grant itself write access.`}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <span className={SECTION_LABEL}>{t`Connect a client`}</span>
              <Tabs value={client} onValueChange={(v) => setClient(v as McpClientId)}>
                <TabsList aria-label={t`MCP client`} className="flex-wrap">
                  {clients.map((c) => (
                    <TabsTab key={c.id} value={c.id}>
                      {c.label}
                    </TabsTab>
                  ))}
                </TabsList>
                {clients.map((c) => (
                  <TabsPanel key={c.id} value={c.id} className="flex flex-col gap-2 pt-3">
                    <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                      {c.hint}
                    </p>
                    <CodeBlock code={mcpSnippet(c.id, url)} label={t`Copy configuration`} />
                  </TabsPanel>
                ))}
              </Tabs>
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                {t`Grok's web and app connectors require OAuth sign-in, which TraderMemos doesn't offer; use the xAI API or Grok Build instead.`}
              </p>
            </div>
          </div>
        </>
      )}
    </SettingsCard>
  );
}
