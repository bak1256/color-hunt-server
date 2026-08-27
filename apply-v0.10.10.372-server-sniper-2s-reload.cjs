const fs = require("fs");
const path = require("path");

const file = path.join("src", "rooms", "MyRoom.ts");
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from SERVER root.`);

let s = fs.readFileSync(file, "utf8");
const MARK = "V1010453E_SNIPER_2S_RELOAD";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.372 server already applied");
  process.exit(0);
}

const candidates = [
  "  private readonly sniperReloadMs = 3_000;",
  "  private readonly sniperReloadMs = 3000;",
];

let replaced = false;
for (const oldText of candidates) {
  if (s.includes(oldText)) {
    s = s.replace(
      oldText,
      `  /* ${MARK} */\n  private readonly sniperReloadMs = 2_000;`
    );
    replaced = true;
    break;
  }
}

if (!replaced) {
  throw new Error("Could not find the 3s sniperReloadMs field. No file written.");
}

if (!s.includes("private readonly sniperReloadMs = 2_000;")) {
  throw new Error("2s server reload verification failed.");
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.372 SERVER");
console.log("[ok] authoritative sniper reload = 2.0s");
console.log("Next: npm run build");
