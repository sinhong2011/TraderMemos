import { Menu as PanelMenu, cn } from 'panelui-native';
import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon, type IconProps } from '@/components/icon';

/**
 * The app's action sheet — every `Menu` in the app is presented as one, so
 * this is the single place its rows are drawn.
 *
 * The shape is the grouped-card list iOS social apps have settled on: the
 * sheet is a plain surface, and the rows sit on cards inside it. A card is a
 * run of rows that belong together, ruled by a hairline between them and set
 * apart from the next run by a gap rather than by a divider — which is what
 * `Menu.Separator` now means. `Menu.Label` closes the card before it and
 * titles the one after.
 *
 * The row's glyph is on the trailing edge, not the leading one. A column of
 * icons down the left is read before the words are, and these rows are verbs:
 * the word is the thing being chosen and the glyph only confirms it, so the
 * label starts at the card's edge and the glyph closes the row.
 *
 * It wraps PanelUI's `Menu` rather than replacing it — the press animation,
 * the close-on-select rule, the sheet itself and the accessibility roles all
 * still come from there. `Menu.RadioItem` / `Menu.CheckboxItem` are the two
 * parts rebuilt here, because PanelUI pins their indicator to the leading
 * edge and this list puts it beside the glyphs on the trailing one.
 *
 * An eslint rule points `Menu` imports here; import from `panelui-native`
 * only in this file.
 */

/** Every row's glyph, at one size, whatever a call site asked its icon for. */
const GLYPH_SIZE = 20;

/** Row metrics — a comfortable tap target with the label flush to the card. */
const ROW = 'min-h-[52px] gap-3 rounded-none px-4 py-3';

/** Hairline between two rows of one card, inset to where the labels start. */
function RowDivider() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="ms-4 h-px bg-border"
    />
  );
}

/** Draws a run of rows as one card: hairlines between, nothing around. */
function Card({ children }: { children: ReactNode[] }) {
  return (
    <View className="overflow-hidden rounded-2xl bg-secondary">{withDividers(children)}</View>
  );
}

function withDividers(rows: ReactNode[]): ReactNode[] {
  return rows.map((row, index) => (
    <Fragment key={index}>
      {index > 0 ? <RowDivider /> : null}
      {row}
    </Fragment>
  ));
}

/**
 * The rows as a flat list.
 *
 * `Children.toArray` flattens the arrays a `map` produces but stops at a
 * fragment, and a fragment is how a call site groups a row with the separator
 * that follows it — leaving one unflattened would hide both from the grouping
 * below and land the pair outside every card.
 */
function flattenRows(children: ReactNode): ReactNode[] {
  const rows: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === Fragment) {
      rows.push(...flattenRows((child.props as { children?: ReactNode }).children));
    } else {
      rows.push(child);
    }
  }
  return rows;
}

function isRow(node: ReactNode): boolean {
  return isValidElement(node) && ROW_TYPES.includes(node.type);
}

/** A call site's icon, resized to the row's glyph. */
function glyph(icon: ReactNode): ReactNode {
  return isValidElement(icon) && icon.type === Icon
    ? cloneElement(icon as ReactElement<IconProps>, { size: GLYPH_SIZE })
    : icon;
}

export type SheetMenuContentProps = ComponentProps<typeof PanelMenu.Content>;

/**
 * The sheet's body: the rows, grouped into cards.
 *
 * `width="full"` because a sheet centres a content-fit panel and strands
 * short rows in a narrow column, and the panel chrome is stripped — the sheet
 * is already the surface, so the popover's rounded box, shadow and overlay
 * fill would read as a second card floating inside it.
 */
function SheetMenuContent({ children, className, ...props }: SheetMenuContentProps) {
  const blocks: ReactNode[] = [];
  let rows: ReactNode[] = [];
  let label: ReactNode = null;

  const flushCard = () => {
    if (rows.length === 0) return;
    blocks.push(
      <View key={`card-${blocks.length}`} className="gap-1.5">
        {label}
        <Card>{rows}</Card>
      </View>
    );
    rows = [];
    label = null;
  };

  for (const child of flattenRows(children)) {
    if (isValidElement(child) && child.type === SheetMenuSeparator) {
      flushCard();
    } else if (isValidElement(child) && child.type === SheetMenuLabel) {
      flushCard();
      label = child;
    } else if (isRow(child)) {
      rows.push(child);
    } else {
      flushCard();
      blocks.push(
        <View key={`block-${blocks.length}`} className="gap-1.5">
          {label}
          {child}
        </View>
      );
      label = null;
    }
  }
  flushCard();

  return (
    <PanelMenu.Content
      width="full"
      className={cn('gap-3 rounded-none p-0 pb-2 shadow-none', className)}
      {...props}
    >
      {/* Transparent, so the sheet's own surface is what the cards sit on. */}
      <PanelMenu.Background className="bg-transparent" />
      {blocks}
    </PanelMenu.Content>
  );
}

export type SheetMenuItemProps = ComponentProps<typeof PanelMenu.Item>;

