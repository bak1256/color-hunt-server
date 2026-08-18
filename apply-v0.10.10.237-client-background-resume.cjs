const fs = require("fs");

const path = "src/network/MultiplayerClient.ts";
if (!fs.existsSync(path)) {
  throw new Error(`Missing ${path}`);
}

let s = fs.readFileSync(path, "utf8");
const before = s;

/*
 * COLOR HUNT v0.10.10.237 client-side background/resume policy.
 *
 * This script deliberately patches only timeout constants that can be
 * identified by their reconnect/background names. It does NOT rewrite
 * reconnect ownership logic blindly.
 */
const replacements = [
  // 30-35 second reconnect/handoff windows -> 5 minutes.
  [
    /(reconnect(?:Grace|Timeout|Window|Deadline|Fallback|MaxWait)[A-Za-z0-9_]*)\s*=\s*(?:30_000|35_000|30000|35000)/gi,
    "$1 = 300_000",
  ],
  [
    /(background(?:Grace|Timeout|Window|Reconnect)[A-Za-z0-9_]*)\s*=\s*(?:30_000|35_000|30000|35000)/gi,
    "$1 = 300_000",
  ],
  [
    /(visibility(?:Grace|Timeout|Window)[A-Za-z0-9_]*)\s*=\s*(?:30_000|35_000|30000|35000)/gi,
    "$1 = 300_000",
  ],
];

for (const [pattern, replacement] of replacements) {
  s = s.replace(pattern, replacement);
}

/*
 * Add an explicit browser lifecycle note. The existing reconnect code remains
 * authoritative; visibilitychange/blur must never proactively disconnect.
 */
if (!s.includes("V1010237_BACKGROUND_RESUME_POLICY")) {
  const classMatch = s.match(/export\s+class\s+MultiplayerClient[^{]*\{/);
  if (classMatch) {
    const at = classMatch.index + classMatch[0].length;
    s =
      s.slice(0, at) +
      `
  /*
   * V1010237_BACKGROUND_RESUME_POLICY
   * Hidden/minimized is NOT a leave signal.
   * Never close/recreate the room merely because document.hidden, blur,
   * pagehide, or visibilitychange fired. Transport close/error remains the
   * authority for reconnect; the server now preserves the same session for
   * five minutes.
   */
  private readonly backgroundReconnectGraceMs = 5 * 60_000;
` +
      s.slice(at);
  }
}

/*
 * If the file has an explicit visibilitychange branch that calls disconnect/
 * leave/close directly, stop and ask for inspection instead of risking a
 * destructive regex rewrite.
 */
const suspicious = /visibilitychange[\s\S]{0,500}\.(?:leave|disconnect|close)\s*\(/i.test(s);
if (suspicious) {
  throw new Error(
    "Found visibilitychange -> leave/disconnect/close in MultiplayerClient.ts. " +
    "Do not auto-rewrite this branch. Send the current file so it can be patched safely."
  );
}

if (s === before) {
  console.log("[info] No known short reconnect constants found; policy marker added only if class was detected.");
} else {
  fs.writeFileSync(path, s, "utf8");
  console.log("[ok] v0.10.10.237 client background/resume policy applied");
}
