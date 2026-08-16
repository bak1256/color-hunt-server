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

function methodRange(name) {
  const marker = `  private ${name}(`;
  const start = s.indexOf(marker);

  if (start < 0) {
    throw new Error(
      `Could not find ${name}()`,
    );
  }

  const brace = s.indexOf(
    "{",
    start,
  );

  let depth = 0;

  for (
    let i = brace;
    i < s.length;
    i += 1
  ) {
    if (s[i] === "{") {
      depth += 1;
    } else if (
      s[i] === "}"
    ) {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end: i + 1,
        };
      }
    }
  }

  throw new Error(
    `Could not parse ${name}()`,
  );
}

/*
 * v0.10.10.79:
 * A Hunter network drop is NEVER itself a Hider victory condition.
 * The authoritative Hunt deadline already decides the time victory.
 *
 * Remove the .78 30-second no-Hunter victory helper and turn any remaining
 * calls into a no-op return.
 */
if (
  s.includes(
    "private scheduleNoHunterGraceResolution",
  )
) {
  const range =
    methodRange(
      "scheduleNoHunterGraceResolution",
    );

  s =
    s.slice(
      0,
      range.start,
    ) +
    s.slice(
      range.end,
    );

  console.log(
    "[ok] removed 30-second no-Hunter victory helper",
  );
}

let removedCalls = 0;

s = s.replace(
  /this\.scheduleNoHunterGraceResolution\(\);\s*return;/g,
  () => {
    removedCalls += 1;
    return `/*
           * v0.10.10.79:
           * Temporary loss of all Hunters does not end the match.
           * Hunt's authoritative deadline remains the victory condition.
           */
          return;`;
  },
);

console.log(
  `[ok] neutralized ${removedCalls} no-Hunter disconnect victory branch(es)`,
);

/*
 * If a same-client fallback joins while the old 30-second allowReconnection()
 * reservation is still alive, onJoin() from .78 removes the old PlayerState
 * and restores role/alive/x/y to the new session.
 *
 * Incrementing this generation also invalidates every old no-Hunter timer
 * left from a previously deployed room implementation.
 */
if (
  !s.includes(
    "V101079_REPLACEMENT_CANCELS_DISCONNECT_OUTCOME",
  )
) {
  const marker =
    `          this.clientKeyBySessionId.delete(
            existingSessionId,
          );`;

  if (!s.includes(marker)) {
    throw new Error(
      "Could not find same-client replacement cleanup",
    );
  }

  s = s.replace(
    marker,
    marker +
      `

          /* V101079_REPLACEMENT_CANCELS_DISCONNECT_OUTCOME */
          this.noHunterGraceGeneration += 1;`,
  );

  console.log(
    "[ok] same-client replacement cancels disconnect outcome",
  );
}

/*
 * A restored fallback Hunter must be visible to all clients immediately,
 * even if Schema batching is delayed.
 */
if (
  !s.includes(
    "V101079_REJOIN_SNAPSHOT_PULSE",
  )
) {
  const marker = `    this.updateRoomMetadata();

    console.log(
      "[Chameleon Hunt] onJoin complete",`;

  if (!s.includes(marker)) {
    throw new Error(
      "Could not find onJoin metadata point",
    );
  }

  const replacement = `    this.updateRoomMetadata();

    /* V101079_REJOIN_SNAPSHOT_PULSE */
    if (
      this.state.phase !== "lobby"
    ) {
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
          serverNow:
            Date.now(),
        },
      );

      this.clock.setTimeout(
        () => {
          if (
            this.clients.includes(
              client,
            )
          ) {
            this.sendLobbySnapshot(
              client,
            );
          }
        },
        120,
      );
    }

    console.log(
      "[Chameleon Hunt] onJoin complete",`;

  s = s.replace(
    marker,
    replacement,
  );

  console.log(
    "[ok] fallback rejoin current-phase snapshot pulse",
  );
}

/*
 * Sanity:
 * there must be no remaining call capable of converting a network-only
 * Hunter disappearance into an arbitrary 30-second victory.
 */
if (
  s.includes(
    "scheduleNoHunterGraceResolution",
  )
) {
  throw new Error(
    "Verification failed: no-Hunter grace helper/call remains",
  );
}

for (
  const [needle, label] of
  [
    [
      "V101079_REPLACEMENT_CANCELS_DISCONNECT_OUTCOME",
      "replacement cancellation",
    ],
    [
      "V101079_REJOIN_SNAPSHOT_PULSE",
      "rejoin snapshot pulse",
    ],
    [
      "V101075_RECONNECT_30S",
      "active reconnect reservation",
    ],
    [
      "V101078_RESTORE_REJOIN_STATE",
      "role/state transfer",
    ],
  ]
) {
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
  "[done] v0.10.10.79 Hunter reconnect server fix applied",
);
console.log(
  "Next: npm run build",
);
