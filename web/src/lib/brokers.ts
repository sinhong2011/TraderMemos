/**
 * The broker catalogue behind the Connect flow.
 *
 * The server already recognises nine broker exports by their header signature
 * (`api/internal/importer/brokers.go`) but that detection is invisible: the
 * import page asks for "a file" and silently guesses. This catalogue is the
 * user-facing half — it names the brokers, says how to get the file out of
 * each one, and routes to the connection method that broker supports.
 *
 * `key` matches the server preset key wherever one exists, so a card that
 * claims "we recognise this layout" is making a checkable promise.
 */

export type BrokerConnectKind =
  /** Credentials in the app; fills arrive on a schedule. */
  | "sync"
  /** The broker exports a file; we parse it. */
  | "file"
  /** No export at all — trades are typed in. */
  | "manual";

export interface BrokerDef {
  key: string;
  name: string;
  /** Stored on `account.broker` when the flow creates the account. */
  accountBroker: string;
  kind: BrokerConnectKind;
  /**
   * True when `importer.brokerPresets` carries a signature for this export —
   * the column mapping is then pre-filled instead of guessed.
   */
  recognised: boolean;
  /** Brand colour for the mark tile, used until a logo asset is dropped in. */
  brand: string;
  /** Monogram shown on the tile when no logo file is present. */
  monogram: string;
  /** File types the export produces. */
  formats?: string;
  /** How to get the data out, in the broker's own menu vocabulary. */
  steps: string[];
  /** A caveat worth knowing before starting. */
  note?: string;
  /** Extra search terms — old names, parent companies, platform names. */
  aliases?: string[];
}

