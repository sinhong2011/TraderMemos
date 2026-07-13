import { i18n } from "@lingui/core";

export const LOCALE_STORAGE_KEY = "tm-locale";

export type AppLocale = "en" | "zh-HK" | "ja" | "ko";

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALES: Record<AppLocale, { label: string; nativeLabel: string; intl: string }> = {
  en: { label: "English", nativeLabel: "English", intl: "en-US" },
  "zh-HK": {
    label: "Chinese (Hong Kong)",
    nativeLabel: "繁體中文（香港）",
    intl: "zh-HK",
  },
  ja: { label: "Japanese", nativeLabel: "日本語", intl: "ja-JP" },
  ko: { label: "Korean", nativeLabel: "한국어", intl: "ko-KR" },
};

export const LOCALE_OPTIONS = (Object.keys(LOCALES) as AppLocale[]).map((value) => ({
  value,
  label: LOCALES[value].nativeLabel,
}));

type NavLabelKey =
  | "dashboard"
  | "trades"
  | "calendar"
  | "stats"
  | "playbook"
  | "calculator"
  | "import"
  | "settings"
  | "newTrade"
  | "newSetup"
  | "newNote";

const NAV_LABELS: Record<AppLocale, Record<NavLabelKey, string>> = {
  en: {
    dashboard: "Dashboard",
    trades: "Trades",
    calendar: "Calendar",
    stats: "Stats",
    playbook: "Playbook",
    calculator: "Calculator",
    import: "Import",
    settings: "Settings",
    newTrade: "New Trade",
    newSetup: "New Setup",
    newNote: "New Note",
  },
  "zh-HK": {
    dashboard: "儀表板",
    trades: "交易",
    calendar: "日曆",
    stats: "統計",
    playbook: "策略庫",
    calculator: "計算器",
    import: "匯入",
    settings: "設定",
    newTrade: "新增交易",
    newSetup: "新增策略",
    newNote: "新增筆記",
  },
  ja: {
    dashboard: "ダッシュボード",
    trades: "トレード",
    calendar: "カレンダー",
    stats: "統計",
    playbook: "プレイブック",
    calculator: "計算機",
    import: "インポート",
    settings: "設定",
    newTrade: "新規トレード",
    newSetup: "新規セットアップ",
    newNote: "新規メモ",
  },
  ko: {
    dashboard: "대시보드",
    trades: "거래",
    calendar: "캘린더",
    stats: "통계",
    playbook: "플레이북",
    calculator: "계산기",
    import: "가져오기",
    settings: "설정",
    newTrade: "새 거래",
    newSetup: "새 셋업",
    newNote: "새 메모",
  },
};

export function navLabel(locale: string, key: NavLabelKey): string {
  const loc = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
  return NAV_LABELS[loc][key];
}

export type SettingsSectionId = "accounts" | "rules" | "journal" | "general";

type SettingsLabelKey =
  | "accounts"
  | "rules"
  | "journal"
  | "general"
  | "accountsTitle"
  | "accountsDescription"
  | "rulesTitle"
  | "rulesDescription"
  | "journalTitle"
  | "journalDescription"
  | "generalTitle"
  | "generalDescription"
  | "language"
  | "languageFooter"
  | "languageSelector"
  | "session"
  | "signOut"
  | "signOutFooter";

