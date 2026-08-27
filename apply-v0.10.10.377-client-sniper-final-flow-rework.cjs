const fs = require("fs");
const path = require("path");

const file = path.join("src", "game", "GameScene.ts");
if (!fs.existsSync(file)) {
  throw new Error(`Missing ${file}. Run from CLIENT project root.`);
}

let s = fs.readFileSync(file, "utf8");
const MARK = "V1010457_SNIPER_FINAL_FLOW_REWORK";

if (s.includes(MARK)) {
  console.log("[skip] v0.10.10.377 already applied");
  process.exit(0);
}

function once(oldText, newText, label) {
  const n = s.split(oldText).length - 1;
  if (n !== 1) {
    throw new Error(`${label}: expected 1 anchor, found ${n}. No file written.`);
  }
  s = s.replace(oldText, newText);
}

function replaceBetween(startNeedle, endNeedle, replacement, label) {
  const a = s.indexOf(startNeedle);
  const b = s.indexOf(endNeedle, a + startNeedle.length);
  if (a < 0 || b < 0) {
    throw new Error(`${label}: structural anchors missing. No file written.`);
  }
  s = s.slice(0, a) + replacement + s.slice(b);
}

/* =========================================================
 * State
 * ========================================================= */
once(
`    private sniperScopeReloadDom?: HTMLDivElement;

`,
`    private sniperScopeReloadDom?: HTMLDivElement;

    /* ${MARK} */
    private sniperScopeCanvas?: HTMLCanvasElement;
    private sniperScopeCanvasContext?: CanvasRenderingContext2D;
    private sniperButtonPressBlockUntil = 0;

`,
"377 fields"
);

/* =========================================================
 * Compact tactical button
 * ========================================================= */
once(
`                214,
                50,
`,
`                148,
                36,
`,
"button bg size"
);

once(
`        const w = 107;
        const h = 25;
        const c = 13;
`,
`        const w = 74;
        const h = 18;
        const c = 9;
`,
"button tactical corner dimensions"
);

once(
`                    fontSize:
                        '17px',
`,
`                    fontSize:
                        '13px',
`,
"button label font"
);

once(
`                .setSize(
                    214,
                    50,
                )
`,
`                .setSize(
                    148,
                    36,
                )
`,
"button hit size"
);

/* Button click: immediate local lock + consume click so shotgun never fires. */
once(
`                this.unlockGameAudio();

                multiplayerClient
                    .sendSniperToggle(
                        true,
                    );
`,
`                this.unlockGameAudio();

                /*
                 * ${MARK}
                 * Consume the support-button click completely.
                 * Local movement locks NOW instead of waiting for network RTT.
                 */
                this.sniperButtonPressBlockUntil =
                    Date.now() +
                    650;

                this.networkPlayerManager
                    .setLocalHunterSpeedMultiplier(
                        0,
                    );

                this.mobileMoveBase
                    ?.setVisible(false);
                this.mobileMoveKnob
                    ?.setVisible(false);
                this.mobileMoveLabel
                    ?.setVisible(false);

                multiplayerClient
                    .sendSniperToggle(
                        true,
                    );
`,
"button immediate lock"
);

/* =========================================================
 * Countdown: NO pulse/flicker. Same text object, only numeral changes.
 * ========================================================= */
const oldCountdown =
`            if (seconds !== this.sniperRadioLastSecond) {
                this.sniperRadioLastSecond = seconds;
                this.sniperRadioText.setText(this.getSniperRadioMessage(seconds));
                this.tweens.killTweensOf(this.sniperRadioText);
                this.sniperRadioText.setScale(0.96).setAlpha(0.2);
                this.tweens.add({
                    targets: this.sniperRadioText,
                    scale: 1,
                    alpha: 1,
                    duration: 150,
                });
            }
`;

const newCountdown =
`            if (
                seconds !==
                this.sniperRadioLastSecond
            ) {
                this.sniperRadioLastSecond =
                    seconds;

                /*
                 * ${MARK}
                 * Do not fade/scale the whole sentence each second.
                 * The object stays perfectly still; only the numeral changes.
                 */
                this.sniperRadioText
                    .setScale(1)
                    .setAlpha(1)
                    .setText(
                        this.getSniperRadioMessage(
                            seconds,
                        ),
                    );
            }
`;

once(oldCountdown, newCountdown, "countdown no flicker");