export const BROKERS: BrokerDef[] = [
  {
    key: "ibkr",
    name: "Interactive Brokers",
    accountBroker: "IBKR",
    kind: "sync",
    recognised: true,
    brand: "#D91F26",
    monogram: "IB",
    formats: "Flex Web Service, or Activity Statement CSV",
    steps: [
      "In Client Portal open Performance & Reports → Flex Queries.",
      "Create a Trade Confirmation Flex Query with the Trades → Executions section, format CSV, and save it.",
      "Copy the Query ID shown next to the saved query.",
      "Under Performance & Reports → Settings, enable the Flex Web Service and copy the token.",
    ],
    note: "The token expires yearly — IBKR emails a reminder before it does.",
    aliases: ["ib", "tws", "flex", "interactive brokers"],
  },
  {
    key: "thinkorswim",
    name: "thinkorswim",
    accountBroker: "Charles Schwab",
    kind: "file",
    recognised: true,
    brand: "#00A0DF",
    monogram: "TS",
    formats: "CSV",
    steps: [
      "Open the Monitor tab → Account Statement.",
      "Set the date range you want to journal.",
      "Use the menu at the top right of the statement to export it as CSV.",
      "Upload the file — the Account Trade History section is the part we read.",
    ],
    aliases: ["tos", "schwab", "td ameritrade", "ameritrade"],
  },
  {
    key: "schwab",
    name: "Charles Schwab",
    accountBroker: "Charles Schwab",
    kind: "file",
    recognised: true,
    brand: "#00A0DF",
    monogram: "CS",
    formats: "CSV",
    steps: [
      "Open Accounts → History.",
      "Pick the account and the date range, with Transactions selected.",
      "Export the result as CSV.",
    ],
    aliases: ["schwab"],
  },
  {
    key: "webull",
    name: "Webull",
    accountBroker: "Webull",
    kind: "file",
    recognised: true,
    brand: "#1D68F1",
    monogram: "WB",
    formats: "CSV",
    steps: [
      "Open the Webull desktop app (the phone app cannot export).",
      "Go to Orders and pick the date range.",
      "Export the orders as CSV.",
    ],
    note: "Only filled orders import — cancelled and pending rows are skipped.",
    aliases: ["webull"],
  },
  {
    key: "tradovate",
    name: "Tradovate",
    accountBroker: "Tradovate",
    kind: "file",
    recognised: true,
    brand: "#0B8B3E",
    monogram: "TV",
    formats: "CSV",
    steps: [
      "Open the Reports section.",
      "Choose Fills and set the date range.",
      "Download the report as CSV.",
    ],
    note: "Times are read as exchange (Chicago) time.",
    aliases: ["futures", "tradovate"],
  },
  {
    key: "ninjatrader",
    name: "NinjaTrader",
    accountBroker: "NinjaTrader",
    kind: "file",
    recognised: true,
    brand: "#F58220",
    monogram: "NT",
    formats: "CSV",
    steps: [
      "In the Control Center open Trade Performance.",
      "Select the Executions tab and the date range.",
      "Right-click the grid and export it as CSV.",
    ],
    aliases: ["ninja", "futures"],
  },
  {
    key: "ctrader",
    name: "cTrader",
    accountBroker: "cTrader",
    kind: "file",
    recognised: true,
    brand: "#1E6FD9",
    monogram: "cT",
    formats: "CSV",
    steps: [
      "Open the History tab.",
      "Set the period you want to journal.",
      "Export the history to CSV.",
    ],
    note: "Rows are whole positions, and quantities are lots — check the timezone in the preview before confirming.",
    aliases: ["forex", "cfd", "prop"],
  },
  {
    key: "dxtrade",
    name: "DXtrade",
    accountBroker: "DXtrade",
    kind: "file",
    recognised: true,
    brand: "#2A6DF4",
    monogram: "DX",
    formats: "CSV",
    steps: [
      "Open Order History in the trading portal.",
      "Set the date range.",
      "Export it as CSV.",
    ],
    note: "Quantities are lots. Common on prop-firm portals.",
    aliases: ["prop", "forex", "funded"],
  },
  {
    key: "matchtrader",
    name: "Match-Trader",
    accountBroker: "Match-Trader",
    kind: "file",
    recognised: true,
    brand: "#0EA5A0",
    monogram: "MT",
    formats: "CSV",
    steps: ["Open the Positions or History view.", "Set the date range.", "Export it as CSV."],
    note: "Rows are positions; still-open ones import with their entry fill only.",
    aliases: ["prop", "forex", "funded"],
  },
  {
    key: "metatrader",
    name: "MetaTrader 4 / 5",
    accountBroker: "MetaTrader",
    kind: "file",
    recognised: true,
    brand: "#0B7CBF",
    monogram: "M5",
    formats: "XLSX or HTML statement",
    steps: [
      "Open the Toolbox (MT5) or Terminal (MT4) and select the History tab.",
      "Set the period, then right-click the grid.",
      "Choose Report → XLSX (MT5) or Save as Report (MT4).",
    ],
    note: "Deals import in broker server time (EET by default) — set the timezone in the preview if your broker differs.",
    aliases: ["mt4", "mt5", "metaquotes", "forex"],
  },
  {
    key: "tastytrade",
    name: "tastytrade",
    accountBroker: "tastytrade",
    kind: "file",
    recognised: false,
    brand: "#F04E23",
    monogram: "tt",
    formats: "CSV",
    steps: [
      "Open History in the desktop or web platform.",
      "Set the date range and filter to filled transactions.",
      "Download the CSV.",
    ],
    aliases: ["tasty", "options"],
  },
  {
    key: "fidelity",
    name: "Fidelity",
    accountBroker: "Fidelity",
    kind: "file",
    recognised: false,
    brand: "#368727",
    monogram: "Fi",
    formats: "CSV",
    steps: [
      "Open Accounts & Trade → Portfolio → Activity & Orders.",
      "Set the date range.",
      "Use Download to save the activity as CSV.",
    ],
    aliases: ["fidelity"],
  },
  {
    key: "etrade",
    name: "E*TRADE",
    accountBroker: "E*TRADE",
    kind: "file",
    recognised: false,
    brand: "#6633CC",
    monogram: "E*",
    formats: "CSV",
    steps: [
      "Open Accounts → Transactions.",
      "Set the account and date range.",
      "Download the transactions as CSV.",
    ],
    aliases: ["etrade", "morgan stanley"],
  },
  {
    key: "moomoo",
    name: "moomoo / Futu",
    accountBroker: "Moomoo",
    kind: "file",
    recognised: false,
    brand: "#FF6C00",
    monogram: "mm",
    formats: "CSV",
    steps: [
      "Open the moomoo or FUTU desktop app.",
      "Go to the account's order or trade history and set the date range.",
      "Export the history as CSV.",
    ],
    aliases: ["futu", "niuniu", "moo moo", "hk"],
  },
  {
    key: "robinhood",
    name: "Robinhood",
    accountBroker: "Robinhood",
    kind: "file",
    recognised: false,
    brand: "#00C805",
    monogram: "RH",
    formats: "CSV you build from the statement",
    steps: [
      "Open Account → Settings → Statements & History.",
      "Download the monthly account statements covering your trades.",
      "Copy the trade rows into a spreadsheet with symbol, side, quantity, price and time columns, and save it as CSV.",
    ],
    note: "Robinhood only publishes PDF statements, so this one needs a spreadsheet step. Logging trades by hand is often faster for a light month.",
    aliases: ["rh", "hood"],
  },
  {
    key: "generic",
    name: "Other broker",
    accountBroker: "Other",
    kind: "file",
    recognised: false,
    brand: "#64748B",
    monogram: "CSV",
    formats: "Any CSV, or a TraderMemos JSON backup",
    steps: [
      "Export your trade, order or execution history from the broker as CSV.",
      "Keep one row per fill, with symbol, side, quantity, price and a timestamp.",
      "Upload it — you map the columns onto those fields in the next step.",
    ],
    note: "Round-trip exports (one row per closed position) work too — map the open/close columns instead.",
    aliases: ["csv", "custom", "unknown", "spreadsheet"],
  },
  {
    key: "manual",
    name: "Manual account",
    accountBroker: "Manual",
    kind: "manual",
    recognised: false,
    brand: "#1264B2",
    monogram: "✎",
    steps: [
      "Name the account and pick its currency.",
      "Log trades as you take them, or fill in yesterday's at review time.",
    ],
    note: "Screenshot scanning and the trade form both write here — nothing about the journal needs a broker file.",
    aliases: ["by hand", "paper", "prop", "backtest", "no broker"],
  },
];

const BY_KEY = new Map(BROKERS.map((b) => [b.key, b]));

export function findBroker(key: string | undefined): BrokerDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

/** Case- and punctuation-insensitive match over name, aliases and format. */
export function searchBrokers(query: string): BrokerDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return BROKERS;
  return BROKERS.filter((b) => {
    const haystack = [b.name, b.accountBroker, b.formats ?? "", ...(b.aliases ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export const KIND_LABEL: Record<BrokerConnectKind, string> = {
  sync: "Auto-sync",
  file: "File import",
  manual: "Manual",
};

/** Ordered so the picker's groups read best-effort-first. */
export const KIND_ORDER: BrokerConnectKind[] = ["sync", "file", "manual"];
