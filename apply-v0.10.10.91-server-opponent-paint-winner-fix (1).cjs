const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

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
    1,
  );

  console.log("[ok]", label);
}

/*
 * v0.10.10.91
 *
 * Opponent paint fix:
 * Capture the reconnecting player's paint while existingSessionId is still
 * known, before any old/new map remapping code can lose the association.
 *
 * Store a normalized copy directly in a temporary local variable scoped to
 * the replacement branch, then replay it with the game's existing
 * "paint_stroke" event after the new actor/session is fully present.
 */
if (
  !s.includes(
    "V101091_CAPTURE_RECONNECT_SELF_PAINT",
  )
) {
  const marker = `          const replacedPlayer =
            this.state.players.get(
              existingSessionId,
            );`;

  const add = `${marker}

          /* V101091_CAPTURE_RECONNECT_SELF_PAINT */
          const reconnectSelfPaint =
            [...this.roundPaintStrokes.values()]
              .flat()
              .filter(
                (stroke: any) =>
                  stroke.targetSessionId ===
                    existingSessionId,
              )
              .map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId ===
                      existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    client.sessionId,
                }),
              );`;

  replaceOnce(
    marker,
    add,
    "capture reconnecting player's paint before session replacement",
  );

  /*
   * The replacement branch already has access to reconnectSelfPaint.
   * Insert a delayed ORIGINAL paint_stroke replay before leaving that branch.
   * Use tiny batches so this cannot destabilize mobile reconnect.
   */
  const replayAnchor = `          this.broadcast(
            "player_reconnected",
            {
              name: replacedName,
            },
          );`;

  const replay = `${replayAnchor}

          if (
            reconnectSelfPaint.length >
            0
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

                let cursor = 0;

                const replayBatch =
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
                        reconnectSelfPaint.length,
                        cursor + 6,
                      );

                    for (
                      ;
                      cursor < end;
                      cursor += 1
                    ) {
                      const stroke =
                        reconnectSelfPaint[cursor];

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
                      reconnectSelfPaint.length
                    ) {
                      this.clock.setTimeout(
                        replayBatch,
                        90,
                      );
                    }
                  };

                replayBatch();
              },
              1400,
            );

            /*
             * One delayed second pass only for this player's paint.
             * This covers slower opponent Schema creation without replaying
             * the whole round or touching reconnect state.
             */
            this.clock.setTimeout(
              () => {
                if (
                  !this.state.players.has(
                    client.sessionId,
                  )
                ) {
                  return;
                }

                reconnectSelfPaint.forEach(
                  (stroke: any) => {
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
                  },
                );
              },
              3200,
            );
          }`;

  replaceOnce(
    replayAnchor,
    replay,
    "replay reconnecting player's paint to opponents",
  );
}

/*
 * Winner fix:
 * finishGame must be idempotent. A stale Hunt deadline or disconnect-related
 * callback firing after Hunters already won must not overwrite winner=hunter
 * with winner=hiders (or vice versa).
 */
if (
  !s.includes(
    "V101091_FINISH_GAME_IDEMPOTENT",
  )
) {
  const marker =
    `  private finishGame(`;

  const start =
    s.indexOf(marker);

  if (start < 0) {
    throw new Error(
      "Could not find finishGame()",
    );
  }

  const brace =
    s.indexOf(
      "{",
      start,
    );

  if (brace < 0) {
    throw new Error(
      "Could not parse finishGame()",
    );
  }

  const guard = `{
    /* V101091_FINISH_GAME_IDEMPOTENT */
    if (
      this.state.phase ===
        "finished" &&
      (
        this.state.winner ===
          "hunters" ||
        this.state.winner ===
          "hiders"
      )
    ) {
      return;
    }
`;

  s =
    s.slice(0, brace) +
    guard +
    s.slice(brace + 1);

  console.log(
    "[ok] finishGame winner overwrite guard",
  );
}

/*
 * Verification.
 */
for (const [needle, label] of [
  [
    "V101091_CAPTURE_RECONNECT_SELF_PAINT",
    "reconnect self-paint capture",
  ],
  [
    "V101091_FINISH_GAME_IDEMPOTENT",
    "finishGame idempotency",
  ],
  [
    "V101090_SAFE_EXISTING_PAINT_STROKE_REPLAY",
    ".90 stable reconnect replay",
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
  "[done] v0.10.10.91 opponent paint + winner fix applied",
);
console.log(
  "Next: npm run build",
);
