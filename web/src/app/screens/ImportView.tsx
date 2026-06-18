import { useRef, useState } from "react";
import { Upload, ArrowRight, Check, RefreshCw, FileText } from "lucide-react";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import type { Account, ImportPreview, ImportResult } from "../../lib/api/types";

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const fieldStyle: React.CSSProperties = {
  background: "var(--color-surface-base)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  color: "var(--color-text)",
  fontSize: 12,
  padding: "5px 8px",
  width: "100%",
  fontFamily: "var(--font-mono)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--color-text-muted)",
  marginBottom: 4,
  fontWeight: 500,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const btnPrimary: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-control)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  background: "transparent",
  color: "var(--color-text-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

// Canonical trade fields we want to map
const CANONICAL_FIELDS = [
  "symbol",
  "side",
  "quantity",
  "price",
  "executed_at",
  "fees",
  "commission",
] as const;

// ---------------------------------------------------------------------------
// Step 1 - Upload
// ---------------------------------------------------------------------------

interface Step1Props {
  accounts: Account[];
  accountsLoading: boolean;
  onPreview: (file: File, accountId: string, instrumentType: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

function Step1Upload({ accounts, accountsLoading, onPreview, error, loading }: Step1Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [instrumentType, setInstrumentType] = useState("stock");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!file) return;
    const aid = accountId || accounts[0]?.id;
    if (!aid) return;
    await onPreview(file, aid, instrumentType);
  }

