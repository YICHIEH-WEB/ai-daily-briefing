import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";
import cjkRegular from "./noto-cjk-regular.woff2";
import cjkBold from "./noto-cjk-bold.woff2";
import condBold from "./noto-display-xcond-bold.ttf";
import monoRegular from "./dejavu-mono.ttf";

/* Same font files the formal artifact ships; injected with bundler URLs so
 * the paths resolve from the page root, not the stylesheet directory. */
const fontStyle = document.createElement("style");
fontStyle.textContent = `
@font-face{font-family:CJK;src:url("${cjkRegular}") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:CJK;src:url("${cjkBold}") format("woff2");font-weight:700 900;font-display:swap}
@font-face{font-family:Cond;src:url("${condBold}") format("truetype");font-weight:800;font-display:swap}
@font-face{font-family:Mono;src:url("${monoRegular}") format("truetype");font-weight:400;font-display:swap}`;
document.head.appendChild(fontStyle);

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
