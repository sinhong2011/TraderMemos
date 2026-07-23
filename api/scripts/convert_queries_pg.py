#!/usr/bin/env python3
"""Convert internal/store/queries/*.sql (? placeholders) → queries_pg ($n)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "internal/store/queries"
dst = ROOT / "internal/store/queries_pg"
dst.mkdir(parents=True, exist_ok=True)


def convert_stmt(stmt: str) -> str:
    stmt = re.sub(r"\?(\d+)", lambda m: f"${m.group(1)}", stmt)
    n = 0

    def repl(_m):
        nonlocal n
        n += 1
        return f"${n}"

    return re.sub(r"\?", repl, stmt)


def convert(text: str) -> str:
    parts = re.split(r"(?=^-- name:)", text, flags=re.M)
    return "".join(convert_stmt(p) for p in parts if p.strip())


def apply_pg_fixes(name: str, out: str) -> str:
    # Postgres EXISTS returns bool; keep ExecutionExists as bigint for Querier parity.
    if name == "executions.sql":
        out = out.replace(
            "SELECT EXISTS(SELECT 1 FROM executions WHERE account_id = $1 AND dedup_hash = $2);",
            "SELECT CASE WHEN EXISTS(\n"
            "  SELECT 1 FROM executions WHERE account_id = $1 AND dedup_hash = $2\n"
            ") THEN 1::bigint ELSE 0::bigint END;",
        )
    # Optional filters: Postgres needs typed params for `IS NULL` checks (42P08).
    # COALESCE keeps nullable args typed from the compared column.
    # sqlc.narg('x') IS NULL OR col = sqlc.narg('x')
    #   → col = COALESCE(sqlc.narg('x'), col)
    out = re.sub(
        r"\(sqlc\.narg\('([^']+)'\)\s+IS NULL\s+OR\s+(\w+)\s*=\s*sqlc\.narg\('\1'\)\)",
        r"(\2 = COALESCE(sqlc.narg('\1'), \2))",
        out,
    )
    # Date compares on TEXT columns (journal_notes.occurred_at) keep ::text.
    # Timestamp columns use ::timestamp.
    timestamp_cols = {"closed_at", "opened_at", "executed_at", "created_at", "updated_at"}

    def ge_repl(m: re.Match[str]) -> str:
        arg, col = m.group(1), m.group(2)
        cast = "timestamp" if col in timestamp_cols else "text"
        return f"({col} >= COALESCE(sqlc.narg('{arg}')::{cast}, {col}))"

    def le_repl(m: re.Match[str]) -> str:
        arg, col = m.group(1), m.group(2)
        cast = "timestamp" if col in timestamp_cols else "text"
        return f"({col} <= COALESCE(sqlc.narg('{arg}')::{cast}, {col}))"

    out = re.sub(
        r"\(sqlc\.narg\('([^']+)'\)\s+IS NULL\s+OR\s+(\w+)\s*>=\s*sqlc\.narg\('\1'\)\)",
        ge_repl,
        out,
    )
    out = re.sub(
        r"\(sqlc\.narg\('([^']+)'\)\s+IS NULL\s+OR\s+(\w+)\s*<=\s*sqlc\.narg\('\1'\)\)",
        le_repl,
        out,
    )
    return out
def main() -> None:
    for f in sorted(src.glob("*.sql")):
        out = apply_pg_fixes(f.name, convert(f.read_text()))
        (dst / f.name).write_text(out)
        print("converted", f.name)


if __name__ == "__main__":
    main()