/* Lower support text/button farther below the Hunter. */
once(
`                    (
                        this.mobileControlsEnabled
                            ? 54
                            : 58
                    );
`,
`                    (
                        this.mobileControlsEnabled
                            ? 76
                            : 82
                    );
`,
"support under-character offset"
);

/* Compact horizontal clamp. */
once(
`                        screenX,
                        150,
                        this.gameWidth -
                            150,
`,
`                        screenX,
                        118,
                        this.gameWidth -
                            118,
`,
"radio horizontal clamp"
);

/* =========================================================
 * Suppress support-button click from shotgun path.
 * ========================================================= */
once(
`    private fireShotgun(
        aimAngleOverride?: number,
        explicitMobileFire =
            false,
    ): void {
`,
`    private fireShotgun(
        aimAngleOverride?: number,
        explicitMobileFire =
            false,
    ): void {
        /*
         * ${MARK}
         * Phaser may deliver the same pointerdown to world shooting after a UI
         * Container handler. A support-button press may NEVER cost shotgun ammo.
         */
        if (
            Date.now() <
            this.sniperButtonPressBlockUntil
        ) {
            return;
        }

`,
"shotgun button-click guard"
);

/* =========================================================
 * Hide all old Hunter aiming/shotgun controls as cinematic starts.
 * ========================================================= */
once(
`        this.mobileMoveLabel
            ?.setVisible(false);

        const localPosition =
`,
`        this.mobileMoveLabel
            ?.setVisible(false);

        /*
         * Old shotgun aiming belongs to the running Hunter mode.
         * Once support is accepted it disappears before the helicopter enters.
         */
        this.aimLine
            ?.setVisible(false);
        this.crosshair
            ?.clear()
            .setVisible(false);
        this.gun
            ?.setVisible(false);

        this.mobileAimBase
            ?.setVisible(false);
        this.mobileAimKnob
            ?.setVisible(false);
        this.mobileAimLabel
            ?.setVisible(false);
        this.mobileFireButton
            ?.setVisible(false);
        this.mobileFireLabel
            ?.setVisible(false);

        this.hunterWeaponHudContainer
            ?.setVisible(false);

        const localPosition =
`,
"hide old aim UI"
);

/* =========================================================
 * Top-down helicopter silhouette.
 * ========================================================= */
const heliStart = `    private createSniperHelicopter(): void {`;
const heliEnd = `    private createSniperScopeCamera(): void {`;

const heliMethod = `    private createSniperHelicopter(): void {
        if (
            this.sniperHelicopter
        ) {
            return;
        }

        const shadow =
            0x020609;

        /*
         * ${MARK}
         * Top-down silhouette: nose at top, fuselage/tail vertical,
         * landing stubs and a large spinning rotor cross.
         */
        const fuselage =
            this.add.ellipse(
                0,
                -4,
                38,
                82,
                shadow,
                0.50,
            );

        const cockpit =
            this.add.ellipse(
                0,
                -28,
                29,
                31,
                shadow,
                0.60,
            );

        const tailBoom =
            this.add.rectangle(
                0,
                54,
                12,
                67,
                shadow,
                0.46,
            );

        const tailFinLeft =
            this.add.triangle(
                -1,
                83,
                0,
                0,
                -24,
                17,
                -3,
                19,
                shadow,
                0.48,
            );

        const tailFinRight =
            this.add.triangle(
                1,
                83,
                0,
                0,
                24,
                17,
                3,
                19,
                shadow,
                0.48,
            );

        const skidLeft =
            this.add.rectangle(
                -25,
                6,
                6,
                61,
                shadow,
                0.36,
            );

        const skidRight =
            this.add.rectangle(
                25,
                6,
                6,
                61,
                shadow,
                0.36,
            );

        const rotorHorizontal =
            this.add.rectangle(
                0,
                0,
                150,
                5,
                shadow,
                0.44,
            );

        const rotorVertical =
            this.add.rectangle(
                0,
                0,
                5,
                150,
                shadow,
                0.34,
            );

        const rotorHub =
            this.add.circle(
                0,
                0,
                8,
                shadow,
                0.58,
            );

        const rotorGroup =
            this.add.container(
                0,
                -8,
                [
                    rotorHorizontal,
                    rotorVertical,
                    rotorHub,
                ],
            );

        const tailRotor =
            this.add.container(
                0,
                88,
                [
                    this.add.rectangle(
                        0,
                        0,
                        34,
                        3,
                        shadow,
                        0.42,
                    ),
                    this.add.rectangle(
                        0,
                        0,
                        3,
                        34,
                        shadow,
                        0.32,
                    ),
                ],
            );

        const heli =
            this.add.container(
                0,
                0,
                [
                    tailBoom,
                    tailFinLeft,
                    tailFinRight,
                    skidLeft,
                    skidRight,
                    fuselage,
                    cockpit,
                    rotorGroup,
                    tailRotor,
                ],
            )
                .setDepth(1200)
                .setAlpha(0.72)
                .setScale(0.92);

        this.sniperHelicopter =
            heli;

        this.sniperHelicopterRotorTween =
            this.tweens.add({
                targets:
                    rotorGroup,
                angle:
                    360,
                duration:
                    170,
                repeat:
                    -1,
            });

        this.tweens.add({
            targets:
                tailRotor,
            angle:
                -360,
            duration:
                105,
            repeat:
                -1,
        });
    }

`;

