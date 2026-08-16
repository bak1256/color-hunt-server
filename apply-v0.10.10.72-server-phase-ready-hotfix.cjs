const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");
let s = fs.readFileSync(file, "utf8");

function replaceOnce(before, after, label) {
  if (s.includes(after)) {
    console.log("[skip]", label);
    return;
  }
  if (!s.includes(before)) {
    throw new Error("Could not find " + label);
  }
  s = s.replace(before, after);
  console.log("[ok]", label);
}

/*
 * v0.10.10.72 CRITICAL:
 * lobby_snapshot becomes the universal authoritative recovery snapshot.
 * Clients can recover Paint -> Hunt even when phase_changed / Schema
 * callbacks are delayed or missed on mobile browsers.
 */
if (!s.includes("V101072_PHASE_RECOVERY_SNAPSHOT")) {
  const needle = `        huntDurationMs: this.huntDurationMs,
        players:`;

  const replacement = `        huntDurationMs: this.huntDurationMs,
        /* V101072_PHASE_RECOVERY_SNAPSHOT */
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
        serverNow:
          Date.now(),
        paintReadyState:
          this.getPaintReadyState(),
        players:`;

  replaceOnce(
    needle,
    replacement,
    "phase/READY recovery snapshot",
  );
}

/*
 * During Paint, an explicit READY-state request also sends the current
 * phase snapshot first. This avoids the UI being stuck at Paint 0 when
 * the READY request is the first packet that successfully gets through.
 */
if (!s.includes("V101072_READY_REQUEST_PHASE_RECOVERY")) {
  const oldBlock = `    request_paint_ready_state: (
      client: Client,
    ): void => {
      this.sendPaintReadyState(client);
    },`;

  const newBlock = `    request_paint_ready_state: (
      client: Client,
    ): void => {
      /* V101072_READY_REQUEST_PHASE_RECOVERY */
      this.sendLobbySnapshot(client);
      this.sendPaintReadyState(client);
    },`;

  replaceOnce(
    oldBlock,
    newBlock,
    "READY request phase recovery",
  );
}

/*
 * READY state is cheap and important. Pulse it during Paint so a missed
 * broadcast can never leave Hunters at 0/N indefinitely.
 */
if (!s.includes("private lastPaintReadyPulseAt = 0;")) {
  const marker = `  private readonly paintReadySessionIds =
    new Set<string>();`;

  replaceOnce(
    marker,
    marker + `

  private lastPaintReadyPulseAt = 0;`,
    "READY pulse field",
  );
}

if (!s.includes("V101072_READY_PERIODIC_PULSE")) {
  const oldSim = `    this.setSimulationInterval(
      () => {
        this.checkPhaseDeadline();
      },
      50,
    );`;

  const newSim = `    this.setSimulationInterval(
      () => {
        this.checkPhaseDeadline();

        /* V101072_READY_PERIODIC_PULSE */
        if (
          this.state.phase === "paint" &&
          Date.now() -
            this.lastPaintReadyPulseAt >=
            500
        ) {
          this.lastPaintReadyPulseAt =
            Date.now();
          this.broadcastPaintReadyState();
        }
      },
      50,
    );`;

  replaceOnce(
    oldSim,
    newSim,
    "READY periodic pulse",
  );
}

/*
 * Paint deadline safety: stale timers are allowed to call startHuntPhase,
 * but nobody is allowed to reset/disconnect the room just because a client
 * missed the phase message. Server remains authoritative.
 *
 * Also send two recovery snapshots shortly after Hunt starts.
 */
if (!s.includes("V101072_HUNT_RECOVERY_PULSE")) {
  const needle = `    this.updateRoomMetadata();
    this.broadcastPhaseChanged();
    /* V101068_REDUNDANT_startHuntPhase */`;

  const replacement = `    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    /* V101072_HUNT_RECOVERY_PULSE */
    [120, 450].forEach(
      (delay) => {
        this.clock.setTimeout(
          () => {
            if (
              this.state.phase === "hunt"
            ) {
              this.clients.forEach(
                (connectedClient) => {
                  this.sendLobbySnapshot(
                    connectedClient,
                  );
                },
              );
            }
          },
          delay,
        );
      },
    );

    /* V101068_REDUNDANT_startHuntPhase */`;

  replaceOnce(
    needle,
    replacement,
    "Hunt recovery snapshot pulses",
  );
}

/* Final structural checks. */
for (const [needle, label] of [
  ["V101072_PHASE_RECOVERY_SNAPSHOT", "phase recovery snapshot"],
  ["V101072_READY_REQUEST_PHASE_RECOVERY", "READY request recovery"],
  ["V101072_READY_PERIODIC_PULSE", "READY pulse"],
  ["V101072_HUNT_RECOVERY_PULSE", "Hunt recovery pulse"],
  ["private getPaintReadyState()", "READY state method"],
  ["private sendLobbySnapshot(", "lobby snapshot method"],
]) {
  if (!s.includes(needle)) {
    throw new Error("Verification failed: " + label);
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("");
console.log("[done] v0.10.10.72 CRITICAL phase/READY hotfix applied");
console.log("Next: npm run build");
