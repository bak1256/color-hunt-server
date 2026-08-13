const fs = require("fs");

const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

// Fix literal backslash-n accidentally written by the previous patch.
s = s.replace(
  "private paintDurationMs =\\n    120_000;",
  `private paintDurationMs =
    120_000;`
);

s = s.replace(
  "![\\n          90_000,\\n          120_000,\\n          150_000,\\n        ].includes(durationMs)",
  `![
          90_000,
          120_000,
          150_000,
        ].includes(durationMs)`
);

fs.writeFileSync(path, s, "utf8");

console.log("[ok] fixed literal \\\\n in paintDurationMs");
console.log("[ok] fixed literal \\\\n in duration whitelist");
console.log("Done. Run npm run build again.");
