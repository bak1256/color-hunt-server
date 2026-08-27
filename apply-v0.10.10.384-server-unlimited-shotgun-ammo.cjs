const fs = require("fs");
const path = require("path");

const candidates = [
  path.join("src", "rooms", "MyRoom.ts"),
  path.join("server", "src", "rooms", "MyRoom.ts"),
];

const file = candidates.find((p) => fs.existsSync(p));
if (!file) throw new Error("Missing MyRoom.ts. Run from SERVER root.");

let s = fs.readFileSync(file, "utf8");
const MARK = "V1010464_SERVER_UNLIMITED_SHOTGUN_AMMO";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.384 server already applied");
  process.exit(0);
}

function regexOnce(re, replacement, label) {
  const m = s.match(re);
  if (!m || m.length !== 1) {
    throw new Error(`${label}: expected 1 match, found ${m ? m.length : 0}. No file written.`);
  }
  s = s.replace(re, replacement);
}

/* Reserve=0 no longer blocks shooting. */
regexOnce(
/      if \(\s*hunterStats\.reserve <= 0\s*\) \{\s*this\.sendWeaponState\([\s\S]*?        return;\s*      \}\s*/m,
`      /*
       * ${MARK}
       * Shotgun reserve is temporarily unlimited. HEAT alone gates fire rate.
       */
`,
"server reserve gate"
);

/* Do not decrement reserve. */
regexOnce(
/      hunterStats\.reserve -= 1;\s*/m,
`      /* ${MARK}: reserve intentionally stays constant. */
`,
"server reserve decrement"
);

/* Precision reward no longer depends on remaining shells. */
regexOnce(
/      const precisionReward =\s*hitIds\.size > 0\s*\?\s*hitIds\.size \*\s*\(\s*100 \+\s*hunterStats\.reserve \*\s*25\s*\)\s*:\s*0;/m,
`      const precisionReward =
        hitIds.size > 0
          ? hitIds.size * 100
          : 0;`,
"precision reward reserve dependency"
);

/* Remove ammo-depletion broadcast + Hider finish path entirely. */
regexOnce(
/      \/\*\s*\n       \* 살아 있는 Hider가 남아 있고,[\s\S]*?        return;\s*      \}\s*/m,
`      /*
       * ${MARK}
       * No ammo-depletion defeat. Hunt now ends only by:
       * - all Hiders found -> Hunters
       * - Hunt timer expiry -> Hiders
       * Shotgun spam remains limited by HEAT/overheat.
       */
`,
"server ammo depletion victory block"
);

/* Remove now-unused reserve aggregation helpers. */
regexOnce(
/  private getTotalHunterReserve\(\): number \{[\s\S]*?\n  \}\n\n  private allHuntersOutOfAmmo\(\): boolean \{[\s\S]*?\n  \}\n\n/m,
"",
"unused ammo helper methods"
);

[
  MARK,
  "reserve intentionally stays constant",
  "hitIds.size * 100",
  "No ammo-depletion defeat",
].forEach((needle) => {
  if (!s.includes(needle)) throw new Error(`verification failed: ${needle}. No file written.`);
});

if (/hunterStats\.reserve\s*-=\s*1/.test(s)) {
  throw new Error("reserve decrement still exists. No file written.");
}
if (/allHuntersOutOfAmmo\(/.test(s)) {
  throw new Error("allHuntersOutOfAmmo still exists. No file written.");
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.384 SERVER");
console.log("[ok] reserve no longer blocks/decrements shotgun fire");
console.log("[ok] ammo-depletion Hider victory removed");
console.log("[ok] precision reward no longer depends on shell count");
console.log("[ok] HEAT/overheat remains authoritative");
console.log("Next: npm run build");
