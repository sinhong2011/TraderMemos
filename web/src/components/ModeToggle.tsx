import { useTheme, type Theme } from "./theme-provider";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

const THEME_OPTIONS: { value: Theme; labelKey: "themeLight" | "themeDark" | "themeSystem" }[] = [
  { value: "light", labelKey: "themeLight" },
  { value: "dark", labelKey: "themeDark" },
  { value: "system", labelKey: "themeSystem" },
];

type ModeToggleProps = {
  labels: {
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    themeSelector: string;
  };
  className?: string;
  wrapperClassName?: string;
};

/** Appearance control — light / dark / system (shadcn ThemeProvider). */
export function ModeToggle({ labels, className, wrapperClassName }: ModeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <NativeSelect
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label={labels.themeSelector}
      className={className}
      wrapperClassName={wrapperClassName}
    >
      {THEME_OPTIONS.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {labels[o.labelKey]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
