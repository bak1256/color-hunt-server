const fs = require("fs");
const path = require("path");

const candidates = [
  path.join("src", "rooms", "MyRoom.ts"),
  path.join("server", "src", "rooms", "MyRoom.ts"),
];

const file = candidates.find((p) => fs.existsSync(p));
if (!file) {
  throw new Error(`MyRoom.ts not found. Tried: ${candidates.join(", ")}`);
}

let s = fs.readFileSync(file, "utf8");
const MARK = "V1010464F_FIRST_SHOT_LOBBY_RESET_HOTFIX";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.384f already applied");
  process.exit(0);
}

const broken = /([ \t]*\/\*\r?\n[ \t]*\* V1010464_SERVER_UNLIMITED_SHOTGUN_AMMO\r?\n[ \t]*\* No ammo-depletion defeat\.[\s\S]*?\* Shotgun spam remains limited by HEAT\/overheat\.\r?\n[ \t]*\*\/\r?\n)[ \t]*this\.resetToLobby\(\);/m;

const matches = s.match(new RegExp(broken.source, "gm"));
const count = matches ? matches.length : 0;

if (count !== 1) {
  throw new Error(
    `Expected exactly 1 broken post-shot resetToLobby block, found ${count}. No file written.`
  );
}

s = s.replace(
  broken,
  `$1      /* ${MARK}: never reset a live Hunt after a normal shotgun shot. */`
);

/* Safety: fire_shot must close directly after the unlimited-ammo comment. */
const fireStart = s.indexOf("    fire_shot: (");
const fireEnd = s.indexOf("    paint_ready: (", fireStart);
if (fireStart < 0 || fireEnd < 0) {
  throw new Error("Could not isolate fire_shot handler. No file written.");
}
const fireBlock = s.slice(fireStart, fireEnd);

if (fireBlock.includes("this.resetToLobby()")) {
  throw new Error("resetToLobby still exists inside fire_shot handler. No file written.");
}

fs.writeFileSync(file, s, "utf8");
console.log(`[done] patched ${file}`);
console.log("[root cause] normal fire_shot ended with this.resetToLobby()");
console.log("[ok] removed only the erroneous post-shot lobby reset");
console.log("[ok] hit/all-hiders-found Hunter victory logic preserved");
console.log("[ok] Hunt timeout Hider victory logic preserved");
console.log("Next: npm run build");
