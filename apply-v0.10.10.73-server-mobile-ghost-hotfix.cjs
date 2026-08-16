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

/*
 * v0.10.10.73:
 * In Lobby there is nothing worth preserving for 10 seconds.
 * If a mobile browser really drops, remove that session immediately so
 * a refresh/rejoin never leaves a duplicate ghost character behind.
 *
 * Active rounds still keep the 10-second reconnection grace.
 */
if (!s.includes("V101073_LOBBY_DROP_CLEANUP")) {
  const needle = `    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    try {`;

  const replacement = `    console.log(
      "[Chameleon Hunt] temporary drop",
      {
        sessionId:
          client.sessionId,
        code,
      },
    );

    /* V101073_LOBBY_DROP_CLEANUP */
    if (this.state.phase === "lobby") {
      this.onLeave(
        client,
        code as CloseCode,
      );
      return;
    }

    try {`;

  replaceOnce(
    needle,
    replacement,
    "Lobby drop immediate cleanup",
  );
}

/*
 * Because Lobby onDrop now delegates to onLeave directly, guard onLeave so
 * a later duplicate lifecycle callback can never broadcast/remove twice.
 */
if (!s.includes("V101073_DUPLICATE_LEAVE_GUARD")) {
  const needle = `  ): void {
    const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );`;

  const replacement = `  ): void {
    /* V101073_DUPLICATE_LEAVE_GUARD */
    if (
      !this.state.players.has(
        client.sessionId,
      )
    ) {
      return;
    }

    const leavingPlayer =
      this.state.players.get(
        client.sessionId,
      );`;

  const onLeaveStart = s.indexOf("  onLeave(");
  if (onLeaveStart < 0) {
    throw new Error("Could not find onLeave()");
  }

  const tail = s.slice(onLeaveStart);
  if (!tail.includes(needle)) {
    throw new Error("Could not find onLeave body");
  }

  s =
    s.slice(0, onLeaveStart) +
    tail.replace(
      needle,
      replacement,
      1,
    );

  console.log("[ok] duplicate leave guard");
}

for (const [needle, label] of [
  ["V101073_LOBBY_DROP_CLEANUP", "Lobby drop cleanup"],
  ["V101073_DUPLICATE_LEAVE_GUARD", "duplicate leave guard"],
  ["allowReconnection(", "active round reconnection"],
]) {
  if (!s.includes(needle)) {
    throw new Error("Verification failed: " + label);
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("");
console.log("[done] v0.10.10.73 MOBILE join/ghost server hotfix applied");
console.log("Next: npm run build");
