const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function findMethod(name) {
  const marker = `private ${name}`;
  const start = s.indexOf(marker);

  if (start < 0) {
    throw new Error(
      `Could not find ${name}() in ${path}`
    );
  }

  const brace = s.indexOf("{", start);

  if (brace < 0) {
    throw new Error(
      `Could not find opening brace for ${name}()`
    );
  }

  let depth = 0;
  let end = -1;

  for (let i = brace; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;

    if (s[i] === "}") {
      depth -= 1;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(
      `Could not parse ${name}()`
    );
  }

  return {
    start,
    brace,
    end,
    text: s.slice(start, end),
  };
}

function replaceMethod(name, transform) {
  const method = findMethod(name);
  const next = transform(method.text);

  if (next === method.text) {
    console.log(
      `[skip] ${name} guard already present`
    );
    return;
  }

  s =
    s.slice(0, method.start) +
    next +
    s.slice(method.end);

  console.log(
    `[ok] hardened ${name}`
  );
}

/*
 * Root safety rule:
 *
 * A delayed/stale timer is allowed to CALL the transition method,
 * but the transition method itself is the final authority.
 *
 * It must verify:
 *   1. We are still in the expected source phase.
 *   2. That source phase's authoritative phaseEndsAt has actually elapsed.
 *
 * Therefore an old callback, reconnect callback, duplicate timeout, or
 * accidentally early timer cannot advance the game.
 */
replaceMethod(
  "startPaintPhase",
  (method) => {
    if (
      method.includes(
        "PHASE_DEADLINE_GUARD_COUNTDOWN"
      )
    ) {
      return method;
    }

    const brace =
      method.indexOf("{");

    const guard = `
    /*
     * PHASE_DEADLINE_GUARD_COUNTDOWN
     *
     * Never enter Paint unless the authoritative Countdown really ended.
     * Stale callbacks from a previous round are ignored.
     */
    if (
      this.state.phase !==
      "countdown"
    ) {
      return;
    }

    const countdownRemainingMs =
      this.state.phaseEndsAt -
      Date.now();

    if (
      Number.isFinite(
        countdownRemainingMs,
      ) &&
      countdownRemainingMs > 25
    ) {
      this.clock.setTimeout(
        () => {
          this.startPaintPhase();
        },
        countdownRemainingMs,
      );

      return;
    }
`;

    return (
      method.slice(0, brace + 1) +
      guard +
      method.slice(brace + 1)
    );
  },
);

replaceMethod(
  "startHuntPhase",
  (method) => {
    if (
      method.includes(
        "PHASE_DEADLINE_GUARD_PAINT"
      )
    ) {
      return method;
    }

    const brace =
      method.indexOf("{");

    const guard = `
    /*
     * PHASE_DEADLINE_GUARD_PAINT
     *
     * This is the final authority for Paint -> Hunt.
     *
     * Even if an old/duplicate Colyseus timer fires early, Hunt can NEVER
     * begin while the server's authoritative Paint deadline is still in
     * the future.
     */
    if (
      this.state.phase !==
      "paint"
    ) {
      return;
    }

    const paintRemainingMs =
      this.state.phaseEndsAt -
      Date.now();

    if (
      Number.isFinite(
        paintRemainingMs,
      ) &&
      paintRemainingMs > 25
    ) {
      /*
       * Do not trust the early callback. Re-arm exactly for the remaining
       * authoritative duration. If several stale callbacks arrive, every
       * one of them hits this same guard; once the first valid transition
       * changes phase to Hunt, all later callbacks return above.
       */
      this.clock.setTimeout(
        () => {
          this.startHuntPhase();
        },
        paintRemainingMs,
      );

      return;
    }

    /*
     * Corrupted/empty deadlines are also unsafe. Paint may only finish from
     * a real deadline set by the current Paint phase.
     */
    if (
      !Number.isFinite(
        this.state.phaseEndsAt,
      ) ||
      this.state.phaseEndsAt <= 0
    ) {
      console.warn(
        "[Color Hunt] blocked Hunt transition: invalid Paint deadline",
        {
          phase:
            this.state.phase,
          phaseEndsAt:
            this.state.phaseEndsAt,
        },
      );

      return;
    }
`;

    return (
      method.slice(0, brace + 1) +
      guard +
      method.slice(brace + 1)
    );
  },
);

/*
 * Also harden Hunt -> Finished if a method with this conventional name
 * exists. We do NOT fail the patch when the project uses a different
 * finish-game path.
 */
if (
  s.includes(
    "private finishGame"
  )
) {
  console.log(
    "[info] finishGame exists; winner flow left authoritative and unchanged"
  );
}

/*
 * Diagnostic breadcrumb:
 * when startHuntPhase legitimately executes, log the actual deadline delta.
 * This makes any future report distinguish a real early transition from a
 * UI countdown display problem.
 */
{
  const method = findMethod(
    "startHuntPhase"
  );

  if (
    !method.text.includes(
      "[Color Hunt] Paint deadline reached"
    )
  ) {
    const guardEndMarker =
      `    if (
      !Number.isFinite(
        this.state.phaseEndsAt,
      ) ||
      this.state.phaseEndsAt <= 0
    ) {`;

    const localIndex =
      method.text.indexOf(
        guardEndMarker
      );

    /*
     * Easier and safer: insert the diagnostic immediately before the first
     * actual phase mutation if recognizable.
     */
    const candidates = [
      `    this.state.phase =
      "hunt";`,
      `    this.state.phase = "hunt";`,
    ];

    let inserted = false;
    let nextMethod =
      method.text;

    for (
      const target of candidates
    ) {
      const idx =
        nextMethod.indexOf(
          target
        );

      if (idx >= 0) {
        const log = `    console.log(
      "[Color Hunt] Paint deadline reached -> Hunt",
      {
        now: Date.now(),
        phaseEndsAt:
          this.state.phaseEndsAt,
        lateByMs:
          Date.now() -
          this.state.phaseEndsAt,
      },
    );

`;

        nextMethod =
          nextMethod.slice(0, idx) +
          log +
          nextMethod.slice(idx);

        inserted = true;
        break;
      }
    }

    if (inserted) {
      s =
        s.slice(0, method.start) +
        nextMethod +
        s.slice(method.end);

      console.log(
        "[ok] Hunt transition diagnostic log"
      );
    } else {
      console.log(
        "[info] phase mutation pattern not recognized; deadline guard still installed"
      );
    }
  } else {
    console.log(
      "[skip] Hunt diagnostic already present"
    );
  }
}

/*
 * Safety verification before writing.
 */
const finalHunt =
  findMethod(
    "startHuntPhase"
  ).text;

const finalPaint =
  findMethod(
    "startPaintPhase"
  ).text;

if (
  !finalHunt.includes(
    "PHASE_DEADLINE_GUARD_PAINT"
  ) ||
  !finalHunt.includes(
    `this.state.phase !==
      "paint"`
  )
) {
  throw new Error(
    "Safety verification failed for startHuntPhase"
  );
}

if (
  !finalPaint.includes(
    "PHASE_DEADLINE_GUARD_COUNTDOWN"
  )
) {
  throw new Error(
    "Safety verification failed for startPaintPhase"
  );
}

fs.writeFileSync(
  path,
  s,
  "utf8",
);

console.log("");
console.log(
  "Done. v0.10.10.66 phase deadline safety patch applied."
);
console.log(
  "Paint -> Hunt cannot occur before authoritative phaseEndsAt."
);
console.log(
  "Countdown -> Paint is protected by the same rule."
);
console.log(
  "Next: npm run build"
);
