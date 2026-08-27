const fs=require("fs");
const path=require("path");
const FILE=path.resolve("src/rooms/MyRoom.ts");
let s=fs.readFileSync(FILE,"utf8");
const mark="V1010452_SKILL_SYSTEM_FOUNDATION";
if(s.includes(mark)){console.log("[v452 server] already applied");process.exit(0);}
const must=(x,n)=>{if(!s.includes(x))throw new Error("anchor missing: "+n);};

must('type FartUseMessage = {','type anchor');
s=s.replace('type FartUseMessage = {\n  pressedAt?: number;\n};',
`type FartUseMessage = {
  pressedAt?: number;
};

type PlayerSkillId =
  | "paintball"
  | "laser";

type SkillSelectMessage = {
  skillId?: PlayerSkillId;
};`);

must('private readonly paintReadySessionIds =','field anchor');
s=s.replace('  private readonly paintReadySessionIds =\n    new Set<string>();',
`  private readonly paintReadySessionIds =
    new Set<string>();

  /*
   * ${mark}
   * Skill ownership follows stable clientKey so reconnect/session handoff
   * keeps the same selection. Only the owner receives its selection packet.
   */
  private readonly selectedSkillByClientKey =
    new Map<string, PlayerSkillId>();`);

must('    request_paint_ready_state: (','message anchor');
s=s.replace('    request_paint_ready_state: (',
`    skill_select: (
      client: Client,
      message: SkillSelectMessage,
    ): void => {
      if (this.state.phase !== "paint") return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const skillId = message?.skillId;
      if (skillId !== "paintball" && skillId !== "laser") return;

      /*
       * First test rollout: Hider can select these two skills.
       * The storage/API is role-neutral so Hunter skills can reuse it later.
       */
      if (player.role !== "hider") return;

      const clientKey =
        this.clientKeyBySessionId.get(client.sessionId) ??
        client.sessionId;

      this.selectedSkillByClientKey.set(clientKey, skillId);

      client.send("skill_state", { skillId });
    },

    request_skill_state: (
      client: Client,
    ): void => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const clientKey =
        this.clientKeyBySessionId.get(client.sessionId) ??
        client.sessionId;

      client.send("skill_state", {
        skillId:
          this.selectedSkillByClientKey.get(clientKey) ??
          "paintball",
      });
    },

    request_paint_ready_state: (`);

s=`/* ${mark}: role-neutral skill selection foundation; first Hider skills paintball/laser. */\n`+s;
fs.mkdirSync(".patch-backups",{recursive:true});
fs.writeFileSync(".patch-backups/MyRoom-before-v452-skill.ts",fs.readFileSync(FILE,"utf8"));
fs.writeFileSync(FILE,s);
console.log("[v452 server] SUCCESS");
console.log("Next: npm run build");
