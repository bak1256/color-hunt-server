const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

if (!fs.existsSync(file)) {
  throw new Error(
    `MyRoom.ts not found: ${file}\nRun this from color-hunt-server root.`
  );
}

let s = fs.readFileSync(file, "utf8");

const MARKER =
  "V1010182_MULTIPLAYER_AMMO_DEPLETION_FINISH";

if (s.includes(MARKER)) {
  console.log("[skip] v0.10.10.182 already applied");
  process.exit(0);
}

const ammoConditionAt =
  s.indexOf(
    "this.allHuntersOutOfAmmo()"
  );

if (ammoConditionAt < 0) {
  throw new Error(
    "[fail] allHuntersOutOfAmmo() condition not found"
  );
}

/*
 * Scope ourselves to the fire_shot handler: find the nearest block after the
 * allHuntersOutOfAmmo() condition and before paint_stroke.
 */
const paintStrokeAt =
  s.indexOf(
    "paint_stroke:",
    ammoConditionAt,
  );

if (paintStrokeAt < 0) {
  throw new Error(
    "[fail] could not locate end of fire_shot handler"
  );
}

const region =
  s.slice(
    ammoConditionAt,
    paintStrokeAt,
  );

if (
  region.includes(
    'this.finishGame('
  ) &&
  region.includes(
    '"ammo_depleted"'
  )
) {
  /*
   * The current source already contains the intended call. Add a marker only
   * so future runs are idempotent; do not duplicate game-ending logic.
   */
  const conditionLine =
    "this.allHuntersOutOfAmmo()";

  s = s.replace(
    conditionLine,
    `/* ${MARKER} */\n        ${conditionLine}`,
  );

  fs.writeFileSync(
    file,
    s,
    "utf8",
  );

  console.log(
    "[ok] multiplayer ammo-depletion finishGame already existed; marker added"
  );
  console.log(
    "Next: npm run build"
  );
  process.exit(0);
}

/*
 * This is the v0.10.10.71-style broken block:
 *
 *   if (aliveHidersAfterShot > 0 && this.allHuntersOutOfAmmo()) {
 *     this.broadcast("hunters_out_of_ammo", ...);
 *   }
 *
 * Insert the authoritative finish immediately after the broadcast inside the
 * SAME condition. This preserves the crucial ordering:
 * 1. pellets resolve
 * 2. last Hider killed? Hunters win
 * 3. otherwise all Hunters out of shells? Hiders win
 */
const blockStart =
  s.lastIndexOf(
    "      if (",
    ammoConditionAt,
  );

if (blockStart < 0) {
  throw new Error(
    "[fail] could not locate ammo depletion if-block"
  );
}

let depth = 0;
let braceAt =
  s.indexOf(
    "{",
    blockStart,
  );

if (braceAt < 0) {
  throw new Error(
    "[fail] ammo if opening brace not found"
  );
}

let blockEnd = -1;

for (
  let i = braceAt;
  i < paintStrokeAt;
  i += 1
) {
  if (s[i] === "{") {
    depth += 1;
  } else if (s[i] === "}") {
    depth -= 1;

    if (depth === 0) {
      blockEnd =
        i + 1;
      break;
    }
  }
}

if (blockEnd < 0) {
  throw new Error(
    "[fail] could not parse ammo depletion if-block"
  );
}

const oldBlock =
  s.slice(
    blockStart,
    blockEnd,
  );

if (
  !oldBlock.includes(
    "hunters_out_of_ammo"
  )
) {
  throw new Error(
    "[fail] located condition does not contain hunters_out_of_ammo broadcast"
  );
}

const closingBrace =
  oldBlock.lastIndexOf(
    "}"
  );

const insert = `
        /*
         * ${MARKER}
         *
         * Multiplayer rule: if at least one Hider survives after the shot and
         * every living Hunter has 0 reserve, the round is over immediately.
         * finishGame() owns phase=finished, round_result, phase_changed and
         * the normal timed resetToLobby() path.
         */
        this.finishGame(
          "hiders",
          "ammo_depleted",
        );
        return;
`;

const newBlock =
  oldBlock.slice(
    0,
    closingBrace,
  ) +
  insert +
  oldBlock.slice(
    closingBrace,
  );

s =
  s.slice(
    0,
    blockStart,
  ) +
  newBlock +
  s.slice(
    blockEnd,
  );

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] multiplayer ammo depletion now calls finishGame(hiders, ammo_depleted)"
);
console.log(
  "[ok] final-shot Hunter victory ordering preserved"
);
console.log(
  "[ok] normal finishGame -> result -> resetToLobby flow preserved"
);
console.log(
  "Next: npm run build"
);
