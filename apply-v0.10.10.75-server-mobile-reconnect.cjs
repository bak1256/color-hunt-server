const fs = require("fs");
const path = require("path");

const file =
  path.join(
    process.cwd(),
    "src",
    "rooms",
    "MyRoom.ts",
  );

let s =
  fs.readFileSync(
    file,
    "utf8",
  );

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

  s =
    s.replace(
      before,
      after,
    );

  console.log("[ok]", label);
}

/*
 * Active rounds: keep the actual Colyseus session alive long enough for
 * mobile Wi-Fi/LTE handoffs and background hiccups to recover.
 * Lobby-specific cleanup from .73 is intentionally left unchanged.
 */
if (!s.includes("V101075_RECONNECT_30S")) {
  replaceOnce(
    `      await this.allowReconnection(
        client,
        10,
      );`,
    `      /* V101075_RECONNECT_30S */
      await this.allowReconnection(
        client,
        30,
      );`,
    "30-second active reconnection grace",
  );
}

/*
 * Built-in automatic reconnection keeps the SAME sessionId.
 * Tell other players it recovered and immediately re-send authoritative
 * phase + READY state to the recovered mobile client.
 */
if (!s.includes("V101075_REAL_RECONNECT_NOTICE")) {
  const marker = `    /*
     * Immediately resynchronize the recovered client instead of waiting
     * for another Schema patch.
     */`;

  const add = `    /* V101075_REAL_RECONNECT_NOTICE */
    const reconnectedPlayer =
      this.state.players.get(
        client.sessionId,
      );

    this.broadcast(
      "player_reconnected",
      {
        name:
          reconnectedPlayer?.name ??
          "Player",
      },
    );

`;

  replaceOnce(
    marker,
    add + marker,
    "real reconnect notice",
  );
}

for (const [needle, label] of [
  ["V101075_RECONNECT_30S", "30-second grace"],
  ["V101075_REAL_RECONNECT_NOTICE", "reconnect notice"],
  ["allowReconnection(", "allowReconnection"],
  ["onReconnect(", "onReconnect"],
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
  "[done] v0.10.10.75 mobile avatar/reconnect server hotfix applied",
);
console.log(
  "Next: npm run build",
);
