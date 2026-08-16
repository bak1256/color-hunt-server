const fs = require("fs");
const path = "src/rooms/MyRoom.ts";
let s = fs.readFileSync(path, "utf8");

function range(name) {
  const patterns = [
    `private ${name}`,
    `  ${name}(`,
    `  async ${name}(`,
  ];
  let start = -1;
  for (const p of patterns) {
    start = s.indexOf(p);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`Could not find ${name}()`);
  const brace = s.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < s.length; i += 1) {
    if (s[i] === "{") depth++;
    if (s[i] === "}") {
      depth--;
      if (depth === 0) return {start,end:i+1};
    }
  }
  throw new Error(`Could not parse ${name}()`);
}

/*
 * Critical v0.10.10.68:
 * phase_changed must contain serverNow from the SAME clock as phaseEndsAt.
 * Clients convert (phaseEndsAt - serverNow) to their local clock.
 */
{
  const r = range("broadcastPhaseChanged");
  let m = s.slice(r.start,r.end);

  if (!m.includes("serverNow:")) {
    const patterns = [
      "phaseEndsAt: this.state.phaseEndsAt,",
      "phaseEndsAt:\n          this.state.phaseEndsAt,",
      "phaseEndsAt:\n        this.state.phaseEndsAt,"
    ];
    let ok=false;
    for (const needle of patterns) {
      if (m.includes(needle)) {
        m=m.replace(needle,needle+"\n        serverNow: Date.now(),");
        ok=true; break;
      }
    }
    if (!ok) throw new Error("Could not add serverNow to phase_changed");
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log("[ok] phase_changed clock synchronization");
  } else {
    console.log("[skip] phase_changed already has serverNow");
  }
}

/*
 * Broadcast the authoritative phase again shortly after every real phase
 * transition. Room Schema remains authoritative; this duplicate notification
 * only reduces recovery latency on mobile/backgrounded browsers.
 */
for (const name of ["startPaintPhase","startHuntPhase"]) {
  const r=range(name);
  let m=s.slice(r.start,r.end);
  const tag=`V101068_REDUNDANT_${name}`;

  if (!m.includes(tag)) {
    const targets=[
      "    this.broadcastPhaseChanged();",
      "    this.updateRoomMetadata();"
    ];
    let idx=-1,target="";
    for (const t of targets) {
      idx=m.lastIndexOf(t);
      if(idx>=0){target=t;break;}
    }
    if(idx<0) throw new Error(`No phase broadcast point in ${name}`);

    const end=idx+target.length;
    const add=`
    /* ${tag} */
    this.clock.setTimeout(
      () => {
        if (
          this.state.phase ===
          "${name === "startPaintPhase" ? "paint" : "hunt"}"
        ) {
          this.broadcastPhaseChanged();
        }
      },
      180,
    );`;

    m=m.slice(0,end)+add+m.slice(end);
    s=s.slice(0,r.start)+m+s.slice(r.end);
    console.log(`[ok] redundant ${name} phase pulse`);
  } else {
    console.log(`[skip] ${name} redundant pulse already exists`);
  }
}

fs.writeFileSync(path,s,"utf8");
console.log("");
console.log("Done. v0.10.10.68 critical phase sync server patch applied.");
console.log("Next: npm run build");
