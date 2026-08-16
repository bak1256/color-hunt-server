const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

let changed = 0;

/*
 * v0.10.10.90a
 *
 * .90 intentionally disabled the old .88/.89 custom
 * reconnected_player_paint path, but a partial cleanup left
 * the tail of that block behind:
 *
 *   if (reconnectPaint.length < 1) ...
 *   this.broadcast(... reconnectPaint ...)
 *
 * Remove only that orphaned tail. The new .90 safe
 * paint_stroke replay path remains untouched.
 */
const orphanPattern =
  /\n\s*if\s*\(\s*reconnectPaint\.length\s*<\s*1\s*\)\s*\{\s*return;\s*\}\s*\n\s*this\.broadcast\(\s*"reconnected_player_paint"\s*,\s*\{\s*(?:sessionId\s*:\s*client\.sessionId\s*,\s*)?strokes\s*:\s*reconnectPaint\s*,?\s*\}\s*,?\s*\);\s*/g;

s = s.replace(
  orphanPattern,
  () => {
    changed += 1;
    return "\n";
  },
);

/*
 * Fallback for slightly different formatting left by prior hotfixes.
 * Remove a small block only when it references reconnectPaint AND
 * reconnected_player_paint together.
 */
if (
  /\breconnectPaint\b/.test(s)
) {
  const lines = s.split(/\r?\n/);

  for (
    let i = 0;
    i < lines.length;
    i += 1
  ) {
    if (
      !lines[i].includes(
        "reconnectPaint.length",
      )
    ) {
      continue;
    }

    let start = i;
    let end = i;

    while (
      start > 0 &&
      i - start < 4 &&
      !lines[start].includes("if")
    ) {
      start -= 1;
    }

    while (
      end < lines.length - 1 &&
      end - i < 24
    ) {
      if (
        lines[end].includes(
          "reconnected_player_paint",
        )
      ) {
        let close = end;

        while (
          close < lines.length - 1 &&
          close - end < 16
        ) {
          if (
            lines[close]
              .trim()
              .endsWith(");")
          ) {
            end = close;
            break;
          }

          close += 1;
        }

        lines.splice(
          start,
          end - start + 1,
        );

        changed += 1;
        i = Math.max(
          -1,
          start - 2,
        );
        break;
      }

      end += 1;
    }
  }

  s = lines.join("\n");
}

/*
 * Verification:
 * There must be no free reconnectPaint reference left.
 * The .90 safe replay uses its own reconnectPaint declaration
 * inside V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY, so allow
 * references only if a declaration exists in the same file.
 */
const refs =
  (s.match(/\breconnectPaint\b/g) ?? [])
    .length;

const declarations =
  (
    s.match(
      /\b(?:const|let)\s+reconnectPaint\b/g,
    ) ?? []
  ).length;

if (
  refs > 0 &&
  declarations === 0
) {
  throw new Error(
    "Orphan reconnectPaint reference still remains",
  );
}

if (
  !s.includes(
    "V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY",
  )
) {
  throw new Error(
    "Verification failed: .90 safe paint_stroke replay is missing",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  `[ok] removed ${changed} orphan reconnectPaint block(s)`,
);
console.log(
  "[ok] preserved v0.10.10.90 safe paint_stroke replay",
);
console.log(
  "[done] v0.10.10.90a server build fix applied",
);
console.log(
  "Next: npm run build",
);
