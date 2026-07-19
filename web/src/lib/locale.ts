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
  | "reports"
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
    reports: "Reports",
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
    reports: "報表",
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
    reports: "レポート",
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
    reports: "리포트",
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
  | "signOutFooter"
  | "screenshots"
  | "screenshotsFooter"
  | "maxScreenshots"
  | "maxScreenshotsHint"
  | "visionScan"
  | "visionScanFooter"
  | "visionEnabled"
  | "visionBaseUrl"
  | "visionModel"
  | "visionFetchModels"
  | "visionFetchingModels"
  | "visionApiKey"
  | "visionApiKeyHint"
  | "visionCustomPrompt"
  | "visionCustomPromptHint"
  | "visionSave"
  | "visionTest"
  | "visionTesting"
  | "visionOff"
  | "visionOn";

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
    generalDescription: "Preferences, screenshot scan, and session.",
    language: "Language",
    languageFooter: "Interface language for TraderMemos.",
    languageSelector: "Language selector",
    session: "Session",
    signOut: "Sign out",
    signOutFooter: "End your session on this device.",
    screenshots: "Screenshots",
    screenshotsFooter:
      "Cap how many images can attach when logging a trade. Leave empty for no limit.",
    maxScreenshots: "Max per trade",
    maxScreenshotsHint: "Unlimited",
    visionScan: "Screenshot scan",
    visionScanFooter:
      "LLM vision extracts fills from broker screenshots in New Trade. Keys stay on the server.",
    visionEnabled: "Enabled",
    visionBaseUrl: "API base URL",
    visionModel: "Model",
    visionFetchModels: "Fetch models",
    visionFetchingModels: "Fetching models…",
    visionApiKey: "API key",
    visionApiKeyHint: "Leave blank to keep current key",
    visionCustomPrompt: "Custom prompt",
    visionCustomPromptHint: "Leave blank to use the built-in fill extraction prompt",
    visionSave: "Save",
    visionTest: "Test",
    visionTesting: "Testing…",
    visionOff: "Off",
    visionOn: "On",
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
    generalDescription: "偏好設定、截圖掃描及工作階段。",
    language: "語言",
    languageFooter: "TraderMemos 的介面語言。",
    languageSelector: "語言選擇器",
    session: "工作階段",
    signOut: "登出",
    signOutFooter: "在此裝置結束你的工作階段。",
    screenshots: "截圖",
    screenshotsFooter: "限制記錄交易時可附加的圖片數量。留空表示不限。",
    maxScreenshots: "每筆上限",
    maxScreenshotsHint: "不限",
    visionScan: "截圖掃描",
    visionScanFooter: "以 LLM 視覺從券商截圖擷取成交，供 New Trade 使用。金鑰只保存在伺服器。",
    visionEnabled: "啟用",
    visionBaseUrl: "API 位址",
    visionModel: "模型",
    visionFetchModels: "擷取模型",
    visionFetchingModels: "擷取模型中…",
    visionApiKey: "API 金鑰",
    visionApiKeyHint: "留空表示保留現有金鑰",
    visionCustomPrompt: "自訂提示詞",
    visionCustomPromptHint: "留空則使用內建成交擷取提示詞",
    visionSave: "儲存",
    visionTest: "測試",
    visionTesting: "測試中…",
    visionOff: "關",
    visionOn: "開",
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
    generalDescription: "設定、スクショ解析、セッション。",
    language: "言語",
    languageFooter: "TraderMemos の表示言語。",
    languageSelector: "言語セレクター",
    session: "セッション",
    signOut: "サインアウト",
    signOutFooter: "このデバイスでのセッションを終了します。",
    screenshots: "スクリーンショット",
    screenshotsFooter: "トレード記録時に添付できる画像数の上限です。空欄は無制限です。",
    maxScreenshots: "1件あたり上限",
    maxScreenshotsHint: "無制限",
    visionScan: "スクショ解析",
    visionScanFooter:
      "LLM ビジョンで証券会社のスクショから約定を抽出し、New Trade に反映します。キーはサーバーのみに保存されます。",
    visionEnabled: "有効",
    visionBaseUrl: "API ベース URL",
    visionModel: "モデル",
    visionFetchModels: "モデルを取得",
    visionFetchingModels: "モデル取得中…",
    visionApiKey: "API キー",
    visionApiKeyHint: "空欄で既存キーを維持",
    visionCustomPrompt: "カスタムプロンプト",
    visionCustomPromptHint: "空欄で標準の約定抽出プロンプトを使用",
    visionSave: "保存",
    visionTest: "テスト",
    visionTesting: "テスト中…",
    visionOff: "オフ",
    visionOn: "オン",
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
    generalDescription: "환경설정, 스크린샷 스캔, 세션.",
    language: "언어",
    languageFooter: "TraderMemos 인터페이스 언어입니다.",
    languageSelector: "언어 선택",
    session: "세션",
    signOut: "로그아웃",
    signOutFooter: "이 기기에서 세션을 종료합니다.",
    screenshots: "스크린샷",
    screenshotsFooter: "거래 기록 시 첨부할 수 있는 이미지 수 한도입니다. 비우면 제한 없음.",
    maxScreenshots: "거래당 최대",
    maxScreenshotsHint: "무제한",
    visionScan: "스크린샷 스캔",
    visionScanFooter:
      "LLM 비전으로 브로커 스크린샷에서 체결을 추출해 New Trade에 채웁니다. 키는 서버에만 저장됩니다.",
    visionEnabled: "사용",
    visionBaseUrl: "API 베이스 URL",
    visionModel: "모델",
    visionFetchModels: "모델 가져오기",
    visionFetchingModels: "모델 가져오는 중…",
    visionApiKey: "API 키",
    visionApiKeyHint: "비우면 기존 키 유지",
    visionCustomPrompt: "커스텀 프롬프트",
    visionCustomPromptHint: "비우면 기본 체결 추출 프롬프트 사용",
    visionSave: "저장",
    visionTest: "테스트",
    visionTesting: "테스트 중…",
    visionOff: "끔",
    visionOn: "켬",
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
