const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) {
    console.log(`[skip] ${label}`);
    return;
  }
  if (!s.includes(oldText)) {
    throw new Error(`Could not find source for: ${label}`);
  }
  s = s.replace(oldText, newText);
  console.log(`[ok] ${label}`);
}

// Explicit phase message avoids relying only on Colyseus root-schema onChange.
replaceOnce(
`  private sendLobbySnapshot(
    client: Client,
  ): void {`,
`  private broadcastPhaseChanged(): void {
    this.broadcast(
      "phase_changed",
      {
        phase: this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
      },
    );
  }

  private sendLobbySnapshot(
    client: Client,
  ): void {`,
"phase_changed broadcaster"
);

// Countdown
replaceOnce(
`    this.updateRoomMetadata();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "countdown"`,
`    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "countdown"`,
"countdown explicit phase broadcast"
);

// Paint
replaceOnce(
`    this.state.phaseEndsAt =
      Date.now() +
      this.paintDurationMs;

    this.updateRoomMetadata();

    this.clock.setTimeout(`,
`    this.state.phaseEndsAt =
      Date.now() +
      this.paintDurationMs;

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    this.clock.setTimeout(`,
"paint explicit phase broadcast"
);

// Hunt
replaceOnce(
`    this.state.phaseEndsAt =
      Date.now() +
      this.huntDurationMs;

    this.updateRoomMetadata();
    this.clock.setTimeout(`,
`    this.state.phaseEndsAt =
      Date.now() +
      this.huntDurationMs;

    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    this.clock.setTimeout(`,
"hunt explicit phase broadcast"
);

// Finished
replaceOnce(
`    this.updateRoomMetadata();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "finished"`,
`    this.updateRoomMetadata();
    this.broadcastPhaseChanged();

    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "finished"`,
"finished explicit phase broadcast"
);

// Lobby reset - add after metadata update in resetToLobby if not already.
const resetStart = s.indexOf("  private resetToLobby(): void {");
if (resetStart < 0) throw new Error("Could not find resetToLobby()");
const resetEnd = s.indexOf("\n  private ", resetStart + 30);
let resetBlock = s.slice(resetStart, resetEnd > 0 ? resetEnd : s.length);
if (!resetBlock.includes("this.broadcastPhaseChanged();")) {
  const target = "    this.updateRoomMetadata();";
  const idx = resetBlock.lastIndexOf(target);
  if (idx < 0) throw new Error("Could not find resetToLobby metadata update");
  resetBlock =
    resetBlock.slice(0, idx) +
    target + "\n    this.broadcastPhaseChanged();" +
    resetBlock.slice(idx + target.length);
  s =
    s.slice(0, resetStart) +
    resetBlock +
    s.slice(resetEnd > 0 ? resetEnd : s.length);
  console.log("[ok] lobby reset explicit phase broadcast");
} else {
  console.log("[skip] lobby reset explicit phase broadcast");
}

// map12 had already been removed from the client. Keep server aligned.
s = s.replace(
  `/^map(?:[1-9]|1[0-2])$/.test(`,
  `/^map(?:[1-9]|1[01])$/.test(`
);
s = s.replace(
  `Math.random() * 12`,
  `Math.random() * 11`
);

fs.writeFileSync(path, s, "utf8");

console.log("[ok] map random/validation aligned to map1-map11");
console.log("Done. Run npm run build.");
