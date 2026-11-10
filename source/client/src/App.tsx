import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, apiBeacon, type ApiResponse } from "./api";
import { ISSUES } from "./data/issues";

type ProgressRow = ApiResponse<typeof api, "getProgress">["progress"][number];
type Mark = { anchor: string; entryNo: number; percent: number };
type ThemeChoice = "system" | "light" | "dark";

const ISSUES_DESC = [...ISSUES].reverse();
const pad2 = (n: number) => String(n).padStart(2, "0");
const pctInt = (p: number) => Math.round(p);
const dotted = (key: string) => key.replaceAll("-", ".");

/** The shell scrolls an inner container, not the window — resolve whichever
 * element actually scrolls (an overflow ancestor of <main>), falling back
 * to the window. All scroll reads/writes go through this interface. */
type Scroller = {
  y: () => number;
  setY: (v: number) => void;
  max: () => number;
  listen: (fn: () => void) => () => void;
};

function resolveScroller(): Scroller {
  const win: Scroller = {
    y: () => window.scrollY,
    setY: (v) => window.scrollTo(0, v),
    max: () => document.documentElement.scrollHeight - window.innerHeight,
    listen: (fn) => {
      window.addEventListener("scroll", fn, { passive: true });
      return () => window.removeEventListener("scroll", fn);
    },
  };
  const anchor = document.querySelector("main");
  if (!anchor) return win;
  const chain: HTMLElement[] = [];
  let el: HTMLElement | null = anchor;
  while (el && el !== document.body && el !== document.documentElement) {
    chain.push(el);
    el = el.parentElement;
  }
  const pick = (requireOverflow: boolean) =>
    chain.find((c) => {
      if (c.scrollHeight - c.clientHeight <= 4) return false;
      if (!requireOverflow) return true;
      const oy = window.getComputedStyle(c).overflowY;
      return oy === "auto" || oy === "scroll";
    });
  const target = pick(true) ?? pick(false);
  if (!target) return win;
  return {
    y: () => target.scrollTop,
    setY: (v) => {
      target.scrollTop = v;
    },
    max: () => target.scrollHeight - target.clientHeight,
    listen: (fn) => {
      target.addEventListener("scroll", fn, { passive: true });
      return () => target.removeEventListener("scroll", fn);
    },
  };
}

/** Smooth-scroll to an absolute Y in the real scroller. Duration scales
 * with distance, capped at ~1s. Any wheel / touch / key input from the
 * user cancels immediately. */
