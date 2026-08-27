const fs = require("fs");
const path = require("path");

const candidates = [
  path.join("src", "rooms", "MyRoom.ts"),
  path.join("server", "src", "rooms", "MyRoom.ts"),
];

const file = candidates.find((candidate) => fs.existsSync(candidate));
if (!file) throw new Error("Missing MyRoom.ts. Run from SERVER root.");

let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const MARK = "V1010386C_SERVER_SIMPLE_THREE_FART_CYCLE_CURRENT_SAFE";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.386c already applied");
  process.exit(0);
}

function replaceRegexOnce(label, regex, replacement) {
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g"
  );
  const matches = [...s.matchAll(globalRegex)];
  if (matches.length !== 1) {
    throw new Error(
      `${label}: expected exactly 1 match, found ${matches.length}. No file written.`
    );
  }
  s = s.replace(regex, replacement);
  console.log(`[ok] ${label}`);
}

/*
 * ${MARK}
 * New authoritative contract:
 * 1st fart -> GAS rises normally
 * 2nd fart -> GAS rises normally
 * 3rd fart -> poop, GAS immediately 0
 * 5s poop/debuff -> GAS stays 0
 * after 5s -> fresh 3-fart cycle
 */

/* Remove old permanent-lock guard. */
replaceRegexOnce(
  "remove permanent fart lock guard",
  /\n      \/\*\n       \* V1010302B_SERVER_FART_PROGRESSION_LOCK_RECOVER:[\s\S]*?\n      \}\n\n\n/,
  `
      /*
       * ${MARK}
       * No permanent fart lock. poopUntil is the only temporary lock.
       */


`
);

/* Replace escalation block, preserving the following poopUntilByHunter.set(...). */
replaceRegexOnce(
  "replace 3-2-1 accident escalation",
  /\n        const nextFartAccidentCount =[\s\S]*?\n        this\.poopUntilByHunter\.set\(/,
  `
        /*
         * ${MARK}
         * Third fart causes one accident, then reset immediately.
         */
        this.fartAccidentCountByHunter.set(
          client.sessionId,
          0,
        );

        this.fartLockedHunters.delete(
          client.sessionId,
        );

        this.fartGaugeByHunter.set(
          client.sessionId,
          0,
        );

        this.fartGaugeUpdatedAt.set(
          client.sessionId,
          now,
        );

        this.poopUntilByHunter.set(`
);

/* Neutralize legacy fields in poop_burst. */
replaceRegexOnce(
  "neutralize poop_burst escalation fields",
  /            accidentCount:\n              this\.fartAccidentCountByHunter\.get\(\n                client\.sessionId,\n              \) \?\? 0,\n            locked:\n              this\.fartLockedHunters\.has\(\n                client\.sessionId,\n              \),/,
  `            accidentCount: 0,
            locked: false,`
);

/* Every accident returns to zero. */
replaceRegexOnce(
  "force post-poop floor to zero",
  /  private getFartPostPoopFloor\(\n    sessionId: string,\n  \): number \{[\s\S]*?\n    return 0;\n  \}/,
  `  private getFartPostPoopFloor(
    _sessionId: string,
  ): number {
    /* ${MARK}: every accident returns to GAS 0. */
    return 0;
  }`
);

/* During the 5s debuff, hold zero instead of draining from 100. */
replaceRegexOnce(
  "pin GAS at zero during poop",
  /    if \(poopUntil > now\) \{[\s\S]*?      next =\n        floor \+[\s\S]*?          progress;\n    \} else \{/,
  `    if (poopUntil > now) {
      /*
       * ${MARK}: GAS is pinned to 0 for the full 5-second debuff.
       */
      next = 0;
    } else {`
);

/* Neutralize legacy fields in fart_state. */
replaceRegexOnce(
  "neutralize fart_state escalation fields",
  /      accidentCount:\n        this\.fartAccidentCountByHunter\.get\(\n          client\.sessionId,\n        \) \?\? 0,\n      locked:\n        this\.fartLockedHunters\.has\(\n          client\.sessionId,\n        \),/,
  `      accidentCount: 0,
      locked: false,`
);

for (const forbidden of [
  "const nextFartAccidentCount =",
  "nextFartAccidentCount === 1",
  "nextFartAccidentCount >= 3",
  "third accident permanently disables detector",
  "first  : 100 -> 36",
  "second : 100 -> 72",
  "third  : 100 -> 0 (locked)",
]) {
  if (s.includes(forbidden)) {
    throw new Error(`Old escalation code still remains: ${forbidden}. No file written.`);
  }
}

for (const required of [
  MARK,
  "this.fartGaugeByHunter.set(\n          client.sessionId,\n          0,",
  "next = 0;",
  "accidentCount: 0",
  "locked: false",
]) {
  if (!s.includes(required)) {
    throw new Error(`Verification failed: ${required}. No file written.`);
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.386c SERVER simple repeating 3-fart cycle");
console.log("[ok] fart #1/#2 build GAS normally");
console.log("[ok] fart #3 triggers poop and immediately sets GAS=0");
console.log("[ok] GAS stays 0 during the full 5s debuff");
console.log("[ok] after 5s the next cycle again requires 3 farts");
console.log("[ok] old 3->2->1 progression and permanent lock removed");
console.log("Next: npm run build");