  return (
    <Panel title="Step 1 - Upload CSV">
      <div style={{ padding: "20px 16px" }}>
        <div className="flex flex-col gap-4" style={{ maxWidth: 480 }}>
          {accountsLoading ? (
            <Skeleton height="36px" />
          ) : (
            <div>
              <label style={labelStyle}>Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={fieldStyle}
                aria-label="Account select"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
                {accounts.length === 0 && <option value="">No accounts - create one in Settings</option>}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Instrument Type</label>
            <select value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)} style={fieldStyle}>
              <option value="stock">Stock</option>
              <option value="option">Option</option>
              <option value="future">Future</option>
              <option value="forex">Forex</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{
                ...fieldStyle,
                padding: "6px 8px",
                cursor: "pointer",
              }}
            />
            {file && (
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                <FileText size={10} strokeWidth={1.5} style={{ display: "inline", marginRight: 4 }} />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {error && <p style={{ fontSize: 11, color: "var(--color-neg)" }}>{error}</p>}

          <div>
            <button
              onClick={handleSubmit}
              disabled={loading || !file || accounts.length === 0}
              style={{
                ...btnPrimary,
                opacity: (loading || !file || accounts.length === 0) ? 0.6 : 1,
                cursor: (loading || !file || accounts.length === 0) ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight size={13} strokeWidth={1.5} />
                  Preview
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - Map columns
// ---------------------------------------------------------------------------

interface Step2Props {
  preview: ImportPreview;
  onCommit: (mapping: Record<string, string>) => Promise<void>;
  onBack: () => void;
  error: string | null;
  loading: boolean;
}

function Step2Map({ preview, onCommit, onBack, error, loading }: Step2Props) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of CANONICAL_FIELDS) {
      initial[field] = preview.suggested_mapping[field] ?? "";
    }
    return initial;
  });

  function setField(field: string, value: string) {
    setMapping((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCommit() {
    await onCommit(mapping);
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Step 2 - Map Columns">
        <div style={{ padding: "16px" }}>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Match each field to the corresponding column in your CSV.
          </p>

          <div className="flex flex-col gap-3" style={{ maxWidth: 480 }}>
            {CANONICAL_FIELDS.map((field) => (
              <div key={field}>
                <label style={labelStyle}>{field.replace(/_/g, " ")}</label>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => setField(field, e.target.value)}
                  style={fieldStyle}
                  aria-label={`Map ${field}`}
                >
                  <option value="">(skip)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {error && <p style={{ fontSize: 11, color: "var(--color-neg)", marginTop: 10 }}>{error}</p>}

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleCommit}
              disabled={loading}
              style={{
                ...btnPrimary,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} strokeWidth={1.5} style={{ animation: "spin 1s linear infinite" }} />
                  Importing...
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={1.5} />
                  Confirm Import
                </>
              )}
            </button>
            <button onClick={onBack} style={btnGhost} disabled={loading}>
              Back
            </button>
          </div>
        </div>
      </Panel>

      {/* Sample data preview table */}
      <Panel title="Sample Rows">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {preview.headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 12px",
                      textAlign: "left",
                      color: "var(--color-text-muted)",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      fontSize: 10,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample_rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {preview.headers.map((h) => (
                    <td
                      key={h}
                      className="tabular-nums"
                      style={{
                        padding: "5px 12px",
                        color: "var(--color-text)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row[h] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - Result
// ---------------------------------------------------------------------------

interface Step3Props {
  result: ImportResult;
  onDone: () => void;
  onImportAnother: () => void;
}

function Step3Result({ result, onDone, onImportAnother }: Step3Props) {
  return (
    <Panel title="Step 3 - Import Complete">
      <div style={{ padding: "24px 16px" }}>
        <div className="flex flex-col gap-4" style={{ maxWidth: 400 }}>
          <div className="flex flex-col gap-2">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={16} strokeWidth={1.5} style={{ color: "var(--color-pos)" }} />
              <span style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>Import finished</span>
            </div>
          </div>

          <div style={{ background: "var(--color-surface-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-panel)", padding: "12px 16px" }}>
            <div className="flex flex-col gap-2">
              <Row label="Inserted" value={String(result.inserted)} highlight="pos" />
              <Row label="Skipped (duplicates)" value={String(result.skipped)} />
              <Row label="Errors" value={String(result.errors.length)} highlight={result.errors.length > 0 ? "neg" : undefined} />
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "var(--radius-panel)", padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "var(--color-neg)", fontWeight: 600, marginBottom: 6 }}>Row errors:</p>
              {result.errors.map((e, i) => (
                <p key={i} style={{ fontSize: 11, color: "var(--color-neg)", fontFamily: "var(--font-mono)" }}>
                  Row {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button onClick={onDone} style={btnPrimary}>
              <Check size={13} strokeWidth={1.5} />
              Done
            </button>
            <button onClick={onImportAnother} style={btnGhost}>
              <Upload size={13} strokeWidth={1.5} />
              Import another
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "pos" | "neg" }) {
  const color = highlight === "pos" ? "var(--color-pos)" : highlight === "neg" ? "var(--color-neg)" : "var(--color-text)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="tabular-nums" style={{ color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Upload", "Map columns", "Result"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 4 }}>
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: isActive ? "var(--color-accent)" : isDone ? "rgba(99,102,241,0.3)" : "var(--color-surface-base)",
                  border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? "#fff" : isDone ? "var(--color-accent)" : "var(--color-text-muted)",
                  flexShrink: 0,
                }}
              >
                {isDone ? <Check size={11} strokeWidth={2} /> : step}
              </div>
              <span style={{ fontSize: 11, color: isActive ? "var(--color-text)" : "var(--color-text-muted)", fontWeight: isActive ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 32, height: 1, background: "var(--color-border)", margin: "0 8px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export - driven by step state
// ---------------------------------------------------------------------------

export interface ImportViewProps {
  accounts: Account[];
  accountsLoading: boolean;
  onPreview: (formData: FormData) => Promise<ImportPreview>;
  onCommit: (batchId: string, formData: FormData) => Promise<ImportResult>;
  onDone: () => void;
}

export function ImportView({ accounts, accountsLoading, onPreview, onCommit, onDone }: ImportViewProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep file + instrument type in state between steps so commit can resend
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedInstrumentType, setStagedInstrumentType] = useState("stock");

  async function handlePreview(file: File, accountId: string, instrumentType: string) {
    setLoading(true);
    setStepError(null);
    setStagedFile(file);
    setStagedInstrumentType(instrumentType);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("account_id", accountId);
      fd.append("instrument_type", instrumentType);
      const data = await onPreview(fd);
      setPreview(data);
      setStep(2);
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "Preview failed. Check your CSV and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit(mapping: Record<string, string>) {
    if (!preview || !stagedFile) return;
    setLoading(true);
    setStepError(null);
    try {
      const fd = new FormData();
      fd.append("file", stagedFile);
      fd.append("column_mapping", JSON.stringify(mapping));
      fd.append("instrument_type", stagedInstrumentType);
      const data = await onCommit(preview.import_batch_id, fd);
      setResult(data);
      setStep(3);
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleImportAnother() {
    setStep(1);
    setPreview(null);
    setResult(null);
    setStepError(null);
    setStagedFile(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1Upload
          accounts={accounts}
          accountsLoading={accountsLoading}
          onPreview={handlePreview}
          error={stepError}
          loading={loading}
        />
      )}

      {step === 2 && preview && (
        <Step2Map
          preview={preview}
          onCommit={handleCommit}
          onBack={() => { setStep(1); setStepError(null); }}
          error={stepError}
          loading={loading}
        />
      )}

      {step === 3 && result && (
        <Step3Result
          result={result}
          onDone={onDone}
          onImportAnother={handleImportAnother}
        />
      )}
    </div>
  );
}
