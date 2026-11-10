// 佔位示例資料，僅用於演示欄位結構，禁止當成真實新聞釋出。
// 真實每日新增一期時，按 03 號檔案規範把當期 15 條寫成同樣結構的 issue 物件追加進 ISSUES，
// 不要把本示例期當成已讀往期，也不要給它預置 100% 進度。
export const ISSUES = [
 {
  "issue": "2026-01-01",
  "label": "01-01",
  "dateline": "2026 年 1 月 1 日 · 星期四",
  "weekday": "星期四",
  "meta": "時間視窗：示例 · 共 3 條（示例期，正式使用時每期為 15 條）",
  "tldr": [
   { "n": 1, "text": "示例速覽第 1 條：佔位標題對應的一句話摘要。" },
   { "n": 2, "text": "示例速覽第 2 條：佔位標題對應的一句話摘要。" },
   { "n": 3, "text": "示例速覽第 3 條：佔位標題對應的一句話摘要。" }
  ],
  "top3": [
   { "rank": 1, "n": 1, "title": "示例條目一", "blurb": "示例置頂摘要一。" },
   { "rank": 2, "n": 2, "title": "示例條目二", "blurb": "示例置頂摘要二。" },
   { "rank": 3, "n": 3, "title": "示例條目三", "blurb": "示例置頂摘要三。" }
  ],
  "hero": "示例導語：過去 24 小時的 AI 訊號示例，不是真實新聞。",
  "dayLine": "THURSDAY · 示例時區",
  "notes": [
   "示例來源說明：本期為佔位資料，正式期請按 03 號檔案寫真實來源說明。"
  ],
  "entries": [
   {
    "n": 1,
    "tag": "model",
    "tagLabel": "模型",
    "title": "示例條目一",
    "en": "Example entry one",
    "paras": [
     "背景示例：第一句佔位正文。",
     "事件示例：第二句佔位正文。",
     "影響示例：第三句佔位正文。"
    ],
    "sources": [{ "url": "https://example.com/example-1", "label": "示例來源" }],
    "sourceText": "",
    "note": "釋出時間示例：未確認"
   },
   {
    "n": 2,
    "tag": "funding",
    "tagLabel": "融資",
    "title": "示例條目二",
    "en": "Example entry two",
    "paras": [
     "背景示例：第一句佔位正文。",
     "事件示例：第二句佔位正文。",
     "影響示例：第三句佔位正文。"
    ],
    "sources": [{ "url": "https://example.com/example-2", "label": "示例來源" }],
    "sourceText": "",
    "note": "釋出時間示例：未確認"
   },
   {
    "n": 3,
    "tag": "app",
    "tagLabel": "應用",
    "title": "示例條目三",
    "en": "Example entry three",
    "paras": [
     "背景示例：第一句佔位正文。",
     "事件示例：第二句佔位正文。",
     "影響示例：第三句佔位正文。"
    ],
    "sources": [{ "url": "https://example.com/example-3", "label": "示例來源" }],
    "sourceText": "",
    "note": "釋出時間示例：未確認"
   }
  ]
 }
];
