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
  | "home"
  | "trades"
  | "calendar"
  | "reports"
  | "events"
  | "notes"
  | "playbook"
  | "calculator"
  | "import"
  | "settings"
  | "create"
  | "newTrade"
  | "newSetup"
  | "newNote"
  | "more";

const NAV_LABELS: Record<AppLocale, Record<NavLabelKey, string>> = {
  en: {
    home: "Home",
    trades: "Trades",
    calendar: "Calendar",
    reports: "Reports",
    events: "Events",
    notes: "Notes",
    playbook: "Playbook",
    calculator: "Calculator",
    import: "Import",
    settings: "Settings",
    create: "Create",
    newTrade: "New Trade",
    newSetup: "New Setup",
    newNote: "New Note",
    more: "More",
  },
  "zh-HK": {
    home: "首頁",
    trades: "交易",
    calendar: "日曆",
    reports: "報表",
    events: "財經事件",
    notes: "筆記",
    playbook: "策略庫",
    calculator: "計算器",
    import: "匯入",
    settings: "設定",
    create: "新增",
    newTrade: "新增交易",
    newSetup: "新增策略",
    newNote: "新增筆記",
    more: "更多",
  },
  ja: {
    home: "ホーム",
    trades: "トレード",
    calendar: "カレンダー",
    reports: "レポート",
    events: "経済イベント",
    notes: "メモ",
    playbook: "プレイブック",
    calculator: "計算機",
    import: "インポート",
    settings: "設定",
    create: "作成",
    newTrade: "新規トレード",
    newSetup: "新規セットアップ",
    newNote: "新規メモ",
    more: "もっと",
  },
  ko: {
    home: "홈",
    trades: "거래",
    calendar: "캘린더",
    reports: "리포트",
    events: "경제 이벤트",
    notes: "메모",
    playbook: "플레이북",
    calculator: "계산기",
    import: "가져오기",
    settings: "설정",
    create: "만들기",
    newTrade: "새 거래",
    newSetup: "새 셋업",
    newNote: "새 메모",
    more: "더보기",
  },
};

export function navLabel(locale: string, key: NavLabelKey): string {
  const loc = isAppLocale(locale) ? locale : DEFAULT_LOCALE;
  return NAV_LABELS[loc][key];
}

export type SettingsSectionId =
  | "accounts"
  | "rules"
  | "journal"
  | "ai"
  | "general"
  | "api"
  | "about";

export type SettingsLabelKey =
  | "accounts"
  | "rules"
  | "journal"
  | "ai"
  | "general"
  | "api"
  | "about"
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
  | "apiTitle"
  | "apiDescription"
  | "aboutTitle"
  | "aboutDescription"
  | "language"
  | "languageFooter"
  | "languageSelector"
  | "theme"
  | "themeFooter"
  | "themeSelector"
  | "themeLight"
  | "themeDark"
  | "themeSystem"
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
  | "appConfig"
  | "appConfigFooter"
  | "exportConfig"
  | "importConfig"
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
  | "llmApiKeyDetail"
  | "apiDocsTitle"
  | "apiDocsDescription"
  | "apiDocsLink"
  | "apiDocsOpen"
  | "apiTokensTitle"
  | "apiTokensDescription"
  | "apiTokensLoading"
  | "apiTokensError"
  | "apiTokensEmpty"
  | "apiTokenCreate"
  | "apiTokenCreateHint"
  | "apiTokenName"
  | "apiTokenNameHint"
  | "apiTokenNameRequired"
  | "apiTokenExpiry"
  | "apiTokenExpiryNever"
  | "apiTokenExpiry30"
  | "apiTokenExpiry90"
  | "apiTokenExpiry365"
  | "apiTokenGenerate"
  | "apiTokenCreating"
  | "apiTokenCancel"
  | "apiTokenDone"
  | "apiTokenRevealTitle"
  | "apiTokenRevealHint"
  | "apiTokenSecret"
  | "apiTokenCopy"
  | "apiTokenCopied"
  | "apiTokenCopyFailed"
  | "apiTokenCreated"
  | "apiTokenExpires"
  | "apiTokenLastUsed"
  | "apiTokenRevokeConfirm"
  | "apiTokenCreatedToast"
  | "apiTokenCreateFailed"
  | "apiTokenRevoked"
  | "apiTokenRevokeFailed";

