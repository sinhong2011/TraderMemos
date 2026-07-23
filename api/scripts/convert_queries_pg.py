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


def main() -> None:
    for f in sorted(src.glob("*.sql")):
        out = convert(f.read_text())
        # Postgres EXISTS returns bool; keep ExecutionExists as bigint for Querier parity.
        if f.name == "executions.sql":
            out = out.replace(
                "SELECT EXISTS(SELECT 1 FROM executions WHERE account_id = $1 AND dedup_hash = $2);",
                "SELECT CASE WHEN EXISTS(\n"
                "  SELECT 1 FROM executions WHERE account_id = $1 AND dedup_hash = $2\n"
                ") THEN 1::bigint ELSE 0::bigint END;",
            )
        (dst / f.name).write_text(out)
        print("converted", f.name)


if __name__ == "__main__":
    main()
