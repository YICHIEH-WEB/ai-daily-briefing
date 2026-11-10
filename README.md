# AI 每日早報

每天 15 條 AI 產業動態，依重要性排序，附來源連結與發布時間。Top 3 置頂於「今日頭條」，同時保留在 15 條順序中。

線上看：https://YICHIEH-WEB.github.io/ai-daily-briefing/

## 怎麼做的

- **信源固定 47 個**，每天依序掃描：官方部落格（OpenAI、Google DeepMind、Anthropic、Meta、Microsoft、NVIDIA）→ 英文科技媒體（The Verge、TechCrunch、MIT Technology Review、Ars Technica、Bloomberg、Reuters、Wired、VentureBeat）→ 中文與台灣媒體 18 個 → 模型跑分榜 7 個（LMArena、Artificial Analysis、Hugging Face、Aider、SWE-bench、HELM、LiveBench）→ 社群 8 個（X、Reddit、Hacker News、Hugging Face 熱門榜、微博、知乎）。
- **日期核驗（方案 B）**：發布類條目須有兩個獨立來源給出同一事件日期，或以官方公告核對；核對不上就降級為「據 X 報導」且不寫斷言日期，或直接棄用。絕不拿文章發布日期當事件日期。
- **只收過去 24 小時內的 AI 新聞**；同一事件合併成一條；湊不夠 15 條就老實說條數不足，不硬湊。
- 全部內容一律繁體中文（台灣用法）。

## 檔案

- `source/`：網站原始碼（React 前端＋ TypeScript 後端＋ Drizzle 資料庫，閱讀進度存於資料庫）。`source/client/src/data/issues.ts` 為佔位範例期數，真實期數資料在 `issues/`。
- `issues/`：每期 JSON 資料，檔名 `<YYYY-MM-DD>.json`。
- `docs/`：每期一份獨立 HTML 存檔（暖紙版），檔名 `AI每日資訊-<YYYY-MM-DD>.html`；`docs/index.html` 為往期歸檔首頁。
- 每期保留一年，超過 365 天的舊期刪除。

## 第一期

2026-11-10：Claude Fable 5.2／Mythos 5.2、Meta Muse Ember、Google TPU 8tx／8i Max。
