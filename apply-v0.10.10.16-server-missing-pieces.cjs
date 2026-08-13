const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) {
    console.log(`[skip] ${label} already applied`);
    return;
  }

  if (!s.includes(oldText)) {
    throw new Error(`Could not find source for: ${label}`);
  }

  s = s.replace(oldText, newText);
  console.log(`[ok] ${label}`);
}

// 1) Add message type.
replaceOnce(
`type SelectMapMessage = {
  map?: string;
};
`,
`type SelectMapMessage = {
  map?: string;
};

type SelectPaintDurationMessage = {
  durationMs?: number;
};
`,
"SelectPaintDurationMessage type"
);

// 2) Make paint duration mutable and default to 60 seconds.
replaceOnce(
`  private readonly paintDurationMs =
    45_000;
`,
`  private paintDurationMs =
    60_000;
`,
"paintDurationMs mutable + default 60s"
);

// Also support a source that already has 60_000 but is still readonly.
if (
  s.includes(
`  private readonly paintDurationMs =
    60_000;
`
  )
) {
  s = s.replace(
`  private readonly paintDurationMs =
    60_000;
`,
`  private paintDurationMs =
    60_000;
`
  );
  console.log("[ok] removed readonly from existing 60s paintDurationMs");
}

// 3) Expose selected paint duration in lobby snapshots.
replaceOnce(
`        activeMap:
          this.state.activeMap,
        players:
`,
`        activeMap:
          this.state.activeMap,
        paintDurationMs:
          this.paintDurationMs,
        players:
`,
"paintDurationMs in lobby snapshot"
);

fs.writeFileSync(path, s, "utf8");

console.log("\\nDone. Missing v0.10.10.16 server pieces are now applied.");
