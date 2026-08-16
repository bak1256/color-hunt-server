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
    "V101084_REJOIN_PAINT_BROADCAST",
  )
) {
  console.log(
    "[skip] reconnect paint broadcast already installed",
  );
  process.exit(0);
}

/*
 * .82b moves the old Hunter's paint history to the replacement sessionId,
 * but existing clients (PC) have already destroyed the old actor and created
 * the new one. They also need the COMPLETE paint history replay, not only the
 * reconnecting mobile client.
 */
const marker = `            this.roundPaintStrokes.delete(
              existingSessionId,
            );`;

if (!s.includes(marker)) {
  throw new Error(
    "Could not find .82b reconnect paint transfer point",
  );
}

const add = `

            /* V101084_REJOIN_PAINT_BROADCAST */
            this.clock.setTimeout(
              () => {
                const active =
                  this.state.phase === "paint" ||
                  this.state.phase === "hunt" ||
                  this.state.phase === "countdown";

                if (!active) {
                  return;
                }

                this.broadcast(
                  "round_paint_state",
                  {
                    strokes:
                      [...this.roundPaintStrokes.values()]
                        .flat(),
                  },
                );
              },
              80,
            );`;

s = s.replace(
  marker,
  marker + add,
);

if (
  !s.includes(
    "V101084_REJOIN_PAINT_BROADCAST",
  )
) {
  throw new Error(
    "Verification failed: reconnect paint broadcast",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] fresh reconnect paint state is replayed to ALL clients",
);
console.log(
  "[done] v0.10.10.84 server self-paint reconnect fix applied",
);
console.log(
  "Next: npm run build",
);
