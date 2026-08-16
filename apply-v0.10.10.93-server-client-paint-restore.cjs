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

if (
  s.includes(
    "V101093_RESTORE_LOCAL_PAINT",
  )
) {
  console.log(
    "[skip] v0.10.10.93 already applied",
  );
  process.exit(0);
}

/*
 * Insert a new message handler next to the existing paint-related handlers.
 * This does NOT modify onJoin/onLeave/onReconnect or fallback handoff.
 */
const handlerAnchor =
  `    request_round_paint_state: (`;

const at =
  s.indexOf(handlerAnchor);

if (at < 0) {
  throw new Error(
    "Could not find request_round_paint_state handler",
  );
}

const handler = `    /* V101093_RESTORE_LOCAL_PAINT */
    restore_local_paint: (
      client: Client,
      payload: {
        strokes?: any[];
      },
    ): void => {
      if (
        this.state.phase !== "paint" &&
        this.state.phase !== "hunt" &&
        this.state.phase !== "countdown"
      ) {
        return;
      }

      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (
        !player ||
        player.role !== "hunter" ||
        !player.alive
      ) {
        return;
      }

      const raw =
        Array.isArray(
          payload?.strokes,
        )
          ? payload.strokes
              .slice(0, 240)
          : [];

      if (raw.length < 1) {
        return;
      }

      const normalized =
        raw
          .map(
            (stroke: any) => {
              const color =
                Number(
                  stroke?.color,
                );

              const size =
                Math.max(
                  1,
                  Math.min(
                    20,
                    Number(
                      stroke?.size,
                    ) || 1,
                  ),
                );

              const shape =
                stroke?.shape ===
                  "square" ||
                stroke?.shape ===
                  "dotCircle"
                  ? stroke.shape
                  : "circle";

              const points =
                Array.isArray(
                  stroke?.points,
                )
                  ? stroke.points
                      .slice(
                        0,
                        1000,
                      )
                      .map(
                        (point: any) => ({
                          x:
                            Number(
                              point?.x,
                            ),
                          y:
                            Number(
                              point?.y,
                            ),
                        }),
                      )
                      .filter(
                        (point: any) =>
                          Number.isFinite(
                            point.x,
                          ) &&
                          Number.isFinite(
                            point.y,
                          ),
                      )
                  : [];

              if (
                !Number.isFinite(
                  color,
                ) ||
                points.length < 1
              ) {
                return null;
              }

              return {
                senderId:
                  client.sessionId,
                targetSessionId:
                  client.sessionId,
                color,
                size,
                shape,
                points,
              };
            },
          )
          .filter(
            Boolean,
          ) as any[];

      if (
        normalized.length <
        1
      ) {
        return;
      }

      /*
       * Replace this Hunter's authoritative round history with the exact
       * post-reconnect source supplied by the same living Hunter.
       */
      this.roundPaintStrokes.set(
        client.sessionId,
        normalized,
      );

      /*
       * Opponents already understand paint_stroke perfectly.
       * Send only this Hunter's paint, in small batches.
       * Do NOT send it back to the reconnecting client: that screen is
       * already correct and doesn't need duplicate drawing work.
       */
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
              normalized.length,
              cursor + 5,
            );

          for (
            ;
            cursor < end;
            cursor += 1
          ) {
            const stroke =
              normalized[cursor];

            this.clients.forEach(
              (otherClient) => {
                if (
                  otherClient.sessionId ===
                    client.sessionId
                ) {
                  return;
                }

                otherClient.send(
                  "paint_stroke",
                  stroke,
                );
              },
            );
          }

          if (
            cursor <
            normalized.length
          ) {
            this.clock.setTimeout(
              sendBatch,
              70,
            );
          }
        };

      /*
       * Give opponent Schema/render objects a brief moment to settle.
       */
      this.clock.setTimeout(
        sendBatch,
        350,
      );
    },

`;

s =
  s.slice(0, at) +
  handler +
  s.slice(at);

if (
  !s.includes(
    "V101093_RESTORE_LOCAL_PAINT",
  )
) {
  throw new Error(
    "Verification failed: restore_local_paint handler",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] reconnecting Hunter can upload its exact surviving local paint",
);
console.log(
  "[ok] server replays that paint only to opponents using paint_stroke",
);
console.log(
  "[ok] reconnect lifecycle was not modified",
);
console.log(
  "[done] v0.10.10.93 client-source opponent paint restore applied",
);
console.log(
  "Next: npm run build",
);
