import { DatePicker } from '@expo/ui/swift-ui';

import { AppHost } from '@/components/app-host';
import type { DateFieldProps } from './date-field.types';

/**
 * The compact SwiftUI `DatePicker` — the system draws the pill(s) itself.
 *
 * `ignoreSafeArea` is load-bearing: a hosted SwiftUI view still insets its
 * content by the container safe area, so a picker sitting inside the
 * home-indicator band — the dividend Date row, last card on the page; the
 * note toolbar — draws its pill ~20pt above its own frame, over the row
 * divider. 'all' also keeps the keyboard inset out of it while a field is open.
 */
export function DateField({ selection, displayedComponents, onDateChange }: DateFieldProps) {
  return (
    <AppHost matchContents ignoreSafeArea="all">
      <DatePicker
        selection={selection}
        displayedComponents={displayedComponents}
        onDateChange={onDateChange}
      />
    </AppHost>
  );
}