replaceBetween(heliStart, heliEnd, heliMethod, "top-down helicopter");

/* =========================================================
 * Center-of-map smooth camera animation.
 * Use Phaser pan + zoomTo, then snap exact logical full map.
 * ========================================================= */
const zoomStart = `    private startSniperWholeMapZoom(): void {`;
const zoomEnd = `    private startSniperScopeRackIn(): void {`;

const zoomMethod = `    private startSniperWholeMapZoom(): void {
        if (
            !this.sniperActive ||
            this.phase !==
                'hunt'
        ) {
            return;
        }

        const camera =
            this.cameras.main;

        camera.stopFollow();

        this.tweens.killTweensOf(
            camera,
        );

        /*
         * ${MARK}
         * Move the VIEW CENTER to exact map X/Y center while zooming out.
         * This avoids the old "zoomed out but still offset" result.
         */
        camera.pan(
            this.gameWidth / 2,
            this.gameHeight / 2,
            920,
            'Sine.easeInOut',
            true,
        );

        camera.zoomTo(
            1,
            920,
            'Sine.easeInOut',
            true,
        );

        this.time.delayedCall(
            940,
            () => {
                if (
                    !this.sniperActive ||
                    this.phase !==
                        'hunt'
                ) {
                    return;
                }

                camera
                    .setZoom(
                        1,
                    )
                    .centerOn(
                        this.gameWidth / 2,
                        this.gameHeight / 2,
                    );

                this.applyFixedHudForZoom(
                    1,
                );

                this.startSniperScopeRackIn();
            },
        );
    }

`;

replaceBetween(zoomStart, zoomEnd, zoomMethod, "whole-map center zoom");

/* =========================================================
 * No visible Phaser square secondary camera.
 * DOM canvas will provide the magnified circular image.
 * ========================================================= */
const cameraStart = `    private createSniperScopeCamera(): void {`;
const cameraEnd = `    private ensureSniperScopeDom(): void {`;

const cameraMethod = `    private createSniperScopeCamera(): void {
        /*
         * ${MARK}
         * Do NOT render a Phaser secondary-camera rectangle.
         * The circular HTML canvas below samples the already-rendered full-map
         * canvas and magnifies only the area inside the circle.
         */
        if (
            this.sniperScopeCamera
        ) {
            this.cameras.remove(
                this.sniperScopeCamera,
            );
            this.sniperScopeCamera =
                undefined;
        }

        this.ensureSniperScopeDom();
    }

`;

replaceBetween(cameraStart, cameraEnd, cameraMethod, "remove square scope camera");

/* =========================================================
 * Replace scope DOM with actual clipped magnifier canvas.
 * ========================================================= */
const domStart = `    private ensureSniperScopeDom(): void {`;
const domEnd = `    private syncSniperScopeDom(): void {`;