function animateScrollTo(
  targetY: number,
  opts: { instant?: boolean; onDone?: () => void; onCancel?: () => void } = {},
) {
  const sc = resolveScroller();
  const startY = sc.y();
  const dist = targetY - startY;
  if (opts.instant || Math.abs(dist) < 4) {
    sc.setY(Math.max(0, targetY));
    opts.onDone?.();
    return;
  }
  const duration = Math.min(1000, Math.max(300, Math.abs(dist) * 0.35));
  let raf = 0;
  let finished = false;
  let armed = false;
  let startT: number | null = null;
  let frames = 0;
  const cleanup = () => {
    window.removeEventListener("wheel", onUser);
    window.removeEventListener("touchstart", onUser);
    window.removeEventListener("keydown", onUser);
  };
  const onUser = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    cleanup();
    opts.onCancel?.();
  };
  const step = (t: number) => {
    if (!armed) {
      // Arm the cancel-on-intervention listeners only once the animation
      // is actually running: the input that *started* the jump (a click,
      // or the Enter keydown that activated the control and is still
      // propagating to window) must not be mistaken for an intervention.
      armed = true;
      startT = t;
      window.addEventListener("wheel", onUser, { passive: true });
      window.addEventListener("touchstart", onUser, { passive: true });
      window.addEventListener("keydown", onUser);
    }
    frames += 1;
    // Progress is anchored on the rAF timestamps themselves; if a host
    // clock stalls those (progress never leaves 0), fall back to counting
    // frames so the scroll still completes instead of freezing in place.
    const timeP = (t - (startT ?? t)) / duration;
    const frameP = frames / (duration / 16.7);
    const p = Math.min(1, timeP > 0.02 ? timeP : frameP);
    const eased = 1 - Math.pow(1 - p, 3);
    sc.setY(startY + dist * eased);
    if (p < 1) {
      raf = requestAnimationFrame(step);
    } else {
      finished = true;
      cleanup();
      opts.onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
}

export function App() {

  /* ---------- theme: formal cycling toggle, every open starts on system ---------- */
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    document.documentElement.dataset.theme = themeChoice;
  }, [themeChoice]);
  const themeName = (m: ThemeChoice) =>
    m === "system" ? "跟隨系統" : m === "light" ? "淺色" : "深色";
  const nextTheme: ThemeChoice =
    themeChoice === "system" ? "light" : themeChoice === "light" ? "dark" : "system";

  /* Formal entrance motion: html.motion + .loaded, but .loaded now waits
   * for the hero fonts (Cond display + CJK bold + Mono) so the hero is
   * first painted with its final font metrics instead of swapping from
   * fallback fonts mid-entrance (the visible jolt). A timeout fallback
   * reveals the hero anyway if fonts are slow or fail, so the page
   * never stays blank. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("motion");
    let raf1 = 0;
    let raf2 = 0;
    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) root.classList.add("loaded");
        });
      });
    };
    let timer = 0;
    const fontsReady = (async () => {
      try {
        if (!("fonts" in document)) return;
        await Promise.all([
          document.fonts.load('800 100px Cond', "AI!"),
          document.fonts.load('700 20px CJK', "過去小時訊號"),
          document.fonts.load('900 20px CJK', "過去小時訊號"),
          document.fonts.load('400 11px Mono', "ISSUE 15"),
        ]);
      } catch {
        /* font load failure: fall through to reveal */
      }
    })();
    const timeout = new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, 1500);
    });
    void Promise.race([fontsReady, timeout]).then(() => {
      window.clearTimeout(timer);
      reveal();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  /* ---------- persisted progress (server DB) ---------- */
  const progressQuery = useQuery({
    queryKey: ["progress"],
    queryFn: () => api.getProgress({}),
  });
  const saveMut = useMutation({
    mutationFn: (v: { issue: string; anchor: string; entryNo: number; percent: number }) =>
      api.saveProgress(v),
  });
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  /* Clear-completion note, keyed by issue: a note written for one issue
   * renders only while that issue is displayed — switching to another
   * issue hides it, switching back shows it again. (Previously a single
   * global string, so the note leaked onto every other issue's footer.) */
  const [clearNotes, setClearNotes] = useState<Record<string, string>>({});
  /* ---------- issue / filter ---------- */
  const [issueKey, setIssueKey] = useState<string>(
    ISSUES_DESC[0]?.issue ?? "2026-10-25",
  );
  const issue = useMemo(
    () => ISSUES.find((i) => i.issue === issueKey) ?? ISSUES[ISSUES.length - 1]!,
    [issueKey],
  );
  const [filter, setFilter] = useState<string>("all");
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const e of issue.entries) {
      if (!counts.has(e.tagLabel)) order.push(e.tagLabel);
      counts.set(e.tagLabel, (counts.get(e.tagLabel) ?? 0) + 1);
    }
    return order
      .map((label, i) => ({ label, count: counts.get(label) ?? 0, i }))
      .sort((a, b) => b.count - a.count || a.i - b.i);
  }, [issue]);
  const visibleEntries = useMemo(
    () =>
      filter === "all"
        ? issue.entries
        : issue.entries.filter((e) => e.tagLabel === filter),
    [issue, filter],
  );

  /* ---------- reading state ---------- */
  const [sessionMarks, setSessionMarks] = useState<Record<string, Mark>>({});
  const [displayPct, setDisplayPct] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<Mark & { issue: string } | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [ribbonGone, setRibbonGone] = useState<Record<string, boolean>>({});
  const [ribbonOpen, setRibbonOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [issueEnter, setIssueEnter] = useState(false);
  const barRef = useRef<HTMLElement | null>(null);

  const issueKeyRef = useRef(issueKey);
  issueKeyRef.current = issueKey;
  const marksRef = useRef(sessionMarks);
  marksRef.current = sessionMarks;
  const pendingRef = useRef<({ issue: string } & Mark) | null>(null);
  const lastSaveRef = useRef(0);
  /* Percent already handed to the server per issue in this session; a new
   * pending payload is only created when the reader moves >0.5% past it
   * (or past the hydrated stored max, whichever is further). */
  const sentBaselineRef = useRef<Record<string, number>>({});
  const trailingRef = useRef<number | null>(null);
  const arrivedRef = useRef(false);
  const suppressRef = useRef(false);
  const hydratedRef = useRef(false);

  const flushSave = (beacon = false) => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    if (trailingRef.current != null) {
      window.clearTimeout(trailingRef.current);
      trailingRef.current = null;
    }
    lastSaveRef.current = Date.now();
    sentBaselineRef.current[p.issue] = Math.max(
      sentBaselineRef.current[p.issue] ?? 0,
      p.percent,
    );
    const payload = {
      issue: p.issue,
      anchor: p.anchor,
      entryNo: p.entryNo,
      percent: p.percent,
    };
    if (beacon) {
      // Page is going away: keepalive transport so the request still
      // leaves the device after unload begins.
      void apiBeacon.saveProgress(payload).catch(() => {});
    } else {
      saveMut.mutate(payload);
    }
  };
  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  /* Per-issue latch: after the current issue's progress is cleared,
   * scroll tracking for that issue stays suspended until the reader is
   * back at the very top — otherwise the compute pass would immediately
   * re-record the deep scroll position the reader is still sitting at
   * (clearing at the bottom would bounce straight back to ~90%+). */
  const suspendedRef = useRef<Set<string>>(new Set());

  /* Clear ONLY the current issue's progress — footer button with an
   * inline confirm step. No other issue is touched, server-side or
   * in-session: every other issue keeps its stored and displayed
   * progress exactly as it was. On success the current issue restarts
   * from 0 and the view jumps straight to the top; recording stays
   * suspended until the scroll position reaches the top, which that
   * jump satisfies (see suspendedRef / the scroll compute pass). */
  const clearMut = useMutation({
    mutationFn: (currentIssue: string) =>
      api.resetIssueProgress({
        currentIssue,
      }),
    onSuccess: (_res, currentIssue) => {
      // Discard any unsent pending progress so it cannot resurrect the
      // cleared row right after the wipe.
      pendingRef.current = null;
      if (trailingRef.current != null) {
        window.clearTimeout(trailingRef.current);
        trailingRef.current = null;
      }
      suspendedRef.current.add(currentIssue);
      delete sentBaselineRef.current[currentIssue];
      setSessionMarks((prev) => {
        const next: Record<string, Mark> = { ...prev };
        delete next[currentIssue];
        return next;
      });
      setDisplayPct((prev) => {
        const next: Record<string, number> = { ...prev };
        delete next[currentIssue];
        return next;
      });
      if (toast?.issue === currentIssue) setToast(null);
      setRibbonGone((prev) => ({ ...prev, [currentIssue]: true }));
      setConfirmClear(false);
      setClearNotes((prev) => ({
        ...prev,
        [currentIssue]: `已清除本期（${dotted(currentIssue)}）進度，其他期不受影響。已回到頂部，將從這裡重新開始記錄。`,
      }));
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      // Jump straight to the top of the issue: this also releases the
      // post-clear suspension latch (it clears when scroll reaches the
      // top), so recording restarts from 0 at the top instead of the
      // reader having to scroll up manually.
      animateScrollTo(0);
    },
    onError: (_err, currentIssue) => {
      setConfirmClear(false);
      setClearNotes((prev) => ({
        ...prev,
        [currentIssue]: "清除失敗，請稍後再試。",
      }));
    },
  });

  /* Hydrate session marks from the DB once; show the resume toast for the
   * initially displayed issue when it has an unfinished breakpoint. */
  useEffect(() => {
    if (!progressQuery.data || hydratedRef.current) return;
    hydratedRef.current = true;
    const marks: Record<string, Mark> = {};
    for (const row of progressQuery.data.progress as ProgressRow[]) {
      sentBaselineRef.current[row.issue] = Math.max(
        sentBaselineRef.current[row.issue] ?? 0,
        row.percent,
      );
      if (row.percent > 0) {
        marks[row.issue] = {
          anchor: row.anchor,
          entryNo: row.entryNo,
          percent: row.percent,
        };
      }
    }
    setSessionMarks((prev) => ({ ...marks, ...prev }));
    const first = marks[issueKeyRef.current];
    if (first && first.percent < 100) {
      setToast({ issue: issueKeyRef.current, ...first });
    }
  }, [progressQuery.data]);

  /* Save on page hide / unload — not only on exit buttons. The flush uses
   * the keepalive client so it still leaves the device while the page is
   * being torn down. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") flushSaveRef.current(true);
    };
    const onUnload = () => flushSaveRef.current(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  /* A fresh view of an issue re-arms its ribbon until the reader scrolls
   * to/past the breakpoint in this view. */
  useEffect(() => {
    arrivedRef.current = false;
    setRibbonGone((prev) => ({ ...prev, [issueKey]: false }));
    setRibbonOpen(false);
  }, [issueKey]);

  /* Formal reveal-on-scroll for story rows (IntersectionObserver, with the
   * same 1800ms safety release as the formal build). */
  useEffect(() => {
    const stories = Array.from(
      document.querySelectorAll<HTMLElement>(".story"),
    );
    if (!("IntersectionObserver" in window)) {
      stories.forEach((s) => s.classList.add("seen"));
      return;
    }
    stories.forEach((s) => {
      if (filter !== "all") s.classList.add("seen");
      else s.classList.add("pending");
    });
    const ob = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("seen");
            ob.unobserve(e.target);
          }
        });
      },
      { rootMargin: "180px 0px 180px 0px", threshold: 0 },
    );
    stories.forEach((s) => ob.observe(s));
    const t = window.setTimeout(() => {
      stories.forEach((s) => s.classList.remove("pending"));
    }, 1800);
    return () => {
      ob.disconnect();
      window.clearTimeout(t);
    };
  }, [issueKey, filter]);

  /* Scroll tracking: formal right-edge progress bar + live percent +
   * furthest entry, throttled saves. */
  useEffect(() => {
    const sc = resolveScroller();
    let ticking = false;
    const compute = () => {
      ticking = false;
      const max = sc.max();
      const frac = max > 0 ? Math.min(1, Math.max(0, sc.y() / max)) : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleY(${frac})`;
      }
      const key = issueKeyRef.current;
      const iss = ISSUES.find((i) => i.issue === key);
      if (!iss) return;
      /* Post-clear suspension: this issue was just reset, so record
       * nothing until the reader is back at the very top. The latch
       * releases as soon as the scroll position reaches the top; from
       * there normal tracking resumes (and the top itself reads ~0%,
       * so nothing is recorded until the reader scrolls down again). */
      if (suspendedRef.current.has(key)) {
        if (sc.y() <= 2) suspendedRef.current.delete(key);
        else return;
      }
      const vh = window.innerHeight;
      const pagePct = frac * 100;
      let furthest = 0;
      document
        .querySelectorAll<HTMLElement>("[data-entry]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top <= vh * 0.55) {
            const n = Number(el.dataset.entry);
            if (n > furthest) furthest = n;
          }
        });
      let sessionPct = Math.max(
        pagePct,
        furthest > 0 ? (furthest / iss.entries.length) * 100 : 0,
      );
      /* Tail completion (fixes the tail gap): progress derived from the
       * furthest entry can stall below 100% at the end of an issue — the
       * last entries sit above the SOURCE NOTES footer, so once the page
       * runs out of scroll they can no longer advance past the read line,
       * and a near-bottom-only threshold (previously 99.5% of total page
       * scroll) is not reliably reached on the inner scroller. Per spec,
       * reaching the very bottom OR scrolling to ~95% of the page counts
       * as the whole issue read: force 100% with the breakpoint on the
       * final entry. */
      const remainingPx = max - sc.y();
      const atBottom = max > 0 && remainingPx <= 8;
      if (atBottom || pagePct >= 95) {
        sessionPct = 100;
        furthest = iss.entries.length;
      }
      sessionPct = Math.round(sessionPct * 10) / 10;
      if (sessionPct > 0.5) {
        setDisplayPct((prev) => ({
          ...prev,
          [key]: Math.max(prev[key] ?? 0, sessionPct),
        }));
        const mark: Mark = {
          anchor: furthest > 0 ? `d${furthest}` : "top",
          entryNo: furthest,
          percent: sessionPct,
        };
        setSessionMarks((prev) => {
          const cur = prev[key];
          if (!cur || mark.percent > cur.percent) return { ...prev, [key]: mark };
          return prev;
        });
        const baseline = Math.max(
          sentBaselineRef.current[key] ?? 0,
          marksRef.current[key]?.percent ?? 0,
        );
        if (mark.percent > baseline + 0.5) {
          pendingRef.current = { issue: key, ...mark };
          if (Date.now() - lastSaveRef.current > 2500) {
            // Throttle window already elapsed (incl. the first scroll of
            // the session): send right away.
            flushSaveRef.current();
          } else {
            // Trailing flush: ~400ms after scrolling stops, send whatever
            // pending progress remains (flushSave clears it, and a later
            // compute reschedules this timer while scrolling continues).
            if (trailingRef.current != null) {
              window.clearTimeout(trailingRef.current);
            }
            trailingRef.current = window.setTimeout(() => {
              trailingRef.current = null;
              flushSaveRef.current();
            }, 400);
          }
        }
        /* Arrival: the reader reached/passed the stored breakpoint by
         * their own scrolling — the ribbon retires until the next visit. */
        const stored = marksRef.current[key];
        if (
          stored &&
          stored.entryNo > 0 &&
          furthest >= stored.entryNo &&
          !suppressRef.current &&
          !arrivedRef.current
        ) {
          arrivedRef.current = true;
          setRibbonGone((prev) => ({ ...prev, [key]: true }));
        }
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(compute);
      }
    };
    const unlisten = sc.listen(onScroll);
    compute();
    return unlisten;
  }, [issueKey, filter]);

  /* ---------- derived display values ---------- */
  const mark = sessionMarks[issueKey];
  /* Percent for the date picker. Returns null while the stored progress
   * has not arrived yet and this session has produced none either: the
   * value is unknown, not 0. Painting 0% first and then swapping in the
   * real value (100% for every preset issue) lengthened the picker label
   * on cold open and twitched the header layout, so the picker renders
   * an equal-width placeholder for null instead. On query error the
   * store is treated as empty so the placeholder never sticks. */
  const pctOf = (key: string): number | null => {
    /* Just-cleared issue: its stored row is gone, so report a real 0%
     * even while the pre-clear query data is still on screen. */
    if (suspendedRef.current.has(key)) return 0;
    const session = Math.max(
      displayPct[key] ?? 0,
      sessionMarks[key]?.percent ?? 0,
    );
    if (session > 0) return Math.min(100, session);
    if (!progressQuery.data && !progressQuery.isError) return null;
    const row = (progressQuery.data?.progress ?? []).find((r) => r.issue === key);
    return row ? Math.min(100, row.percent) : 0;
  };

  /* ---------- navigation ---------- */
  const scrollToEntryEl = (entryNo: number, instant: boolean, onArrive?: () => void) => {
    const el = document.getElementById(`d${entryNo}`);
    if (!el) return;
    suppressRef.current = true;
    const targetY =
      resolveScroller().y() + el.getBoundingClientRect().top - 84;
    animateScrollTo(targetY, {
      instant,
      onDone: () => {
        suppressRef.current = false;
        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
        setFlashId(`d${entryNo}`);
        window.setTimeout(
          () => setFlashId((f) => (f === `d${entryNo}` ? null : f)),
          1750,
        );
        onArrive?.();
      },
      onCancel: () => {
        suppressRef.current = false;
      },
    });
  };

  const jumpToBreakpoint = (instant = false) => {
    const m = marksRef.current[issueKeyRef.current];
    if (!m || m.entryNo <= 0) return;
    setToast(null);
    const arrive = () => {
      arrivedRef.current = true;
      setRibbonGone((prev) => ({ ...prev, [issueKeyRef.current]: true }));
    };
    if (filter !== "all") {
      setFilter("all");
      window.setTimeout(() => scrollToEntryEl(m.entryNo, instant, arrive), 90);
    } else {
      scrollToEntryEl(m.entryNo, instant, arrive);
    }
  };

  const jumpFromList = (n: number) => {
    const el = document.getElementById(`d${n}`);
    if (!el) return;
    const targetY =
      resolveScroller().y() + el.getBoundingClientRect().top - 84;
    animateScrollTo(targetY, {
      onDone: () => {
        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
        setFlashId(`d${n}`);
        window.setTimeout(
          () => setFlashId((f) => (f === `d${n}` ? null : f)),
          1750,
        );
      },
    });
  };

  const switchIssue = (key: string) => {
    if (key === issueKey) return;
    flushSaveRef.current();
    pendingRef.current = null;
    setFilter("all");
    setToast(null);
    setIssueKey(key);
    resolveScroller().setY(0);
    setIssueEnter(true);
    window.setTimeout(() => setIssueEnter(false), 340);
    const m = marksRef.current[key];
    if (m && m.percent > 0 && m.percent < 100 && !dismissed[key]) {
      window.setTimeout(() => setToast({ issue: key, ...m }), 350);
    }
  };

  const dismissToastForever = () => {
    if (toast) setDismissed((prev) => ({ ...prev, [toast.issue]: true }));
    setToast(null);
  };

  const latestKey = ISSUES_DESC[0]?.issue;

  return (
    <div>
      <SafeAreaTopScrim backgroundColor="var(--bg)" />

      {/* Formal right-edge scroll progress — fills acid green as you scroll. */}
      <div className="progress" aria-hidden="true">
        <i ref={barRef} />
      </div>

      <main className="shell">
        <div
          className={`issue${issueEnter ? " issue-enter" : ""}`}
          data-date={issueKey}
        >
          {/* ================= hero (formal layout) ================= */}
          <section className="hero" aria-labelledby="issue-title">
            <div className="hero-main">
              <div className="issue-line">
                <div className="issue-mark">
                  <span>
                    ISSUE / {dotted(issue.issue)}
                  </span>
                  <time dateTime={issue.issue}>{issue.dayLine}</time>
                </div>
                <div className="mast-controls">
                  <span className="control date-control">
                    <select
                      className="issue-picker"
                      aria-label="選擇早報日期"
                      value={issueKey}
                      onChange={(e) => switchIssue(e.target.value)}
                    >
                      {ISSUES_DESC.map((iss) => {
                        const pct = pctOf(iss.issue);
                        return (
                          <option key={iss.issue} value={iss.issue}>
                            {dotted(iss.issue)}
                            {iss.issue === latestKey ? " · 最新" : ""} ·{" "}
                            {/* "···%" is exactly as wide as "100%" in the
                                picker's monospace font, so the label keeps
                                its final length while progress loads. */}
                            {pct === null ? "···%" : `${pctInt(pct)}%`}
                          </option>
                        );
                      })}
                    </select>
                  </span>
                  <button
                    type="button"
                    className="control theme-toggle"
                    aria-label={`主題：${themeName(themeChoice)}；點選切換到${themeName(nextTheme)}`}
                    onClick={() => setThemeChoice(nextTheme)}
                  >
                    <span className="theme-icon" aria-hidden="true" />
                    <span className="theme-text">{themeChoice.toUpperCase()}</span>
                  </button>
                </div>
              </div>
              <h1 id="issue-title" aria-label="AI 每日早報">
                <span>AI</span>
                <span>!</span>
              </h1>
              <div className="hero-bottom">
                <p>{issue.hero}</p>
                <div className="count" aria-label={`${issue.entries.length} 條資訊`}>
                  {issue.entries.length}
                  <small>
                    CURATED
                    <br />
                    SIGNALS
                  </small>
                </div>
              </div>
            </div>
            <aside className="leads" aria-label="今日頭條">
              <div className="leads-head">
                <span>
                  <i className="beacon" aria-hidden="true" />
                  TOP SIGNALS
                </span>
                <span>03 / {pad2(issue.entries.length)}</span>
              </div>
              {issue.top3.map((t) => {
                const entry = issue.entries.find((e) => e.n === t.n);
                return (
                  <a
                    key={t.rank}
                    className={`lead lead-${t.rank}`}
                    href={`#d${t.n}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (filter !== "all") setFilter("all");
                      window.setTimeout(
                        () => jumpFromList(t.n),
                        filter !== "all" ? 90 : 0,
                      );
                    }}
                  >
                    <span className="lead-no">{pad2(t.rank)}</span>
                    <span>
                      <strong>{entry?.title ?? t.title}</strong>
                      <small>{t.blurb}</small>
                    </span>
                    <i aria-hidden="true" />
                  </a>
                );
              })}
            </aside>
          </section>

          {/* ================= TLDR (formal layout) ================= */}
          <section className="tldr-section">
            <h2>一句話速覽</h2>
            <div className="tldr">
              <ol>
                {issue.tldr.map((t) => (
                  <li key={t.n}>
                    <a
                      href={`#d${t.n}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (filter !== "all") setFilter("all");
                        window.setTimeout(
                          () => jumpFromList(t.n),
                          filter !== "all" ? 90 : 0,
                        );
                      }}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ================= feed (formal layout) ================= */}
          <section>
            <div className="feed-head">
              <h2>
                THE
                <br />
                FEED
              </h2>
              <p>
                按主題篩選。每條以編號、正文與來源三列完整呈現，保留原始摘要、出處與時間資訊。
              </p>
            </div>
            <nav className="filters" aria-label="資訊主題篩選">
              <button
                type="button"
                className={`filter${filter === "all" ? " active" : ""}`}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                全部 <b>{issue.entries.length}</b>
              </button>
              {categories.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`filter${filter === c.label ? " active" : ""}`}
                  aria-pressed={filter === c.label}
                  onClick={() => setFilter(c.label)}
                >
                  {c.label} <b>{c.count}</b>
                </button>
              ))}
            </nav>
            <div className="stories">
              {visibleEntries.map((e) => (
                <article
                  key={e.n}
                  className="story reveal"
                  data-category={e.tagLabel}
                  id={`d${e.n}`}
                  data-entry={e.n}
                  aria-label={`第 ${e.n} 條：${e.title}`}
                >
                  <div
                    className={`story-row${flashId === `d${e.n}` ? " entry-flash" : ""}`}
                  >
                    <span className="index" aria-hidden="true">
                      {pad2(e.n)}
                    </span>
                    <div className="story-main">
                      <span className="heading">
                        <span className="story-meta">
                          <em>{e.tagLabel}</em>
                          {e.n <= 3 && <em className="lead-tag">LEAD</em>}
                        </span>
                        <span className="title">{e.title}</span>
                        {e.en && (
                          <span className="en" lang="en">
                            {e.en}
                          </span>
                        )}
                      </span>
                      <div className="copy">
                        {e.paras.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </div>
                    <div className="source">
                      <span className="src-label">來源</span>
                      <span>
                        {e.sources.length > 0
                          ? e.sources.map((s, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                <a href={s.url} target="_blank" rel="noopener">
                                  {s.label}
                                </a>
                              </span>
                            ))
                          : e.sourceText}
                      </span>
                      {e.note && <span>{e.note}</span>}
                    </div>
                  </div>
                </article>
              ))}
              <p className={`empty${visibleEntries.length === 0 ? " show" : ""}`}>
                當前篩選下沒有資訊。
              </p>
            </div>
          </section>

          {/* ================= source notes (formal layout) ================= */}
          <footer className="source-notes">
            <h2>
              SOURCE
              <br />
              NOTES
            </h2>
            <div>
              <details>
                <summary>檢視本期採集與核驗說明</summary>
                <ul>
                  {issue.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </details>
              <div className="footer-actions">
                <button
                  type="button"
                  className="btn-inv"
                  onClick={() => animateScrollTo(0)}
                >
                  回到頂部 ↑
                </button>
                {!confirmClear ? (
                  <button
                    type="button"
                    className="btn-inv"
                    aria-label="清除本期閱讀進度"
                    onClick={() => {
                      setClearNotes((prev) => {
                        const next = { ...prev };
                        delete next[issueKey];
                        return next;
                      });
                      setConfirmClear(true);
                    }}
                  >
                    清除本期進度
                  </button>
                ) : (
                  <span className="clear-confirm">
                    <span>
                      確定清除本期（{dotted(issueKey)}）的閱讀進度？其他期不受影響，確認後將直接回到頂部並從
                      0 重新開始記錄。
                    </span>
                    <button
                      type="button"
                      className="btn-inv btn-danger"
                      aria-label="確認清除本期閱讀進度"
                      disabled={clearMut.isPending}
                      onClick={() => clearMut.mutate(issueKey)}
                    >
                      {clearMut.isPending ? "清除中…" : "確認清除本期"}
                    </button>
                    <button
                      type="button"
                      className="btn-inv"
                      aria-label="取消清除本期進度"
                      disabled={clearMut.isPending}
                      onClick={() => setConfirmClear(false)}
                    >
                      取消
                    </button>
                  </span>
                )}
              </div>
              {clearNotes[issueKey] && (
                <p className="clear-note" role="status">
                  {clearNotes[issueKey]}
                </p>
              )}
              <p className="end">AI 每日早報 · 由 Muse 生成 · 僅供個人閱讀參考</p>
            </div>
          </footer>
        </div>
      </main>

      {/* ================= resume toast (addition) ================= */}
      {toast && toast.issue === issueKey && (
        <div
          role="status"
          aria-label={`上次讀到 ${toast.issue.slice(5)} 期第 ${toast.entryNo} 條，已讀 ${pctInt(toast.percent)}%`}
          className="resume-toast"
        >
          <button
            type="button"
            aria-label="關閉提示"
            onClick={() => setToast(null)}
            className="rt-close"
          >
            ×
          </button>
          <p className="rt-kicker">斷點恢復 · RESUME</p>
          <p className="rt-title">
            上次讀到 {toast.issue.slice(5)} 期第 {toast.entryNo} 條 ·{" "}
            {pctInt(toast.percent)}%
          </p>
          <p className="rt-sub">點此回到斷點，接著讀。</p>
          <div className="rt-actions">
            <button
              type="button"
              onClick={() => jumpToBreakpoint(false)}
              className="btn-acid"
            >
              回到斷點
            </button>
            <button
              type="button"
              aria-label="直接跳到斷點（無動畫）"
              onClick={() => jumpToBreakpoint(true)}
              className="btn-ghost"
            >
              直接跳
            </button>
            <button
              type="button"
              aria-label="本次不再提示"
              onClick={dismissToastForever}
              className="btn-ghost-dim"
            >
              本次不再提示
            </button>
          </div>
        </div>
      )}

      {/* ================= bookmark ribbon (addition) ================= */}
      {mark && mark.percent > 0 && mark.percent < 100 && !ribbonGone[issueKey] && (
        <div
          className="bookmark-ribbon"
          onMouseEnter={() => setRibbonOpen(true)}
          onMouseLeave={() => setRibbonOpen(false)}
        >
          {ribbonOpen && (
            <div className="ribbon-tip">
              <p className="rt-kicker">書籤 · {issue.label} 期</p>
              <p className="rt-title">
                上次讀到第 {mark.entryNo} 條 · {pctInt(mark.percent)}%
              </p>
              <p className="rt-sub">點選緞帶回到斷點</p>
            </div>
          )}
          <button
            type="button"
            aria-label={`書籤：上次讀到第 ${mark.entryNo} 條，已讀 ${pctInt(mark.percent)}%，點選回到斷點`}
            onClick={() => jumpToBreakpoint(false)}
            onFocus={() => setRibbonOpen(true)}
            onBlur={() => setRibbonOpen(false)}
            className="ribbon-btn"
          >
            {pctInt(mark.percent)}% · 第{pad2(mark.entryNo)}條 ↩
          </button>
        </div>
      )}
    </div>
  );
}
