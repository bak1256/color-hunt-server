const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");
let s = fs.readFileSync(file, "utf8");

function addOnce(marker, anchor, replacement) {
  if (s.includes(marker)) {
    console.log("[skip]", marker);
    return;
  }
  if (!s.includes(anchor)) throw new Error("Could not find anchor for " + marker);
  s = s.replace(anchor, replacement);
  console.log("[ok]", marker);
}

addOnce(
  "paintReadySessionIds",
  `  private readonly hunterRoundStats =
    new Map<string, HunterRoundStats>();`,
  `  private readonly hunterRoundStats =
    new Map<string, HunterRoundStats>();

  private readonly paintReadySessionIds =
    new Set<string>();`
);

addOnce(
  "request_paint_ready_state:",
  `    paint_stroke: (
`,
  `    paint_ready: (
      client: Client,
    ): void => {
      if (this.state.phase !== "paint") return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.role !== "hider" || !player.alive) return;

      this.paintReadySessionIds.add(client.sessionId);
      this.broadcastPaintReadyState();
    },

    request_paint_ready_state: (
      client: Client,
    ): void => {
      this.sendPaintReadyState(client);
    },

    paint_stroke: (
`
);

addOnce(
  "this.sendPaintReadyState(client);",
  `    client.send(
      "phase_changed",
      {
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
      },
    );
`,
  `    client.send(
      "phase_changed",
      {
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
      },
    );

    if (this.state.phase === "paint") {
      this.sendPaintReadyState(client);
    }
`
);

addOnce(
  "V101069_READY_LEAVE_CLEANUP",
  `    this.hunterRoundStats.delete(
      client.sessionId,
    );
`,
  `    this.hunterRoundStats.delete(
      client.sessionId,
    );

    /* V101069_READY_LEAVE_CLEANUP */
    this.paintReadySessionIds.delete(client.sessionId);
    if (this.state.phase === "paint") {
      this.broadcastPaintReadyState();
    }
`
);

addOnce(
  "V101069_READY_PAINT_START",
  `    this.updateRoomMetadata();
    this.broadcastPhaseChanged();
    /* V101068_REDUNDANT_startPaintPhase */`,
  `    /* V101069_READY_PAINT_START */
    this.paintReadySessionIds.clear();

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();
    this.broadcastPaintReadyState();
    /* V101068_REDUNDANT_startPaintPhase */`
);

addOnce(
  "V101069_READY_RESET",
  `    this.state.winner = "";

    /*
`,
  `    this.state.winner = "";
    /* V101069_READY_RESET */
    this.paintReadySessionIds.clear();

    /*
`
);

addOnce(
  "private broadcastPaintReadyState(): void",
  `  private getHunterRoundStats(
`,
  `  private getPaintReadyState(): {
    ready: number;
    total: number;
    readySessionIds: string[];
  } {
    const activeHiderIds = [...this.state.players.entries()]
      .filter(([, player]) => player.role === "hider" && player.alive)
      .map(([sessionId]) => sessionId);

    const activeHiderSet = new Set(activeHiderIds);
    for (const sessionId of this.paintReadySessionIds) {
      if (!activeHiderSet.has(sessionId)) {
        this.paintReadySessionIds.delete(sessionId);
      }
    }

    const readySessionIds = activeHiderIds.filter((sessionId) =>
      this.paintReadySessionIds.has(sessionId),
    );

    return {
      ready: readySessionIds.length,
      total: activeHiderIds.length,
      readySessionIds,
    };
  }

  private sendPaintReadyState(client: Client): void {
    client.send("paint_ready_state", this.getPaintReadyState());
  }

  private broadcastPaintReadyState(): void {
    this.broadcast("paint_ready_state", this.getPaintReadyState());
  }

  private getHunterRoundStats(
`
);

fs.writeFileSync(file, s, "utf8");
console.log("[done] v0.10.10.69b server READY recovery patch applied");
