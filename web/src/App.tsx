import { useState } from "react";
import { api, setToken, type Trade } from "./api";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState("");

  async function load(id: string) {
    setTrades(await api.trades(id));
    setSummary(await api.summary(id));
  }

  async function login() {
    setErr("");
    try {
      const t = await api.login(email, password);
      setToken(t.access_token);
      setAuthed(true);
      const accs = await api.accounts();
      if (accs[0]) await load(accs[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "login failed");
    }
  }

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>TraderMemos</h1>
        <div style={{ display: "grid", gap: 8, maxWidth: 280 }}>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={login}>Login</button>
          {err && <p style={{ color: "red" }}>{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h2>Summary</h2>
      {summary && <pre>{JSON.stringify(summary, null, 2)}</pre>}
      <h2>Trades</h2>
      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Direction</th>
            <th>Net P&amp;L</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id}>
              <td>{t.symbol}</td>
              <td>{t.direction}</td>
              <td>{t.net_pnl}</td>
              <td>{t.closed_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
