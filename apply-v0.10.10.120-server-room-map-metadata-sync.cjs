const fs = require("fs");
const path = require("path");

const target = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

if (!fs.existsSync(target)) {
  throw new Error(
    `MyRoom.ts not found: ${target}`
  );
}

let src = fs.readFileSync(
  target,
  "utf8",
);

let changed = 0;

function replaceOnce(
  label,
  from,
  to,
) {
  if (src.includes(to)) {
    console.log(
      `[skip] ${label} already applied`
    );
    return;
  }

  if (!src.includes(from)) {
    throw new Error(
      `[fail] anchor not found: ${label}`
    );
  }

  src = src.replace(
    from,
    to,
  );
  changed += 1;
  console.log(
    `[ok] ${label}`
  );
}

/*
 * Public room metadata must expose the SAME selected map
 * shown in the waiting room.  The client room browser then
 * uses this value for both thumbnail and map label.
 */
replaceOnce(
  "initial metadata selectedMap",
`      phase:
        this.state.phase,
    };`,
`      phase:
        this.state.phase,
      selectedMap:
        this.state.selectedMap,
      activeMap:
        this.state.activeMap,
    };`,
);

replaceOnce(
  "update metadata selectedMap",
`      phase:
        this.state.phase,
    });
  }
}`,
`      phase:
        this.state.phase,
      selectedMap:
        this.state.selectedMap,
      activeMap:
        this.state.activeMap,
    });
  }
}`,
);

/*
 * Changing map inside the waiting room must immediately refresh
 * room-list metadata so users outside the room see the new map.
 */
replaceOnce(
  "refresh metadata after map selection",
`      this.state.activeMap =
        requested === "random"
          ? "forest"
          : requested;

      this.clients.forEach(`,
`      this.state.activeMap =
        requested === "random"
          ? "forest"
          : requested;

      this.updateRoomMetadata();

      this.clients.forEach(`,
);

if (changed > 0) {
  fs.writeFileSync(
    target,
    src,
    "utf8",
  );
}

console.log("");
console.log(
  `[done] v0.10.10.120 server room-map metadata sync applied (${changed} changes)`
);
console.log(
  "Next: npm run build"
);
