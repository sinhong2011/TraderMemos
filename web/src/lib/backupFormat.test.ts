import { describe, expect, it } from "vite-plus/test";
import { backupNeedsAttention } from "./api/backup";
import { fmtBackupInterval, fmtBackupTimestamp, fmtRelativeAge } from "./backupFormat";

const NOW = Date.parse("2026-10-04T12:00:00Z");

describe("fmtRelativeAge", () => {
  it("reads a just-written snapshot as now, even with clock skew", () => {
    expect(fmtRelativeAge("2026-10-04T11:59:50Z", NOW, "en-US")).toBe("now");
    expect(fmtRelativeAge("2026-10-04T12:00:05Z", NOW, "en-US")).toBe("now");
  });

  it("steps through minutes, hours and days", () => {
    expect(fmtRelativeAge("2026-10-04T11:55:00Z", NOW, "en-US")).toBe("5 minutes ago");
    expect(fmtRelativeAge("2026-10-04T09:00:00Z", NOW, "en-US")).toBe("3 hours ago");
    expect(fmtRelativeAge("2026-10-03T12:00:00Z", NOW, "en-US")).toBe("yesterday");
    expect(fmtRelativeAge("2026-09-30T12:00:00Z", NOW, "en-US")).toBe("4 days ago");
  });

  it("follows the locale it is handed", () => {
    expect(fmtRelativeAge("2026-10-04T09:00:00Z", NOW, "ja-JP")).toBe("3 時間前");
  });

  it("passes an unparseable value through", () => {
    expect(fmtRelativeAge("garbage", NOW, "en-US")).toBe("garbage");
  });
});

describe("fmtBackupTimestamp", () => {
  it("renders in the timezone and clock it is handed, not the machine's", () => {
    const iso = "2026-10-04T03:15:00Z";
    expect(fmtBackupTimestamp(iso, "en-US", "America/New_York", true)).toBe(
      "Oct 3, 2026, 11:15 PM",
    );
    expect(fmtBackupTimestamp(iso, "en-US", "Asia/Hong_Kong", false)).toBe("Oct 4, 2026, 11:15");
  });
});

describe("fmtBackupInterval", () => {
  it("picks the largest whole unit", () => {
    expect(fmtBackupInterval(1440)).toBe("24h");
    expect(fmtBackupInterval(2880)).toBe("2d");
    expect(fmtBackupInterval(60)).toBe("1h");
    expect(fmtBackupInterval(90)).toBe("90m");
    expect(fmtBackupInterval(1)).toBe("1m");
  });
});

describe("backupNeedsAttention", () => {
  it("flags failures and overdue snapshots only", () => {
    expect(backupNeedsAttention({ status: "failed" })).toBe(true);
    expect(backupNeedsAttention({ status: "stale" })).toBe(true);
    for (const status of ["ok", "none", "disabled", "unsupported"] as const) {
      expect(backupNeedsAttention({ status })).toBe(false);
    }
    expect(backupNeedsAttention(undefined)).toBe(false);
  });
});
