import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { McpSettings, PutMcpSettingsBody } from "@/lib/api/mcp";
import { renderWithI18n } from "@/test/renderWithI18n";
import { McpSection, mcpEndpointUrl, mcpSnippet } from "./mcp-section";

const h = vi.hoisted(() => ({
  settings: null as McpSettings | null,
  mutate: vi.fn<(body: PutMcpSettingsBody) => void>(),
}));

vi.mock("@/lib/hooks/useMcpSettings", () => ({
  useMcpSettings: () => ({ data: h.settings, isLoading: false, isError: false }),
  useSaveMcpSettings: () => ({ mutate: h.mutate, isPending: false }),
}));

function settings(patch: Partial<McpSettings> = {}): McpSettings {
  return {
    available: true,
    enabled: false,
    allow_writes: false,
    endpoint_path: "/api/v1/mcp",
    ...patch,
  };
}

function renderSection() {
  return renderWithI18n(
    <Toaster>
      <McpSection />
    </Toaster>,
  );
}

describe("mcpEndpointUrl", () => {
  it("joins a same-origin API base onto the page origin", () => {
    expect(mcpEndpointUrl("/api/v1", "/api/v1/mcp", "https://journal.example.com")).toBe(
      "https://journal.example.com/api/v1/mcp",
    );
  });

  it("keeps a separately hosted API's origin", () => {
    expect(
      mcpEndpointUrl("https://api.example.com/api/v1/", "/api/v1/mcp", "https://app.example.com"),
    ).toBe("https://api.example.com/api/v1/mcp");
  });
});

describe("mcpSnippet", () => {
  it("never embeds a real token, only a placeholder", () => {
    for (const id of ["grok-api", "grok-build", "claude-code", "json"] as const) {
      const code = mcpSnippet(id, "https://x.example/api/v1/mcp");
      expect(code).toContain("https://x.example/api/v1/mcp");
      expect(code).not.toMatch(/tm_pat_[A-Za-z0-9_-]{8,}/);
    }
    expect(mcpSnippet("grok-api", "u")).toContain('authorization="<YOUR_TM_PAT>"');
    expect(JSON.parse(mcpSnippet("json", "u"))).toEqual({
      mcpServers: {
        tradermemos: { type: "http", url: "u", headers: { Authorization: "Bearer <YOUR_TM_PAT>" } },
      },
    });
  });
});

describe("McpSection", () => {
  beforeEach(() => {
    h.mutate.mockReset();
  });

  it("starts off and read-only, with writes locked until MCP is on", () => {
    h.settings = settings();
    renderSection();
    expect(screen.getByRole("switch", { name: "Allow MCP connections" })).not.toBeChecked();
    const writes = screen.getByRole("switch", { name: "Allow changes" });
    expect(writes).not.toBeChecked();
    expect(writes).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByText(/\/api\/v1\/mcp$/)).toBeInTheDocument();
  });

  it("turns MCP on without touching write access", async () => {
    h.settings = settings();
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("switch", { name: "Allow MCP connections" }));
    expect(h.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutate.mock.calls[0]?.[0]).toEqual({ enabled: true, allow_writes: false });
  });

  it("turns writes on and back off", async () => {
    h.settings = settings({ enabled: true });
    const user = userEvent.setup();
    const { unmount } = renderSection();
    await user.click(screen.getByRole("switch", { name: "Allow changes" }));
    expect(h.mutate.mock.calls[0]?.[0]).toEqual({ enabled: true, allow_writes: true });
    unmount();

    h.settings = settings({ enabled: true, allow_writes: true });
    renderSection();
    expect(screen.getByText("Read & write")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Allow changes" }));
    expect(h.mutate.mock.calls[1]?.[0]).toEqual({ enabled: true, allow_writes: false });
  });

  it("turning MCP off keeps the stored write choice", async () => {
    h.settings = settings({ enabled: true, allow_writes: true });
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("switch", { name: "Allow MCP connections" }));
    expect(h.mutate.mock.calls[0]?.[0]).toEqual({ enabled: false, allow_writes: true });
  });

  it("explains and locks the switches when the server disabled MCP", () => {
    h.settings = settings({ available: false });
    renderSection();
    expect(screen.getByText(/TM_MCP_ENABLED=false/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Allow MCP connections" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("switches client snippets", async () => {
    h.settings = settings({ enabled: true });
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByText(/xai_sdk/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Claude Code" }));
    expect(screen.getByText(/claude mcp add --transport http/)).toBeInTheDocument();
  });
});
