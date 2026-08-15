import { Tabs } from 'panelui-native';

type Option<T extends string> = { value: T; label: string };

/**
 * Capsule pill tabs for pager sections — PanelUI's `segmented` tab set (a
 * raised chip travelling inside a recessed track on the shared spring) over a
 * fixed option set. Equal-width triggers so five sections fit a phone without
 * scrolling.
 *
 * The panels stay with the caller: this renders the strip only, because the
 * screens using it (Reports) already own their section content and its scroll
 * position.
 */
export function PagerTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Tabs
      className="self-stretch"
      value={value}
      defaultValue={value}
      onValueChange={(next) => onChange(next as T)}
    >
      <Tabs.List>
        {options.map((option) => (
          <Tabs.Trigger key={option.value} value={option.value}>
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
