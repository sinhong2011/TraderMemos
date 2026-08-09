import type { AppLocale } from "./locale";
import { REPO_URL } from "./version";

export { REPO_URL };
export const DEVELOPER_NAME = "sinhong2011";
export const DEVELOPER_GITHUB = "https://github.com/sinhong2011";
export const DEVELOPER_AVATAR = "https://github.com/sinhong2011.png";

export type AboutFeature = {
  title: string;
  description: string;
};

export type AboutLink = {
  label: string;
  href: string;
  description: string;
};

export type AboutContent = {
  tagline: string;
  intro: string;
  featuresTitle: string;
  features: AboutFeature[];
  stackTitle: string;
  stack: string[];
  linksTitle: string;
  links: AboutLink[];
  philosophyTitle: string;
  philosophy: string;
  licenseNote: string;
  developerTitle: string;
  developerRole: string;
  developerGithubLabel: string;
  apiTitle: string;
  apiDescription: string;
  apiBaseUrlLabel: string;
  apiHealthLabel: string;
  apiVersionLabel: string;
  apiGoLabel: string;
  apiWebVersionLabel: string;
  apiStatusOk: string;
  apiStatusError: string;
  apiStatusChecking: string;
  updatesTitle: string;
  updatesDescription: string;
  updateCurrentLabel: string;
  updateLatestLabel: string;
  updateStatusLabel: string;
  updateStatusCurrent: string;
  updateStatusAvailable: string;
  updateStatusSwReady: string;
  updateCheck: string;
  updateChecking: string;
  updateReload: string;
  updateViewRelease: string;
  updateLastChecked: string;
  updateNeverChecked: string;
  updateBannerTitle: string;
  updateBannerSw: string;
  updateDismiss: string;
  updateReleaseTitle: string;
  updateReleasePublished: string;
  updateWebBehind: string;
  updateApiBehind: string;
  updateBothBehind: string;
  updateApiVersionLabel: string;
  updateApiUnreachable: string;
  updateNoticesLabel: string;
  updateNoticesDetail: string;
  updateMismatch: string;
  apiBuildTimeLabel: string;
  apiUptimeLabel: string;
  apiDbLabel: string;
  apiFeaturesLabel: string;
  featureNames: Record<string, string>;
};

