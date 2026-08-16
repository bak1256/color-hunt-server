const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

/*
 * v0.10.10.90
 * Restore reconnect stability first.
 *
 * .89 changed the targeted reconnect-paint path and the client retry policy.
 * Reconnect itself was stable before that, so this patch removes the .89
 * targeted payload logic and leaves the established .88a reconnect flow alone.
 *
 * Paint visibility for opponents is solved separately below by replaying the
 * reconnecting Hunter's paint through the game's ORIGINAL paint_stroke event.
 */

/* Remove .89 marker so we don't rely on that path anymore. */
s = s.replace(
  /\s*\/\* V101089_NORMALIZED_TARGETED_RECONNECT_PAINT \*\/[\s\S]*?(?=\n\s*if\s*\(\s*reconnectPaint\.length|\n\s*this\.broadcast\()/,
  "\n",
);

/*
 * Neutralize the custom .88 reconnected_player_paint broadcast block.
 * Keep the code structurally present if other patches reference its marker,
 * but make its condition impossible so it cannot affect reconnect timing.
 */
const marker88 =
  "/* V101088_TARGETED_RECONNECT_PAINT */";

const markerAt =
  s.indexOf(marker88);

if (markerAt >= 0) {
  const windowEnd =
    Math.min(
      s.length,
      markerAt + 7000,
    );

  let block =
    s.slice(
      markerAt,
      windowEnd,
    );

  block =
    block.replace(
      /if\s*\(\s*options\.reconnectFallback\s*===\s*true\s*&&/,
      "if (\n      false &&",
    );

  s =
    s.slice(0, markerAt) +
    block +
    s.slice(windowEnd);

  console.log(
    "[ok] disabled custom .88/.89 reconnect-paint message path",
  );
}

/*
 * Safe opponent repaint:
 * after the fresh replacement session exists, replay only THAT player's stored
 * paint using the existing paint_stroke event that every client already knows.
 *
 * No full-round snapshot.
 * No new reconnect callbacks.
 * No extra client retry state.
 * Small batches avoid browser stalls.
 */
if (
  !s.includes(
    "V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY",
  )
) {
  const insertionMarker = `    this.state.players.set(
      client.sessionId,
      player,
    );`;

  if (!s.includes(insertionMarker)) {
    throw new Error(
      "Could not find final player insertion point",
    );
  }

  const add = `

    /* V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY */
    if (
      options.reconnectFallback === true &&
      this.state.phase !== "lobby"
    ) {
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
            (
              this.roundPaintStrokes.get(
                client.sessionId,
              ) ?? []
            ).map(
              (stroke: any) => ({
                ...stroke,
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

          let cursor = 0;

          const sendBatch =
            (): void => {
              if (
                !this.state.players.has(
                  client.sessionId,
                )
              ) {
                return;
              }

              const end =
                Math.min(
                  reconnectPaint.length,
                  cursor + 12,
                );

              for (
                ;
                cursor < end;
                cursor += 1
              ) {
                const stroke =
                  reconnectPaint[cursor];

                this.broadcast(
                  "paint_stroke",
                  {
                    senderId:
                      stroke.senderId,
                    targetSessionId:
                      client.sessionId,
                    color:
                      stroke.color,
                    size:
                      stroke.size,
                    shape:
                      stroke.shape,
                    points:
                      stroke.points,
                  },
                );
              }

              if (
                cursor <
                reconnectPaint.length
              ) {
                this.clock.setTimeout(
                  sendBatch,
                  70,
                );
              }
            };

          sendBatch();
        },
        1200,
      );
    }`;

  s =
    s.replace(
      insertionMarker,
      insertionMarker + add,
      1,
    );

  console.log(
    "[ok] installed safe existing paint_stroke replay",
  );
}

if (
  !s.includes(
    "V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY",
  )
) {
  throw new Error(
    "Verification failed: safe reconnect paint replay",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log("");
console.log(
  "[done] v0.10.10.90 stable reconnect + opponent paint replay applied",
);
console.log(
  "Next: npm run build",
);
