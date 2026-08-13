const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function ensureContains(pattern, label) {
  if (!pattern.test(s)) {
    throw new Error(`Could not find current server source for: ${label}`);
  }
}

function replaceRegex(pattern, replacement, label) {
  if (typeof replacement === "string" && s.includes(replacement)) {
    console.log(`[skip] ${label} already applied`);
    return;
  }

  if (!pattern.test(s)) {
    console.log(`[skip] ${label} source already changed or not needed`);
    return;
  }

  s = s.replace(pattern, replacement);
  console.log(`[ok] ${label}`);
}

// 1. Add broadcaster immediately before sendLobbySnapshot().
if (!s.includes("private broadcastPhaseChanged(): void")) {
  const marker = `  private sendLobbySnapshot(
    client: Client,
  ): void {`;

  if (!s.includes(marker)) {
    throw new Error("Could not find sendLobbySnapshot()");
  }

  const helper = `  private broadcastPhaseChanged(): void {
    this.broadcast(
      "phase_changed",
      {
        phase: this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
      },
    );
  }

`;

  s = s.replace(marker, helper + marker);
  console.log("[ok] phase_changed broadcaster");
} else {
  console.log("[skip] phase_changed broadcaster already exists");
}

// Helper that inserts a broadcast immediately after the FIRST
// updateRoomMetadata() inside a named phase method.
function insertBroadcastInMethod(methodName) {
  const startNeedle = `  private ${methodName}(`;
  const start = s.indexOf(startNeedle);

  if (start < 0) {
    throw new Error(`Could not find ${methodName}()`);
  }

  const nextPrivate = s.indexOf("\n  private ", start + startNeedle.length);
  const end = nextPrivate >= 0 ? nextPrivate : s.length;

  let block = s.slice(start, end);

  if (block.includes("this.broadcastPhaseChanged();")) {
    console.log(`[skip] ${methodName} phase broadcast already exists`);
    return;
  }

  const metadata = "    this.updateRoomMetadata();";
  const metadataIndex = block.indexOf(metadata);

  if (metadataIndex < 0) {
    throw new Error(`Could not find updateRoomMetadata() inside ${methodName}()`);
  }

  const insertion =
    metadata +
    "\n    this.broadcastPhaseChanged();";

  block =
    block.slice(0, metadataIndex) +
    insertion +
    block.slice(metadataIndex + metadata.length);

  s =
    s.slice(0, start) +
    block +
    s.slice(end);

  console.log(`[ok] ${methodName} explicit phase broadcast`);
}

// Current server methods verified from main branch.
insertBroadcastInMethod("startCountdownPhase");
insertBroadcastInMethod("startPaintPhase");
insertBroadcastInMethod("startHuntPhase");
insertBroadcastInMethod("finishGame");
insertBroadcastInMethod("resetToLobby");

// 2. Align random maps and validation with map1-map11.
const oldValidation = `/^map(?:[1-9]|1[0-2])$/.test(`;
const newValidation = `/^map(?:[1-9]|1[01])$/.test(`;

if (s.includes(oldValidation)) {
  s = s.replace(oldValidation, newValidation);
  console.log("[ok] map validation changed to map1-map11");
} else if (s.includes(newValidation)) {
  console.log("[skip] map validation already map1-map11");
} else {
  console.log("[warn] map validation pattern not found; left unchanged");
}

if (s.includes("Math.random() * 12")) {
  s = s.replace(
    "Math.random() * 12",
    "Math.random() * 11"
  );
  console.log("[ok] random map changed to 11 maps");
} else if (s.includes("Math.random() * 11")) {
  console.log("[skip] random map already uses 11 maps");
} else {
  console.log("[warn] random-map expression not found; left unchanged");
}

// 3. Sanity checks BEFORE writing.
const required = [
  ["private broadcastPhaseChanged(): void", "phase broadcaster"],
  ['"phase_changed"', "phase_changed message"],
  ["private startCountdownPhase()", "countdown method"],
  ["private startPaintPhase()", "paint method"],
  ["private startHuntPhase()", "hunt method"],
  ["private resetToLobby()", "lobby reset method"],
];

for (const [needle, label] of required) {
  if (!s.includes(needle)) {
    throw new Error(`Sanity check failed: ${label}`);
  }
}

// Ensure each transition method contains the explicit broadcast.
for (const methodName of [
  "startCountdownPhase",
  "startPaintPhase",
  "startHuntPhase",
  "finishGame",
  "resetToLobby",
]) {
  const startNeedle = `  private ${methodName}(`;
  const start = s.indexOf(startNeedle);
  const nextPrivate = s.indexOf("\n  private ", start + startNeedle.length);
  const end = nextPrivate >= 0 ? nextPrivate : s.length;
  const block = s.slice(start, end);

  if (!block.includes("this.broadcastPhaseChanged();")) {
    throw new Error(
      `Sanity check failed: ${methodName} has no phase broadcast`
    );
  }
}

fs.writeFileSync(path, s, "utf8");

console.log("");
console.log("Done. v0.10.10.24 server phase patch applied successfully.");
console.log("Next: npm run build");
