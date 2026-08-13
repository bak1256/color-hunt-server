const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function mustReplace(oldText, newText, label) {
  if (s.includes(newText)) {
    console.log(`[skip] ${label} already applied`);
    return;
  }
  if (!s.includes(oldText)) {
    throw new Error(`Could not find expected source for: ${label}`);
  }
  s = s.replace(oldText, newText);
  console.log(`[ok] ${label}`);
}

mustReplace(
`type SelectMapMessage = {
  map?: string;
};
`,
`type SelectMapMessage = {
  map?: string;
};

type SelectPaintDurationMessage = {
  durationMs?: number;
};
`,
"paint duration message type"
);

mustReplace(
`  private readonly paintDurationMs =
    45_000;
`,
`  private paintDurationMs =
    60_000;
`,
"default paint duration 60 seconds"
);

mustReplace(
`        activeMap:
          this.state.activeMap,
        players:
`,
`        activeMap:
          this.state.activeMap,
        paintDurationMs:
          this.paintDurationMs,
        players:
`,
"paint duration in lobby snapshot"
);

const selectMapEnd = `    select_map: (
      client: Client,
      message: SelectMapMessage,
    ): void => {
      this.ensureValidHost();

      if (
        client.sessionId !==
          this.state.hostId ||
        this.state.phase !== "lobby"
      ) {
        return;
      }

      const requestedMap =
        String(
          message.map ?? "",
        ).trim();

      if (
        !this.isAllowedMap(
          requestedMap,
        )
      ) {
        return;
      }

      this.state.selectedMap =
        requestedMap;

      this.clients.forEach(
        (connectedClient) => {
          this.sendLobbySnapshot(
            connectedClient,
          );
        },
      );
    },
`;

const durationHandler = `
    select_paint_duration: (
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

if (!s.includes("select_paint_duration:")) {
  if (!s.includes(selectMapEnd)) {
    throw new Error("Could not find select_map handler. Your server MyRoom.ts differs from the expected v0.10.10.15 source.");
  }
  s = s.replace(selectMapEnd, selectMapEnd + durationHandler);
  console.log("[ok] select_paint_duration handler");
} else {
  console.log("[skip] select_paint_duration handler already applied");
}

fs.writeFileSync(path, s, "utf8");
console.log("\\nDone: src/rooms/MyRoom.ts patched for v0.10.10.16.");