const ABOUT: Record<AppLocale, AboutContent> = {
  en: {
    tagline: "Self-hosted trading journal",
    intro:
      "TraderMemos is an open-source performance journal for active traders. Your trades, screenshots, and analytics stay on infrastructure you control — no SaaS lock-in, no data mining.",
    featuresTitle: "What you get",
    features: [
      {
        title: "Home & equity",
        description:
          "Asymmetric bento stats, glowing P&L hero, step equity curve, and session-aware filters.",
      },
      {
        title: "Trade log & detail",
        description:
          "Virtualized table, execution-level detail, tags, setups, journal notes, and screenshot attachments.",
      },
      {
        title: "P&L calendar",
        description:
          "Heatmap calendar with daily realized P&L, trade counts, drill-down, and a macro economic event timeline.",
      },
      {
        title: "Reports & playbook",
        description:
          "Win rate, expectancy, setup breakdown, MAE/MFE excursions, behavior insights, and a linked strategy playbook.",
      },
      {
        title: "Import & tools",
        description:
          "CSV import, IBKR Flex auto-sync, position-size calculator, risk rules, and cash ledger per account.",
      },
      {
        title: "AI (optional)",
        description:
          "Screenshot fill extraction and trade coach via any OpenAI-compatible API — keys stored server-side only.",
      },
    ],
    stackTitle: "Built with",
    stack: ["Go · Echo · SQLite / Postgres", "React · Vite+ · TanStack", "Tailwind · shadcn UI"],
    linksTitle: "Resources",
    links: [
      {
        label: "GitHub repository",
        href: REPO_URL,
        description: "Source code, issues, and releases.",
      },
      {
        label: "Fork & deploy guide",
        href: `${REPO_URL}/blob/main/docs/fork-deploy.md`,
        description: "One-click Vercel, Cloudflare, Netlify, or Railway.",
      },
      {
        label: "Contributing",
        href: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
        description: "Local dev setup with make dev.",
      },
      {
        label: "Design system",
        href: `${REPO_URL}/blob/main/DESIGN.md`,
        description: "shadcn — typography, color, and layout rules.",
      },
    ],
    philosophyTitle: "Why self-host?",
    philosophy:
      "Cloud journals like TradeZella and TraderSync are polished — but your edge lives in the data. TraderMemos follows the same philosophy as projects like Ghost, Umami, and Plane: run it yourself, own the database, and extend it without permission.",
    licenseNote: "Open source. Deploy on Docker, Railway, or your own VPS.",
    developerTitle: "Developer",
    developerRole: "Creator & maintainer",
    developerGithubLabel: "View on GitHub",
    apiTitle: "Backend API",
    apiDescription: "Live connection to the TraderMemos API this app is using.",
    apiBaseUrlLabel: "API base URL",
    apiHealthLabel: "Health",
    apiVersionLabel: "API version",
    apiGoLabel: "Go runtime",
    apiWebVersionLabel: "Web version",
    apiStatusOk: "Connected",
    apiStatusError: "Unreachable",
    apiStatusChecking: "Checking…",
    updatesTitle: "Updates",
    updatesDescription:
      "Check for a newer web build (service worker) or a published GitHub release.",
    updateCurrentLabel: "Installed version",
    updateLatestLabel: "Latest release",
    updateStatusLabel: "Status",
    updateStatusCurrent: "You're up to date",
    updateStatusAvailable: "New release available",
    updateStatusSwReady: "Update ready — reload to apply",
    updateCheck: "Check for updates",
    updateChecking: "Checking…",
    updateReload: "Reload to update",
    updateViewRelease: "View release",
    updateLastChecked: "Last checked",
    updateNeverChecked: "Not checked yet",
    updateBannerTitle: "Update available",
    updateBannerSw: "A new version of TraderMemos is ready. Reload to apply it.",
    updateDismiss: "Dismiss",
    updateReleaseTitle: "Release notes",
    updateReleasePublished: "Published",
    updateWebBehind: "Web UI is behind the latest release",
    updateApiBehind: "API server is behind the latest release",
    updateBothBehind: "Web and API are behind the latest release",
    updateApiVersionLabel: "API version",
    updateApiUnreachable: "Could not read API version",
    updateNoticesLabel: "Update notifications",
    updateNoticesDetail:
      "Show a notice in the corner when a newer version is available. Update status stays visible here either way.",
    updateMismatch: "Web and API versions don't match",
    apiBuildTimeLabel: "Built",
    apiUptimeLabel: "Uptime",
    apiDbLabel: "Database",
    apiFeaturesLabel: "Server features",
    featureNames: {
      market_data: "Market data",
      econ_calendar: "Economic calendar",
      ocr: "OCR",
      coach: "AI coach",
      background_jobs: "Background jobs",
    },
  },
  "zh-HK": {
    tagline: "自架交易日誌",
    intro:
      "TraderMemos 是面向活躍交易者的開源績效日誌。你的交易、截圖與分析都留在你控制的基礎設施上——沒有 SaaS 綁定，也沒有資料挖掘。",
    featuresTitle: "功能概覽",
    features: [
      {
        title: "儀表板與權益",
        description: "不對稱 bento 統計、發光 P&L 主指標、階梯權益曲線及盤段感知篩選。",
      },
      {
        title: "交易日誌與詳情",
        description: "虛擬化表格、成交層級詳情、標籤、策略、日誌筆記及截圖附件。",
      },
      {
        title: "P&L 日曆",
        description: "熱力圖日曆顯示每日已實現 P&L、交易筆數、可深入查看，並附宏觀經濟事件時間軸。",
      },
      {
        title: "報表與策略庫",
        description: "勝率、期望值、策略分解、MAE/MFE 走勢、行為洞察，以及連結的策略庫。",
      },
      {
        title: "匯入與工具",
        description: "CSV 匯入、IBKR Flex 自動同步、倉位計算器、風險規則，以及每帳戶現金分錄。",
      },
      {
        title: "AI（可選）",
        description: "透過任何 OpenAI 相容 API 進行截圖填單擷取及交易教練——金鑰只保存在伺服器。",
      },
    ],
    stackTitle: "技術棧",
    stack: ["Go · Echo · SQLite / Postgres", "React · Vite+ · TanStack", "Tailwind · shadcn UI"],
    linksTitle: "資源",
    links: [
      {
        label: "GitHub 儲存庫",
        href: REPO_URL,
        description: "原始碼、議題與版本。",
      },
      {
        label: "Fork 與部署指南",
        href: `${REPO_URL}/blob/main/docs/fork-deploy.md`,
        description: "一鍵部署至 Vercel、Cloudflare、Netlify 或 Railway。",
      },
      {
        label: "貢獻指南",
        href: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
        description: "使用 make dev 進行本地開發。",
      },
      {
        label: "設計系統",
        href: `${REPO_URL}/blob/main/DESIGN.md`,
        description: "shadcn——字體、色彩與版面規則。",
      },
    ],
    philosophyTitle: "為何自架？",
    philosophy:
      "雲端日誌如 TradeZella、TraderSync 很完善——但你的優勢藏在資料裡。TraderMemos 與 Ghost、Umami、Plane 等專案同一理念：自己部署、擁有資料庫、無需許可即可擴展。",
    licenseNote: "開源。可部署於 Docker、Railway 或自有 VPS。",
    developerTitle: "開發者",
    developerRole: "創作者及維護者",
    developerGithubLabel: "在 GitHub 查看",
    apiTitle: "後端 API",
    apiDescription: "此應用程式目前連線的 TraderMemos API。",
    apiBaseUrlLabel: "API 位址",
    apiHealthLabel: "健康狀態",
    apiVersionLabel: "API 版本",
    apiGoLabel: "Go 執行環境",
    apiWebVersionLabel: "Web 版本",
    apiStatusOk: "已連線",
    apiStatusError: "無法連線",
    apiStatusChecking: "檢查中…",
    updatesTitle: "更新",
    updatesDescription: "檢查較新的網頁版本（Service Worker）或 GitHub 發佈版本。",
    updateCurrentLabel: "目前版本",
    updateLatestLabel: "最新發佈",
    updateStatusLabel: "狀態",
    updateStatusCurrent: "已是最新",
    updateStatusAvailable: "有新版本可更新",
    updateStatusSwReady: "更新已就緒 — 重新載入以套用",
    updateCheck: "檢查更新",
    updateChecking: "檢查中…",
    updateReload: "重新載入以更新",
    updateViewRelease: "查看發佈說明",
    updateLastChecked: "上次檢查",
    updateNeverChecked: "尚未檢查",
    updateBannerTitle: "有可用更新",
    updateBannerSw: "TraderMemos 有新版本就緒。重新載入以套用。",
    updateDismiss: "關閉",
    updateReleaseTitle: "發佈說明",
    updateReleasePublished: "發佈日期",
    updateWebBehind: "Web 介面落後於最新發佈",
    updateApiBehind: "API 伺服器落後於最新發佈",
    updateBothBehind: "Web 與 API 均落後於最新發佈",
    updateApiVersionLabel: "API 版本",
    updateApiUnreachable: "無法讀取 API 版本",
    updateNoticesLabel: "更新通知",
    updateNoticesDetail: "有新版本時在角落顯示提示。關閉後這裡仍會顯示更新狀態。",
    updateMismatch: "Web 與 API 版本不一致",
    apiBuildTimeLabel: "建置時間",
    apiUptimeLabel: "運行時間",
    apiDbLabel: "資料庫",
    apiFeaturesLabel: "伺服器功能",
    featureNames: {
      market_data: "市場資料",
      econ_calendar: "經濟日曆",
      ocr: "OCR",
      coach: "AI 教練",
      background_jobs: "背景工作",
    },
  },
  ja: {
    tagline: "セルフホスト型トレードジャーナル",
    intro:
      "TraderMemos はアクティブトレーダー向けのオープンソースパフォーマンスジャーナルです。トレード、スクショ、分析はすべて自分で管理するインフラに残ります — SaaS ロックインやデータマイニングはありません。",
    featuresTitle: "主な機能",
    features: [
      {
        title: "ダッシュボード & エクイティ",
        description:
          "非対称 bento 統計、グロー P&L ヒーロー、ステップエクイティ曲線、セッション対応フィルタ。",
      },
      {
        title: "トレードログ & 詳細",
        description:
          "仮想化テーブル、約定レベル詳細、タグ、セットアップ、ジャーナルノート、スクショ添付。",
      },
      {
        title: "P&L カレンダー",
        description:
          "日次実現 P&L とトレード数のヒートマップカレンダー、ドリルダウンとマクロ経済イベントのタイムライン対応。",
      },
      {
        title: "レポート & プレイブック",
        description:
          "勝率、期待値、セットアップ内訳、MAE/MFE、行動インサイト、リンクされたプレイブック。",
      },
      {
        title: "インポート & ツール",
        description:
          "CSV インポート、IBKR Flex 自動同期、ポジションサイズ計算、リスクルール、アカウント別キャッシュ台帳。",
      },
      {
        title: "AI（任意）",
        description:
          "OpenAI 互換 API によるスクショ約定抽出とトレードコーチ — キーはサーバー側のみに保存。",
      },
    ],
    stackTitle: "技術スタック",
    stack: ["Go · Echo · SQLite / Postgres", "React · Vite+ · TanStack", "Tailwind · shadcn UI"],
    linksTitle: "リソース",
    links: [
      {
        label: "GitHub リポジトリ",
        href: REPO_URL,
        description: "ソースコード、Issue、リリース。",
      },
      {
        label: "Fork & デプロイガイド",
        href: `${REPO_URL}/blob/main/docs/fork-deploy.md`,
        description: "Vercel、Cloudflare、Netlify、Railway のワンクリック。",
      },
      {
        label: "コントリビューション",
        href: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
        description: "make dev によるローカル開発。",
      },
      {
        label: "デザインシステム",
        href: `${REPO_URL}/blob/main/DESIGN.md`,
        description: "shadcn — タイポ、カラー、レイアウトルール。",
      },
    ],
    philosophyTitle: "なぜセルフホスト？",
    philosophy:
      "TradeZella や TraderSync のようなクラウドジャーナルは洗練されています — しかしエッジはデータの中にあります。Ghost、Umami、Plane と同じ思想：自分で動かし、DB を所有し、許可なく拡張する。",
    licenseNote: "オープンソース。Docker、Railway、または自前 VPS にデプロイ可能。",
    developerTitle: "開発者",
    developerRole: "作成者 & メンテナ",
    developerGithubLabel: "GitHub で見る",
    apiTitle: "バックエンド API",
    apiDescription: "このアプリが使用中の TraderMemos API への接続情報。",
    apiBaseUrlLabel: "API ベース URL",
    apiHealthLabel: "ヘルス",
    apiVersionLabel: "API バージョン",
    apiGoLabel: "Go ランタイム",
    apiWebVersionLabel: "Web バージョン",
    apiStatusOk: "接続済み",
    apiStatusError: "到達不可",
    apiStatusChecking: "確認中…",
    updatesTitle: "アップデート",
    updatesDescription: "新しい Web ビルド（Service Worker）または GitHub リリースを確認します。",
    updateCurrentLabel: "インストール済み",
    updateLatestLabel: "最新リリース",
    updateStatusLabel: "ステータス",
    updateStatusCurrent: "最新です",
    updateStatusAvailable: "新しいリリースがあります",
    updateStatusSwReady: "更新準備完了 — 再読み込みで適用",
    updateCheck: "更新を確認",
    updateChecking: "確認中…",
    updateReload: "再読み込みして更新",
    updateViewRelease: "リリースを見る",
    updateLastChecked: "最終確認",
    updateNeverChecked: "未確認",
    updateBannerTitle: "アップデートがあります",
    updateBannerSw:
      "TraderMemos の新しいバージョンが準備できました。再読み込みして適用してください。",
    updateDismiss: "閉じる",
    updateReleaseTitle: "リリースノート",
    updateReleasePublished: "公開日",
    updateWebBehind: "Web UI が最新リリースより古い",
    updateApiBehind: "API サーバーが最新リリースより古い",
    updateBothBehind: "Web と API が最新リリースより古い",
    updateApiVersionLabel: "API バージョン",
    updateApiUnreachable: "API バージョンを取得できません",
    updateNoticesLabel: "アップデート通知",
    updateNoticesDetail:
      "新しいバージョンがあるときに画面隅に通知を表示します。オフでもここで更新状況を確認できます。",
    updateMismatch: "Web と API のバージョンが一致しません",
    apiBuildTimeLabel: "ビルド日時",
    apiUptimeLabel: "稼働時間",
    apiDbLabel: "データベース",
    apiFeaturesLabel: "サーバー機能",
    featureNames: {
      market_data: "市場データ",
      econ_calendar: "経済カレンダー",
      ocr: "OCR",
      coach: "AI コーチ",
      background_jobs: "バックグラウンドジョブ",
    },
  },
  ko: {
    tagline: "셀프호스팅 트레이딩 저널",
    intro:
      "TraderMemos는 활발한 트레이더를 위한 오픈소스 성과 저널입니다. 거래, 스크린샷, 분석이 모두 직접 관리하는 인프라에 남습니다 — SaaS 종속이나 데이터 마이닝 없음.",
    featuresTitle: "주요 기능",
    features: [
      {
        title: "대시보드 & 에쿼티",
        description: "비대칭 bento 통계, 글로우 P&L 히어로, 스텝 에쿼티 곡선, 세션 필터.",
      },
      {
        title: "거래 로그 & 상세",
        description: "가상화 테이블, 체결 수준 상세, 태그, 셋업, 저널 노트, 스크린샷 첨부.",
      },
      {
        title: "P&L 캘린더",
        description: "일별 실현 P&L, 거래 수 히트맵 캘린더, 드릴다운 및 거시 경제 이벤트 타임라인.",
      },
      {
        title: "리포트 & 플레이북",
        description: "승률, 기대값, 셋업 분석, MAE/MFE, 행동 인사이트, 연결된 플레이북.",
      },
      {
        title: "가져오기 & 도구",
        description:
          "CSV 가져오기, IBKR Flex 자동 동기화, 포지션 크기 계산기, 리스크 규칙, 계정별 현금 원장.",
      },
      {
        title: "AI (선택)",
        description: "OpenAI 호환 API로 스크린샷 체결 추출 및 거래 코치 — 키는 서버에만 저장.",
      },
    ],
    stackTitle: "기술 스택",
    stack: ["Go · Echo · SQLite / Postgres", "React · Vite+ · TanStack", "Tailwind · shadcn UI"],
    linksTitle: "리소스",
    links: [
      {
        label: "GitHub 저장소",
        href: REPO_URL,
        description: "소스 코드, 이슈, 릴리스.",
      },
      {
        label: "Fork & 배포 가이드",
        href: `${REPO_URL}/blob/main/docs/fork-deploy.md`,
        description: "Vercel, Cloudflare, Netlify, Railway 원클릭.",
      },
      {
        label: "기여하기",
        href: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
        description: "make dev로 로컬 개발.",
      },
      {
        label: "디자인 시스템",
        href: `${REPO_URL}/blob/main/DESIGN.md`,
        description: "shadcn — 타이포, 색상, 레이아웃 규칙.",
      },
    ],
    philosophyTitle: "왜 셀프호스팅?",
    philosophy:
      "TradeZella, TraderSync 같은 클라우드 저널은 잘 만들어졌지만 — 엣지는 데이터 안에 있습니다. Ghost, Umami, Plane과 같은 철학: 직접 운영하고, DB를 소유하고, 허가 없이 확장.",
    licenseNote: "오픈소스. Docker, Railway 또는 자체 VPS에 배포.",
    developerTitle: "개발자",
    developerRole: "제작자 및 유지보수",
    developerGithubLabel: "GitHub에서 보기",
    apiTitle: "백엔드 API",
    apiDescription: "이 앱이 사용 중인 TraderMemos API 연결 정보.",
    apiBaseUrlLabel: "API 기본 URL",
    apiHealthLabel: "상태",
    apiVersionLabel: "API 버전",
    apiGoLabel: "Go 런타임",
    apiWebVersionLabel: "Web 버전",
    apiStatusOk: "연결됨",
    apiStatusError: "연결 불가",
    apiStatusChecking: "확인 중…",
    updatesTitle: "업데이트",
    updatesDescription: "새 웹 빌드(서비스 워커) 또는 GitHub 릴리스를 확인합니다.",
    updateCurrentLabel: "설치된 버전",
    updateLatestLabel: "최신 릴리스",
    updateStatusLabel: "상태",
    updateStatusCurrent: "최신 상태입니다",
    updateStatusAvailable: "새 릴리스 사용 가능",
    updateStatusSwReady: "업데이트 준비됨 — 새로고침하여 적용",
    updateCheck: "업데이트 확인",
    updateChecking: "확인 중…",
    updateReload: "새로고침하여 업데이트",
    updateViewRelease: "릴리스 보기",
    updateLastChecked: "마지막 확인",
    updateNeverChecked: "아직 확인 안 함",
    updateBannerTitle: "업데이트 사용 가능",
    updateBannerSw: "TraderMemos 새 버전이 준비되었습니다. 새로고침하여 적용하세요.",
    updateDismiss: "닫기",
    updateReleaseTitle: "릴리스 노트",
    updateReleasePublished: "게시일",
    updateWebBehind: "Web UI가 최신 릴리스보다 이전",
    updateApiBehind: "API 서버가 최신 릴리스보다 이전",
    updateBothBehind: "Web과 API가 최신 릴리스보다 이전",
    updateApiVersionLabel: "API 버전",
    updateApiUnreachable: "API 버전을 읽을 수 없음",
    updateNoticesLabel: "업데이트 알림",
    updateNoticesDetail:
      "새 버전이 있을 때 화면 모서리에 알림을 표시합니다. 꺼도 여기에서 업데이트 상태를 확인할 수 있습니다.",
    updateMismatch: "Web과 API 버전이 일치하지 않음",
    apiBuildTimeLabel: "빌드 시간",
    apiUptimeLabel: "가동 시간",
    apiDbLabel: "데이터베이스",
    apiFeaturesLabel: "서버 기능",
    featureNames: {
      market_data: "시장 데이터",
      econ_calendar: "경제 캘린더",
      ocr: "OCR",
      coach: "AI 코치",
      background_jobs: "백그라운드 작업",
    },
  },
};

export function aboutContent(locale: string): AboutContent {
  if (locale in ABOUT) return ABOUT[locale as AppLocale];
  return ABOUT.en;
}
