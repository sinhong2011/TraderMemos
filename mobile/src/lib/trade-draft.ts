/**
 * Hand-off slot between the new-trade form and the pushed /trade-preview
 * screen. Blocks hold Dates and screenshot queues, so they can't ride router
 * params; the form stashes the draft here, pushes the route, and the preview
 * screen picks it up on mount. One slot only — a new stash replaces the last.
 */

import type { Setup, Tag } from '@/api/types';
import type { TradeFormValues } from './trade-form';

export interface TradeDraft {
  blocks: TradeFormValues[];
  accountId: string;
  accountName: string;
  currency: string;
  setups: Setup[];
  tags: Tag[];
}

let draft: TradeDraft | null = null;

export function stashTradeDraft(next: TradeDraft): void {
  draft = next;
}

/** The current draft — null when the route is opened cold (deep link). */
export function peekTradeDraft(): TradeDraft | null {
  return draft;
}

export function clearTradeDraft(): void {
  draft = null;
}