/** One row: the label at the card's edge, the glyph on the trailing one. */
function SheetMenuItem({ className, icon, trailing, ...props }: SheetMenuItemProps) {
  return (
    <PanelMenu.Item
      className={cn(ROW, className)}
      trailing={trailing ?? glyph(icon)}
      {...props}
    />
  );
}

export type SheetMenuLabelProps = ComponentProps<typeof PanelMenu.Label>;

/** Title over the card below it, lined up with the labels inside it. */
function SheetMenuLabel({ className, ...props }: SheetMenuLabelProps) {
  return <PanelMenu.Label className={cn('px-4 pb-0 pt-1', className)} {...props} />;
}

/** Ends the card it follows. Drawn as the gap before the next one. */
function SheetMenuSeparator() {
  return null;
}

/** The tick that marks a chosen row, on the trailing edge with the glyphs. */
function SelectionCheck() {
  const [primary] = useCSSVariable(['--color-primary']) as [string];
  return <Icon name="checkmark" size={17} tintColor={primary} weight="semibold" />;
}

interface RadioContextValue {
  value: string | undefined;
  select: (value: string) => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export interface SheetMenuRadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

/** A run of rows of which exactly one is chosen — a card of its own. */
function SheetMenuRadioGroup({ value, onValueChange, children }: SheetMenuRadioGroupProps) {
  const context = useMemo(
    () => ({ value, select: (next: string) => onValueChange?.(next) }),
    [value, onValueChange]
  );

  return (
    <RadioContext.Provider value={context}>
      <View accessibilityRole="radiogroup">{withDividers(flattenRows(children))}</View>
    </RadioContext.Provider>
  );
}

export interface SheetMenuRadioItemProps extends Omit<SheetMenuItemProps, 'icon'> {
  value: string;
}

function SheetMenuRadioItem({ value, onSelect, ...props }: SheetMenuRadioItemProps) {
  const group = useContext(RadioContext);
  if (!group) {
    throw new Error('Menu.RadioItem must be used within a <Menu.RadioGroup>');
  }
  const selected = group.value === value;

  return (
    <SheetMenuItem
      accessibilityRole="menuitem"
      accessibilityState={{ selected, disabled: props.disabled ?? false }}
      trailing={selected ? <SelectionCheck /> : null}
      onSelect={() => {
        group.select(value);
        onSelect?.();
      }}
      {...props}
    />
  );
}

export interface SheetMenuCheckboxItemProps extends Omit<SheetMenuItemProps, 'icon'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * A row that carries a state rather than running an action. It leaves the
 * sheet open, because a set of toggles is nearly always set more than one at
 * a time and closing after each turns three taps into six.
 */
function SheetMenuCheckboxItem({
  checked = false,
  onCheckedChange,
  onSelect,
  closeOnSelect = false,
  ...props
}: SheetMenuCheckboxItemProps) {
  return (
    <SheetMenuItem
      accessibilityRole="menuitem"
      accessibilityState={{ checked, disabled: props.disabled ?? false }}
      closeOnSelect={closeOnSelect}
      trailing={checked ? <SelectionCheck /> : null}
      onSelect={() => {
        onCheckedChange?.(!checked);
        onSelect?.();
      }}
      {...props}
    />
  );
}

export type SheetMenuSubTriggerProps = ComponentProps<typeof PanelMenu.SubTrigger>;

/**
 * The row that expands a run of options in place.
 *
 * Its glyph stays on the leading edge: the trailing one is already spoken
 * for by the chevron that says which way the rows will appear.
 */
function SheetMenuSubTrigger({ className, ...props }: SheetMenuSubTriggerProps) {
  return <PanelMenu.SubTrigger className={cn(ROW, className)} {...props} />;
}

export type SheetMenuSubContentProps = ComponentProps<typeof PanelMenu.SubContent>;

/** The rows a sub reveals — ruled like the card they are nested in. */
function SheetMenuSubContent({ children, ...props }: SheetMenuSubContentProps) {
  return (
    <PanelMenu.SubContent {...props}>
      {withDividers(flattenRows(children))}
    </PanelMenu.SubContent>
  );
}

/**
 * What belongs on a card. Anything else breaks out of one — a grid of tiles,
 * say, which is a block of its own rather than a run of rows.
 */
const ROW_TYPES: unknown[] = [
  SheetMenuItem,
  SheetMenuRadioGroup,
  SheetMenuRadioItem,
  SheetMenuCheckboxItem,
  PanelMenu.Sub,
];

/**
 * Drop-in for PanelUI's `Menu`, presented as a sheet and drawn as cards.
 * Parts not restyled here pass straight through.
 */
export const Menu = Object.assign(
  (props: ComponentProps<typeof PanelMenu>) => (
    <PanelMenu presentation="bottom-sheet" {...props} />
  ),
  {
    Trigger: PanelMenu.Trigger,
    Content: SheetMenuContent,
    Label: SheetMenuLabel,
    Item: SheetMenuItem,
    Separator: SheetMenuSeparator,
    RadioGroup: SheetMenuRadioGroup,
    RadioItem: SheetMenuRadioItem,
    CheckboxItem: SheetMenuCheckboxItem,
    Sub: PanelMenu.Sub,
    SubTrigger: SheetMenuSubTrigger,
    SubContent: SheetMenuSubContent,
  }
);
