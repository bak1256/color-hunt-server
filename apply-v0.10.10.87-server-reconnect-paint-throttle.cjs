const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(file, "utf8");

function patchMarkerArray(
  marker,
  expectedArrays,
  replacementArray,
  label,
) {
  const at = s.indexOf(marker);

  if (at < 0) {
    console.log(
      `[skip] ${label}: marker not present`,
    );
    return;
  }

  const windowEnd =
    Math.min(
      s.length,
      at + 7000,
    );

  let block =
    s.slice(
      at,
      windowEnd,
    );

  let changed = false;

  for (
    const expected of
    expectedArrays
  ) {
    if (block.includes(expected)) {
      block =
        block.replace(
          expected,
          replacementArray,
        );
      changed = true;
      break;
    }
  }

  if (changed) {
    s =
      s.slice(0, at) +
      block +
      s.slice(windowEnd);

    console.log(
      `[ok] ${label}`,
    );
  } else {
    console.log(
      `[skip] ${label}: array already changed or not found`,
    );
  }
}

/*
 * v0.10.10.87:
 * Previous hotfixes independently added full round_paint_state broadcasts.
 * On mobile reconnect these could overlap and force massive repeated
 * RenderTexture reconstruction.
 *
 * Keep ONE delayed authoritative replay after the replacement actor is
 * expected to exist everywhere.
 */
patchMarkerArray(
  "V101086_GLOBAL_PAINT_SESSION_REMAP",
  [
    "[180, 520, 1100]",
    "[180,520,1100]",
  ],
  "[650]",
  "throttle .86 global paint replay",
);

patchMarkerArray(
  "V101085_REJOIN_FULL_STATE_PULSE",
  [
    "[120, 420, 900]",
    "[120,420,900]",
  ],
  "[650]",
  "throttle .85 full-state replay",
);

patchMarkerArray(
  "V101084_REJOIN_PAINT_BROADCAST",
  [
    "[80, 220, 650]",
    "[80,220,650]",
  ],
  "[650]",
  "throttle .84 reconnect paint replay",
);

/*
 * Add one final authoritative paint replay helper point if .86 exists.
 * The .86 block already remaps every stale sessionId before this fires.
 */
if (
  !s.includes(
    "V101087_RECONNECT_PAINT_THROTTLED",
  )
) {
  const marker =
    "/* V101086_GLOBAL_PAINT_SESSION_REMAP */";

  const at =
    s.indexOf(marker);

  if (at < 0) {
    throw new Error(
      "Expected v0.10.10.86 global paint remap before .87",
    );
  }

  /*
   * Marker-only flag. The actual .86 replay is now throttled to one pulse.
   */
  s =
    s.slice(0, at) +
    `/* V101087_RECONNECT_PAINT_THROTTLED */
          ` +
    s.slice(at);

  console.log(
    "[ok] reconnect paint throttle marker",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log("");
console.log(
  "[done] v0.10.10.87 reconnect paint traffic throttled",
);
console.log(
  "Next: npm run build",
);
