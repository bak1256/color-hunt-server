const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "rooms", "MyRoom.ts");
let s = fs.readFileSync(file, "utf8");

function replaceOnce(before, after, label) {
  if (s.includes(after)) {
    console.log("[skip]", label);
    return;
  }
  if (!s.includes(before)) {
    throw new Error("Could not find " + label);
  }
  s = s.replace(before, after);
  console.log("[ok]", label);
}

if (!s.includes("roundPaintStrokes")) {
  const marker = `  private readonly lobbyAvatarPresets =
    new Map<string, any[]>();`;

  replaceOnce(
    marker,
    marker + `

  private readonly roundPaintStrokes =
    new Map<string, any[]>();`,
    "round paint history map",
  );
}

if (!s.includes("V101082_STORE_ROUND_PAINT")) {
  const marker = `      this.broadcast(
        "paint_stroke",
        {`;

  const add = `      /* V101082_STORE_ROUND_PAINT */
      const storedStroke = {
        senderId: client.sessionId,
        targetSessionId,
        color,
        size,
        shape,
        points,
      };

      const targetHistory =
        this.roundPaintStrokes.get(
          targetSessionId,
        ) ?? [];

      targetHistory.push(storedStroke);

      if (targetHistory.length > 500) {
        targetHistory.splice(
          0,
          targetHistory.length - 500,
        );
      }

      this.roundPaintStrokes.set(
        targetSessionId,
        targetHistory,
      );

`;

  replaceOnce(
    marker,
    add + marker,
    "store validated round paint",
  );
}

if (!s.includes("request_round_paint_state:")) {
  const marker = `    request_lobby_snapshot: (
      client: Client,
    ): void => {`;

  const handler = `    request_round_paint_state: (
      client: Client,
    ): void => {
      const active =
        this.state.phase === "paint" ||
        this.state.phase === "hunt" ||
        this.state.phase === "countdown";

      client.send(
        "round_paint_state",
        {
          strokes:
            active
              ? [...this.roundPaintStrokes.values()].flat()
              : [],
        },
      );
    },

`;

  replaceOnce(
    marker,
    handler + marker,
    "round paint recovery request",
  );
}

if (!s.includes("V101082_TRANSFER_PAINT_STATE")) {
  const marker = `          this.paintReadySessionIds.delete(
            existingSessionId,
          );`;

  const add = `

          /* V101082_TRANSFER_PAINT_STATE */
          const oldAvatar =
            this.lobbyAvatarPresets.get(
              existingSessionId,
            );

          if (oldAvatar) {
            this.lobbyAvatarPresets.set(
              client.sessionId,
              oldAvatar,
            );
            this.lobbyAvatarPresets.delete(
              existingSessionId,
            );
          }

          const oldRoundPaint =
            this.roundPaintStrokes.get(
              existingSessionId,
            );

          if (oldRoundPaint) {
            const transferred =
              oldRoundPaint.map(
                (stroke: any) => ({
                  ...stroke,
                  senderId:
                    stroke.senderId === existingSessionId
                      ? client.sessionId
                      : stroke.senderId,
                  targetSessionId:
                    client.sessionId,
                }),
              );

            this.roundPaintStrokes.set(
              client.sessionId,
              transferred,
            );
            this.roundPaintStrokes.delete(
              existingSessionId,
            );
          }`;

  replaceOnce(
    marker,
    marker + add,
    "transfer reconnect paint state",
  );
}

if (!s.includes("V101082_RECONNECT_PAINT_REPLAY")) {
  const start = s.indexOf("  onReconnect(");
  const end = s.indexOf("\n  onLeave(", start);

  if (start < 0 || end < 0) {
    throw new Error("Could not locate onReconnect()");
  }

  let block = s.slice(start, end);
  const marker = `    this.sendLobbySnapshot(client);`;

  if (!block.includes(marker)) {
    throw new Error("Could not find reconnect snapshot send");
  }

  block = block.replace(
    marker,
    marker + `

    /* V101082_RECONNECT_PAINT_REPLAY */
    client.send(
      "round_paint_state",
      {
        strokes:
          this.state.phase === "paint" ||
          this.state.phase === "hunt" ||
          this.state.phase === "countdown"
            ? [...this.roundPaintStrokes.values()].flat()
            : [],
      },
    );

    client.send(
      "avatar_presets",
      {
        presets:
          [...this.lobbyAvatarPresets.entries()]
            .map(
              ([sessionId, strokes]) => ({
                sessionId,
                strokes,
              }),
            ),
      },
    );`,
    1,
  );

  s = s.slice(0, start) + block + s.slice(end);
  console.log("[ok] reconnect paint/avatar replay");
}

if (!s.includes("V101082_CLEAR_ROUND_PAINT")) {
  const start = s.indexOf("  private startPaintPhase(");
  const end = s.indexOf("\n  private ", start + 20);

  if (start < 0 || end < 0) {
    throw new Error("Could not locate startPaintPhase()");
  }

  let block = s.slice(start, end);
  const marker = `    this.paintReadySessionIds.clear();`;

  if (!block.includes(marker)) {
    throw new Error("Could not find READY reset in startPaintPhase()");
  }

  block = block.replace(
    marker,
    `    /* V101082_CLEAR_ROUND_PAINT */
    this.roundPaintStrokes.clear();

${marker}`,
    1,
  );

  s = s.slice(0, start) + block + s.slice(end);
  console.log("[ok] clear gameplay paint at Paint start");
}

for (const [needle, label] of [
  ["roundPaintStrokes", "history map"],
  ["V101082_STORE_ROUND_PAINT", "stroke storage"],
  ["request_round_paint_state:", "paint recovery request"],
  ["V101082_TRANSFER_PAINT_STATE", "session transfer"],
  ["V101082_RECONNECT_PAINT_REPLAY", "reconnect replay"],
  ["V101082_CLEAR_ROUND_PAINT", "new-round clear"],
]) {
  if (!s.includes(needle)) {
    throw new Error("Verification failed: " + label);
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("");
console.log("[done] v0.10.10.82 reconnect paint-state server patch applied");
console.log("Next: npm run build");
