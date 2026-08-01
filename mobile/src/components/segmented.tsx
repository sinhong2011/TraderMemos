import { Host, Picker, Text as UIText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

type SegmentedProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Native UISegmentedControl (SwiftUI segmented Picker) — the range/dim switcher on cards. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <Host matchContents>
      <Picker
        selection={value}
        onSelectionChange={(selection) => {
          if (selection != null) onChange(selection);
        }}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option) => (
          <UIText key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </UIText>
        ))}
      </Picker>
    </Host>
  );
}
