const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(
  file,
  "utf8",
);

function replaceOnce(
  before,
  after,
  label,
) {
  if (s.includes(after)) {
    console.log("[skip]", label);
    return;
  }

  if (!s.includes(before)) {
    throw new Error(
      "Could not find " + label,
    );
  }

  s = s.replace(
    before,
    after,
  );

  console.log("[ok]", label);
}

/*
 * v0.10.10.76:
 * On mobile network handoff, phase may have advanced while the client was
 * disconnected. Re-send the complete authoritative snapshot immediately
 * and once more shortly afterward.
 */
if (!s.includes(
  "V101076_RECONNECT_STATE_PULSE",
)) {
  const marker = `    if (this.state.phase === "paint") {
      this.sendPaintReadyState(client);
    }`;

  const replacement = `${marker}

    /* V101076_RECONNECT_STATE_PULSE */
    this.clock.setTimeout(
      () => {
        if (
          this.clients.includes(client)
        ) {
          this.sendLobbySnapshot(
            client,
          );

          if (
            this.state.phase ===
              "paint"
          ) {
            this.sendPaintReadyState(
              client,
            );
          }
        }
      },
      180,
    );`;

  replaceOnce(
    marker,
    replacement,
    "reconnect authoritative state pulse",
  );
}

/*
 * Keep the 30-second active-round grace from .75.
 */
if (!s.includes(
  "V101075_RECONNECT_30S",
)) {
  throw new Error(
    "Expected v0.10.10.75 30-second reconnection grace first",
  );
}

for (const [needle, label] of [
  [
    "V101076_RECONNECT_STATE_PULSE",
    "state pulse",
  ],
  [
    "V101075_RECONNECT_30S",
    "30-second grace",
  ],
  [
    "sendLobbySnapshot(",
    "snapshot sender",
  ],
]) {
  if (!s.includes(needle)) {
    throw new Error(
      "Verification failed: " +
      label,
    );
  }
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log("");
console.log(
  "[done] v0.10.10.76 smooth reconnect server patch applied",
);
console.log(
  "Next: npm run build",
);
