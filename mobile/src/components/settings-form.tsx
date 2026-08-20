import { cn } from 'panelui-native';
import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export interface SettingsFormProps extends ScrollViewProps {
  /**
   * Accepted and ignored — the SwiftUI `modifiers` array the settings screens
   * used to hand the native `Form` (`scrollDismissesKeyboard`, and before that
   * the background/section-spacing/scroll-edge set). The form is drawn in JS
   * now, so keyboard dismissal and the background are props on the scroller
   * below; the prop stays in the signature so the screens that still pass one
   * keep compiling.
   */
  modifiers?: unknown;
  children?: ReactNode;
}

/**
 * The settings-screen container: one scroller on the app background holding a
 * column of `SettingsSection` blocks.
 *
 * It replaces the SwiftUI `Form` / Compose `FieldGroup` pair with the same
 * shape drawn in JS, so both platforms get the identical grouped-list layout
 * and the 25 settings screens never branch. Section gaps, the grouped
 * background and the card surfaces all come from the theme tokens rather than
 * from platform list styling.
 *
 * `contentInsetAdjustmentBehavior="automatic"` keeps the app-wide rule for
 * scrollables under a large-title header; the keyboard settings are the ones
 * the three form screens used to ask for with `scrollDismissesKeyboard`.
 */
export function SettingsForm({
  modifiers: _modifiers,
  className,
  contentContainerClassName,
  children,
  ...props
}: SettingsFormProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      className={cn('flex-1 bg-background', className)}
      contentContainerClassName={cn('gap-6 px-4 py-4', contentContainerClassName)}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
