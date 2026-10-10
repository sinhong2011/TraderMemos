# Trading System Map — 實作計畫

日期：2026-10-10  
狀態：階段 A 完成；階段 B（規則地圖）已實作，待完整 E2E 截圖驗收。  
工作分支：`cursor/trading-system-map-f936`

延續 [Trading System Builder](trading-system-builder.md)。

## 分階段實作

### A. 整理既有能力與分析正確性

- [x] 盤點既有 API、規則編輯、版本啟用、每日市況、system card、review，更新原 spec 的已實作／缺失清單。
- [x] 驗證並保留 Defensive / Paused 診斷回歸測試。
- [x] 修正四週進度文案：Week 3 不再稱小倉驗證；Week 4 改為 version revision（`revise`），非「完成回顧」。
- [x] 移除固定 30 筆即「Reliable」；改為 thin / indicative / adequate。
- [x] hesitated misses 分開顯示，不混入 adherence_rate。
- [x] 跨幣別：system-review 經 `loadClosedTrades` → `mixed_currencies` 400。

### B. 第一個可交付版本：規則地圖

- [x] 固定五節點、選中狀態、fit view（`@xyflow/react`）。
- [x] 右側詳情與手機直向卡；`RuleEditor` 共用元件。
- [x] 系統空狀態四個起始問題。
- [x] vague-wording、自評、未解問題、regime / trade types。
- [x] 保存、取消、切換防丟、discard、啟用原因。
- [ ] 完整瀏覽器 E2E 截圖（進行中）。

### C–E

待後續 session。