const SETTINGS_LABELS: Record<AppLocale, Record<SettingsLabelKey, string>> = {
  en: {
    accounts: "Accounts",
    rules: "Rules",
    journal: "Journal",
    ai: "AI",
    general: "General",
    api: "API",
    about: "About",
    accountsTitle: "Accounts & funding",
    accountsDescription: "Manage broker accounts, starting balances, and cash flows.",
    rulesTitle: "Rules & checklist",
    rulesDescription: "Risk limits plus a rich-text daily checklist for New Note.",
    journalTitle: "Journal metadata",
    journalDescription: "Tags used when logging trades. Manage setups in Playbook.",
    aiTitle: "AI & LLM",
    aiDescription: "Screenshot scan, trade coach, and OpenAI-compatible API keys.",
    generalTitle: "General",
    generalDescription: "Preferences and session.",
    apiTitle: "API access",
    apiDescription: "Personal access tokens and OpenAPI docs for external tools, MCP, and scripts.",
    aboutTitle: "About TraderMemos",
    aboutDescription: "Project info, features, and links to docs and source.",
    language: "Language",
    languageFooter: "Interface language for TraderMemos.",
    languageSelector: "Language selector",
    theme: "Appearance",
    themeFooter: "Light, dark, or match the system preference.",
    themeSelector: "Appearance selector",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
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
      "API host for this device. Leave blank for the default. You only need the origin — /api/v1 is added automatically.",
    serverUrlHint: "https://example.com",
    session: "Session",
    signOut: "Sign out",
    signOutFooter: "End your session on this device.",
    appConfig: "App configuration",
    appConfigFooter:
      "Backup or restore local app preferences (language, timezone, API server, screenshot limit).",
    exportConfig: "Export config",
    importConfig: "Import config",
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
    apiDocsTitle: "API documentation",
    apiDocsDescription:
      "Interactive OpenAPI reference (Scalar). Use a session JWT or a personal access token as Bearer auth.",
    apiDocsLink: "OpenAPI / Scalar",
    apiDocsOpen: "Open docs",
    apiTokensTitle: "Access tokens",
    apiTokensDescription:
      "Tokens let MCP, AI agents, and scripts call the API with the same access as your account. The full secret is shown only once.",
    apiTokensLoading: "Loading tokens…",
    apiTokensError: "Could not load access tokens.",
    apiTokensEmpty: "No access tokens yet. Create one for MCP, scripts, or other clients.",
    apiTokenCreate: "Generate token",
    apiTokenCreateHint:
      "Name the token and choose when it expires. You will only see the secret once.",
    apiTokenName: "Name",
    apiTokenNameHint: "e.g. MCP bot, Claude, scripts",
    apiTokenNameRequired: "Name is required",
    apiTokenExpiry: "Expiration",
    apiTokenExpiryNever: "Never",
    apiTokenExpiry30: "30 days",
    apiTokenExpiry90: "90 days",
    apiTokenExpiry365: "1 year",
    apiTokenGenerate: "Generate",
    apiTokenCreating: "Generating…",
    apiTokenCancel: "Cancel",
    apiTokenDone: "Done",
    apiTokenRevealTitle: "Copy your token",
    apiTokenRevealHint:
      "Store this secret now. It will not be shown again. Use Authorization: Bearer tm_pat_…",
    apiTokenSecret: "Token",
    apiTokenCopy: "Copy token",
    apiTokenCopied: "Token copied",
    apiTokenCopyFailed: "Could not copy token",
    apiTokenCreated: "Created",
    apiTokenExpires: "Expires",
    apiTokenLastUsed: "Last used",
    apiTokenRevokeConfirm: "Revoke this token? Clients using it will lose access.",
    apiTokenCreatedToast: "Access token created",
    apiTokenCreateFailed: "Could not create token",
    apiTokenRevoked: "Token revoked",
    apiTokenRevokeFailed: "Could not revoke token",
  },
  "zh-HK": {
    accounts: "帳戶",
    rules: "規則",
    journal: "日誌",
    ai: "AI",
    general: "一般",
    api: "API",
    about: "關於",
    accountsTitle: "帳戶與資金",
    accountsDescription: "管理券商帳戶、起始結餘及現金流。",
    rulesTitle: "規則與檢查清單",
    rulesDescription: "風險限制及每日筆記檢查清單範本。",
    journalTitle: "日誌元數據",
    journalDescription: "記錄交易時使用的標籤。策略庫設定請到 Playbook 管理。",
    aiTitle: "AI 與 LLM",
    aiDescription: "截圖掃描、交易教練及 OpenAI 相容 API 金鑰。",
    generalTitle: "一般",
    generalDescription: "偏好設定及工作階段。",
    apiTitle: "API 存取",
    apiDescription: "個人存取權杖與 OpenAPI 文件，供外部工具、MCP 及腳本使用。",
    aboutTitle: "關於 TraderMemos",
    aboutDescription: "專案資訊、功能概覽，以及文件與原始碼連結。",
    language: "語言",
    languageFooter: "TraderMemos 的介面語言。",
    languageSelector: "語言選擇器",
    theme: "外觀",
    themeFooter: "淺色、深色，或跟隨系統設定。",
    themeSelector: "外觀選擇器",
    themeLight: "淺色",
    themeDark: "深色",
    themeSystem: "系統",
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
    serverUrlFooter: "此裝置的 API 主機。留空則使用預設。只需填主機，/api/v1 會自動加上。",
    serverUrlHint: "https://example.com",
    session: "工作階段",
    signOut: "登出",
    signOutFooter: "在此裝置結束你的工作階段。",
    appConfig: "應用程式設定",
    appConfigFooter: "備份或還原本機偏好（語言、時區、API 伺服器、截圖上限）。",
    exportConfig: "匯出設定",
    importConfig: "匯入設定",
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
    apiDocsTitle: "API 文件",
    apiDocsDescription:
      "互動式 OpenAPI 參考（Scalar）。可用工作階段 JWT 或個人存取權杖作為 Bearer 驗證。",
    apiDocsLink: "OpenAPI / Scalar",
    apiDocsOpen: "開啟文件",
    apiTokensTitle: "存取權杖",
    apiTokensDescription:
      "權杖可讓 MCP、AI 代理及腳本以你的帳戶權限呼叫 API。完整密鑰只會顯示一次。",
    apiTokensLoading: "載入權杖中…",
    apiTokensError: "無法載入存取權杖。",
    apiTokensEmpty: "尚未建立存取權杖。可為 MCP、腳本或其他客戶端建立一個。",
    apiTokenCreate: "產生權杖",
    apiTokenCreateHint: "為權杖命名並選擇到期日。密鑰只會顯示一次。",
    apiTokenName: "名稱",
    apiTokenNameHint: "例如 MCP bot、Claude、scripts",
    apiTokenNameRequired: "必須填寫名稱",
    apiTokenExpiry: "到期",
    apiTokenExpiryNever: "永不到期",
    apiTokenExpiry30: "30 日",
    apiTokenExpiry90: "90 日",
    apiTokenExpiry365: "1 年",
    apiTokenGenerate: "產生",
    apiTokenCreating: "產生中…",
    apiTokenCancel: "取消",
    apiTokenDone: "完成",
    apiTokenRevealTitle: "複製你的權杖",
    apiTokenRevealHint: "請立即儲存此密鑰，之後不會再顯示。使用 Authorization: Bearer tm_pat_…",
    apiTokenSecret: "權杖",
    apiTokenCopy: "複製權杖",
    apiTokenCopied: "已複製權杖",
    apiTokenCopyFailed: "無法複製權杖",
    apiTokenCreated: "建立時間",
    apiTokenExpires: "到期",
    apiTokenLastUsed: "上次使用",
    apiTokenRevokeConfirm: "撤銷此權杖？使用中的客戶端將失去存取權。",
    apiTokenCreatedToast: "已建立存取權杖",
    apiTokenCreateFailed: "無法建立權杖",
    apiTokenRevoked: "已撤銷權杖",
    apiTokenRevokeFailed: "無法撤銷權杖",
  },
  ja: {
    accounts: "アカウント",
    rules: "ルール",
    journal: "ジャーナル",
    ai: "AI",
    general: "一般",
    api: "API",
    about: "について",
    accountsTitle: "アカウントと資金",
    accountsDescription: "証券会社アカウント、開始残高、キャッシュフローを管理します。",
    rulesTitle: "ルールとチェックリスト",
    rulesDescription: "リスク制限とデイリーノートのチェックリストテンプレート。",
    journalTitle: "ジャーナルメタデータ",
    journalDescription: "トレード記録時に使うタグ。セットアップは Playbook で管理します。",
    aiTitle: "AI & LLM",
    aiDescription: "スクショ解析、トレードコーチ、OpenAI 互換 API キー。",
    generalTitle: "一般",
    generalDescription: "設定とセッション。",
    apiTitle: "API アクセス",
    apiDescription:
      "外部ツール、MCP、スクリプト向けの個人アクセストークンと OpenAPI ドキュメント。",
    aboutTitle: "TraderMemos について",
    aboutDescription: "プロジェクト情報、機能、ドキュメントとソースへのリンク。",
    language: "言語",
    languageFooter: "TraderMemos の表示言語。",
    languageSelector: "言語セレクター",
    theme: "外観",
    themeFooter: "ライト、ダーク、またはシステム設定に合わせます。",
    themeSelector: "外観セレクター",
    themeLight: "ライト",
    themeDark: "ダーク",
    themeSystem: "システム",
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
      "このデバイスの API ホスト。空欄でデフォルト。オリジンだけでよく、/api/v1 は自動付与されます。",
    serverUrlHint: "https://example.com",
    session: "セッション",
    signOut: "サインアウト",
    signOutFooter: "このデバイスでのセッションを終了します。",
    appConfig: "アプリ設定",
    appConfigFooter:
      "ローカル設定（言語、タイムゾーン、API サーバー、スクショ上限）をバックアップ/復元します。",
    exportConfig: "設定を書き出し",
    importConfig: "設定を読み込み",
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
    apiDocsTitle: "API ドキュメント",
    apiDocsDescription:
      "インタラクティブな OpenAPI リファレンス（Scalar）。セッション JWT または個人アクセストークンを Bearer 認証に使えます。",
    apiDocsLink: "OpenAPI / Scalar",
    apiDocsOpen: "ドキュメントを開く",
    apiTokensTitle: "アクセストークン",
    apiTokensDescription:
      "MCP、AI エージェント、スクリプトがアカウントと同じ権限で API を呼べます。シークレットは一度だけ表示されます。",
    apiTokensLoading: "トークンを読み込み中…",
    apiTokensError: "アクセストークンを読み込めませんでした。",
    apiTokensEmpty: "まだアクセストークンがありません。MCP やスクリプト用に作成できます。",
    apiTokenCreate: "トークンを発行",
    apiTokenCreateHint: "名前と有効期限を設定します。シークレットは一度だけ表示されます。",
    apiTokenName: "名前",
    apiTokenNameHint: "例: MCP bot、Claude、scripts",
    apiTokenNameRequired: "名前は必須です",
    apiTokenExpiry: "有効期限",
    apiTokenExpiryNever: "無期限",
    apiTokenExpiry30: "30 日",
    apiTokenExpiry90: "90 日",
    apiTokenExpiry365: "1 年",
    apiTokenGenerate: "発行",
    apiTokenCreating: "発行中…",
    apiTokenCancel: "キャンセル",
    apiTokenDone: "完了",
    apiTokenRevealTitle: "トークンをコピー",
    apiTokenRevealHint:
      "このシークレットを今すぐ保存してください。再表示できません。Authorization: Bearer tm_pat_…",
    apiTokenSecret: "トークン",
    apiTokenCopy: "トークンをコピー",
    apiTokenCopied: "コピーしました",
    apiTokenCopyFailed: "コピーできませんでした",
    apiTokenCreated: "作成",
    apiTokenExpires: "期限",
    apiTokenLastUsed: "最終使用",
    apiTokenRevokeConfirm:
      "このトークンを取り消しますか？利用中のクライアントはアクセスできなくなります。",
    apiTokenCreatedToast: "アクセストークンを作成しました",
    apiTokenCreateFailed: "トークンを作成できませんでした",
    apiTokenRevoked: "トークンを取り消しました",
    apiTokenRevokeFailed: "トークンを取り消せませんでした",
  },
  ko: {
    accounts: "계정",
    rules: "규칙",
    journal: "저널",
    ai: "AI",
    general: "일반",
    api: "API",
    about: "정보",
    accountsTitle: "계정 및 자금",
    accountsDescription: "브로커 계정, 시작 잔액, 현금 흐름을 관리합니다.",
    rulesTitle: "규칙 및 체크리스트",
    rulesDescription: "리스크 한도와 일일 노트 체크리스트 템플릿.",
    journalTitle: "저널 메타데이터",
    journalDescription: "거래 기록 시 사용하는 태그. 셋업은 Playbook에서 관리합니다.",
    aiTitle: "AI & LLM",
    aiDescription: "스크린샷 스캔, 트레이드 코치, OpenAI 호환 API 키.",
    generalTitle: "일반",
    generalDescription: "환경설정 및 세션.",
    apiTitle: "API 접근",
    apiDescription: "외부 도구, MCP, 스크립트용 개인 액세스 토큰과 OpenAPI 문서.",
    aboutTitle: "TraderMemos 정보",
    aboutDescription: "프로젝트 정보, 기능, 문서 및 소스 링크.",
    language: "언어",
    languageFooter: "TraderMemos 인터페이스 언어입니다.",
    languageSelector: "언어 선택",
    theme: "모양",
    themeFooter: "라이트, 다크, 또는 시스템 설정을 따릅니다.",
    themeSelector: "모양 선택",
    themeLight: "라이트",
    themeDark: "다크",
    themeSystem: "시스템",
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
      "이 기기의 API 호스트입니다. 비우면 기본값을 씁니다. 호스트만 입력하면 /api/v1이 자동으로 붙습니다.",
    serverUrlHint: "https://example.com",
    session: "세션",
    signOut: "로그아웃",
    signOutFooter: "이 기기에서 세션을 종료합니다.",
    appConfig: "앱 설정",
    appConfigFooter: "로컬 설정(언어, 시간대, API 서버, 스크린샷 한도)을 백업하거나 복원합니다.",
    exportConfig: "설정 내보내기",
    importConfig: "설정 가져오기",
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
    apiDocsTitle: "API 문서",
    apiDocsDescription:
      "대화형 OpenAPI 레퍼런스(Scalar). 세션 JWT 또는 개인 액세스 토큰을 Bearer 인증으로 사용하세요.",
    apiDocsLink: "OpenAPI / Scalar",
    apiDocsOpen: "문서 열기",
    apiTokensTitle: "액세스 토큰",
    apiTokensDescription:
      "MCP, AI 에이전트, 스크립트가 계정과 같은 권한으로 API를 호출할 수 있습니다. 전체 비밀값은 한 번만 표시됩니다.",
    apiTokensLoading: "토큰 불러오는 중…",
    apiTokensError: "액세스 토큰을 불러올 수 없습니다.",
    apiTokensEmpty: "아직 액세스 토큰이 없습니다. MCP나 스크립트용으로 만드세요.",
    apiTokenCreate: "토큰 생성",
    apiTokenCreateHint: "이름을 짓고 만료를 선택하세요. 비밀값은 한 번만 표시됩니다.",
    apiTokenName: "이름",
    apiTokenNameHint: "예: MCP bot, Claude, scripts",
    apiTokenNameRequired: "이름이 필요합니다",
    apiTokenExpiry: "만료",
    apiTokenExpiryNever: "만료 없음",
    apiTokenExpiry30: "30일",
    apiTokenExpiry90: "90일",
    apiTokenExpiry365: "1년",
    apiTokenGenerate: "생성",
    apiTokenCreating: "생성 중…",
    apiTokenCancel: "취소",
    apiTokenDone: "완료",
    apiTokenRevealTitle: "토큰 복사",
    apiTokenRevealHint:
      "이 비밀값을 지금 저장하세요. 다시 표시되지 않습니다. Authorization: Bearer tm_pat_…",
    apiTokenSecret: "토큰",
    apiTokenCopy: "토큰 복사",
    apiTokenCopied: "토큰이 복사되었습니다",
    apiTokenCopyFailed: "토큰을 복사할 수 없습니다",
    apiTokenCreated: "생성",
    apiTokenExpires: "만료",
    apiTokenLastUsed: "최근 사용",
    apiTokenRevokeConfirm: "이 토큰을 취소할까요? 사용 중인 클라이언트의 접근이 막힙니다.",
    apiTokenCreatedToast: "액세스 토큰이 생성되었습니다",
    apiTokenCreateFailed: "토큰을 만들 수 없습니다",
    apiTokenRevoked: "토큰이 취소되었습니다",
    apiTokenRevokeFailed: "토큰을 취소할 수 없습니다",
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
      { id: "general", key: "general" },
      { id: "accounts", key: "accounts" },
      { id: "rules", key: "rules" },
      { id: "journal", key: "journal" },
      { id: "ai", key: "ai" },
      { id: "api", key: "api" },
      { id: "about", key: "about" },
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
