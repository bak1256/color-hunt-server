const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "src",
  "rooms",
  "MyRoom.ts",
);

let s = fs.readFileSync(
  file,
  "utf8",
);

if (
  s.includes(
    "V101099_MULTIPLAYER_CHAT",
  )
) {
  console.log(
    "[skip] v0.10.10.99 chat already applied",
  );
  process.exit(0);
}

const onCreateMarker =
  "\n  onCreate(";

const onCreateAt =
  s.indexOf(onCreateMarker);

if (onCreateAt < 0) {
  throw new Error(
    "Could not find MyRoom.onCreate()",
  );
}

const chatSupport = `
  /* V101099_MULTIPLAYER_CHAT */
  private readonly chatHistory: Array<{
    id: string;
    sessionId: string;
    name: string;
    text: string;
    sentAt: number;
  }> = [];

  private readonly chatRateHistory =
    new Map<string, number[]>();

  private readonly chatLastNormalized =
    new Map<
      string,
      {
        text: string;
        sentAt: number;
      }
    >();

  private chatSequence = 0;

  private normalizeChatText(
    value: unknown,
  ): string {
    return String(
      value ?? "",
    )
      .replace(
        /[\\u0000-\\u001f\\u007f]/g,
        "",
      )
      .replace(
        /\\s+/g,
        " ",
      )
      .trim()
      .slice(
        0,
        140,
      );
  }

  private censorChatText(
    input: string,
  ): string {
    /*
     * Basic server-side profanity filtering.
     * Keep the list intentionally conservative to reduce false positives.
     * Variants separated by punctuation/spaces are caught by the compact
     * secondary check below.
     */
    const patterns = [
      /시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새끼|새끼야|좆|존나|지랄/gi,
      /fuck|fucking|motherfucker|shit|bitch|asshole|dickhead/gi,
      /くそ|クソ|死ね|しね|シネ|ばかやろう|バカヤロー/gi,
    ];

    let output =
      input;

    for (
      const pattern of
      patterns
    ) {
      output =
        output.replace(
          pattern,
          "***",
        );
    }

    const compact =
      input
        .toLowerCase()
        .replace(
          /[\\s._\\-~!@#$%^&*()+=[\\]{}|\\\\/:;"'?,<>]+/g,
          "",
        );

    const compactBlocked = [
      "씨발",
      "시발",
      "개새끼",
      "병신",
      "fuckyou",
      "motherfucker",
    ];

    if (
      compactBlocked.some(
        (word) =>
          compact.includes(
            word,
          ),
      )
    ) {
      return "***";
    }

    return output;
  }

  private sendChatHistory(
    client: Client,
  ): void {
    client.send(
      "chat_history",
      {
        messages:
          this.chatHistory,
      },
    );
  }

`;

s =
  s.slice(0, onCreateAt) +
  chatSupport +
  s.slice(onCreateAt);

/*
 * Insert handlers directly before request_lobby_snapshot in the existing
 * message-handler table. This avoids touching reconnect/join lifecycle.
 */
const handlerMarker =
  `    request_lobby_snapshot: (`;

const handlerAt =
  s.indexOf(handlerMarker);

if (handlerAt < 0) {
  throw new Error(
    "Could not find request_lobby_snapshot handler",
  );
}

const handlers = `    chat_send: (
      client: Client,
      payload: {
        text?: unknown;
      },
    ): void => {
      const player =
        this.state.players.get(
          client.sessionId,
        );

      if (!player) {
        return;
      }

      const now =
        Date.now();

      const text =
        this.normalizeChatText(
          payload?.text,
        );

      if (!text) {
        return;
      }

      const timestamps =
        (
          this.chatRateHistory.get(
            client.sessionId,
          ) ?? []
        )
          .filter(
            (value) =>
              now - value <
              10_000,
          );

      /*
       * Spam protection:
       * - no faster than ~0.8 seconds
       * - max 6 messages / 10 seconds
       * - exact same normalized message cannot repeat within 8 seconds
       */
      const latest =
        timestamps[
          timestamps.length - 1
        ] ?? 0;

      const comparable =
        text
          .toLowerCase()
          .replace(
            /\\s+/g,
            "",
          );

      const previous =
        this.chatLastNormalized.get(
          client.sessionId,
        );

      if (
        now - latest <
          800 ||
        timestamps.length >=
          6 ||
        (
          previous &&
          previous.text ===
            comparable &&
          now -
            previous.sentAt <
            8_000
        )
      ) {
        client.send(
          "chat_error",
          {
            message:
              "spam",
          },
        );
        return;
      }

      timestamps.push(
        now,
      );

      this.chatRateHistory.set(
        client.sessionId,
        timestamps,
      );

      this.chatLastNormalized.set(
        client.sessionId,
        {
          text:
            comparable,
          sentAt:
            now,
        },
      );

      const censored =
        this.censorChatText(
          text,
        );

      const message = {
        id:
          \`\${now}-\${++this.chatSequence}\`,
        sessionId:
          client.sessionId,
        name:
          String(
            player.name ??
            "Player",
          ).slice(
            0,
            32,
          ),
        text:
          censored,
        sentAt:
          now,
      };

      this.chatHistory.push(
        message,
      );

      if (
        this.chatHistory.length >
        40
      ) {
        this.chatHistory.splice(
          0,
          this.chatHistory.length -
            40,
        );
      }

      this.broadcast(
        "chat_message",
        message,
      );
    },

    request_chat_history: (
      client: Client,
    ): void => {
      this.sendChatHistory(
        client,
      );
    },

`;

s =
  s.slice(0, handlerAt) +
  handlers +
  s.slice(handlerAt);

if (
  !s.includes(
    "V101099_MULTIPLAYER_CHAT",
  ) ||
  !s.includes(
    "chat_send:",
  ) ||
  !s.includes(
    "request_chat_history:",
  )
) {
  throw new Error(
    "Chat patch verification failed",
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log(
  "[ok] room-wide chat history (last 40)",
);
console.log(
  "[ok] nickname comes from authoritative PlayerState",
);
console.log(
  "[ok] spam/repeat rate limiting",
);
console.log(
  "[ok] Korean/Japanese/English profanity filtering",
);
console.log(
  "[ok] reconnect can request recent room chat history",
);
console.log(
  "[done] v0.10.10.99 multiplayer chat server patch applied",
);
console.log(
  "Next: npm run build",
);
