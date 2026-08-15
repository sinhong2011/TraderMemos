import type { AndroidSymbol } from 'expo-symbols';

/**
 * SF Symbol → Material Symbols name map, for the Android side of `<Icon>`.
 *
 * `expo-symbols` renders real SF Symbols on iOS and, on every other platform,
 * falls back to drawing a Material Symbols glyph from a bundled variable font
 * (see its `SymbolView.tsx` — plain RN `<Text>`, so it works anywhere in the
 * tree and honors `weight`). Its `name` prop already accepts
 * `{ ios, android }`; all that's missing is the vocabulary translation, which
 * is this file. No extra icon dependency is involved.
 *
 * The lookup has to happen at runtime, not through `@expo/ui`'s compile-time
 * `Icon.select`: seventeen call sites take the symbol name as a *prop*
 * (`error-state.tsx`, `header-icon-button.tsx`, `account-menu.tsx`, the
 * ternaries in `password-input.tsx`, …), so the name isn't a literal where the
 * icon is drawn.
 *
 * Adding a symbol on iOS means adding a row here. `<Icon>` warns in dev on a
 * miss and falls back to a neutral glyph, so a gap degrades visibly instead of
 * rendering an empty box.
 *
 * Every target is validated against the font's own symbol table by
 * `scripts/check-icon-map.mjs` (`pnpm run check-icons`).
 */

/**
 * Targets are Material Symbols names. Typing them as `AndroidSymbol` (a union
 * of every name in the font's symbol table) makes `tsc` reject a typo here, so
 * the build catches a bad target before the check script has to.
 */
export const SF_TO_MATERIAL: Record<string, AndroidSymbol> = {
  // navigation / chrome
  'chevron.left': 'chevron_left',
  'chevron.right': 'chevron_right',
  'chevron.backward': 'chevron_left',
  'chevron.forward': 'chevron_right',
  xmark: 'close',
  'xmark.circle.fill': 'cancel',
  magnifyingglass: 'search',
  gearshape: 'settings',
  keyboard: 'keyboard',
  link: 'link',
  'arrow.up.forward': 'call_made',

  // add / edit / remove
  plus: 'add',
  'plus.circle': 'add_circle_outline',
  'plus.circle.fill': 'add_circle',
  'plus.square.on.square': 'library_add',
  'minus.circle': 'remove_circle_outline',
  pencil: 'edit',
  'square.and.pencil': 'create',
  trash: 'delete_outline',
  'trash.fill': 'delete',

  // state / status
  checkmark: 'check',
  'checkmark.circle': 'check_circle_outline',
  'checkmark.circle.fill': 'check_circle',
  circle: 'radio_button_unchecked',
  'exclamationmark.circle': 'error_outline',
  'exclamationmark.circle.fill': 'error',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle': 'info_outline',
  star: 'star_border',
  'star.fill': 'star',

  // transfer / sync
  'arrow.up': 'arrow_upward',
  'arrow.down': 'arrow_downward',
  'arrow.down.circle': 'arrow_circle_down',
  'arrow.up.arrow.down': 'swap_vert',
  'arrow.left.arrow.right': 'swap_horiz',
  'arrow.clockwise': 'refresh',
  'arrow.counterclockwise': 'rotate_left',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.up.doc': 'file_upload',
  'arrow.down.doc': 'file_download',
  'arrow.down.to.line': 'download',
  'square.and.arrow.up': 'share',
  'square.and.arrow.down': 'save_alt',

  // documents / data
  'doc.text': 'description',
  'doc.on.doc': 'content_copy',
  'doc.badge.plus': 'note_add',
  'note.text': 'notes',
  'note.text.badge.plus': 'post_add',
  folder: 'folder',
  tablecells: 'table_chart',
  curlybraces: 'data_object',
  book: 'menu_book',
  newspaper: 'article',
  tag: 'label',

  // media / capture
  'play.fill': 'play_arrow',
  'play.rectangle': 'ondemand_video',
  'stop.circle': 'stop_circle',
  'photo.on.rectangle': 'photo_library',
  'photo.badge.plus': 'add_photo_alternate',
  'text.viewfinder': 'document_scanner',

  // filters — the nav-bar pull-down falls back to a plain glyph off iOS, so
  // both the idle and the active variant need a target here.
  'line.3.horizontal.decrease.circle': 'filter_alt',
  'line.3.horizontal.decrease.circle.fill': 'filter_alt',

  // tab bar
  'list.bullet': 'format_list_bulleted',
  calendar: 'calendar_month',
  'square.grid.3x3': 'grid_view',

  // charts / analytics
  'chart.xyaxis.line': 'show_chart',
  'chart.line.uptrend.xyaxis': 'trending_up',
  'chart.pie': 'pie_chart',
  'waveform.path.ecg': 'monitor_heart',
  'arrowtriangle.up.fill': 'arrow_drop_up',
  'arrowtriangle.down.fill': 'arrow_drop_down',

  // security / account
  key: 'vpn_key',
  'key.horizontal.fill': 'key',
  'key.slash.fill': 'key_off',
  'lock.rotation': 'lock_reset',
  'lock.shield': 'security',
  shield: 'verified_user',
  eye: 'visibility',
  'eye.slash': 'visibility_off',
  'person.2': 'people',
  'person.crop.circle': 'account_circle',

  // connectivity / server
  'wifi.slash': 'wifi_off',
  externaldrive: 'storage',
  'externaldrive.badge.wifi': 'dns',
  'dot.radiowaves.left.and.right': 'sensors',
  globe: 'language',

  // time
  clock: 'schedule',
  'clock.arrow.circlepath': 'history',
  'calendar.badge.exclamationmark': 'event_busy',

  // notifications
  bell: 'notifications_none',
  'bell.fill': 'notifications',
  'bell.badge': 'notifications_active',

  // domain / misc
  banknote: 'payments',
  sparkles: 'auto_awesome',
  brain: 'psychology',
  target: 'adjust',
  'flag.checkered': 'sports_score',
  'bolt.fill': 'bolt',
  'slider.horizontal.3': 'tune',
  'wrench.and.screwdriver': 'handyman',
  // Overflow menus and the backtest session actions — these used to be drawn by
  // SwiftUI (`@expo/ui` Menu labels), so they never needed an Android row.
  'ellipsis.circle': 'more_horiz',
  'tray.and.arrow.down': 'save',
};

/** Drawn when a symbol has no row above — visible, so the gap is obvious. */
export const FALLBACK_MATERIAL_ICON: AndroidSymbol = 'help_outline';
