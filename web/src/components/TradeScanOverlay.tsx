import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pnlColor } from "@/components/theme-tokens";
import { ocrApi, type TradeExtract } from "@/lib/api/ocr";
import { parseAmountToNumber } from "@/lib/amountInput";
import { cn } from "@/lib/cn";
import { parseFillFile } from "@/lib/fillFile";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { OCR_SCAN_MAX_FILES } from "@/lib/hooks/useOcrParse";
import { blockMultiplier, tradesFromOcrExtract, type SymbolTradeBlock } from "@/lib/newTradeBlocks";
import { mergeTradeExtracts, partitionOcrWarnings } from "@/lib/ocrSymbolGroups";
import { previewFillNetPnls, previewTradePnl } from "@/lib/tradePnlPreview";

/**
 * Web port of the mobile trade-scan overlay (mobile/src/components/
 * trade-scan-overlay.tsx): a document-scanner staging over the New Trade
 * drawer. Files slide in and get read one by one — a light bar sweeps the
 * active thumbnail, statuses pop in as they land, a progress track fills under
 * the title — and when everything is parsed the file list folds into a
 * one-line receipt while per-symbol review cards spring up. Nothing touches
 * the form until "Fill form".
 */

/** One spring for all scan motion — mirrors the app's 420ms/0.85 scan spring. */
const SCAN_SPRING = { type: "spring" as const, stiffness: 340, damping: 30, mass: 0.9 };

type FileStatus = "pending" | "parsing" | "done" | "error";

interface FileItem {
  file: File;
  isImage: boolean;
  status: FileStatus;
  error?: string;
}

function isImageFile(file: File): boolean {
  if (file.type) return file.type.startsWith("image/");
  return /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);
}

/** Images capped so a single scan stays affordable; fill files always kept. */
function capScanFiles(files: File[]): File[] {
  const images = files.filter(isImageFile).slice(0, OCR_SCAN_MAX_FILES);
  return [...images, ...files.filter((f) => !isImageFile(f))];
}

/**
 * Thumbnail object URLs, created in an effect rather than in state initialisers
 * so StrictMode's mount → cleanup → mount cycle hands back live URLs. Revoking
 * URLs built during render would leave the second mount pointing at freed
 * blobs, and every thumbnail renders broken. jsdom has no createObjectURL, so
 * thumbnails there fall back to the document glyph.
 */
function usePreviewUrls(items: FileItem[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>(() => items.map(() => null));

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const created = items.map((item) => (item.isImage ? URL.createObjectURL(item.file) : null));
    setUrls(created);
    return () => {
      for (const url of created) {
        if (url) URL.revokeObjectURL(url);
      }
    };
    // Files are fixed for the overlay's lifetime; statuses must not re-create URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return urls;
}

function statusCaption(item: FileItem): string {
  switch (item.status) {
    case "pending":
      return "Waiting";
    case "parsing":
      return item.isImage ? "Scanning with AI…" : "Reading…";
    case "done":
      return "Parsed";
    case "error":
      return item.error ?? "Failed";
  }
}

/**
 * The document-scanner light bar: a thin brand-tinted line sweeping the
 * thumbnail top-to-bottom while the vision endpoint reads the screenshot.
 */
function ScanBeam({ travel }: { travel: number }) {
  return (
    <motion.div
      aria-hidden
      className="absolute inset-x-0 top-0 h-1 rounded-full bg-primary opacity-90 shadow-[0_0_8px_--theme(--color-primary/60%)]"
      animate={{ y: [0, travel] }}
      transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.1, ease: "easeInOut" }}
    />
  );
}

function StatusGlyph({ status }: { status: FileStatus }) {
  switch (status) {
    case "pending":
      return <Clock size={15} className="text-muted-foreground" aria-hidden />;
    case "parsing":
      return <Loader2 size={15} className="animate-spin text-muted-foreground" aria-hidden />;
    case "done":
      return <CheckCircle2 size={17} className="text-profit" aria-hidden />;
    case "error":
      return <AlertCircle size={17} className="text-destructive" aria-hidden />;
  }
}

function FileThumb({
  previewUrl,
  className,
  iconSize = 18,
}: {
  previewUrl: string | null;
  className?: string;
  iconSize?: number;
}) {
  return previewUrl ? (
    <img src={previewUrl} alt="" className={cn("object-cover", className)} />
  ) : (
    <span className={cn("flex items-center justify-center", className)}>
      <FileText size={iconSize} className="text-muted-foreground" aria-hidden />
    </span>
  );
}

