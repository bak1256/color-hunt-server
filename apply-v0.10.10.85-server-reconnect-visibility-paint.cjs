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
    "V101085_REJOIN_FULL_STATE_PULSE",
  )
) {
  console.log(
    "[skip] v0.10.10.85 reconnect full-state pulse already installed",
  );
  process.exit(0);
}

/*
 * .82b/.84 transfer the old Hunter paint to the replacement sessionId.
 * The regression happened because some clients received paint replay before
 * the replacement Hunter actor/Schema add existed.
 *
 * After the new player is completely inserted, pulse BOTH player snapshot
 * and complete paint state to every client. GameScene .85 also delays paint
 * replacement until after it reconciles these players.
 */
const marker = `    this.state.players.set(
      client.sessionId,
      player,
    );`;

if (!s.includes(marker)) {
  throw new Error(
    "Could not find final player insertion point in onJoin()",
  );
}

const add = `

    /* V101085_REJOIN_FULL_STATE_PULSE */
    if (
      this.state.phase !== "lobby" &&
      String(options.clientKey ?? "")
        .trim()
    ) {
      [120, 420, 900].forEach(
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

              this.clients.forEach(
                (connectedClient) => {
                  this.sendLobbySnapshot(
                    connectedClient,
                  );

                  connectedClient.send(
                    "round_paint_state",
                    {
                      strokes:
                        [...this.roundPaintStrokes.values()]
                          .flat(),
                    },
                  );
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
    "V101085_REJOIN_FULL_STATE_PULSE",
  )
) {
  throw new Error(
    "Verification failed: full reconnect state pulse",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] replacement Hunter/player snapshot is replayed to ALL clients",
);
console.log(
  "[ok] complete round paint is replayed after player creation settles",
);
console.log(
  "[done] v0.10.10.85 server reconnect visibility/paint fix applied",
);
console.log(
  "Next: npm run build",
);
