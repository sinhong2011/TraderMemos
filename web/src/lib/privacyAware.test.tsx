import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { useDisplayPrefs } from "./displayPrefs";
import { privacyAware } from "./privacyAware";

function Probe({ __privacyMode: _privacyMode }: { __privacyMode?: boolean } = {}) {
  // Mimic fmtMoney*: read privacy via getState at render time only.
  const privacy = useDisplayPrefs.getState().privacyMode;
  return <span data-testid="probe">{privacy ? "masked" : "visible"}</span>;
}

const AwareProbe = privacyAware(Probe);

describe("privacyAware", () => {
  beforeEach(() => {
    useDisplayPrefs.setState({ displayCurrency: null, privacyMode: false });
  });

  it("re-renders wrapped component when privacy mode toggles", () => {
    render(<AwareProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("visible");

    act(() => {
      useDisplayPrefs.getState().setPrivacyMode(true);
    });

    expect(screen.getByTestId("probe")).toHaveTextContent("masked");
  });
});
