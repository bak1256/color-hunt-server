const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

if (
  s.includes(
    "V101088_TARGETED_RECONNECT_PAINT",
  )
) {
  console.log(
    "[skip] v0.10.10.88 targeted reconnect paint already installed",
  );
  process.exit(0);
}

if (!s.includes("roundPaintStrokes")) {
  throw new Error(
    "Expected roundPaintStrokes support before .88",
  );
}

/*
 * Fresh fallback joins set reconnectFallback=true.
 * The previous hotfixes already remap old sessionIds -> client.sessionId.
 * Once the new player is fully inserted, broadcast ONLY that player's paint.
 * This is small enough to retry without freezing mobile browsers and gives
 * every opponent a deterministic repaint of the replacement Hunter.
 */
const marker = `    this.state.players.set(
      client.sessionId,
      player,
    );`;

if (!s.includes(marker)) {
  throw new Error(
    "Could not find final player insertion point",
  );
}

/* Make reconnectFallback available to the typed JoinOptions if needed. */
if (!s.includes("reconnectFallback?: boolean;")) {
  const optionMarker =
    `  clientKey?: string;`;

  if (s.includes(optionMarker)) {
    s = s.replace(
      optionMarker,
      optionMarker +
        `
  reconnectFallback?: boolean;`,
      1,
    );
  }
}

const add = `

    /* V101088_TARGETED_RECONNECT_PAINT */
    if (
      options.reconnectFallback === true &&
      this.state.phase !== "lobby"
    ) {
      [900, 1800].forEach(
        (delay) => {
          this.clock.setTimeout(
            () => {
              if (
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }

              const reconnectPaint =
                this.roundPaintStrokes.get(
                  client.sessionId,
                ) ?? [];

              if (
                reconnectPaint.length <
                1
              ) {
                return;
              }

              this.broadcast(
                "reconnected_player_paint",
                {
                  strokes:
                    reconnectPaint,
                },
              );
            },
            delay,
          );
        },
      );
    }`;

s = s.replace(
  marker,
  marker + add,
  1,
);

if (
  !s.includes(
    "V101088_TARGETED_RECONNECT_PAINT",
  )
) {
  throw new Error(
    "Verification failed: targeted reconnect paint",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] reconnecting player's paint will be replayed to every opponent",
);
console.log(
  "[ok] replay is targeted, not a full-round paint flood",
);
console.log(
  "[done] v0.10.10.88 targeted reconnect paint server patch applied",
);
console.log(
  "Next: npm run build",
);