const domMethod = `    private ensureSniperScopeDom(): void {
        if (
            this.sniperScopeDom &&
            this.sniperScopeReloadDom &&
            this.sniperScopeCanvas &&
            this.sniperScopeCanvasContext
        ) {
            return;
        }

        if (
            typeof document ===
            'undefined'
        ) {
            return;
        }

        const scope =
            document.createElement(
                'div',
            );

        scope.className =
            'colorhunt-sniper-scope';

        Object.assign(
            scope.style,
            {
                position:
                    'fixed',
                zIndex:
                    '2147482600',
                pointerEvents:
                    'none',
                display:
                    'none',
                borderRadius:
                    '50%',
                boxSizing:
                    'border-box',
                overflow:
                    'hidden',
                border:
                    '7px solid rgba(5,10,12,.99)',
                boxShadow:
                    '0 0 0 2px rgba(192,218,203,.58), 0 0 0 9999px rgba(2,7,11,.44), inset 0 0 28px rgba(0,0,0,.70), 0 5px 20px rgba(0,0,0,.55)',
                background:
                    '#05090b',
                transformOrigin:
                    '50% 50%',
            },
        );

        const magnifier =
            document.createElement(
                'canvas',
            );

        Object.assign(
            magnifier.style,
            {
                position:
                    'absolute',
                inset:
                    '0',
                width:
                    '100%',
                height:
                    '100%',
                borderRadius:
                    '50%',
                display:
                    'block',
            },
        );

        const crossV =
            document.createElement(
                'div',
            );

        Object.assign(
            crossV.style,
            {
                position:
                    'absolute',
                left:
                    'calc(50% - 1px)',
                top:
                    '8%',
                width:
                    '2px',
                height:
                    '84%',
                background:
                    'rgba(235,249,255,.88)',
                boxShadow:
                    '0 0 2px #000',
            },
        );

        const crossH =
            document.createElement(
                'div',
            );

        Object.assign(
            crossH.style,
            {
                position:
                    'absolute',
                left:
                    '8%',
                top:
                    'calc(50% - 1px)',
                width:
                    '84%',
                height:
                    '2px',
                background:
                    'rgba(235,249,255,.88)',
                boxShadow:
                    '0 0 2px #000',
            },
        );

        const centerDot =
            document.createElement(
                'div',
            );

        Object.assign(
            centerDot.style,
            {
                position:
                    'absolute',
                width:
                    '7px',
                height:
                    '7px',
                left:
                    '50%',
                top:
                    '50%',
                transform:
                    'translate(-50%, -50%)',
                borderRadius:
                    '50%',
                background:
                    '#ffe2a0',
                boxShadow:
                    '0 0 8px rgba(255,226,160,.95)',
            },
        );

        const reloadTrack =
            document.createElement(
                'div',
            );

        Object.assign(
            reloadTrack.style,
            {
                position:
                    'absolute',
                left:
                    '18%',
                right:
                    '18%',
                bottom:
                    '12px',
                height:
                    '9px',
                borderRadius:
                    '5px',
                overflow:
                    'hidden',
                border:
                    '1px solid rgba(255,255,255,.62)',
                background:
                    'rgba(4,10,14,.88)',
                boxShadow:
                    '0 1px 4px rgba(0,0,0,.65)',
            },
        );

        const reload =
            document.createElement(
                'div',
            );

        Object.assign(
            reload.style,
            {
                width:
                    '100%',
                height:
                    '100%',
                transformOrigin:
                    'left center',
                transform:
                    'scaleX(1)',
                background:
                    'linear-gradient(90deg,#d89a36,#ffe19c)',
            },
        );

        reloadTrack.appendChild(
            reload,
        );

        scope.appendChild(
            magnifier,
        );
        scope.appendChild(
            crossV,
        );
        scope.appendChild(
            crossH,
        );
        scope.appendChild(
            centerDot,
        );
        scope.appendChild(
            reloadTrack,
        );

        document.body.appendChild(
            scope,
        );

        const context =
            magnifier.getContext(
                '2d',
                {
                    alpha:
                        false,
                },
            );

        this.sniperScopeDom =
            scope;
        this.sniperScopeReloadDom =
            reload;
        this.sniperScopeCanvas =
            magnifier;
        this.sniperScopeCanvasContext =
            context ??
            undefined;

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.sniperScopeDom
                    ?.remove();

                this.sniperScopeDom =
                    undefined;
                this.sniperScopeReloadDom =
                    undefined;
                this.sniperScopeCanvas =
                    undefined;
                this.sniperScopeCanvasContext =
                    undefined;
            },
        );
    }

`;

replaceBetween(domStart, domEnd, domMethod, "real circular scope DOM");

/* =========================================================
 * Sync scope DOM: position + circular magnified sample from game canvas.
 * ========================================================= */
const syncStart = `    private syncSniperScopeDom(): void {`;
const syncEnd = `    private drawLocalSniperScope(`;

