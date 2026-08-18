import { useRouter } from 'expo-router';
import { Card, cn, Input, Spinner } from 'panelui-native';
import type { ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import type { SFSymbol } from 'expo-symbols';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { NumericField } from '@/components/numeric-field';

/**
 * Vertical form scroll area with native keyboard insets and tap-to-dismiss.
 * No KeyboardAvoidingView: inside a sheet it measures against window
 * coordinates and shifts the content up under the header even with the
 * keyboard closed — the scroll view's own insets behave correctly.
 */
export function FormScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      {/* Decimal pads have no return key — tapping any empty space dismisses.
          Inputs and controls handle their own taps, so this never intercepts.
          The measure cap lives here so the tap target still spans the page. */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} className="grow p-4 pb-12">
        {/* Fields track the reading measure, not the screen: on a tablet-wide
            sheet a full-bleed row of inputs is unusable, so the column caps
            and centres. The gap lives here (not on the scroll content) so it
            spaces the fields. */}
        <View className="w-full max-w-[560px] self-center gap-4">{children}</View>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Creation-form sheet scaffold: circular glass close on the left, matching
 * circular glass checkmark on the right (or a glass capsule when `saveLabel`
 * names the commit). `scroll` (default) wraps children in a FormScrollArea;
 * pass `scroll={false}` when the screen manages its own scrolling (e.g. the
 * trade form's symbol pager owns one scroll per page).
 *
 * `inSheet` is required under `presentation: 'formSheet'`: react-native-screens
 * gives that host no usable height, so a header sibling and a `flex: 1` scroll
 * area both collapse to the origin and the form paints over the chrome. The
 * sheet's content root has to be the ScrollView itself (same shape as
 * tool-sheet.tsx / manage-tags.tsx), which means the chrome scrolls with the
 * form — fine for the short forms that earn a sheet, wrong for the tall ones
 * (those use `presentation: 'modal'` and the pinned header below).
 */
export function FormSheet({
  title,
  titleControl,
  saving,
  scroll = true,
  inSheet = false,
  pushed = false,
  headerAccessory,
  saveLabel,
  saveIcon,
  savingLabel,
  saveDisabled = false,
  hideClose = false,
  onSave,
  children,
}: {
  title: string;
  /**
   * Replaces the header title with a control — used when the form's shape is
   * itself a choice (the note sheet's Note / Daily log switch), so the body
   * opens straight onto the writing field instead of a mode picker.
   * `title` is still required: it names the screen for assistive tech.
   */
  titleControl?: ReactNode;
  saving?: boolean;
  scroll?: boolean;
  /** Set on screens presented as `formSheet` — see the note above. */
  inSheet?: boolean;
  /**
   * Set on screens pushed as a card (not presented as a sheet): the leading
   * control becomes a back chevron and the chrome clears the status bar,
   * which an iOS modal's detent already does for free (fullscreen Android
   * modals get the clearance regardless).
   */
  pushed?: boolean;
  /** Extra control rendered beside Save (e.g. the trade form's Import menu). */
  headerAccessory?: ReactNode;
  /** Names the commit for flows where "Save" is wrong (Generate, Done…). */
  saveLabel?: string;
  /**
   * Draws the commit as the circular glass icon instead of a labelled capsule,
   * with `saveLabel` demoted to the accessibility label — for verbs that have a
   * settled glyph (Preview → `eye`) and don't need a word in the chrome.
   */
  saveIcon?: SFSymbol;
  savingLabel?: string;
  /** Greys the commit while the form is incomplete — no error alert needed. */
  saveDisabled?: boolean;
  /** Drops the cancel affordance when the work is already committed. */
  hideClose?: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The scrim inherits the page colour at ~70% so the form stays legible
  // behind it in both schemes; hex + alpha because a native view cannot
  // evaluate a colour-mix at runtime.
  const [background] = useCSSVariable(['--color-background']) as [string];

  const header = (
    <View
      // Sheets show the grabber above — keep the chrome tight beneath it. In
      // the `inSheet` variant the ScrollView's content already carries the
      // page padding, so the chrome only needs its gap to the first field.
      className={cn(
        'flex-row items-center gap-3 px-4 pb-3 pt-4',
        inSheet && 'px-0 pb-0 pt-0',
      )}
      // iOS modals float as a card below the status bar, but Android modals
      // are fullscreen (edge-to-edge), so the pinned chrome has to clear the
      // status bar itself. The `inSheet` detent starts below it on both.
      style={
        pushed || (Platform.OS === 'android' && !inSheet)
          ? { paddingTop: insets.top + 12 }
          : undefined
      }
    >
      <View className="flex-1 flex-row items-center">
        {hideClose ? null : (
          <GlassIconButton
            systemImage={pushed ? 'chevron.backward' : 'xmark'}
            label={pushed ? t`Back` : t`Cancel`}
            // Dismissing mid-save races the mutation's own router.back().
            disabled={saving}
            onPress={() => router.back()}
          />
        )}
      </View>
      {titleControl ? (
        // The control takes the title's slot but sizes to its own content, so
        // a two-option switch centres rather than stretching across the header.
        <View className="shrink items-center" accessibilityLabel={title}>
          {titleControl}
        </View>
      ) : (
        <Text className="max-w-[55%] shrink text-[17px] font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
      )}
      <View className="flex-1 flex-row items-center justify-end gap-2">
        {headerAccessory}
        {/* A plain save is a checkmark in the same glass circle as the close
            button; a caller that passes `saveLabel` chose a distinct verb
            (Generate / Done) and keeps it as a glass capsule, unless
            `saveIcon` gives that verb a glyph and puts it back in the circle. */}
        {saveLabel && !saveIcon ? (
          <GlassButton
            label={saving ? (savingLabel ?? t`Saving…`) : saveLabel}
            disabled={saving || saveDisabled}
            onPress={onSave}
          />
        ) : (
          <GlassIconButton
            systemImage={saveIcon ?? 'checkmark'}
            label={saving ? (savingLabel ?? t`Saving…`) : (saveLabel ?? t`Save`)}
            disabled={saveDisabled}
            loading={saving}
            onPress={onSave}
          />
        )}
      </View>
    </View>
  );

  if (inSheet) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        // No `grow`: the sheet host's height can't be trusted, so the content
        // sizes itself (the shape tool-sheet.tsx settled on).
        contentContainerClassName="p-4 pb-12"
        // The sheet starts below the notch, but the scroll view still inherits
        // the window's top safe-area inset — ~60pt of dead space under the
        // grabber. The sheet owns its own padding.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-[560px] self-center gap-4">
          {header}
          {children}
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* The header keeps the full width — Cancel and Save read as nav-bar
          chrome, so they stay at the screen edges even when the form doesn't. */}
      {header}
      {scroll ? (
        <FormScrollArea>{children}</FormScrollArea>
      ) : (
        // `scroll={false}` means the child owns the layout (the trade form's
        // symbol pager needs full-width pages) — it caps its own measure.
        <View className="flex-1">{children}</View>
      )}
      {/* A slow save has to look like the app working, not hanging: the scrim
          blocks every touch and names the wait. Not rendered in the `inSheet`
          variant — its content root is the ScrollView, so an absolute overlay
          would only cover the content extent (those short forms keep the
          disabled chrome). */}
      {saving ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          className="items-center justify-center"
          style={[StyleSheet.absoluteFill, { backgroundColor: background + 'B3' }]}
        >
          <Card className="flex-row items-center gap-3 px-6 py-4">
            <Spinner />
            <Text className="text-[15px] font-semibold text-foreground">
              {savingLabel ?? t`Saving…`}
            </Text>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Labelled form row. `quiet` swaps the 15pt semibold label for the small
 * lettered one the token sheet uses — right when the sheet title is the only
 * thing that should shout and the fields are just captions above their input.
 */
export function FormField({
  label,
  quiet = false,
  children,
}: {
  label: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <View className={quiet ? 'gap-1.5' : 'gap-2'}>
      <Text
        className={
          quiet
            ? 'text-xs font-medium tracking-[0.3px] text-muted-foreground'
            : 'text-[15px] font-semibold text-foreground'
        }
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * The `FormInput` shell around a control that isn't a text field — a menu
 * picker, a static value. Without it the control is naked on the sheet
 * background and reads as a label, not something you can tap. Same box as the
 * `Input` beside it, laid out as a row so the control is positioned by
 * flexbox rather than by a centred text baseline.
 */
export function FormControl({ children }: { children: ReactNode }) {
  return (
    <View className="min-h-12 flex-row items-center rounded-3xl bg-muted px-3.5">
      {children}
    </View>
  );
}

/**
 * Field as a borderless row: label left, control right. For controls that draw
 * their own affordance — a menu picker's chevron, the date pill — where a box
 * around them would be a second frame inside the first. Everything you type
 * into keeps the stacked caption over a bordered field.
 *
 * No border and no inset of its own: the label lines up with the captions of
 * the boxed fields above and below it, not with their text.
 */
export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-11 flex-row items-center gap-3">
      <Text className="shrink text-base text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {/* Takes the rest of the row so the control lands on the trailing edge. */}
      <View className="flex-1 flex-row items-center justify-end gap-2">{children}</View>
    </View>
  );
}

/**
 * Muted lead-in line for a sheet — one sentence on what the form is for,
 * above the first field (the token sheet's shape).
 */
export function FormFootnote({ children }: { children: ReactNode }) {
  return <Text className="text-[13px] leading-[18px] text-muted-foreground">{children}</Text>;
}

/**
 * Filled, borderless input matching the auth screen's fields. `numeric` swaps
 * the text input for the `NumericField` — a number field is its own control
 * here, not a text field with a numeric keyboard (see numeric-field.tsx).
 */
export function FormInput({
  className,
  multiline,
  numeric,
  decimals,
  onChangeText,
  ...props
}: TextInputProps & { numeric?: boolean; decimals?: boolean }) {
  if (numeric) {
    return (
      <View className="h-12 justify-center rounded-3xl bg-muted px-3.5">
        <NumericField
          value={props.value ?? ''}
          onChangeText={onChangeText ?? (() => {})}
          placeholder={props.placeholder}
          decimals={decimals}
          autoFocus={props.autoFocus}
        />
      </View>
    );
  }
  return (
    <Input
      variant="filled"
      multiline={multiline}
      // Android centres a multiline field's text in its box otherwise, so the
      // caret starts halfway down an empty note.
      textAlignVertical={multiline ? 'top' : undefined}
      // An explicit height, not `min-h`: a multiline TextInput inside the
      // form's scroll view has no bound to measure against and reports an
      // effectively infinite intrinsic height (~477,000pt), which swallowed
      // every field below it. Fixed box, scrolls internally past its last
      // visible line.
      className={cn('rounded-3xl border-0', multiline && 'h-[168px]', className)}
      onChangeText={onChangeText}
      {...props}
    />
  );
}
