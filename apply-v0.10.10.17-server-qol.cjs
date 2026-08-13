const fs = require("fs");
const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

s = s.replace(
  /private paintDurationMs\s*=\s*60_000;/,
  "private paintDurationMs =\\n    120_000;"
);

s = s.replace(
  /\[\s*45_000,\s*60_000,\s*90_000,\s*\]\.includes\(durationMs\)/m,
  "[\\n          90_000,\\n          120_000,\\n          150_000,\\n        ].includes(durationMs)"
);

// Remove map12 from common server-side allowed map declarations.
s = s.replace(/,\s*"map12"/g, "");
s = s.replace(/"map12",?\s*/g, "");

fs.writeFileSync(path, s, "utf8");
console.log("[ok] paint choices: 90 / 120 / 150 seconds");
console.log("[ok] default paint time: 120 seconds");
console.log("[ok] map12 removed from server map whitelist if present");
