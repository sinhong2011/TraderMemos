import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
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
      style={styles.flex}
      contentContainerStyle={styles.grow}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      {/* Decimal pads have no return key — tapping any empty space dismisses.
          Inputs and controls handle their own taps, so this never intercepts.
          The measure cap lives here so the tap target still spans the page. */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.content}>
        <View style={styles.column}>{children}</View>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Creation-form sheet scaffold, iOS 26 chrome: circular glass close on the
 * left, glassProminent Save on the right. `scroll` (default) wraps children
 * in a FormScrollArea; pass `scroll={false}` when the screen manages its own
 * scrolling (e.g. the trade form's symbol pager owns one scroll per page).
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
  headerAccessory,
  saveLabel,
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
  /** Extra control rendered beside Save (e.g. the trade form's Import menu). */
  headerAccessory?: ReactNode;
  /** Names the commit for flows where "Save" is wrong (Generate, Done…). */
  saveLabel?: string;
  savingLabel?: string;
  /** Greys the commit while the form is incomplete — no error alert needed. */
  saveDisabled?: boolean;
  /** Drops the cancel affordance when the work is already committed. */
  hideClose?: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const router = useRouter();

  const header = (
    <View style={[styles.header, inSheet && styles.headerInSheet]}>
      <View style={styles.headerSide}>
        {hideClose ? null : (
          <GlassIconButton systemImage="xmark" label={t`Cancel`} onPress={() => router.back()} />
        )}
      </View>
      {titleControl ? (
        <View style={styles.titleControl} accessibilityLabel={title}>
          {titleControl}
        </View>
      ) : (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}
      <View style={[styles.headerSide, styles.headerEnd]}>
        {headerAccessory}
        <GlassButton
          label={saving ? (savingLabel ?? t`Saving…`) : (saveLabel ?? t`Save`)}
          prominent
          disabled={saving || saveDisabled}
          onPress={onSave}
        />
      </View>
    </View>
  );

  if (inSheet) {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.sheetContent}
        // The sheet starts below the notch, but the scroll view still inherits
        // the window's top safe-area inset — ~60pt of dead space under the
        // grabber. The sheet owns its own padding.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {header}
          {children}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.page}>
      {/* The header keeps the full width — Cancel and Save read as nav-bar
          chrome, so they stay at the screen edges even when the form doesn't. */}
      {header}
      {scroll ? (
        <FormScrollArea>{children}</FormScrollArea>
      ) : (
        // `scroll={false}` means the child owns the layout (the trade form's
        // symbol pager needs full-width pages) — it caps its own measure.
        <View style={styles.flex}>{children}</View>
      )}
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
    <View style={quiet ? styles.fieldQuiet : styles.field}>
      <Text style={quiet ? styles.labelQuiet : styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Muted lead-in line for a sheet — one sentence on what the form is for,
 * above the first field (the token sheet's shape).
 */
export function FormFootnote({ children }: { children: ReactNode }) {
  return <Text style={styles.footnote}>{children}</Text>;
}

/**
 * Filled, bordered input matching the auth screen's fields. `numeric` swaps the
 * text input for the `NumericField` — a number field is its own control here,
 * not a text field with a numeric keyboard (see numeric-field.tsx).
 */
export function FormInput({
  style,
  multiline,
  numeric,
  decimals,
  onChangeText,
  ...props
}: TextInputProps & { numeric?: boolean; decimals?: boolean }) {
  const { theme } = useUnistyles();
  if (numeric) {
    return (
      <View style={styles.shell}>
        <NumericField
          value={props.value ?? ''}
          onChangeText={onChangeText ?? (() => {})}
          placeholder={props.placeholder}
          decimals={decimals}
        />
      </View>
    );
  }
  return (
    <View style={[styles.shell, multiline && styles.shellMultiline]}>
      <TextInput
        placeholderTextColor={theme.colors.mutedForeground}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        onChangeText={onChangeText}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    // Sheets show the grabber above — keep the chrome tight beneath it.
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  // The sheet's ScrollView content already carries the page padding, and the
  // grabber sits above — the chrome only needs its gap to the first field.
  headerInSheet: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerEnd: { justifyContent: 'flex-end', gap: theme.spacing.sm },
  // The control takes the title's slot but sizes to its own content, so a
  // two-option switch centres rather than stretching across the header.
  titleControl: { flexShrink: 1, alignItems: 'center' },
  title: {
    flexShrink: 1,
    maxWidth: '55%',
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  grow: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  // No flexGrow: the sheet host's height can't be trusted, so the content
  // sizes itself (the shape tool-sheet.tsx settled on).
  sheetContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  // Fields track the reading measure, not the screen: on an iPad-wide sheet a
  // full-bleed row of inputs is unusable, so the column caps and centres. The
  // gap lives here (not on the scroll content) so it spaces the fields.
  column: {
    width: '100%',
    maxWidth: theme.measure.form,
    alignSelf: 'center',
    gap: theme.spacing.lg,
  },
  footnote: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  field: { gap: theme.spacing.sm },
  label: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  fieldQuiet: { gap: theme.spacing.xs + 2 },
  labelQuiet: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: theme.colors.mutedForeground,
  },
  shell: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg + 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.input,
    backgroundColor: theme.colors.card,
  },
  // An explicit height, not `minHeight`: a multiline TextInput inside the
  // form's scroll view has no bound to measure against and reports an
  // effectively infinite intrinsic height (~477,000pt), which swallowed every
  // field below it. Fixed box, scrolls internally past its last visible line.
  shellMultiline: { height: 168, justifyContent: 'flex-start' },
  input: { fontSize: 16, paddingVertical: theme.spacing.sm, color: theme.colors.foreground },
  inputMultiline: { flex: 1, textAlignVertical: 'top' },
}));
