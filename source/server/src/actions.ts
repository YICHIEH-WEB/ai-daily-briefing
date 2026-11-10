// Actions for the AI 每日早報 reading-progress store.
//
// Reading progress is stored one row per issue in `reading_progress`.
// `saveProgress` is a max-only upsert: the stored row is overwritten only
// when the incoming percentage is strictly greater than the stored one, so
// the row always holds the furthest position reached across every session
// (comparing once against the stored max is equivalent to comparing against
// all past sessions, because the stored value is itself the running max).
//
// `seedPresetProgress` is the one-time formal-launch preset requested by
// the user: the 19 existing issues (2026-10-07 .. 2026-10-25) start at
// 100%. It inserts only where no row exists yet, so it can never overwrite
// real reading progress, and it presets nothing for future issues — those
// start at 0 simply by having no row.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const progressRow = z.object({
  issue: z.string(),
  anchor: z.string(),
  entryNo: z.number(),
  percent: z.number(),
  updatedAt: z.string(),
});

type ProgressRowOut = z.infer<typeof progressRow>;

function toOut(row: typeof schema.readingProgress.$inferSelect): ProgressRowOut {
  return {
    issue: row.issue,
    anchor: row.anchor,
    entryNo: row.entryNo,
    percent: row.percent,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const seedResponse = z.object({ seeded: z.number() });

const resetResponse = z.object({ cleared: z.number() });

export const Actions = {
  getProgress: defineAction({
    request: z.object({}),
    response: z.object({ progress: z.array(progressRow) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.readingProgress);
      return { progress: rows.map(toOut) };
    },
  }),

  saveProgress: defineAction({
    request: z.object({
      issue: z.string().min(1),
      anchor: z.string().min(1),
      entryNo: z.number().int().min(0),
      percent: z.number().min(0).max(100),
    }),
    response: z.object({
      saved: z.boolean(),
      progress: progressRow.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.readingProgress)
        .where(eq(schema.readingProgress.issue, args.issue))
        .limit(1);
      const current = existing[0];

      // Max-only: a smaller-or-equal reading position never overwrites the
      // stored furthest breakpoint.
      if (current && args.percent <= current.percent) {
        return { saved: false, progress: toOut(current) };
      }

      const now = new Date();
      if (current) {
        await db
          .update(schema.readingProgress)
          .set({
            anchor: args.anchor,
            entryNo: args.entryNo,
            percent: args.percent,
            updatedAt: now,
          })
          .where(eq(schema.readingProgress.issue, args.issue));
      } else {
        await db.insert(schema.readingProgress).values({
          issue: args.issue,
          anchor: args.anchor,
          entryNo: args.entryNo,
          percent: args.percent,
          updatedAt: now,
        });
      }
      ctx.invalidateQueries();
      return {
        saved: true,
        progress: {
          issue: args.issue,
          anchor: args.anchor,
          entryNo: args.entryNo,
          percent: args.percent,
          updatedAt: now.toISOString(),
        },
      };
    },
  }),

  // Per-issue reset: strictly delete ONLY the current issue's row.
  // No other issue is read, written, inserted, or preset by this action —
  // past and future issues keep their stored rows exactly as they were.
  resetIssueProgress: defineAction({
    request: z.object({
      currentIssue: z.string().min(1),
    }),
    response: resetResponse,
    async handler(ctx, args): Promise<z.infer<typeof resetResponse>> {
      const db = ctx.db<typeof schema>();

      const currentRows = await db
        .select({ issue: schema.readingProgress.issue })
        .from(schema.readingProgress)
        .where(eq(schema.readingProgress.issue, args.currentIssue));
      if (currentRows.length > 0) {
        await db
          .delete(schema.readingProgress)
          .where(eq(schema.readingProgress.issue, args.currentIssue));
        ctx.invalidateQueries();
      }

      return { cleared: currentRows.length };
    },
  }),

  seedPresetProgress: defineAction({
    request: z.object({
      issues: z.array(
        z.object({
          issue: z.string().min(1),
          anchor: z.string().min(1),
          entryNo: z.number().int().min(0),
        }),
      ),
    }),
    response: seedResponse,
    async handler(ctx, args): Promise<z.infer<typeof seedResponse>> {
      const db = ctx.db<typeof schema>();
      let seeded = 0;
      for (const item of args.issues) {
        const existing = await db
          .select({ issue: schema.readingProgress.issue })
          .from(schema.readingProgress)
          .where(eq(schema.readingProgress.issue, item.issue))
          .limit(1);
        if (existing[0]) continue;
        await db.insert(schema.readingProgress).values({
          issue: item.issue,
          anchor: item.anchor,
          entryNo: item.entryNo,
          percent: 100,
          updatedAt: new Date(),
        });
        seeded += 1;
      }
      if (seeded > 0) ctx.invalidateQueries();
      return { seeded };
    },
  }),
} satisfies ActionsModule;
