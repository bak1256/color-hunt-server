const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");
let s = fs.readFileSync(file, "utf8");

function replaceBetween(startNeedle, endNeedle, replacement, label) {
  const start = s.indexOf(startNeedle);
  if (start < 0) throw new Error(`Could not find start for ${label}`);

  const end = s.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) throw new Error(`Could not find end for ${label}`);

  s =
    s.slice(0, start) +
    replacement +
    s.slice(end);

  console.log(`[ok] ${label}`);
}

/*
 * 1) Replace paint_ready handler completely.
 */
if (!s.includes("V101069E_READY_HANDLER")) {
  replaceBetween(
    "    paint_ready: (",
    "    request_paint_ready_state:",
    `    /* V101069E_READY_HANDLER */
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

`,
    "READY true/false handler",
  );
} else {
  console.log("[skip] READY true/false handler");
}

/*
 * 2) Insert Hunter early-start handler only once.
 */
if (!s.includes("V101069E_EARLY_START")) {
  const marker = "    request_paint_ready_state: (";
  const at = s.indexOf(marker);

  if (at < 0) {
    throw new Error("Could not find request_paint_ready_state");
  }

  const add = `    /* V101069E_EARLY_START */
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

  s =
    s.slice(0, at) +
    add +
    s.slice(at);

  console.log("[ok] Hunter early-start READY handler");
} else {
  console.log("[skip] Hunter early-start READY handler");
}

/*
 * 3) Replace getPaintReadyState() completely.
 * Avoids all formatting-dependent payload matching.
 */
{
  const startNeedle =
    "  private getPaintReadyState():";
  const endNeedle =
    "  private sendPaintReadyState(";

  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle, start);

  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate getPaintReadyState() block",
    );
  }

  const method = `  private getPaintReadyState(): {
    ready: number;
    total: number;
    readyCount: number;
    hiderCount: number;
    allHidersReady: boolean;
    readySessionIds: string[];
  } {
    const activeHiderIds =
      [...this.state.players.entries()]
        .filter(
          ([, player]) =>
            player.role === "hider" &&
            player.alive,
        )
        .map(
          ([sessionId]) =>
            sessionId,
        );

    const activeHiderSet =
      new Set(activeHiderIds);

    for (
      const sessionId of
      [...this.paintReadySessionIds]
    ) {
      if (!activeHiderSet.has(sessionId)) {
        this.paintReadySessionIds.delete(
          sessionId,
        );
      }
    }

    const readySessionIds =
      activeHiderIds.filter(
        (sessionId) =>
          this.paintReadySessionIds.has(
            sessionId,
          ),
      );

    const ready =
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
    };
  }

`;

  s =
    s.slice(0, start) +
    method +
    s.slice(end);

  console.log("[ok] READY payload compatibility");
}

/*
 * 4) Ensure reconnect phase_changed includes serverNow.
 */
{
  const start = s.indexOf("  onReconnect(");
  const end = s.indexOf("\n  onLeave(", start);

  if (start < 0 || end < 0) {
    throw new Error("Could not find onReconnect()");
  }

  let m = s.slice(start, end);

  if (!m.includes("serverNow: Date.now()")) {
    const needle =
      `        phaseEndsAt:
          this.state.phaseEndsAt,`;

    if (!m.includes(needle)) {
      throw new Error(
        "Could not locate phaseEndsAt in onReconnect()",
      );
    }

    m = m.replace(
      needle,
      needle +
        `
        serverNow: Date.now(),`,
    );

    console.log("[ok] reconnect server clock sync");
  } else {
    console.log("[skip] reconnect server clock sync");
  }

  if (!m.includes("this.sendPaintReadyState(")) {
    const close = m.lastIndexOf("\n  }");

    if (close < 0) {
      throw new Error(
        "Could not patch reconnect READY resend",
      );
    }

    m =
      m.slice(0, close) +
      `

    if (this.state.phase === "paint") {
      this.sendPaintReadyState(client);
    }` +
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
 * 5) Structural verification only.
 */
const checks = [
  ["V101069E_READY_HANDLER", "READY handler"],
  ["V101069E_EARLY_START", "early-start handler"],
  ["readyCount: number;", "readyCount type"],
  ["hiderCount: number;", "hiderCount type"],
  ["allHidersReady: boolean;", "all-ready type"],
  ["readyCount: ready,", "readyCount payload"],
  ["hiderCount: total,", "hiderCount payload"],
  ['client.send(\n      "paint_ready_state"', "READY sender"],
  ['this.broadcast(\n      "paint_ready_state"', "READY broadcaster"],
];

for (const [needle, label] of checks) {
  if (!s.includes(needle)) {
    throw new Error(
      `Verification failed: ${label}`,
    );
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("");
console.log("[done] v0.10.10.69e READY compatibility applied");
console.log("Next: npm run build");
