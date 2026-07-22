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

export type SettingsSectionId = "accounts" | "rules" | "journal" | "ai" | "general";

export type SettingsLabelKey =
  | "accounts"
  | "rules"
  | "journal"
  | "ai"
  | "general"
  | "accountsTitle"
  | "accountsDescription"
  | "rulesTitle"
  | "rulesDescription"
  | "journalTitle"
  | "journalDescription"
  | "aiTitle"
  | "aiDescription"
  | "generalTitle"
  | "generalDescription"
  | "language"
  | "languageFooter"
  | "languageSelector"
  | "timezone"
  | "timezoneFooter"
  | "timezoneSelector"
  | "timeFormat"
  | "timeFormatFooter"
  | "timeFormatSelector"
  | "tradeDateBasis"
  | "tradeDateBasisFooter"
  | "tradeDateBasisSelector"
  | "tradeDateBasisClose"
  | "tradeDateBasisOpen"
  | "serverUrl"
  | "serverUrlFooter"
  | "serverUrlHint"
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
  | "visionOn"
  | "coach"
  | "coachTitle"
  | "coachFooter"
  | "coachEnabled"
  | "coachBaseUrl"
  | "coachModel"
  | "coachFetchModels"
  | "coachFetchingModels"
  | "coachApiKey"
  | "coachApiKeyHint"
  | "coachCustomPrompt"
  | "coachCustomPromptHint"
  | "coachSave"
  | "coachTest"
  | "coachTesting"
  | "coachOff"
  | "coachOn"
  | "llmEnabledDetail"
  | "llmBaseUrlDetail"
  | "llmModelDetail"
  | "llmApiKeyDetail";

