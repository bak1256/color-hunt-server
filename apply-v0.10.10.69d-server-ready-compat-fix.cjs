const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");
let s = fs.readFileSync(file, "utf8");

function mustReplace(regex, replacement, label) {
  if (!regex.test(s)) {
    throw new Error(`Could not patch ${label}`);
  }
  s = s.replace(regex, replacement);
  console.log(`[ok] ${label}`);
}

/*
 * 1) Hider READY true / false.
 * v0.10.10.69b ignored message.ready and always added the Hider.
 */
if (!s.includes("V101069D_READY_HANDLER")) {
  const start = s.indexOf("    paint_ready: (");
  const end = s.indexOf("    request_paint_ready_state:", start);

  if (start < 0 || end < 0) {
    throw new Error("Could not find paint_ready handler");
  }

  const next = `    /* V101069D_READY_HANDLER */
    paint_ready: (
      client: Client,
      message: {
        ready?: boolean;
      },
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !player ||
        player.role !== "hider" ||
        !player.alive
      ) {
        return;
      }

      if (message?.ready === false) {
        this.paintReadySessionIds.delete(
          client.sessionId,
        );
      } else {
        this.paintReadySessionIds.add(
          client.sessionId,
        );
      }

      this.broadcastPaintReadyState();
    },

`;

  s = s.slice(0, start) + next + s.slice(end);
  console.log("[ok] READY true/false handler");
} else {
  console.log("[skip] READY true/false handler");
}

/*
 * 2) Hunter may start Hunt early only when every active Hider is READY.
 */
if (!s.includes("V101069D_EARLY_START")) {
  const marker = "    request_paint_ready_state: (";
  const at = s.indexOf(marker);

  if (at < 0) {
    throw new Error("Could not find request_paint_ready_state");
  }

  const add = `    /* V101069D_EARLY_START */
    early_start_hunt: (
      client: Client,
    ): void => {
      if (this.state.phase !== "paint") {
        return;
      }

      const requester =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !requester ||
        requester.role !== "hunter" ||
        !requester.alive
      ) {
        return;
      }

      const readyState =
        this.getPaintReadyState();

      if (
        readyState.total < 1 ||
        readyState.ready !==
          readyState.total
      ) {
        return;
      }

      this.state.phaseEndsAt =
        Date.now();

      this.startHuntPhase();
    },

`;

  s = s.slice(0, at) + add + s.slice(at);
  console.log("[ok] Hunter early-start READY handler");
} else {
  console.log("[skip] Hunter early-start READY handler");
}

/*
 * 3) READY payload compatibility.
 * New clients can use ready/total and old clients can keep using
 * readyCount/hiderCount/allHidersReady.
 *
 * Do NOT parse the method by braces here: getPaintReadyState() has an
 * object-shaped return type, so a naive first-"{" parser sees the type
 * declaration instead of the method body. That was the .69c failure.
 */
if (!s.includes("readyCount: number;")) {
  mustReplace(
    /private getPaintReadyState\(\): \{\s*ready: number;\s*total: number;\s*readySessionIds: string\[\];\s*\} \{/m,
    `private getPaintReadyState(): {
    ready: number;
    total: number;
    readyCount: number;
    hiderCount: number;
    allHidersReady: boolean;
    readySessionIds: string[];
  } {`,
    "READY return type compatibility",
  );
} else {
  console.log("[skip] READY return type compatibility");
}

if (!s.includes("allHidersReady:")) {
  mustReplace(
    /return \{\s*ready:\s*readySessionIds\.length,\s*total:\s*activeHiderIds\.length,\s*readySessionIds,\s*\};/m,
    `const ready =
      readySessionIds.length;

    const total =
      activeHiderIds.length;

    return {
      ready,
      total,
      readyCount: ready,
      hiderCount: total,
      allHidersReady:
        total > 0 &&
        ready === total,
      readySessionIds,
    };`,
    "READY payload compatibility fields",
  );
} else {
  console.log("[skip] READY payload compatibility fields");
}

/*
 * 4) Reconnect phase snapshot must contain serverNow.
 */
{
  const start = s.indexOf("  onReconnect(");
  const end = s.indexOf("\n  onLeave(", start);

  if (start < 0 || end < 0) {
    throw new Error("Could not find onReconnect()");
  }

  let m = s.slice(start, end);

  if (!m.includes("serverNow: Date.now()")) {
    const phaseEndsAtRegex =
      /(phaseEndsAt:\s*\n\s*this\.state\.phaseEndsAt,)/m;

    if (!phaseEndsAtRegex.test(m)) {
      throw new Error(
        "Could not add serverNow in onReconnect()",
      );
    }

    m = m.replace(
      phaseEndsAtRegex,
      `$1
        serverNow: Date.now(),`,
    );

    console.log("[ok] reconnect server clock sync");
  } else {
    console.log("[skip] reconnect server clock sync");
  }

  /*
   * .69b may already have sendPaintReadyState(client). Do not duplicate it.
   */
  if (!m.includes("this.sendPaintReadyState(client);")) {
    const close = m.lastIndexOf("\n  }");

    if (close < 0) {
      throw new Error(
        "Could not patch onReconnect READY resend",
      );
    }

    const add = `

    if (this.state.phase === "paint") {
      this.sendPaintReadyState(client);
    }`;

    m =
      m.slice(0, close) +
      add +
      m.slice(close);

    console.log("[ok] reconnect READY resend");
  } else {
    console.log("[skip] reconnect READY resend");
  }

  s =
    s.slice(0, start) +
    m +
    s.slice(end);
}

/*
 * 5) Final sanity checks before writing.
 */
const required = [
  "V101069D_READY_HANDLER",
  "V101069D_EARLY_START",
  "readyCount: number;",
  "hiderCount: number;",
  "allHidersReady: boolean;",
  "readyCount: ready",
  "hiderCount: total",
  "allHidersReady:",
  "serverNow: Date.now()",
  'this.broadcast("paint_ready_state", this.getPaintReadyState())',
];

for (const needle of required) {
  if (!s.includes(needle)) {
    throw new Error(
      `Sanity check failed: ${needle}`,
    );
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("");
console.log("[done] v0.10.10.69d READY compatibility patch applied");
console.log("Next: npm run build");
