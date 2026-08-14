const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

const fieldMarker = "  messages = {";
if (!s.includes(fieldMarker)) {
  throw new Error("Could not find `messages = {` in src/rooms/MyRoom.ts");
}

if (!s.includes("private readonly lobbyAvatarPresets")) {
  s = s.replace(
    fieldMarker,
`  private readonly lobbyAvatarPresets =
    new Map<string, any[]>();

${fieldMarker}`
  );
  console.log("[ok] lobbyAvatarPresets map");
} else {
  console.log("[skip] lobbyAvatarPresets map");
}

if (!s.includes("avatar_preset: (")) {
  const handler = `  messages = {
    avatar_preset: (
      client: Client,
      message: any,
    ): void => {
      if (
        this.state.phase !==
        "lobby"
      ) {
        return;
      }

      const rawStrokes =
        Array.isArray(
          message?.strokes,
        )
          ? message.strokes
          : [];

      const strokes =
        rawStrokes
          .slice(0, 80)
          .map((stroke: any) => {
            const color =
              Math.max(
                0,
                Math.min(
                  0xffffff,
                  Math.round(
                    Number(
                      stroke?.color ??
                      0,
                    ),
                  ),
                ),
              );

            const size =
              Math.max(
                1,
                Math.min(
                  12,
                  Math.round(
                    Number(
                      stroke?.size ??
                      1,
                    ),
                  ),
                ),
              );

            const shape =
              stroke?.shape ===
                "square"
                ? "square"
                : "circle";

            const points =
              (
                Array.isArray(
                  stroke?.points,
                )
                  ? stroke.points
                  : []
              )
                .slice(0, 240)
                .map(
                  (point: any) => ({
                    x:
                      Math.max(
                        0,
                        Math.min(
                          80,
                          Math.round(
                            Number(
                              point?.x ??
                              40,
                            ),
                          ),
                        ),
                      ),
                    y:
                      Math.max(
                        0,
                        Math.min(
                          120,
                          Math.round(
                            Number(
                              point?.y ??
                              60,
                            ),
                          ),
                        ),
                      ),
                  }),
                );

            return {
              targetSessionId:
                client.sessionId,
              color,
              size,
              shape,
              points,
            };
          })
          .filter(
            (stroke: any) =>
              stroke.points.length >
              0,
          );

      this.lobbyAvatarPresets
        .set(
          client.sessionId,
          strokes,
        );

      this.broadcast(
        "avatar_preset",
        {
          sessionId:
            client.sessionId,
          strokes,
        },
      );
    },

    request_avatar_presets: (
      client: Client,
    ): void => {
      client.send(
        "avatar_presets",
        {
          presets:
            [
              ...this
                .lobbyAvatarPresets
                .entries(),
            ].map(
              (
                [
                  sessionId,
                  strokes,
                ],
              ) => ({
                sessionId,
                strokes,
              }),
            ),
        },
      );
    },

`;
  s = s.replace(
    "  messages = {\n",
    handler
  );
  console.log("[ok] avatar preset messages");
} else {
  console.log("[skip] avatar preset messages");
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log("Done. Lobby avatar preset sync patch applied.");
console.log("Next: npm run build");
