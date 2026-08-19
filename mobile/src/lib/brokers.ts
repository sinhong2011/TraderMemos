/**
 * Broker catalogue for the Connect flow — a mirror of web/src/lib/brokers.ts
 * (same keys, names, kinds and brand tints; keep the two in sync). `sync`
 * routes to the flex-sync screen, `file` to the import screen, `manual` to
 * the account form.
 */
export type BrokerKind = 'sync' | 'file' | 'manual';

export interface BrokerDef {
  key: string;
  name: string;
  /** What the created account's broker field reads. */
  accountBroker: string;
  kind: BrokerKind;
  /** Brand tint behind the monogram — static hex, same as web. */
  brand: string;
  monogram: string;
  formats: string;
  /** Official site — its favicon is fetched at runtime as the real mark.
   *  Nothing trademarked ships with the app; offline falls back to the
   *  monogram. Absent = always monogram. */
  domain?: string;
}

export const BROKERS: readonly BrokerDef[] = [
  {
    key: 'ibkr',
    domain: 'interactivebrokers.com',
    name: 'Interactive Brokers',
    accountBroker: 'IBKR',
    kind: 'sync',
    brand: '#D91F26',
    monogram: 'IB',
    formats: 'Flex Web Service, or Activity Statement CSV',
  },
  {
    key: 'thinkorswim',
    domain: 'thinkorswim.com',
    name: 'thinkorswim',
    accountBroker: 'Charles Schwab',
    kind: 'file',
    brand: '#00A0DF',
    monogram: 'TS',
    formats: 'CSV',
  },
  {
    key: 'schwab',
    domain: 'schwab.com',
    name: 'Charles Schwab',
    accountBroker: 'Charles Schwab',
    kind: 'file',
    brand: '#00A0DF',
    monogram: 'CS',
    formats: 'CSV',
  },
  {
    key: 'webull',
    domain: 'webull.com',
    name: 'Webull',
    accountBroker: 'Webull',
    kind: 'file',
    brand: '#1D68F1',
    monogram: 'WB',
    formats: 'CSV',
  },
  {
    key: 'tradovate',
    domain: 'tradovate.com',
    name: 'Tradovate',
    accountBroker: 'Tradovate',
    kind: 'file',
    brand: '#0B8B3E',
    monogram: 'TV',
    formats: 'CSV',
  },
  {
    key: 'ninjatrader',
    domain: 'ninjatrader.com',
    name: 'NinjaTrader',
    accountBroker: 'NinjaTrader',
    kind: 'file',
    brand: '#F58220',
    monogram: 'NT',
    formats: 'CSV',
  },
  {
    key: 'ctrader',
    domain: 'ctrader.com',
    name: 'cTrader',
    accountBroker: 'cTrader',
    kind: 'file',
    brand: '#1E6FD9',
    monogram: 'cT',
    formats: 'CSV',
  },
  {
    key: 'dxtrade',
    domain: 'dx.trade',
    name: 'DXtrade',
    accountBroker: 'DXtrade',
    kind: 'file',
    brand: '#2A6DF4',
    monogram: 'DX',
    formats: 'CSV',
  },
  {
    key: 'matchtrader',
    domain: 'match-trade.com',
    name: 'Match-Trader',
    accountBroker: 'Match-Trader',
    kind: 'file',
    brand: '#0EA5A0',
    monogram: 'MT',
    formats: 'CSV',
  },
  {
    key: 'metatrader',
    domain: 'metatrader5.com',
    name: 'MetaTrader 4 / 5',
    accountBroker: 'MetaTrader',
    kind: 'file',
    brand: '#0B7CBF',
    monogram: 'M5',
    formats: 'XLSX or HTML statement',
  },
  {
    key: 'tastytrade',
    domain: 'tastytrade.com',
    name: 'tastytrade',
    accountBroker: 'tastytrade',
    kind: 'file',
    brand: '#F04E23',
    monogram: 'tt',
    formats: 'CSV',
  },
  {
    key: 'fidelity',
    domain: 'fidelity.com',
    name: 'Fidelity',
    accountBroker: 'Fidelity',
    kind: 'file',
    brand: '#368727',
    monogram: 'Fi',
    formats: 'CSV',
  },
  {
    key: 'etrade',
    domain: 'etrade.com',
    name: 'E*TRADE',
    accountBroker: 'E*TRADE',
    kind: 'file',
    brand: '#6633CC',
    monogram: 'E*',
    formats: 'CSV',
  },
  {
    key: 'moomoo',
    domain: 'moomoo.com',
    name: 'moomoo / Futu',
    accountBroker: 'Moomoo',
    kind: 'file',
    brand: '#FF6C00',
    monogram: 'mm',
    formats: 'CSV',
  },
  {
    key: 'robinhood',
    domain: 'robinhood.com',
    name: 'Robinhood',
    accountBroker: 'Robinhood',
    kind: 'file',
    brand: '#00C805',
    monogram: 'RH',
    formats: 'CSV you build from the statement',
  },
  {
    key: 'generic',
    name: 'Other broker',
    accountBroker: 'Other',
    kind: 'file',
    brand: '#64748B',
    monogram: 'CSV',
    formats: 'Any CSV, or a TraderMemos JSON backup',
  },
  {
    key: 'manual',
    name: 'Manual account',
    accountBroker: 'Manual',
    kind: 'manual',
    brand: '#1264B2',
    monogram: '✎',
    formats: '',
  },
];
