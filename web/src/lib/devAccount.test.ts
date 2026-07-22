import { describe, expect, it } from "vite-plus/test";
import { DEV_ACCOUNT } from "./devAccount";

describe("devAccount", () => {
  it("uses the e2e demo defaults", () => {
    expect(DEV_ACCOUNT.email).toBe("demo@tradermemos.app");
    expect(DEV_ACCOUNT.password).toBe("hunter2");
  });
});
