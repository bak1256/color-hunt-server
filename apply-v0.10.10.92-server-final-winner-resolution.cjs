const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

if (
  s.includes(
    "V101092_FINAL_WINNER_RESOLUTION",
  )
) {
  console.log(
    "[skip] v0.10.10.92 final winner resolution already installed",
  );
  process.exit(0);
}

const marker =
  "/* V101091_FINISH_GAME_IDEMPOTENT */";

const markerAt =
  s.indexOf(marker);

if (markerAt < 0) {
  throw new Error(
    "Expected v0.10.10.91 finishGame guard before .92",
  );
}

/*
 * Find the finishGame method containing the .91 guard.
 */
const methodStart =
  s.lastIndexOf(
    "  private finishGame(",
    markerAt,
  );

if (methodStart < 0) {
  throw new Error(
    "Could not locate finishGame()",
  );
}

const brace =
  s.indexOf(
    "{",
    methodStart,
  );

if (brace < 0) {
  throw new Error(
    "Could not parse finishGame()",
  );
}

/*
 * Determine the winner argument identifier from the method signature.
 * Expected forms include:
 *   finishGame(winner: "hunters" | "hiders")
 */
const signature =
  s.slice(
    methodStart,
    brace,
  );

const match =
  signature.match(
    /finishGame\s*\(\s*([A-Za-z_$][\w$]*)/,
  );

if (!match) {
  throw new Error(
    "Could not determine finishGame winner parameter",
  );
}

const winnerVar =
  match[1];

/*
 * Insert BEFORE the .91 idempotency guard.
 *
 * Critical rule:
 * - 0 alive Hiders => Hunters win, always.
 * - Otherwise keep the requested winner.
 *
 * Also, if an old stale callback already marked hiders but all Hiders have
 * since been eliminated in the same finishing race, allow correction to
 * hunters instead of returning from the .91 guard.
 */
const insertAt =
  s.indexOf(
    marker,
    brace,
  );

const resolution = `/* V101092_FINAL_WINNER_RESOLUTION */
    const finalAliveHiderCount =
      [...this.state.players.values()]
        .filter(
          (player) =>
            player.role === "hider" &&
            player.alive,
        )
        .length;

    if (
      finalAliveHiderCount === 0
    ) {
      ${winnerVar} = "hunters";
    }

    /*
     * If a stale callback tentatively finished as Hiders while the last
     * Hider was eliminated in the same race, correct the stored result.
     */
    if (
      this.state.phase === "finished" &&
      this.state.winner === "hiders" &&
      finalAliveHiderCount === 0
    ) {
      this.state.winner =
        "hunters";

      this.broadcast(
        "round_result",
        {
          winner:
            "hunters",
        },
      );

      return;
    }

    `;

s =
  s.slice(0, insertAt) +
  resolution +
  s.slice(insertAt);

/*
 * The winner parameter may be declared as a normal parameter and therefore
 * assignable. If it was declared readonly by an unusual syntax, TypeScript
 * build will reveal it; normal TS parameters are mutable.
 */
if (
  !s.includes(
    "V101092_FINAL_WINNER_RESOLUTION",
  )
) {
  throw new Error(
    "Verification failed: final winner resolution",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] zero surviving Hiders always resolves to Hunter victory",
);
console.log(
  "[ok] stale Hider result can be corrected during the final elimination race",
);
console.log(
  "[done] v0.10.10.92 final winner resolution applied",
);
console.log(
  "Next: npm run build",
);
