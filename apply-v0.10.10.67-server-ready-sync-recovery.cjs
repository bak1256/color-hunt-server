const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function findMethodRange(name) {
  // Supports both "private foo(" and lifecycle methods such as "onLeave(".
  const patterns = [
    `private ${name}`,
    `  ${name}(`,
    `  async ${name}(`,
  ];

  let start = -1;
  for (const pattern of patterns) {
    start = s.indexOf(pattern);
    if (start >= 0) break;
  }

  if (start < 0) {
    return null;
  }

  const brace = s.indexOf("{", start);
  if (brace < 0) return null;

  let depth = 0;
  for (let i = brace; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { start, end: i + 1 };
      }
    }
  }

  return null;
}

/*
 * v0.10.10.67 first patch already wrote the READY changes before it stopped.
 * This recovery patch only finishes the remaining work and is safe to rerun.
 */

// Remove a disconnected Hider from READY count.
if (!s.includes("this.paintReadySessionIds.delete(client.sessionId);")) {
  const r = findMethodRange("onLeave");

  if (!r) {
    console.log("[warn] onLeave() not found; disconnect READY cleanup skipped.");
  } else {
    let m = s.slice(r.start, r.end);
    const del = "this.state.players.delete(client.sessionId);";
    const at = m.indexOf(del);

    if (at >= 0) {
      const end = at + del.length;
      m =
        m.slice(0, end) +
        `
    this.paintReadySessionIds.delete(
      client.sessionId,
    );

    if (this.state.phase === "paint") {
      this.broadcastPaintReadyState();
    }` +
        m.slice(end);

      s = s.slice(0, r.start) + m + s.slice(r.end);
      console.log("[ok] READY count follows disconnects");
    } else {
      console.log("[warn] player delete not found in onLeave(); cleanup skipped.");
    }
  }
} else {
  console.log("[skip] disconnect READY cleanup already exists");
}

// Add server timestamp to phase_changed if the current broadcaster has the
// normal phaseEndsAt payload. Older clients safely ignore this extra field.
{
  const r = findMethodRange("broadcastPhaseChanged");

  if (!r) {
    console.log("[warn] broadcastPhaseChanged() not found; serverNow skipped.");
  } else {
    let m = s.slice(r.start, r.end);

    if (m.includes("serverNow:")) {
      console.log("[skip] phase packets already include serverNow");
    } else {
      const candidates = [
        "phaseEndsAt: this.state.phaseEndsAt,",
        "phaseEndsAt:\\n          this.state.phaseEndsAt,",
        "phaseEndsAt:\\n        this.state.phaseEndsAt,",
      ];

      let replaced = false;

      for (const literal of candidates) {
        const needle = literal.replaceAll("\\n", "\n");
        if (m.includes(needle)) {
          m = m.replace(
            needle,
            needle + "\n        serverNow: Date.now(),",
          );
          replaced = true;
          break;
        }
      }

      if (replaced) {
        s = s.slice(0, r.start) + m + s.slice(r.end);
        console.log("[ok] phase packets include serverNow");
      } else {
        console.log("[warn] phaseEndsAt payload shape differs; serverNow skipped.");
      }
    }
  }
}

fs.writeFileSync(path, s, "utf8");

console.log("");
console.log("Done. v0.10.10.67 recovery patch completed.");
console.log("Next: npm run build");
