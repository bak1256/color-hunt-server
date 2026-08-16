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
    "V101089_NORMALIZED_TARGETED_RECONNECT_PAINT",
  )
) {
  console.log(
    "[skip] v0.10.10.89 already applied",
  );
  process.exit(0);
}

/*
 * .88 used roundPaintStrokes.get(client.sessionId). That assumes the map key
 * and every stroke target have already migrated perfectly.
 *
 * The reconnecting mobile client could still recover its own paint through
 * a local old-session fallback, while opponents could not.
 *
 * Derive the paint from the ENTIRE authoritative history and normalize the
 * outgoing target/sender to the CURRENT replacement sessionId.
 */
const marker =
  `/* V101088_TARGETED_RECONNECT_PAINT */`;

const markerAt =
  s.indexOf(marker);

if (markerAt < 0) {
  throw new Error(
    "Expected v0.10.10.88 targeted reconnect paint first",
  );
}

/*
 * Locate the .88 if-block, then replace only its reconnectPaint acquisition
 * and outgoing payload construction.
 */
const searchEnd =
  Math.min(
    s.length,
    markerAt + 6000,
  );

let block =
  s.slice(
    markerAt,
    searchEnd,
  );

const oldAcquire = `              const reconnectPaint =
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
              );`;

const newAcquire = `              /* V101089_NORMALIZED_TARGETED_RECONNECT_PAINT */
              const reconnectPaint =
                [...this.roundPaintStrokes.values()]
                  .flat()
                  .filter(
                    (stroke: any) =>
                      stroke.targetSessionId ===
                        client.sessionId ||
                      (
                        stroke.senderId ===
                          client.sessionId &&
                        stroke.senderId ===
                          stroke.targetSessionId
                      ),
                  )
                  .map(
                    (stroke: any) => ({
                      ...stroke,
                      /*
                       * This is the replacement Hunter's self-camouflage.
                       * Opponents must receive the CURRENT sessionId even if
                       * one stored object escaped an earlier migration.
                       */
                      senderId:
                        stroke.senderId ===
                          stroke.targetSessionId
                          ? client.sessionId
                          : stroke.senderId,
                      targetSessionId:
                        client.sessionId,
                    }),
                  );

              if (
                reconnectPaint.length <
                1
              ) {
                return;
              }

              this.broadcast(
                "reconnected_player_paint",
                {
                  sessionId:
                    client.sessionId,
                  strokes:
                    reconnectPaint,
                },
              );`;

if (!block.includes(oldAcquire)) {
  throw new Error(
    "Could not find .88 reconnectPaint broadcast block",
  );
}

block =
  block.replace(
    oldAcquire,
    newAcquire,
    1,
  );

/*
 * More time for slower opponents to receive the replacement actor, while
 * payload stays tiny (only reconnecting Hunter paint).
 */
block =
  block.replace(
    `[900, 1800]`,
    `[700, 1600, 3200]`,
  );

s =
  s.slice(0, markerAt) +
  block +
  s.slice(searchEnd);

if (
  !s.includes(
    "V101089_NORMALIZED_TARGETED_RECONNECT_PAINT",
  )
) {
  throw new Error(
    "Verification failed: normalized targeted reconnect paint",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] reconnecting Hunter paint is derived from full history",
);
console.log(
  "[ok] outgoing Hunter paint is forced to the new sessionId",
);
console.log(
  "[ok] opponents receive only the reconnecting Hunter paint",
);
console.log(
  "[done] v0.10.10.89 opponent Hunter paint fix applied",
);
console.log(
  "Next: npm run build",
);
