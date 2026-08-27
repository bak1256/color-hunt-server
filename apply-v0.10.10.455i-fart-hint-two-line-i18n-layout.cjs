const fs = require("fs");
const path = require("path");

const file = path.join("src", "game", "GameScene.ts");
if (!fs.existsSync(file)) {
  throw new Error(`Missing ${file}. Run from CLIENT project root.`);
}

let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const MARK = "V1010455I_FART_HINT_TWO_LINE_I18N_LAYOUT";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.455i already applied");
  process.exit(0);
}

const start = s.indexOf("    private showHunterFartHintBubble(): void {");
const end = s.indexOf("    private ", start + 10);

if (start < 0 || end < 0) {
  throw new Error("showHunterFartHintBubble() bounds not found. No file written.");
}

let block = s.slice(start, end);

function once(oldText, newText, label) {
  const count = block.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match in fart hint block, found ${count}. No file written.`);
  }
  block = block.replace(oldText, newText);
  console.log(`[ok] ${label}`);
}

/* Exact two-line localized copy. */
once(
`        const fartHintCopy =
            (
                {
                    ko: mobile
                        ? '못 찾겠다면 💨 방구 버튼으로 탐지!\\n코로 찾는 것도 실력이지!'
                        : '못 찾겠다면 💨 SPACE로 탐지!\\n코로 찾는 것도 실력이지!',
                    ja: mobile
                        ? '見つからないなら 💨 おならボタンで探知！\\n鼻で探すのも立派な技術！'
                        : '見つからないなら 💨 SPACEでおなら探知！\\n鼻で探すのも立派な技術！',
                    en: mobile
                        ? 'Can’t find them? 💨 Use FART DETECT!\\nSometimes your nose finds the clue!'
                        : 'Can’t find them? 💨 Press SPACE to detect!\\nSometimes your nose finds the clue!',
                    zh: mobile
                        ? '找不到吗？💨 用放屁按钮探测！\\n用鼻子找也是本事！'
                        : '找不到吗？💨 按 SPACE 放屁探测！\\n用鼻子找也是本事！',
                } as const
            )[getLanguage()];
`,
`        /*
         * ${MARK}: every locale is authored as exactly two short lines.
         */
        const fartHintCopy =
            (
                {
                    ko: mobile
                        ? '못 찾겠다면 💨 방구로 탐지!\\n코로 찾는 것도 실력이지!'
                        : '못 찾겠다면 💨 SPACE로 탐지!\\n코로 찾는 것도 실력이지!',
                    ja: mobile
                        ? '見つからないなら 💨 おならで探知！\\n鼻で探すのも立派な技術！'
                        : '見つからないなら 💨 SPACEで探知！\\n鼻で探すのも立派な技術！',
                    en: mobile
                        ? 'Can’t find them? 💨 Use FART DETECT!\\nYour nose can find clues too!'
                        : 'Can’t find them? 💨 Press SPACE to detect!\\nYour nose can find clues too!',
                    zh: mobile
                        ? '找不到吗？💨 用放屁探测！\\n用鼻子找也是本事！'
                        : '找不到吗？💨 按 SPACE 探测！\\n用鼻子找也是本事！',
                } as const
            )[getLanguage()];
`,
"localized 2-line copy"
);

/* Language-aware sizing. */
once(
`        bubble.textContent =
            fartHintCopy;

        Object.assign(
`,
`        bubble.textContent =
            fartHintCopy;

        const fartHintLanguage =
            getLanguage();

        const fartHintDesktopWidth =
            fartHintLanguage === 'ja' ||
            fartHintLanguage === 'en'
                ? '390px'
                : '360px';

        const fartHintFontSize =
            mobile
                ? (
                    fartHintLanguage === 'ja' ||
                    fartHintLanguage === 'en'
                        ? '12px'
                        : '13px'
                )
                : (
                    fartHintLanguage === 'ja' ||
                    fartHintLanguage === 'en'
                        ? '15px'
                        : '16px'
                );

        Object.assign(
`,
"language-aware sizing"
);

once(
`                width: mobile
                    ? '248px'
                    : '360px',
                maxWidth: mobile
                    ? '248px'
                    : '360px',
`,
`                width: mobile
                    ? '258px'
                    : fartHintDesktopWidth,
                maxWidth: mobile
                    ? '258px'
                    : fartHintDesktopWidth,
`,
"bubble width"
);

once(
`                fontSize: mobile
                    ? '13px'
                    : '16px',
`,
`                fontSize:
                    fartHintFontSize,
`,
"bubble font"
);

once(
`                whiteSpace: 'pre-line',
                textAlign: 'center',
`,
`                whiteSpace: 'pre-line',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
                textAlign: 'center',
`,
"prevent third-line wrapping"
);

once(
`                padding: mobile
                    ? '10px 12px'
                    : '11px 16px',
`,
`                padding: mobile
                    ? '9px 10px'
                    : '11px 12px',
`,
"compact padding"
);

s = s.slice(0, start) + block + s.slice(end);

for (const required of [
  MARK,
  "見つからないなら 💨 おならで探知！",
  "Your nose can find clues too!",
  "wordBreak: 'keep-all'",
  "fartHintDesktopWidth",
]) {
  if (!s.includes(required)) {
    throw new Error(`verification failed: ${required}. No file written.`);
  }
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.455i CLIENT");
console.log("[ok] KO/JA/EN/ZH fart hints fixed to exactly two authored lines");
console.log("[ok] JA/EN receive slightly wider box + smaller font");
console.log("[ok] KO/ZH retain larger readable font");
console.log("[ok] accidental third-line wrapping prevented");
console.log("[ok] sniper/gameplay logic untouched");
console.log("Next: npm run build");