const SETTINGS_LABELS: Record<AppLocale, Record<SettingsLabelKey, string>> = {
  en: {
    accounts: "Accounts",
    rules: "Rules",
    journal: "Journal",
    general: "General",
    accountsTitle: "Accounts & funding",
    accountsDescription: "Manage broker accounts, starting balances, and cash flows.",
    rulesTitle: "Rules & checklist",
    rulesDescription: "Risk limits and daily note checklist templates.",
    journalTitle: "Journal metadata",
    journalDescription: "Tags and playbook setups used when logging trades.",
    generalTitle: "General",
    generalDescription: "App preferences and localization.",
    language: "Language",
    languageFooter: "Interface language for TraderMemos.",
    languageSelector: "Language selector",
    session: "Session",
    signOut: "Sign out",
    signOutFooter: "End your session on this device.",
  },
  "zh-HK": {
    accounts: "帳戶",
    rules: "規則",
    journal: "日誌",
    general: "一般",
    accountsTitle: "帳戶與資金",
    accountsDescription: "管理券商帳戶、起始結餘及現金流。",
    rulesTitle: "規則與檢查清單",
    rulesDescription: "風險限制及每日筆記檢查清單範本。",
    journalTitle: "日誌元數據",
    journalDescription: "記錄交易時使用的標籤及策略庫設定。",
    generalTitle: "一般",
    generalDescription: "應用程式偏好設定及本地化。",
    language: "語言",
    languageFooter: "TraderMemos 的介面語言。",
    languageSelector: "語言選擇器",
    session: "工作階段",
    signOut: "登出",
    signOutFooter: "在此裝置結束你的工作階段。",
  },
  ja: {
    accounts: "アカウント",
    rules: "ルール",
    journal: "ジャーナル",
    general: "一般",
    accountsTitle: "アカウントと資金",
    accountsDescription: "証券会社アカウント、開始残高、キャッシュフローを管理します。",
    rulesTitle: "ルールとチェックリスト",
    rulesDescription: "リスク制限とデイリーノートのチェックリストテンプレート。",
    journalTitle: "ジャーナルメタデータ",
    journalDescription: "トレード記録時に使うタグとプレイブックセットアップ。",
    generalTitle: "一般",
    generalDescription: "アプリの設定とローカライズ。",
    language: "言語",
    languageFooter: "TraderMemos の表示言語。",
    languageSelector: "言語セレクター",
    session: "セッション",
    signOut: "サインアウト",
    signOutFooter: "このデバイスでのセッションを終了します。",
  },
  ko: {
    accounts: "계정",
    rules: "규칙",
    journal: "저널",
    general: "일반",
    accountsTitle: "계정 및 자금",
    accountsDescription: "브로커 계정, 시작 잔액, 현금 흐름을 관리합니다.",
    rulesTitle: "규칙 및 체크리스트",
    rulesDescription: "리스크 한도와 일일 노트 체크리스트 템플릿.",
    journalTitle: "저널 메타데이터",
    journalDescription: "거래 기록 시 사용하는 태그와 플레이북 셋업.",
    generalTitle: "일반",
    generalDescription: "앱 환경설정 및 현지화.",
    language: "언어",
    languageFooter: "TraderMemos 인터페이스 언어입니다.",
    languageSelector: "언어 선택",
    session: "세션",
    signOut: "로그아웃",
    signOutFooter: "이 기기에서 세션을 종료합니다.",
  },
};

export function settingsLabel(locale: string, key: SettingsLabelKey): string {
  const loc = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
  return SETTINGS_LABELS[loc][key];
}

export function settingsSectionCopy(
  locale: string,
  section: SettingsSectionId,
): { title: string; description: string } {
  const titleKey = `${section}Title` as SettingsLabelKey;
  const descriptionKey = `${section}Description` as SettingsLabelKey;
  return {
    title: settingsLabel(locale, titleKey),
    description: settingsLabel(locale, descriptionKey),
  };
}

export function settingsNavItems(locale: string): {
  id: SettingsSectionId;
  label: string;
}[] {
  return (
    [
      { id: "accounts", key: "accounts" },
      { id: "rules", key: "rules" },
      { id: "journal", key: "journal" },
      { id: "general", key: "general" },
    ] as const
  ).map(({ id, key }) => ({
    id,
    label: settingsLabel(locale, key),
  }));
}

export function isAppLocale(value: string): value is AppLocale {
  return value in LOCALES;
}

export function getIntlLocale(locale: string): string {
  return isAppLocale(locale) ? LOCALES[locale].intl : LOCALES.en.intl;
}

export function intlLocale(): string {
  const active = i18n.locale || DEFAULT_LOCALE;
  return getIntlLocale(active);
}

export function getStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isAppLocale(stored)) return stored;
  } catch {
    // localStorage unavailable (SSR/tests)
  }
  return DEFAULT_LOCALE;
}

export function setStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}
