const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

/*
 * Repair every class-field declaration of huntDurationMs.
 * Handles forms such as:
 *
 * private readonly huntDurationMs =
 *   45_000;
 *
 * private huntDurationMs = 80_000;
 */
const declarationPattern =
  /(?:private\s+)?(?:readonly\s+)?huntDurationMs\s*=\s*[\d_]+\s*;/g;

const matches =
  [...s.matchAll(declarationPattern)];

if (matches.length === 0) {
  throw new Error(
    "Could not find huntDurationMs declaration in src/rooms/MyRoom.ts"
  );
}

console.log(
  `[info] found ${matches.length} huntDurationMs declaration(s)`
);

/*
 * Replace the first declaration with the one mutable authoritative field,
 * and remove any accidental duplicate declarations.
 */
let first = true;

s = s.replace(
  declarationPattern,
  () => {
    if (first) {
      first = false;
      return "private huntDurationMs = 80_000;";
    }

    return "";
  },
);

/*
 * Safety checks:
 * - exactly one field declaration
 * - it must NOT be readonly
 */
const finalMatches =
  [...s.matchAll(
    /(?:private\s+)?(?:readonly\s+)?huntDurationMs\s*=\s*[\d_]+\s*;/g
  )];

if (finalMatches.length !== 1) {
  throw new Error(
    `Repair failed: expected 1 declaration, found ${finalMatches.length}`
  );
}

if (
  /readonly\s+huntDurationMs/.test(s)
) {
  throw new Error(
    "Repair failed: readonly huntDurationMs still exists"
  );
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log(
  "[ok] huntDurationMs is now mutable and defaults to 80_000"
);
console.log(
  "[ok] duplicate huntDurationMs declarations removed"
);
console.log("");
console.log(
  "Next: npm run build"
);