const SETTINGS_LABELS: Record<AppLocale, Record<SettingsLabelKey, string>> = {
  en: {
    accounts: "Accounts",
    rules: "Rules",
    journal: "Journal",
    ai: "AI",
    general: "General",
    accountsTitle: "Accounts & funding",
    accountsDescription: "Manage broker accounts, starting balances, and cash flows.",
    rulesTitle: "Rules & checklist",
    rulesDescription: "Risk limits and daily note checklist templates.",
    journalTitle: "Journal metadata",
    journalDescription: "Tags and playbook setups used when logging trades.",
    aiTitle: "AI & LLM",
    aiDescription: "Screenshot scan, trade coach, and OpenAI-compatible API keys.",
    generalTitle: "General",
    generalDescription: "Preferences and session.",
    language: "Language",
    languageFooter: "Interface language for TraderMemos.",
    languageSelector: "Language selector",
    timezone: "Timezone",
    timezoneFooter:
      "Applies to all displayed times (trade timestamps, Hourly labels, charts). Doesn’t change how trades are grouped (UTC) or Session (Premarket/RTH stays US Eastern).",
    timezoneSelector: "Timezone selector",
    timeFormat: "Time format",
    timeFormatFooter: "12-hour or 24-hour clock for displayed times.",
    timeFormatSelector: "Time format selector",
    tradeDateBasis: "Trade date basis",
    tradeDateBasisFooter:
      "Which timestamp places a trade on the calendar and in date filters. Close date uses last activity (realized P&L day). Open date uses entry.",
    tradeDateBasisSelector: "Trade date basis selector",
    tradeDateBasisClose: "Close date (last activity)",
    tradeDateBasisOpen: "Open date (entry)",
    serverUrl: "API server",
    serverUrlFooter:
      "Custom TraderMemos API base URL for this device. Leave blank to use the default. Origin-only URLs get /api/v1 appended.",
    serverUrlHint: "https://your-host/api/v1",
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
    coach: "Coach",
    coachTitle: "Trade coach",
    coachFooter:
      "LLM-powered coaching on trade detail. Falls back to rule-based notes when off or unavailable. Keys stay on the server.",
    coachEnabled: "Enabled",
    coachBaseUrl: "API base URL",
    coachModel: "Model",
    coachFetchModels: "Fetch models",
    coachFetchingModels: "Fetching models…",
    coachApiKey: "API key",
    coachApiKeyHint: "Leave blank to keep current key",
    coachCustomPrompt: "System prompt",
    coachCustomPromptHint: "Leave blank to use the built-in coaching prompt",
    coachSave: "Save",
    coachTest: "Test",
    coachTesting: "Testing…",
    coachOff: "Off",
    coachOn: "On",
    llmEnabledDetail: "Turn on to call this API from the app.",
    llmBaseUrlDetail: "OpenAI-compatible API root URL.",
    llmModelDetail: "Model ID supported by your provider.",
    llmApiKeyDetail: "Stored on the server only — never sent to the browser after save.",
  },
  "zh-HK": {
    accounts: "帳戶",
    rules: "規則",
    journal: "日誌",
    ai: "AI",
    general: "一般",
    accountsTitle: "帳戶與資金",
    accountsDescription: "管理券商帳戶、起始結餘及現金流。",
    rulesTitle: "規則與檢查清單",
    rulesDescription: "風險限制及每日筆記檢查清單範本。",
    journalTitle: "日誌元數據",
    journalDescription: "記錄交易時使用的標籤及策略庫設定。",
    aiTitle: "AI 與 LLM",
    aiDescription: "截圖掃描、交易教練及 OpenAI 相容 API 金鑰。",
    generalTitle: "一般",
    generalDescription: "偏好設定及工作階段。",
    language: "語言",
    languageFooter: "TraderMemos 的介面語言。",
    languageSelector: "語言選擇器",
    timezone: "時區",
    timezoneFooter:
      "套用到所有顯示時間（交易時間戳、小時標籤、圖表）。不會改變交易分組（仍以 UTC）或盤前/盤中/盤後（仍以美東為準）。",
    timezoneSelector: "時區選擇器",
    timeFormat: "時間格式",
    timeFormatFooter: "顯示時間使用 12 小時制或 24 小時制。",
    timeFormatSelector: "時間格式選擇器",
    tradeDateBasis: "交易日期基準",
    tradeDateBasisFooter:
      "決定交易落在日曆哪一天，以及日期篩選用哪個時間戳。平倉日＝最後活動（已實現 P&L 日）。開倉日＝進場時間。",
    tradeDateBasisSelector: "交易日期基準選擇器",
    tradeDateBasisClose: "平倉日（最後活動）",
    tradeDateBasisOpen: "開倉日（進場）",
    serverUrl: "API 伺服器",
    serverUrlFooter:
      "此裝置的自訂 TraderMemos API 位址。留空則使用預設。只填主機時會自動加上 /api/v1。",
    serverUrlHint: "https://your-host/api/v1",
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
    coach: "教練",
    coachTitle: "交易教練",
    coachFooter:
      "在交易詳情提供 LLM 教練意見。關閉或不可用時會使用規則式提示。金鑰只保存在伺服器。",
    coachEnabled: "啟用",
    coachBaseUrl: "API 位址",
    coachModel: "模型",
    coachFetchModels: "擷取模型",
    coachFetchingModels: "擷取模型中…",
    coachApiKey: "API 金鑰",
    coachApiKeyHint: "留空表示保留現有金鑰",
    coachCustomPrompt: "系統提示詞",
    coachCustomPromptHint: "留空則使用內建教練提示詞",
    coachSave: "儲存",
    coachTest: "測試",
    coachTesting: "測試中…",
    coachOff: "關",
    coachOn: "開",
    llmEnabledDetail: "開啟後應用程式才會呼叫此 API。",
    llmBaseUrlDetail: "OpenAI 相容 API 根位址。",
    llmModelDetail: "供應商支援的模型 ID。",
    llmApiKeyDetail: "只保存在伺服器，儲存後不會再傳到瀏覽器。",
  },
  ja: {
    accounts: "アカウント",
    rules: "ルール",
    journal: "ジャーナル",
    ai: "AI",
    general: "一般",
    accountsTitle: "アカウントと資金",
    accountsDescription: "証券会社アカウント、開始残高、キャッシュフローを管理します。",
    rulesTitle: "ルールとチェックリスト",
    rulesDescription: "リスク制限とデイリーノートのチェックリストテンプレート。",
    journalTitle: "ジャーナルメタデータ",
    journalDescription: "トレード記録時に使うタグとプレイブックセットアップ。",
    aiTitle: "AI & LLM",
    aiDescription: "スクショ解析、トレードコーチ、OpenAI 互換 API キー。",
    generalTitle: "一般",
    generalDescription: "設定とセッション。",
    language: "言語",
    languageFooter: "TraderMemos の表示言語。",
    languageSelector: "言語セレクター",
    timezone: "タイムゾーン",
    timezoneFooter:
      "表示されるすべての時刻（トレード時刻、Hourly ラベル、チャート）に適用。取引の集計（UTC）やプレマーケット／RTH（米東部）は変わりません。",
    timezoneSelector: "タイムゾーンセレクター",
    timeFormat: "時刻形式",
    timeFormatFooter: "表示時刻の 12 時間制 / 24 時間制。",
    timeFormatSelector: "時刻形式セレクター",
    tradeDateBasis: "トレード日付の基準",
    tradeDateBasisFooter:
      "カレンダー上の日と日付フィルタに使う時刻を選びます。決済日＝最後の活動（実現損益の日）。建玉日＝エントリー。",
    tradeDateBasisSelector: "トレード日付基準セレクター",
    tradeDateBasisClose: "決済日（最後の活動）",
    tradeDateBasisOpen: "建玉日（エントリー）",
    serverUrl: "API サーバー",
    serverUrlFooter:
      "このデバイスのカスタム TraderMemos API ベース URL。空欄でデフォルトを使用。オリジンのみの場合は /api/v1 を付与します。",
    serverUrlHint: "https://your-host/api/v1",
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
    coach: "コーチ",
    coachTitle: "トレードコーチ",
    coachFooter:
      "トレード詳細で LLM コーチングを表示します。オフまたは利用不可の場合はルールベースのメモにフォールバックします。キーはサーバーのみに保存されます。",
    coachEnabled: "有効",
    coachBaseUrl: "API ベース URL",
    coachModel: "モデル",
    coachFetchModels: "モデルを取得",
    coachFetchingModels: "モデル取得中…",
    coachApiKey: "API キー",
    coachApiKeyHint: "空欄で既存キーを維持",
    coachCustomPrompt: "システムプロンプト",
    coachCustomPromptHint: "空欄で標準のコーチングプロンプトを使用",
    coachSave: "保存",
    coachTest: "テスト",
    coachTesting: "テスト中…",
    coachOff: "オフ",
    coachOn: "オン",
    llmEnabledDetail: "オンにするとアプリからこの API を呼び出します。",
    llmBaseUrlDetail: "OpenAI 互換 API のルート URL。",
    llmModelDetail: "プロバイダーがサポートするモデル ID。",
    llmApiKeyDetail: "サーバーのみに保存 — 保存後はブラウザに送りません。",
  },
  ko: {
    accounts: "계정",
    rules: "규칙",
    journal: "저널",
    ai: "AI",
    general: "일반",
    accountsTitle: "계정 및 자금",
    accountsDescription: "브로커 계정, 시작 잔액, 현금 흐름을 관리합니다.",
    rulesTitle: "규칙 및 체크리스트",
    rulesDescription: "리스크 한도와 일일 노트 체크리스트 템플릿.",
    journalTitle: "저널 메타데이터",
    journalDescription: "거래 기록 시 사용하는 태그와 플레이북 셋업.",
    aiTitle: "AI & LLM",
    aiDescription: "스크린샷 스캔, 트레이드 코치, OpenAI 호환 API 키.",
    generalTitle: "일반",
    generalDescription: "환경설정 및 세션.",
    language: "언어",
    languageFooter: "TraderMemos 인터페이스 언어입니다.",
    languageSelector: "언어 선택",
    timezone: "시간대",
    timezoneFooter:
      "표시되는 모든 시간(거래 타임스탬프, Hourly 라벨, 차트)에 적용됩니다. 거래 그룹(UTC)이나 프리마켓/RTH(미국 동부)는 바꾸지 않습니다.",
    timezoneSelector: "시간대 선택",
    timeFormat: "시간 형식",
    timeFormatFooter: "표시 시간의 12시간제 / 24시간제.",
    timeFormatSelector: "시간 형식 선택",
    tradeDateBasis: "거래 날짜 기준",
    tradeDateBasisFooter:
      "캘린더 날짜와 날짜 필터에 쓸 타임스탬프입니다. 청산일 = 마지막 활동(실현 P&L 일). 진입일 = 오픈 시각.",
    tradeDateBasisSelector: "거래 날짜 기준 선택",
    tradeDateBasisClose: "청산일 (마지막 활동)",
    tradeDateBasisOpen: "진입일 (오픈)",
    serverUrl: "API 서버",
    serverUrlFooter:
      "이 기기의 사용자 지정 TraderMemos API 기본 URL입니다. 비우면 기본값을 씁니다. 호스트만 입력하면 /api/v1이 붙습니다.",
    serverUrlHint: "https://your-host/api/v1",
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
    coach: "코치",
    coachTitle: "트레이드 코치",
    coachFooter:
      "거래 상세에서 LLM 코칭을 제공합니다. 꺼져 있거나 사용할 수 없으면 규칙 기반 메모로 대체됩니다. 키는 서버에만 저장됩니다.",
    coachEnabled: "사용",
    coachBaseUrl: "API 베이스 URL",
    coachModel: "모델",
    coachFetchModels: "모델 가져오기",
    coachFetchingModels: "모델 가져오는 중…",
    coachApiKey: "API 키",
    coachApiKeyHint: "비우면 기존 키 유지",
    coachCustomPrompt: "시스템 프롬프트",
    coachCustomPromptHint: "비우면 기본 코칭 프롬프트 사용",
    coachSave: "저장",
    coachTest: "테스트",
    coachTesting: "테스트 중…",
    coachOff: "끔",
    coachOn: "켬",
    llmEnabledDetail: "켜면 앱에서 이 API를 호출합니다.",
    llmBaseUrlDetail: "OpenAI 호환 API 루트 URL.",
    llmModelDetail: "제공자가 지원하는 모델 ID.",
    llmApiKeyDetail: "서버에만 저장되며 저장 후 브라우저로 전송되지 않습니다.",
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
      { id: "ai", key: "ai" },
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
