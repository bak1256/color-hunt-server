const fs = require("fs");
const path = require("path");

const file = path.join("src", "rooms", "MyRoom.ts");
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from SERVER root.`);

let s = fs.readFileSync(file, "utf8");
const MARK = "V1010386_SERVER_SIMPLE_THREE_FART_CYCLE";
if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.386 server already applied");
  process.exit(0);
}

function replaceOnce(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 anchor, found ${n}. No file written.`);
  s = s.replace(from, to);
}

/*
 * New contract:
 * 0 -> 36 -> 72 -> third fart triggers poop
 * poop begins with GAS 0 and GAS stays 0 for the full 5s debuff
 * after 5s: unlocked, still GAS 0, next cycle is again three farts
 *
 * Keep legacy accidentCount/locked fields in packets as compatibility fields,
 * but they are always 0/false.
 */

replaceOnce(
  "legacy lock guard",
`      /*
       * V1010302B_SERVER_FART_PROGRESSION_LOCK_RECOVER: third accident permanently disables detector this round.
       */
      if (
        this.fartLockedHunters.has(
          client.sessionId,
        )
      ) {
        this.sendFartState(
          client,
          now,
        );
        return;
      }


`,
`      /*
       * ${MARK}
       * No permanent 3 -> 2 -> 1 escalation/lock.
       * Every completed accident resets to a fresh 3-fart cycle.
       */


`
);

replaceOnce(
  "poop escalation block",
`        const nextFartAccidentCount =
          Math.min(
            3,
            (
              this.fartAccidentCountByHunter.get(
                client.sessionId,
              ) ?? 0
            ) + 1,
          );

        this.fartAccidentCountByHunter.set(
          client.sessionId,
          nextFartAccidentCount,
        );


      const postAccidentGasFloor =
        nextFartAccidentCount === 1
          ? 36
          : nextFartAccidentCount === 2
            ? 72
            : 100;

if (
          nextFartAccidentCount >= 3
        ) {
          this.fartLockedHunters.add(
            client.sessionId,
          );

          /* V1010306_THIRD_ACCIDENT_MAX_COMMIT */
          this.fartGaugeByHunter.set(
            client.sessionId,
            100,
          );

          this.fartGaugeUpdatedAt.set(
            client.sessionId,
            now,
          );
        }

`,
`        /*
         * ${MARK}
         * Third fart = accident, then immediately reset GAS to 0.
         * The poopUntil guard blocks further use for the full 5 seconds.
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

`
);

replaceOnce(
  "post poop floor function",
`  private getFartPostPoopFloor(
    sessionId: string,
  ): number {
    if (
      this.fartLockedHunters.has(
        sessionId,
      )
    ) {
      /*
       * V1010306_SERVER_GAS_THIRD_STAYS_MAX: third accident is MAX forever for this round.
       */
      return 100;
    }

    const accidents =
      this.fartAccidentCountByHunter.get(
        sessionId,
      ) ?? 0;

    if (accidents >= 2) {
      return 72;
    }

    if (accidents === 1) {
      return 36;
    }

    return 0;
  }
`,
`  private getFartPostPoopFloor(
    _sessionId: string,
  ): number {
    /* ${MARK}: every accident returns to GAS 0. */
    return 0;
  }
`
);

replaceOnce(
  "poop gauge calculation",
`    if (poopUntil > now) {
      const remainingMs =
        Math.max(
          0,
          poopUntil - now,
        );

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            remainingMs /
              this.poopDurationMs,
          ),
        );

      /*
       * Accident animation:
       * first  : 100 -> 36
       * second : 100 -> 72
       * third  : 100 -> 0 (locked)
       */
      next =
        floor +
        (
          100 -
          floor
        ) *
          progress;
    } else {
`,
`    if (poopUntil > now) {
      /*
       * ${MARK}: GAS is visibly pinned at 0 for the whole 5s punishment.
       */
      next = 0;
    } else {
`
);

replaceOnce(
  "packet compatibility state",
`      accidentCount:
        this.fartAccidentCountByHunter.get(
          client.sessionId,
        ) ?? 0,
      locked:
        this.fartLockedHunters.has(
          client.sessionId,
        ),
`,
`      /* ${MARK}: compatibility fields; escalation was removed. */
      accidentCount: 0,
      locked: false,
`
);

/* poop_burst has the same compatibility pair, replace its remaining copy. */
const oldBurst =
`            accidentCount:
              this.fartAccidentCountByHunter.get(
                client.sessionId,
              ) ?? 0,
            locked:
              this.fartLockedHunters.has(
                client.sessionId,
              ),
`;
const burstCount = s.split(oldBurst).length - 1;
if (burstCount !== 1) throw new Error(`poop_burst compatibility: expected 1, found ${burstCount}. No file written.`);
s = s.replace(oldBurst,
`            accidentCount: 0,
            locked: false,
`);

fs.writeFileSync(file, s, "utf8");
console.log("[done] v0.10.10.386 SERVER simple 3-fart cycle");
console.log("[ok] fart 1 -> GAS ~36");
console.log("[ok] fart 2 -> GAS ~72");
console.log("[ok] fart 3 -> poop + GAS immediately 0");
console.log("[ok] 5s poop/debuff blocks fart use");
console.log("[ok] after 5s: fresh 3-fart cycle, no 3->2->1 escalation");
console.log("Next: npm run build");
