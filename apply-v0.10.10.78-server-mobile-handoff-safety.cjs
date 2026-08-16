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
  );

  console.log("[ok]", label);
}

/*
 * Keep a short-lived authoritative player snapshot for same-browser
 * reconnect fallback sessions.
 */
if (!s.includes(
  "rejoinStateByClientKey",
)) {
  const marker =
    `  private readonly clientKeyBySessionId =
    new Map<string, string>();`;

  replaceOnce(
    marker,
    marker + `

  private readonly rejoinStateByClientKey =
    new Map<
      string,
      {
        role: "hunter" | "hider";
        alive: boolean;
        hunterVolunteer: boolean;
        x: number;
        y: number;
        expiresAt: number;
      }
    >();

  private noHunterGraceGeneration = 0;`,
    "rejoin-state cache",
  );
}

/*
 * Save the old player's active-round identity before .74 removes a ghost
 * session during same-client fresh rejoin.
 */
if (!s.includes(
  "V101078_CAPTURE_REPLACED_STATE",
)) {
  const marker = `          this.state.players.delete(
            existingSessionId,
          );`;

  const add = `          /* V101078_CAPTURE_REPLACED_STATE */
          if (
            replacedPlayer &&
            this.state.phase !==
              "lobby"
          ) {
            this.rejoinStateByClientKey.set(
              clientKey,
              {
                role:
                  replacedPlayer.role,
                alive:
                  replacedPlayer.alive,
                hunterVolunteer:
                  replacedPlayer
                    .hunterVolunteer,
                x:
                  replacedPlayer.x,
                y:
                  replacedPlayer.y,
                expiresAt:
                  Date.now() +
                  35_000,
              },
            );
          }

`;

  replaceOnce(
    marker,
    add + marker,
    "capture replaced active player state",
  );
}

/*
 * Also preserve state when onLeave really happens before a fresh join.
 */
if (!s.includes(
  "V101078_CAPTURE_LEAVE_STATE",
)) {
  const marker = `    const leavingName =
      leavingPlayer?.name ??
      "Player";

    this.state.players.delete(
      client.sessionId,
    );`;

  const replacement = `    const leavingName =
      leavingPlayer?.name ??
      "Player";

    /* V101078_CAPTURE_LEAVE_STATE */
    const leavingClientKey =
      this.clientKeyBySessionId.get(
        client.sessionId,
      ) ?? "";

    if (
      leavingClientKey &&
      leavingPlayer &&
      this.state.phase !== "lobby"
    ) {
      this.rejoinStateByClientKey.set(
        leavingClientKey,
        {
          role:
            leavingPlayer.role,
          alive:
            leavingPlayer.alive,
          hunterVolunteer:
            leavingPlayer
              .hunterVolunteer,
          x:
            leavingPlayer.x,
          y:
            leavingPlayer.y,
          expiresAt:
            Date.now() +
            35_000,
        },
      );
    }

    this.state.players.delete(
      client.sessionId,
    );`;

  replaceOnce(
    marker,
    replacement,
    "capture leave active player state",
  );
}

/*
 * After the default player initialization, restore the authoritative role
 * and position for a same-browser fallback join.
 */
if (!s.includes(
  "V101078_RESTORE_REJOIN_STATE",
)) {
  const marker = `    player.y = lobbyPosition.y;

    this.state.players.set(
      client.sessionId,
      player,
    );`;

  const replacement = `    player.y = lobbyPosition.y;

    /* V101078_RESTORE_REJOIN_STATE */
    if (clientKey) {
      const saved =
        this.rejoinStateByClientKey.get(
          clientKey,
        );

      if (
        saved &&
        saved.expiresAt >
          Date.now() &&
        this.state.phase !==
          "lobby"
      ) {
        player.role =
          saved.role;
        player.alive =
          saved.alive;
        player.hunterVolunteer =
          saved.hunterVolunteer;
        player.x =
          saved.x;
        player.y =
          saved.y;

        this.rejoinStateByClientKey.delete(
          clientKey,
        );
      }
    }

    this.noHunterGraceGeneration += 1;

    this.state.players.set(
      client.sessionId,
      player,
    );`;

  replaceOnce(
    marker,
    replacement,
    "restore fallback rejoin state",
  );
}

/*
 * A real reconnect also invalidates any pending no-Hunter victory timer.
 */
if (!s.includes(
  "V101078_CANCEL_NO_HUNTER_ON_RECONNECT",
)) {
  const marker = `    console.log(
      "[Chameleon Hunt] reconnected",`;

  replaceOnce(
    marker,
    `    /* V101078_CANCEL_NO_HUNTER_ON_RECONNECT */
    this.noHunterGraceGeneration += 1;

${marker}`,
    "cancel no-Hunter grace on reconnect",
  );
}

/*
 * Never award Hider victory instantly just because the final Hunter's
 * transport disappeared. Wait out the mobile handoff grace and re-check.
 */
if (!s.includes(
  "private scheduleNoHunterGraceResolution",
)) {
  const marker =
    `  private finishGame(`;

  const method = `  private scheduleNoHunterGraceResolution(): void {
    const generation =
      ++this.noHunterGraceGeneration;

    this.clock.setTimeout(
      () => {
        if (
          generation !==
            this.noHunterGraceGeneration
        ) {
          return;
        }

        if (
          this.state.phase !==
            "countdown" &&
          this.state.phase !==
            "paint" &&
          this.state.phase !==
            "hunt"
        ) {
          return;
        }

        const players =
          [...this.state.players.values()];

        const hunterCount =
          players.filter(
            (player) =>
              player.role ===
                "hunter",
          ).length;

        const hiderCount =
          players.filter(
            (player) =>
              player.role ===
                "hider",
          ).length;

        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          this.finishGame(
            "hiders",
          );
        }
      },
      30_000,
    );
  }

`;

  replaceOnce(
    marker,
    method + marker,
    "delayed no-Hunter resolution method",
  );
}

/* Replace both active-round instant Hider victory branches. */
{
  const instant = `        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          this.finishGame("hiders");
          return;
        }`;

  let count = 0;

  while (s.includes(instant)) {
    s = s.replace(
      instant,
      `        if (
          hunterCount < 1 &&
          hiderCount >= 1
        ) {
          /*
           * v0.10.10.78:
           * Network handoff is not a victory condition.
           */
          this.scheduleNoHunterGraceResolution();
          return;
        }`,
    );
    count += 1;
  }

  if (count < 2) {
    throw new Error(
      "Expected two instant no-Hunter victory branches; replaced " +
      count,
    );
  }

  console.log(
    "[ok] delayed " +
    count +
    " no-Hunter victory branches",
  );
}

for (const [needle, label] of [
  ["V101078_CAPTURE_REPLACED_STATE", "replacement capture"],
  ["V101078_CAPTURE_LEAVE_STATE", "leave capture"],
  ["V101078_RESTORE_REJOIN_STATE", "rejoin restore"],
  ["V101078_CANCEL_NO_HUNTER_ON_RECONNECT", "reconnect cancel"],
  ["private scheduleNoHunterGraceResolution", "grace resolver"],
  ["V101075_RECONNECT_30S", "30-second reconnect reservation"],
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
  "[done] v0.10.10.78 mobile handoff safety server patch applied",
);
console.log(
  "Next: npm run build",
);
