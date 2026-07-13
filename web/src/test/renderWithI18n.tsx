import { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { I18nProvider } from "../i18n";

export function renderWithI18n(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    ...options,
  });
}