/** One picked file: thumbnail (beam while scanning), name, live status. */
function FileRow({
  item,
  previewUrl,
  index,
  reduceMotion,
}: {
  item: FileItem;
  previewUrl: string | null;
  index: number;
  reduceMotion: boolean;
}) {
  const failed = item.status === "error";
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { ...SCAN_SPRING, delay: index * 0.07 }}
      className="flex items-center gap-3 px-4 py-2.5"
    >
      <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
        <FileThumb previewUrl={previewUrl} className="size-11" />
        {item.status === "parsing" ? <ScanBeam travel={40} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] text-foreground">{item.file.name}</span>
        <span
          className={cn(
            "line-clamp-2 text-[11px] leading-snug",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {statusCaption(item)}
        </span>
      </span>
      {/* Keyed by status so each state change lands with a zoom-pop. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={item.status}
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }
          }
          className="inline-flex shrink-0"
        >
          <StatusGlyph status={item.status} />
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

/** Animated brand-blue progress track under the title. */
function ProgressTrack({ fraction, reduceMotion }: { fraction: number; reduceMotion: boolean }) {
  return (
    <div className="mx-4 h-[3px] overflow-hidden rounded-full bg-muted sm:mx-5">
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={false}
        animate={{ width: `${Math.round(fraction * 100)}%` }}
        transition={reduceMotion ? { duration: 0 } : SCAN_SPRING}
      />
    </div>
  );
}

/** "CALL 325 · 2026-08-15 · ×100" — contract facts the header row can't hold. */
function contractLine(block: SymbolTradeBlock): string {
  const parts: string[] = [];
  if (block.market === "option") {
    const right = block.option_right ? block.option_right.toUpperCase() : "";
    const strike = block.option_strike.trim();
    if (right || strike) parts.push([right, strike].filter(Boolean).join(" "));
    if (block.option_expiry.trim()) parts.push(block.option_expiry.trim());
  }
  const multiplier = blockMultiplier(block);
  if (multiplier > 1) parts.push(`×${multiplier}`);
  return parts.join(" · ");
}

function fillWhen(executedAt: string, locale: string): string {
  const d = new Date(executedAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Read-only digest of one scanned symbol block — the web sibling of the
 * mobile BlockSummary: header facts, fills, then a result strip with the
 * FIFO net P&L.
 */
function ScanBlockSummary({
  block,
  currency,
  locale,
}: {
  block: SymbolTradeBlock;
  currency: string;
  locale: string;
}) {
  const parsedRows = block.rows.map((r) => ({
    side: r.side,
    quantity: parseAmountToNumber(r.quantity) ?? 0,
    price: parseAmountToNumber(r.price) ?? 0,
    fees: parseAmountToNumber(r.fees) ?? 0,
    commission: parseAmountToNumber(r.commission) ?? 0,
  }));
  const multiplier = blockMultiplier(block);
  const preview = previewTradePnl(block.side, parsedRows, multiplier, null);
  const fillPnls = previewFillNetPnls(block.side, parsedRows, multiplier);
  // Rows the model returned blank carry nothing to review, and a "— @ —" line
  // is exactly the dash placeholder the design rules ban.
  const priced = block.rows
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => parsedRows[index]!.quantity > 0 || parsedRows[index]!.price > 0);
  const shown = priced.slice(0, 6);
  const hidden = priced.length - shown.length;
  const long = block.side === "long";
  const contract = contractLine(block);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/40 py-3">
      <div className="flex items-center gap-2 px-4">
        <span className="text-[15px] font-bold text-foreground">
          {block.symbol || "Unknown symbol"}
        </span>
        <span
          className={cn(
            "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold",
            long ? "text-profit" : "text-destructive",
          )}
        >
          {long ? "Long" : "Short"}
        </span>
        <span className="ml-auto text-[11px] capitalize text-muted-foreground">{block.market}</span>
      </div>
      {contract ? (
        <p className="m-0 px-4 text-[11px] tabular-nums text-muted-foreground">{contract}</p>
      ) : null}

      <div className="flex flex-col">
        {shown.map(({ row, index }) => {
          const buy = row.side === "buy";
          const pnl = fillPnls[index] ?? null;
          const qty = parsedRows[index]!.quantity;
          const price = parsedRows[index]!.price;
          return (
            <div key={row.key} className="flex items-center gap-2 px-4 py-1">
              <span className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "w-8 text-[12px] font-semibold",
                    buy ? "text-profit" : "text-destructive",
                  )}
                >
                  {buy ? "Buy" : "Sell"}
                </span>
                <span className="truncate text-[12px] tabular-nums text-foreground">
                  {qty > 0 ? row.quantity : "Qty pending"}
                  {price > 0 ? ` @ ${row.price}` : ""}
                </span>
              </span>
              <span className="text-center text-[11px] tabular-nums text-muted-foreground">
                {fillWhen(row.executed_at, locale)}
              </span>
              <span className="flex flex-1 justify-end">
                {pnl != null ? (
                  <span className={cn("text-[11px] font-semibold tabular-nums", pnlColor(pnl))}>
                    {fmtSignedMoney(pnl, currency, locale)}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
        {hidden > 0 ? (
          <p className="m-0 px-4 pt-1 text-[11px] text-muted-foreground">+{hidden} more fills</p>
        ) : null}
      </div>

      {preview.avgEntry != null || preview.avgExit != null ? (
        <div className="mx-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Avg entry
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {preview.avgEntry != null ? fmtMoney(preview.avgEntry, currency, locale) : "None"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Avg exit
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {preview.avgExit != null ? fmtMoney(preview.avgExit, currency, locale) : "Open"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Est. P&L
            </span>
            {preview.net != null ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn("text-[13px] font-semibold tabular-nums", pnlColor(preview.net))}
                >
                  {fmtSignedMoney(preview.net, currency, locale)}
                </span>
                {preview.closed ? (
                  <CheckCircle2 size={12} className="text-profit" aria-hidden />
                ) : null}
              </span>
            ) : (
              <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                Open · {preview.positionQty} left
              </span>
            )}
          </div>
        </div>
      ) : null}

      {preview.feesTotal > 0 ? (
        <p className="m-0 px-4 text-[11px] tabular-nums text-muted-foreground">
          Fees {fmtMoney(preview.feesTotal, currency, locale)}
        </p>
      ) : null}
    </div>
  );
}

export function TradeScanOverlay({
  files,
  currency,
  locale,
  onApply,
  onClose,
}: {
  files: File[];
  currency: string;
  locale: string;
  /** Apply the merged extract to the form — called only from "Fill form". */
  onApply: (extract: TradeExtract) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [items, setItems] = useState<FileItem[]>(() =>
    capScanFiles(files).map((file) => ({
      file,
      isImage: isImageFile(file),
      status: "pending" as const,
    })),
  );
  const [extracts, setExtracts] = useState<TradeExtract[] | null>(null);
  const previewUrls = usePreviewUrls(items);
  // The parse loop walks the files this overlay opened with; the ref keeps it
  // off the status updates it writes back into `items`.
  const itemsRef = useRef(items);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done: TradeExtract[] = [];
      for (const [index, item] of itemsRef.current.entries()) {
        if (cancelled) return;
        setItems((cur) => cur.map((f, i) => (i === index ? { ...f, status: "parsing" } : f)));
        try {
          let extract: TradeExtract;
          if (item.isImage) {
            const fd = new FormData();
            fd.append("file", item.file);
            extract = await ocrApi.parse(fd);
          } else {
            extract = parseFillFile(item.file.name, await item.file.text());
          }
          done.push(extract);
          if (cancelled) return;
          setItems((cur) => cur.map((f, i) => (i === index ? { ...f, status: "done" } : f)));
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : "Could not read this file";
          setItems((cur) =>
            cur.map((f, i) => (i === index ? { ...f, status: "error", error: message } : f)),
          );
        }
      }
      if (!cancelled) setExtracts(done);
    })();
    return () => {
      cancelled = true;
    };
    // Parse exactly once for the files this overlay was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsing = extracts == null;
  const merged = useMemo(
    () => (extracts != null && extracts.length > 0 ? mergeTradeExtracts(extracts) : null),
    [extracts],
  );
  /**
   * Only blocks with a priced fill are worth reviewing. A vision call that
   * returns no usable rows still yields an extract, and mapping it produces a
   * hollow "UNKNOWN" card — so those count as nothing found, and the warnings
   * below explain why.
   */
  const blocks = useMemo(() => {
    if (!merged) return null;
    const usable = tradesFromOcrExtract(merged).filter((block) =>
      block.rows.some(
        (row) =>
          (parseAmountToNumber(row.quantity) ?? 0) > 0 || (parseAmountToNumber(row.price) ?? 0) > 0,
      ),
    );
    return usable.length > 0 ? usable : null;
  }, [merged]);
  const nothingParsed = extracts != null && blocks == null;
  const warningParts = useMemo(
    () => (merged ? partitionOcrWarnings(merged.warnings ?? []) : null),
    [merged],
  );
  const warnings = warningParts ? [...warningParts.highlights, ...warningParts.details] : [];
  const settled = items.filter((f) => f.status === "done" || f.status === "error").length;
  const parsedCount = items.filter((f) => f.status === "done").length;

  const springUp = (delay: number) => ({
    initial: reduceMotion ? false : ({ opacity: 0, y: 14 } as const),
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { ...SCAN_SPRING, delay },
  });

  return (
    <motion.div
      role="dialog"
      aria-label={blocks ? "Review import" : "Scan to fill"}
      data-testid="trade-scan-overlay"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 56 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, transition: { duration: 0.2 } }}
      transition={reduceMotion ? { duration: 0.15 } : SCAN_SPRING}
      className="absolute inset-0 z-20 flex flex-col rounded-[inherit] bg-card"
    >
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Close scan"
          onClick={onClose}
        >
          <X size={15} strokeWidth={1.5} />
        </Button>
        <h2 className="m-0 flex-1 text-center text-[15px] font-semibold text-foreground">
          {blocks ? "Review import" : "Scan to fill"}
        </h2>
        {/* Spacer mirroring the close button keeps the title centred. */}
        <span aria-hidden className="size-7" />
      </div>
      <ProgressTrack
        fraction={items.length > 0 ? settled / items.length : 0}
        reduceMotion={reduceMotion}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-5">
        <motion.div
          layout={!reduceMotion}
          transition={reduceMotion ? { duration: 0 } : SCAN_SPRING}
          className="overflow-hidden rounded-xl bg-muted/40 py-1"
        >
          {blocks ? (
            // The scan is done — the list folds into a one-line receipt so
            // the review cards own the screen.
            <motion.div {...springUp(0)} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex">
                {items.slice(0, 3).map((item, index) => (
                  <FileThumb
                    key={item.file.name + index}
                    previewUrl={previewUrls[index] ?? null}
                    iconSize={13}
                    className={cn(
                      "size-7 rounded-[7px] border-[1.5px] border-card bg-muted",
                      index > 0 && "-ml-2.5",
                    )}
                  />
                ))}
              </span>
              <span className="flex-1 text-[13px] font-medium text-foreground">
                {parsedCount === 1 ? "1 file scanned" : `${parsedCount} files scanned`}
              </span>
              <CheckCircle2 size={17} className="text-profit" aria-hidden />
            </motion.div>
          ) : (
            items.map((item, index) => (
              <FileRow
                key={item.file.name + index}
                item={item}
                previewUrl={previewUrls[index] ?? null}
                index={index}
                reduceMotion={reduceMotion}
              />
            ))
          )}
        </motion.div>

        {parsing ? (
          <motion.p
            {...springUp(0.2)}
            className="m-0 text-[12px] leading-normal text-muted-foreground"
          >
            Reading {settled} of {items.length}… Screenshots are parsed by your vision endpoint; CSV
            and JSON parse in this browser.
          </motion.p>
        ) : null}

        {nothingParsed ? (
          <motion.p
            {...springUp(0)}
            className="m-0 text-[12px] leading-normal text-muted-foreground"
          >
            Nothing could be read from these files. Check your AI endpoint under Settings → AI, or
            try clearer screenshots.
          </motion.p>
        ) : null}

        {blocks ? (
          <>
            <motion.p
              {...springUp(0.08)}
              className="m-0 pl-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {blocks.length === 1 ? "1 symbol found" : `${blocks.length} symbols found`}
            </motion.p>
            {blocks.map((block, index) => (
              <motion.div key={block.key} {...springUp(0.14 + index * 0.09)}>
                <ScanBlockSummary block={block} currency={currency} locale={locale} />
              </motion.div>
            ))}
          </>
        ) : null}

        {/* The extraction notes explain a thin result, so they close out both
            the review and the nothing-found endings. */}
        {!parsing && warnings.length > 0 ? (
          <motion.div
            {...springUp(blocks ? 0.14 + blocks.length * 0.09 : 0.06)}
            className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4"
            data-testid="scan-overlay-warnings"
          >
            {warnings.map((warning) => (
              <span key={warning} className="flex items-start gap-2">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-chart-3" aria-hidden />
                <span className="text-[12px] leading-snug text-chart-3">{warning}</span>
              </span>
            ))}
          </motion.div>
        ) : null}

        {blocks ? (
          <motion.p
            {...springUp(0.22 + blocks.length * 0.09)}
            className="m-0 text-[12px] leading-normal text-muted-foreground"
          >
            Every field stays editable in the form — check quantities and times against your broker
            before saving.
          </motion.p>
        ) : null}
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        {merged && blocks ? (
          <motion.div {...springUp(0.26)}>
            <Button type="button" className="w-full" onClick={() => onApply(merged)}>
              Fill form
            </Button>
          </motion.div>
        ) : nothingParsed ? (
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Close scan
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}