const syncMethod = `    private syncSniperScopeDom(): void {
        const scope =
            this.sniperScopeDom;

        const magnifier =
            this.sniperScopeCanvas;

        const context =
            this.sniperScopeCanvasContext;

        if (
            !scope ||
            !magnifier ||
            !context ||
            !this.sniperCinematicActive
        ) {
            return;
        }

        const rect =
            this.game.canvas
                .getBoundingClientRect();

        const sx =
            rect.width /
            this.gameWidth;

        const sy =
            rect.height /
            this.gameHeight;

        const diameterLogical =
            this.sniperScopeRadius *
            2;

        const cssWidth =
            Math.max(
                1,
                Math.round(
                    diameterLogical *
                    sx,
                ),
            );

        const cssHeight =
            Math.max(
                1,
                Math.round(
                    diameterLogical *
                    sy,
                ),
            );

        scope.style.display =
            '';

        scope.style.left =
            String(
                Math.round(
                    rect.left +
                    (
                        this.sniperScopeScreenX -
                        this.sniperScopeRadius
                    ) *
                        sx,
                ),
            ) +
            'px';

        scope.style.top =
            String(
                Math.round(
                    rect.top +
                    (
                        this.sniperScopeScreenY -
                        this.sniperScopeRadius
                    ) *
                        sy,
                ),
            ) +
            'px';

        scope.style.width =
            String(
                cssWidth,
            ) +
            'px';

        scope.style.height =
            String(
                cssHeight,
            ) +
            'px';

        /*
         * Magnify the exact world point under the mouse.
         * At sniper stage main camera is zoom=1 and centered on full map, so
         * world x/y map 1:1 to the logical game canvas.
         */
        const backing =
            this.game.canvas;

        const backingScaleX =
            backing.width /
            this.gameWidth;

        const backingScaleY =
            backing.height /
            this.gameHeight;

        const magnification =
            2.85;

        const sourceHalfW =
            this.sniperScopeRadius /
            magnification;

        const sourceHalfH =
            this.sniperScopeRadius /
            magnification;

        const sourceX =
            Phaser.Math.Clamp(
                this.sniperAimWorldX -
                    sourceHalfW,
                0,
                Math.max(
                    0,
                    this.gameWidth -
                        sourceHalfW *
                            2,
                ),
            );

        const sourceY =
            Phaser.Math.Clamp(
                this.sniperAimWorldY -
                    sourceHalfH,
                0,
                Math.max(
                    0,
                    this.gameHeight -
                        sourceHalfH *
                            2,
                ),
            );

        const pixelRatio =
            Math.max(
                1,
                Math.min(
                    2,
                    window.devicePixelRatio ||
                        1,
                ),
            );

        const targetW =
            Math.max(
                1,
                Math.round(
                    cssWidth *
                    pixelRatio,
                ),
            );

        const targetH =
            Math.max(
                1,
                Math.round(
                    cssHeight *
                    pixelRatio,
                ),
            );

        if (
            magnifier.width !==
                targetW ||
            magnifier.height !==
                targetH
        ) {
            magnifier.width =
                targetW;
            magnifier.height =
                targetH;
        }

        context.save();

        context.clearRect(
            0,
            0,
            targetW,
            targetH,
        );

        context.beginPath();
        context.arc(
            targetW / 2,
            targetH / 2,
            Math.min(
                targetW,
                targetH,
            ) /
                2,
            0,
            Math.PI *
                2,
        );
        context.clip();

        context.imageSmoothingEnabled =
            false;

        context.drawImage(
            backing,
            sourceX *
                backingScaleX,
            sourceY *
                backingScaleY,
            sourceHalfW *
                2 *
                backingScaleX,
            sourceHalfH *
                2 *
                backingScaleY,
            0,
            0,
            targetW,
            targetH,
        );

        context.restore();

        const remain =
            Math.max(
                0,
                this.sniperReadyAt -
                Date.now(),
            );

        const ready =
            Phaser.Math.Clamp(
                1 -
                    remain /
                        2000,
                0,
                1,
            );

        if (
            this.sniperScopeReloadDom
        ) {
            this.sniperScopeReloadDom
                .style.transform =
                'scaleX(' +
                String(
                    ready,
                ) +
                ')';

            this.sniperScopeReloadDom
                .style.background =
                remain > 0
                    ? 'linear-gradient(90deg,#b56d2b,#ffd27d)'
                    : 'linear-gradient(90deg,#54b77c,#b7f2cb)';
        }
    }

`;

replaceBetween(syncStart, syncEnd, syncMethod, "scope canvas sync");

