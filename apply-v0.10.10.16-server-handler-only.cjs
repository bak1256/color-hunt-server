const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

if (s.includes("select_paint_duration:")) {
  console.log("[skip] select_paint_duration handler already exists");
  process.exit(0);
}

const marker = `    start_game: (
`;

if (!s.includes(marker)) {
  throw new Error("Could not find start_game handler.");
}

const handler = `    select_paint_duration: (
      client: Client,
      message:
        SelectPaintDurationMessage,
    ): void => {
      this.ensureValidHost();

      if (
        client.sessionId !==
          this.state.hostId ||
        this.state.phase !== "lobby"
      ) {
        return;
      }

      const durationMs =
        Number(
          message.durationMs,
        );

      if (
        ![
          45_000,
          60_000,
          90_000,
        ].includes(durationMs)
      ) {
        return;
      }

      this.paintDurationMs =
        durationMs;

      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );
    },

`;

s = s.replace(
  marker,
  handler + marker,
);

fs.writeFileSync(path, s, "utf8");

console.log(
  "[ok] select_paint_duration handler inserted before start_game"
);
