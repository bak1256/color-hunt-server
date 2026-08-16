const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'rooms', 'MyRoom.ts');
let s = fs.readFileSync(file, 'utf8');

function methodRange(name) {
  const marker = `  private ${name}`;
  const start = s.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${name}()`);
  const brace = s.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < s.length; i += 1) {
    if (s[i] === '{') depth += 1;
    if (s[i] === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Could not parse ${name}()`);
}

// 1) Replace READY handler so ready:false actually cancels READY.
{
  const start = s.indexOf('    paint_ready: (');
  const end = s.indexOf('    request_paint_ready_state:', start);
  if (start < 0 || end < 0) throw new Error('Could not find paint_ready handler');
  const current = s.slice(start, end);
  if (!current.includes('message?.ready === false')) {
    const next = `    paint_ready: (\n      client: Client,\n      message: { ready?: boolean },\n    ): void => {\n      if (this.state.phase !== "paint") {\n        return;\n      }\n\n      const player =\n        this.state.players.get(\n          client.sessionId,\n        );\n\n      if (\n        !player ||\n        player.role !== "hider" ||\n        !player.alive\n      ) {\n        return;\n      }\n\n      if (message?.ready === false) {\n        this.paintReadySessionIds.delete(\n          client.sessionId,\n        );\n      } else {\n        this.paintReadySessionIds.add(\n          client.sessionId,\n        );\n      }\n\n      this.broadcastPaintReadyState();\n    },\n\n`;
    s = s.slice(0, start) + next + s.slice(end);
    console.log('[ok] READY true/false handler');
  } else {
    console.log('[skip] READY true/false handler already fixed');
  }
}

// 2) Add Hunter early-start handler if missing.
if (!s.includes('    early_start_hunt: (')) {
  const marker = '    request_paint_ready_state: (';
  const start = s.indexOf(marker);
  if (start < 0) throw new Error('Could not find request_paint_ready_state');
  // insert before request handler: order does not matter.
  const add = `    early_start_hunt: (\n      client: Client,\n    ): void => {\n      if (this.state.phase !== "paint") {\n        return;\n      }\n\n      const requester =\n        this.state.players.get(\n          client.sessionId,\n        );\n\n      if (\n        !requester ||\n        requester.role !== "hunter" ||\n        !requester.alive\n      ) {\n        return;\n      }\n\n      const readyState =\n        this.getPaintReadyState();\n\n      if (\n        readyState.total < 1 ||\n        readyState.ready !== readyState.total\n      ) {\n        return;\n      }\n\n      this.state.phaseEndsAt = Date.now();\n      this.startHuntPhase();\n    },\n\n`;
  s = s.slice(0, start) + add + s.slice(start);
  console.log('[ok] Hunter early-start READY handler');
} else {
  console.log('[skip] early-start handler already exists');
}

// 3) Make READY payload backward/forward compatible with both client schemas.
{
  const r = methodRange('getPaintReadyState');
  let m = s.slice(r.start, r.end);
  if (!m.includes('readyCount:')) {
    m = m.replace(
      `    return {\n      ready: readySessionIds.length,\n      total: activeHiderIds.length,\n      readySessionIds,\n    };`,
      `    const ready = readySessionIds.length;\n    const total = activeHiderIds.length;\n\n    return {\n      ready,\n      total,\n      readyCount: ready,\n      hiderCount: total,\n      allHidersReady:\n        total > 0 && ready === total,\n      readySessionIds,\n    };`,
    );
    // Expand explicit return type when present.
    m = m.replace(
      `  private getPaintReadyState(): {\n    ready: number;\n    total: number;\n    readySessionIds: string[];\n  } {`,
      `  private getPaintReadyState(): {\n    ready: number;\n    total: number;\n    readyCount: number;\n    hiderCount: number;\n    allHidersReady: boolean;\n    readySessionIds: string[];\n  } {`,
    );
    if (!m.includes('readyCount:')) throw new Error('Could not expand READY payload');
    s = s.slice(0, r.start) + m + s.slice(r.end);
    console.log('[ok] READY payload compatibility fields');
  } else {
    console.log('[skip] READY payload compatibility already present');
  }
}

// 4) Reconnect must resend phase with server clock + READY state.
{
  const start = s.indexOf('  onReconnect(');
  const end = s.indexOf('\n  onLeave(', start);
  if (start < 0 || end < 0) throw new Error('Could not find onReconnect()');
  let m = s.slice(start, end);
  if (!m.includes('serverNow: Date.now()')) {
    const needle = `        phaseEndsAt:\n          this.state.phaseEndsAt,`;
    if (!m.includes(needle)) throw new Error('Could not add serverNow in onReconnect');
    m = m.replace(needle, needle + `\n        serverNow: Date.now(),`);
    console.log('[ok] reconnect server clock sync');
  }
  if (!m.includes('V101069C_READY_RECONNECT')) {
    const last = m.lastIndexOf('\n  }');
    if (last < 0) throw new Error('Could not patch onReconnect READY resend');
    const add = `\n\n    /* V101069C_READY_RECONNECT */\n    if (this.state.phase === "paint") {\n      this.sendPaintReadyState(client);\n    }`;
    m = m.slice(0, last) + add + m.slice(last);
    console.log('[ok] reconnect READY resend');
  }
  s = s.slice(0, start) + m + s.slice(end);
}

fs.writeFileSync(file, s, 'utf8');
console.log('[done] v0.10.10.69c READY compatibility/reconnect patch applied');
console.log('Next: npm run build');
