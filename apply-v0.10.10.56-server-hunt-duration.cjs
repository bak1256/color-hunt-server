const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!s.includes(from)) {
    throw new Error(`Could not find source for: ${label}`);
  }
  s = s.replace(from, to);
  console.log(`[ok] ${label}`);
}

// 1) Server-side selected hunt duration, default 80s.
if (!s.includes("private huntDurationMs = 80_000;")) {
  const messagesIndex = s.indexOf("  messages = {");
  if (messagesIndex < 0) {
    throw new Error("Could not find messages object.");
  }

  s =
    s.slice(0, messagesIndex) +
    "  private huntDurationMs = 80_000;\n\n" +
    s.slice(messagesIndex);

  console.log("[ok] default hunt duration 80s");
} else {
  console.log("[skip] default hunt duration already present");
}

// 2) Host-selectable 80/100/120s lobby setting.
if (!s.includes("select_hunt_duration: (")) {
  const marker = "  messages = {\n";
  const handler = `  messages = {
    select_hunt_duration: (
      client: Client,
      message: {
        durationMs?: number;
      },
    ): void => {
      if (
        this.state.phase !== "lobby" ||
        client.sessionId !== this.state.hostId
      ) {
        return;
      }

      const durationMs =
        Number(
          message?.durationMs,
        );

      if (
        ![
          80_000,
          100_000,
          120_000,
        ].includes(durationMs)
      ) {
        return;
      }

      this.huntDurationMs =
        durationMs;

      this.clients.forEach(
        (remainingClient) => {
          this.sendLobbySnapshot(
            remainingClient,
          );
        },
      );
    },

`;

  replaceOnce(
    marker,
    handler,
    "hunt duration selection handler",
  );
} else {
  console.log("[skip] hunt duration handler already present");
}

// 3) Include selected hunt time in every lobby snapshot that already
// exposes paintDurationMs.
if (!s.includes("huntDurationMs: this.huntDurationMs")) {
  const paintSnapshot =
    /paintDurationMs:\s*this\.paintDurationMs,/g;

  let count = 0;
  s = s.replace(
    paintSnapshot,
    (match) => {
      count += 1;
      return (
        match +
        "\n        huntDurationMs: this.huntDurationMs,"
      );
    },
  );

  if (count === 0) {
    throw new Error(
      "Could not find paintDurationMs in lobby snapshot payload.",
    );
  }

  console.log(
    `[ok] hunt duration added to ${count} lobby snapshot payload(s)`,
  );
} else {
  console.log("[skip] hunt duration snapshot already present");
}

// 4) Make startHuntPhase use the selected value instead of old fixed 45s.
const methodStart =
  s.indexOf("private startHuntPhase");

if (methodStart < 0) {
  throw new Error(
    "Could not find private startHuntPhase method.",
  );
}

const braceStart =
  s.indexOf("{", methodStart);

let depth = 0;
let methodEnd = -1;

for (
  let i = braceStart;
  i < s.length;
  i += 1
) {
  if (s[i] === "{") depth += 1;
  if (s[i] === "}") {
    depth -= 1;
    if (depth === 0) {
      methodEnd = i + 1;
      break;
    }
  }
}

if (methodEnd < 0) {
  throw new Error(
    "Could not parse startHuntPhase method.",
  );
}

let method =
  s.slice(
    methodStart,
    methodEnd,
  );

let replacedDuration = false;

const durationPatterns = [
  /\b45_000\b/g,
  /\b45\s*\*\s*1000\b/g,
  /\b30_000\b/g,
  /\b30\s*\*\s*1000\b/g,
];

for (const pattern of durationPatterns) {
  if (pattern.test(method)) {
    pattern.lastIndex = 0;
    method =
      method.replace(
        pattern,
        "this.huntDurationMs",
      );
    replacedDuration = true;
  }
}

// Fallback: phaseEndsAt assignment within startHuntPhase.
if (
  !replacedDuration &&
  !method.includes(
    "this.huntDurationMs",
  )
) {
  const phaseEndPattern =
    /this\.state\.phaseEndsAt\s*=\s*Date\.now\(\)\s*\+\s*[^;]+;/;

  if (
    phaseEndPattern.test(method)
  ) {
    method =
      method.replace(
        phaseEndPattern,
        "this.state.phaseEndsAt = Date.now() + this.huntDurationMs;",
      );
    replacedDuration = true;
  }
}

if (
  !replacedDuration &&
  !method.includes(
    "this.huntDurationMs",
  )
) {
  throw new Error(
    "Could not identify fixed Hunt duration inside startHuntPhase.",
  );
}

s =
  s.slice(0, methodStart) +
  method +
  s.slice(methodEnd);

console.log("[ok] startHuntPhase uses selected duration");

// 5) Display name only. Keep Colyseus room type `chameleon_hunt` unchanged.
s = s
  .replaceAll(
    '"Chameleon Hunt"',
    '"Color Hunt"',
  )
  .replaceAll(
    '"CHAMELEON HUNT"',
    '"COLOR HUNT"',
  );

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log("Done. v0.10.10.56 server hunt-time patch applied.");
console.log("Default Hunt: 80s / Host choices: 80, 100, 120s");
console.log("Next: npm run build");
