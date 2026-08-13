const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

if (
  s.includes(
    "async onDrop("
  )
) {
  console.log(
    "[skip] onDrop reconnection grace already exists"
  );
} else {
  const marker = `  onLeave(
    client: Client,`;

  if (!s.includes(marker)) {
    throw new Error(
      "Could not find onLeave() in MyRoom.ts"
    );
  }

  const block = `  async onDrop(
    client: Client,
    code: number,
  ): Promise<void> {
    /*
     * Colyseus 0.17 distinguishes a temporary network drop from a real
     * leave when onDrop() is implemented.
     *
     * Previously every brief WebSocket interruption went straight through
     * onLeave(), which removed the player. During an active Paint round,
     * that made canContinue=false and immediately reset everybody to Lobby.
     *
     * Give the same session 10 seconds to reconnect. While this is pending,
     * DO NOT delete the player and DO NOT abort the round.
     */
    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    try {
      await this.allowReconnection(
        client,
        10,
      );
    } catch {
      /*
       * When reconnection finally fails, Colyseus will treat the client as
       * permanently gone and onLeave() performs the existing cleanup.
       */
    }
  }

  onReconnect(
    client: Client,
  ): void {
    console.log(
      "[Chameleon Hunt] reconnected",
      {
        sessionId:
          client.sessionId,
        phase:
          this.state.phase,
      },
    );

    /*
     * Immediately resynchronize the recovered client instead of waiting
     * for another Schema patch.
     */
    this.sendLobbySnapshot(
      client,
    );

    client.send(
      "phase_changed",
      {
        phase:
          this.state.phase,
        phaseEndsAt:
          this.state.phaseEndsAt,
      },
    );
  }

`;

  s = s.replace(
    marker,
    block + marker,
  );

  console.log(
    "[ok] added 10s onDrop reconnection grace"
  );
  console.log(
    "[ok] added onReconnect state/phase resync"
  );
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log(
  "Done. Temporary network drops will no longer immediately abort Paint."
);
console.log(
  "Next: npm run build"
);
