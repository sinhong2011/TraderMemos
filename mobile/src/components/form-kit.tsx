import { Alert, BottomSheet, cn, Input, Item, type InputProps } from 'panelui-native';
import { Fragment, useState, type ReactNode, type Ref } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextInput,
  type ScrollViewProps,
} from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

/**
 * The app's one stacked-form vocabulary, codified from the sign-in screen —
 * the reference form (`login.tsx`) — so every data-entry screen reads the
 * same: a bold label over a 52pt PanelUI field, helper text and errors under
 * the field it belongs to (never an `Alert.alert`), pickers whose trigger is
 * a field-shaped box, and one primary `Button` to commit.
 *
 * Two form contexts, one system:
 * - **Entry forms** (this kit): screens whose purpose is typing — sign-in,
 *   add user, account form, sync credentials, addresses.
 * - **Settings lists** (`settings-rows.tsx`): rows of toggles, pickers and
 *   values. No inline text inputs there — a single value edits in a prompt
 *   (`usePrompt`), anything more pushes an entry form built from this kit.
 */

/**
 * The entry-form page: one scroller on the app background, fields tracking
 * the reading measure rather than the screen (an iPad-wide input row reads as
 * a layout bug — the sign-in rule).
 */
export function FormScreen({
  className,
  contentContainerClassName,
  children,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      className={cn('flex-1 bg-background', className)}
      contentContainerClassName={cn(
        'w-full max-w-[420px] gap-5 self-center p-4 pb-12',
        contentContainerClassName,
      )}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A labelled field block: the bold label (and an optional trailing accessory —
 * a status chip, a "Forgot?" link) over whatever control the field takes.
 * Helper text and errors ride on the control itself (`description` /
 * `errorMessage` on `Input`), so they sit under the field they describe.
 */
export function FormField({
  label,
  accessory,
  children,
}: {
  label: string;
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{label}</Text>
        {accessory}
      </View>
      {children}
    </View>
  );
}

export interface FormInputProps extends InputProps {
  ref?: Ref<TextInput>;
  /** Trailing unit label inside the field (a currency code). */
  suffix?: string;
}

/**
 * The kit's text field: PanelUI `Input` at the sign-in metrics (52pt, 17px),
 * filled and borderless — the muted fill alone separates the field from the
 * void (per DESIGN.md's borderless direction); an outline on dark reads as
 * wireframe.
 */
export function FormInput({ ref, className, suffix, endContent, ...props }: FormInputProps) {
  return (
    <Input
      ref={ref}
      variant="filled"
      className={cn('min-h-[52px] rounded-3xl border-0 text-[17px]', className)}
      endContent={
        endContent ??
        (suffix != null ? (
          <Text className="text-[15px] text-muted-foreground">{suffix}</Text>
        ) : undefined)
      }
      {...props}
    />
  );
}

export interface FormPickerItem<T extends string> {
  value: T;
  label: string;
}

/**
 * Single choice in an entry form. The trigger is a field-shaped box — same
 * height, radius and fill as `FormInput`, so a form of fields and pickers
 * reads as one column — and the options arrive in the app's picker sheet
 * (52pt rows, hairline separators, the chosen row bold with a trailing
 * check — the Segmented / SettingsPicker anatomy).
 */
export function FormPicker<T extends string>({
  label,
  selectedValue,
  onValueChange,
  items,
  placeholder,
}: {
  /** Sheet title, and the trigger's accessibility name. */
  label: string;
  selectedValue: T | null;
  onValueChange: (value: T) => void;
  items: FormPickerItem<T>[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const selected = items.find((item) => item.value === selectedValue);

  return (
    <>
      <Pressable
        onPress={() => {
          // Opening from a focused field takes the keyboard down with it.
          Keyboard.dismiss();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={selected ? { text: selected.label } : undefined}
        className="min-h-[52px] flex-row items-center justify-between gap-2 rounded-3xl bg-muted px-3.5 active:opacity-60"
      >
        <Text
          className={cn('text-[17px]', selected ? 'text-foreground' : 'text-muted-foreground')}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder ?? ''}
        </Text>
        <Icon name="chevron.up.chevron.down" size={13} tintColor={mutedForeground} />
      </Pressable>
      <PickerSheet
        open={open}
        onOpenChange={setOpen}
        title={label}
        items={items}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      />
    </>
  );
}

/**
 * The app's one options sheet — the picker anatomy every "choose one of
 * these" surface shares (FormPicker, Segmented's overflow, SettingsPicker,
 * the nav-bar sort/filter menus): titled header, 52pt rows over hairline
 * separators, the chosen row bold with a trailing check.
 */
export function PickerSheet<T extends string>({
  open,
  onOpenChange,
  title,
  items,
  selectedValue,
  onValueChange,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: readonly FormPickerItem<T>[];
  selectedValue: T | null;
  onValueChange: (value: T) => void;
  /** Extra rows after the options (a destructive reset); bring a separator. */
  footer?: ReactNode;
}) {
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheet.Content>
        <BottomSheet.Header title={title} />
        {/* Capped ScrollView, not BottomSheet.Body — Body is a flex-1
            scroller that collapses in a sheet sized to its options. */}
        <ScrollView className="max-h-[440px]" bounces={false}>
          {items.map((item, index) => {
            const isSelected = item.value === selectedValue;
            return (
              <Fragment key={item.value}>
                {index > 0 ? <Item.Separator /> : null}
                <Pressable
                  onPress={() => {
                    onValueChange(item.value);
                    onOpenChange(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  className="min-h-[52px] flex-row items-center gap-3 active:opacity-60"
                >
                  <Text
                    className={cn(
                      'flex-1 text-[17px] text-foreground',
                      isSelected && 'font-semibold',
                    )}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <Icon name="checkmark.circle.fill" size={22} tintColor={primary} />
                  ) : null}
                </Pressable>
              </Fragment>
            );
          })}
          {footer}
        </ScrollView>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/**
 * A form-level failure — one the fields can't own (the server said no, the
 * host is unreachable). Field-level problems belong on the field
 * (`errorMessage`), not up here.
 */
export function FormError({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <Alert variant="destructive">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description selectable>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
