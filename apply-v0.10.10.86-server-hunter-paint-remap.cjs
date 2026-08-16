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
    "V101086_GLOBAL_PAINT_SESSION_REMAP",
  )
) {
  console.log(
    "[skip] v0.10.10.86 global paint remap already installed",
  );
  process.exit(0);
}

if (!s.includes("roundPaintStrokes")) {
  throw new Error(
    "Expected .82b roundPaintStrokes support before .86",
  );
}

const marker = `          this.paintReadySessionIds.delete(
            existingSessionId,
          );`;

if (!s.includes(marker)) {
  throw new Error(
    "Could not find same-client replacement point",
  );
}

const add = `

          /* V101086_GLOBAL_PAINT_SESSION_REMAP */
          const remappedRoundPaint =
            new Map<string, any[]>();

          for (
            const [
              paintTargetId,
              paintStrokes,
            ] of this.roundPaintStrokes
          ) {
            const remappedTargetId =
              paintTargetId ===
                existingSessionId
                ? client.sessionId
                : paintTargetId;

            const remappedStrokes =
              paintStrokes.map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    stroke.targetSessionId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.targetSessionId,
                }),
              );

            const previous =
              remappedRoundPaint.get(
                remappedTargetId,
              ) ?? [];

            previous.push(
              ...remappedStrokes,
            );

            remappedRoundPaint.set(
              remappedTargetId,
              previous,
            );
          }

          this.roundPaintStrokes.clear();

          for (
            const [
              paintTargetId,
              paintStrokes,
            ] of remappedRoundPaint
          ) {
            this.roundPaintStrokes.set(
              paintTargetId,
              paintStrokes,
            );
          }

          [180, 520, 1100].forEach(
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
          );`;

s = s.replace(
  marker,
  marker + add,
  1,
);

if (
  !s.includes(
    "V101086_GLOBAL_PAINT_SESSION_REMAP",
  )
) {
  throw new Error(
    "Verification failed: global paint session remap",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] every stale Hunter paint sessionId is remapped",
);
console.log(
  "[ok] full paint state is replayed after the new Hunter session exists",
);
console.log(
  "[done] v0.10.10.86 Hunter paint reconnect remap applied",
);
console.log(
  "Next: npm run build",
);