/* drawLocal no longer touches secondary camera viewport. */
once(
`        const radius =
            this.sniperScopeRadius;

        this.sniperScopeCamera
            ?.setViewport(
                this.sniperScopeScreenX -
                    radius,
                this.sniperScopeScreenY -
                    radius,
                radius * 2,
                radius * 2,
            );

        this.sniperScopeCamera
            ?.centerOn(
                x,
                y,
            );

`,
`        void x;
        void y;

`,
"remove square camera draw"
);

/* =========================================================
 * Scope intro should be larger / clearly below then rack up.
 * ========================================================= */
once(
`        this.sniperScopeRadius =
            this.mobileControlsEnabled
                ? 104
                : 130;
`,
`        this.sniperScopeRadius =
            this.mobileControlsEnabled
                ? 112
                : 142;
`,
"scope final radius"
);

once(
`        this.sniperScopeScreenY =
            this.gameHeight +
            this.sniperScopeRadius +
            30;
`,
`        this.sniperScopeScreenY =
            this.gameHeight +
            this.sniperScopeRadius +
            54;
`,
"scope starts lower"
);

once(
`                duration:
                    450,
`,
`                duration:
                    520,
`,
"rack intro duration"
);

/* =========================================================
 * Heavier anti-materiel shot: layer existing shotgun sample lower-pitched
 * underneath the procedural crack/boom.
 * ========================================================= */
once(
`    private playProceduralSniperShot(): void {
        try {
`,
`    private playProceduralSniperShot(): void {
        /*
         * ${MARK}
         * Layer the recorded shotgun transient at a low rate underneath the
         * synthesized crack/boom. It reads much heavier than the normal shotgun.
         */
        try {
            this.sound.play(
                'shotgun-blast',
                {
                    volume:
                        0.98,
                    rate:
                        0.58,
                    detune:
                        -180,
                },
            );
        } catch {
            // Recorded layer is optional.
        }

        try {
`,
"anti-materiel recorded layer"
);

/* Stronger recoil. */
once(
`        this.cameras.main.shake(
            155,
            0.010,
        );
`,
`        this.cameras.main.shake(
            210,
            0.016,
        );
`,
"main recoil"
);

/* =========================================================
 * Ensure DOM scope follows pointer every frame after rack-in.
 * ========================================================= */
once(
`        this.drawSniperReloadGauge();
    }

    private refreshSniperSupportUi(): void {
`,
`        this.drawSniperReloadGauge();

        if (
            this.sniperScopeInteractive
        ) {
            this.syncSniperScopeDom();
        }
    }

    private refreshSniperSupportUi(): void {
`,
"scope continuous sync"
);

/* =========================================================
 * Exit/lobby cleanup canvas.
 * ========================================================= */
once(
`                this.sniperScopeCanvas =
                    undefined;
                this.sniperScopeCanvasContext =
                    undefined;
`,
`                this.sniperScopeCanvas =
                    undefined;
                this.sniperScopeCanvasContext =
                    undefined;
`,
"shutdown canvas cleanup verify"
);

/* final marker is already in fields; validate */
[
  MARK,
  "private sniperScopeCanvas?: HTMLCanvasElement;",
  "camera.pan(",
  "camera.zoomTo(",
  "this.sound.play(\n                'shotgun-blast'",
  "Date.now() <\n            this.sniperButtonPressBlockUntil",
  "const fuselage =",
  "context.drawImage(",
].forEach((needle) => {
  if (!s.includes(needle)) {
    throw new Error(`verification failed: ${needle}. No file written.`);
  }
});

/* Must not create a visible named sniper secondary camera anymore. */
if (
  s.includes("'sniper-scope-camera',")
) {
  throw new Error("old square sniper camera creation still exists. No file written.");
}

fs.writeFileSync(file, s, "utf8");

console.log("[done] v0.10.10.377 sniper final-flow rework");
console.log("[ok] compact support button moved farther below Hunter");
console.log("[ok] support click locally locks movement and cannot fire shotgun");
console.log("[ok] countdown no longer fades/flashes; only number changes");
console.log("[ok] old shotgun aim/crosshair/mobile fire UI hides before helicopter");
console.log("[ok] top-down helicopter silhouette rises bottom -> Hunter");
console.log("[ok] camera pans to exact map center while zooming to full map");
console.log("[ok] square Phaser sniper camera removed");
console.log("[ok] true circular DOM canvas magnifier follows the mouse");
console.log("[ok] recorded low-pitch shotgun + procedural boom for anti-materiel shot");
console.log("[ok] heavier recoil + existing two-stage reload rack sound");
console.log("[ok] 2.0s reload retained");
console.log("Next: npm run build");
