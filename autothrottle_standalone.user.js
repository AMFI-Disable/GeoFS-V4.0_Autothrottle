// ==UserScript==
// @name         GeoFS-V4.0_Autothrottle
// @namespace    https://greasyfork.org/users/1594049
// @version      1.0.0
// @description  Holds a selected speed in GeoFS with an automatic throttle controller. © 2026 AMFI-Disable. Part of the GeoFS-V4.0_Ecosystem.
// @author       AMFI-Disable
// @icon         https://www.geo-fs.com/images/icons/favicon.ico
// @match        https://beta.geo-fs.com/geofs.php*
// @match        https://www.geo-fs.com/geofs.php*
// @require      https://update.greasyfork.org/scripts/604885/code.js
// @require      https://update.greasyfork.org/scripts/604887/code.js
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
(() => {
    'use strict';
    if (!window.GeoFSV4Core || !window.GeoFSV4Design) { console.error('[GeoFS-V4.0_Autothrottle] Missing dependency'); return; }
    function main () {
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        let previousOpState = null;
        function releaseOpSync() {
            if (!geofs.autothrottle.opSyncActive) return;
            geofs.autothrottle.opSyncActive = false;
            document.dispatchEvent(new CustomEvent('V40_opSyncStateChanged', { detail: { active: false } }));
            if (!previousOpState) return;
            if (Number.isFinite(previousOpState.multiplier)) {
                window.opMultiplier = previousOpState.multiplier;
                document.dispatchEvent(new CustomEvent('V40_opMultiplierUpdated', { detail: { value: window.opMultiplier } }));
            }
            if (!previousOpState.thrust && globalThis.isThrustActive && window.toggleThrustMode) {
                window.toggleThrustMode();
            }
            if (!previousOpState.ceiling && globalThis.isCeilingActive && window.toggleCeilingMode) window.toggleCeilingMode();
            previousOpState = null;
        }
        geofs.autothrottle = {
            on: !1,

            /**
             * System Bootstrapper: Foundation & Callbacks
             * Injects styles, registers frame callbacks, and prepares the HUD panel.
             */
            init: () => {
                geofs.autothrottle.initStyles();
                // Register high-frequency physics tick
                geofs.autothrottle.callbackID = geofs.api.addFrameCallback(geofs.autothrottle.tickWrapper);
                
                /**
                 * User Interface: Autopilot Bar Integration
                 * Injects a stylized A/THR button into the Autopilot bar to serve as the
                 * primary toggle for the standalone control panel.
                 */
                const $bar = $(`
                    <div class="ext-autothrottle-bar">
                        <div class="ext-autothrottle-control-pad ext-autothrottle-pad" id="autothrottle-button" tabindex="0" onclick="geofs.autothrottle.toggle()" style="cursor: pointer; pointer-events: all;">
                            <div class="control-pad-label transp-pad" style="pointer-events: none;">A/THR</div>
                        </div>
                        <div class="ext-autothrottle-controls" style="display: none;">
                            <div class="ext-autothrottle-control" style="position: relative;">
                                <div id="V40-at-rev" style="display: none; font-size: 8px; color: #ef4444; font-weight: 900; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); letter-spacing: 1px; text-shadow: 0 0 5px #ef4444;">[REV]</div>
                                <a class="ext-autothrottle-numberDown numberDown ext-autothrottle-control">-</a><input class="ext-autothrottle-numberValue numberValue ext-autothrottle-speed" min="0" smallstep="5" stepthreshold="100" step="10" data-method="setSpeed" maxlength="4" max="9999" value="0"><a class="ext-autothrottle-numberUp numberUp">+</a>
                                <span class="ext-autothrottle-switch ext-autothrottle-speedMode">
                                    <a class="ext-autothrottle-switchLeft switchLeft green-pad" data-method="setAutothrottleSpeedMode" value="knots" id="knotsMode">KTS</a>
                                    <a class="ext-autothrottle-switchRight switchRight" data-method="setAutothrottleSpeedMode" value="mach" id="machMode">M.</a>
                                </span>
                            </div>
                            <div class="geofs-autopilot-control" style="display: inline-block; vertical-align: bottom; margin-left: 5px; text-align: center;">
                                <span style="display: block; font-size: 10px; font-weight: bold; color: #aaa; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">LANDING</span>
                                <span class="ext-autothrottle-switch ext-autothrottle-mode" id="autothrottle-landing-mode-switch" role="group" aria-label="Landing mode">
                                    <a class="ext-autothrottle-switchLeft switchLeft landing-selected" data-method="setArm" value="false" id="armOff" role="button" tabindex="0" aria-pressed="true">OFF</a>
                                    <a class="ext-autothrottle-switchRight switchRight" data-method="setArm" value="true" id="armOn" role="button" tabindex="0" aria-pressed="false">ARM</a>
                                </span>
                            </div>
                        </div>
                        <div class="mdl-tooltip" id="autothrottle-tooltip" for="autothrottle-button">Toggle autothrottle on/off</div>
                        <div class="mdl-tooltip" id="autothrottle-landing-mode-tooltip" for="autothrottle-landing-mode-switch">Landing mode: when armed, throttle goes to idle at touchdown</div>
                    </div>
                `).appendTo(".geofs-autopilot-bar");

                if (window.componentHandler) {
                    if (document.querySelector("#autothrottle-tooltip")) {
                        componentHandler.upgradeElement(document.querySelector("#autothrottle-tooltip"));
                    }
                    if (document.querySelector("#autothrottle-landing-mode-tooltip")) {
                        componentHandler.upgradeElement(document.querySelector("#autothrottle-landing-mode-tooltip"));
                    }
                }
                
                // Keep the native-style landing switches usable from the keyboard.
                $(document).on("keydown", "#autothrottle-landing-mode-switch a", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        $(e.currentTarget).trigger("click");
                    }
                });

                // Auto-select on focus/click
                $(document).on("focus click", ".ext-autothrottle-speed", (e) => {
                    e.target.select();
                });

                $(document).on("change input", ".ext-autothrottle-speed", (e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) geofs.autopilot.setSpeed(val);
                });

                /**
                 * System Synchronization Events
                 * Handlers for engagement/disengagement state changes.
                 */
                $(document).on("autothrottleOn", () => {
                    geofs.autopilot.on && geofs.autopilot.turnOff();
                    clearTimeout(geofs.autothrottle.panelTimeout);
                    geofs.autopilot.setArm(!1); // Standard safety: Start with Landing Mode OFF.
                    $("#autothrottle-button").removeClass("red-pad").addClass("green-pad");
                    $(".ext-autothrottle-controls").show();
                    geofs.autothrottle.on = !0;
                    
                    // Mode Validation: Validate KIAS, MACH, or KNOTS, and sync green active lights.
                    let mode = geofs.autopilot.speedMode;
                    if (!mode || (mode !== "mach" && mode !== "kias" && mode !== "knots")) {
                        mode = "kias";
                    } else if (mode === "knots") {
                        mode = "kias";
                    }
                    geofs.autopilot.setAutothrottleSpeedMode(mode === "mach" ? "mach" : "knots");

                    const isMach = mode == "mach";
                    
                    // Capture input speed first to prevent wiping out user target speed
                    const $input = $(".ext-autothrottle-speed");
                    let targetVal = parseFloat($input.val());
                    if (isNaN(targetVal) || targetVal <= 0) {
                        targetVal = isMach ? (geofs.animation.values.mach || 0.8) : Math.round(geofs.animation.values.kias || 250);
                    } else {
                        // Protect against mode/value mismatch
                        if (isMach && targetVal > 50) {
                            const kias = geofs.animation.values.kias;
                            const mach = geofs.animation.values.mach;
                            if (kias && kias > 50 && mach) {
                                targetVal = (targetVal / kias) * mach;
                            } else {
                                targetVal = targetVal / 661.47;
                            }
                        } else if (!isMach && targetVal < 10) {
                            const kias = geofs.animation.values.kias;
                            const mach = geofs.animation.values.mach;
                            if (kias && kias > 50 && mach) {
                                targetVal = (targetVal / mach) * kias;
                            } else {
                                targetVal = targetVal * 661.47;
                            }
                            targetVal = Math.round(targetVal);
                        }
                    }
                    
                    geofs.autopilot.setSpeed(targetVal);
                    $input.val(isMach ? targetVal.toFixed(6) : Math.round(targetVal));
                    
                    if (window.V40_NOTIF) {
                        window.V40_NOTIF.show(`🛫 Autothrottle Engaged - Holding ${targetVal.toFixed(isMach ? 2 : 0)} ${isMach ? 'Mach' : 'Knots'}`);
                    }
                    document.dispatchEvent(new CustomEvent('V40_autothrottleStateChanged', { detail: { active: !0 } }));
                });

                // Triggered when the system is disengaged.
                $(document).on("autothrottleOff", () => {
                    $("#autothrottle-button").removeClass("green-pad").addClass("red-pad");
                    $(".ext-autothrottle-controls").hide();
                    geofs.autothrottle.on = !1;
                    
                    geofs.autothrottle.panelTimeout = setTimeout(() => {
                        $("#autothrottle-button").removeClass("red-pad");
                    }, 3000);
                    
                    releaseOpSync();

                    if (geofs.autothrottle.reverseEngaged) {
                        geofs.autothrottle.reverseEngaged = false;
                        if (geofs.aircraft.instance.definition && geofs.autothrottle._origReverse !== undefined) {
                            geofs.aircraft.instance.definition.reverse = geofs.autothrottle._origReverse;
                        }
                    }

                    // Remove REV visual indicator in case it was active during disengagement
                    $("#V40-at-rev").hide();
                    // Reset our tracking values to prevent spikes on subsequent engagements
                    geofs.autothrottle._tickTime = null;
                    geofs.autothrottle._lastFrameTime = null;
                    geofs.autothrottle._prevKias = null;
                    geofs.autothrottle._currentAccelKts = 0;
                    
                    geofs.autopilot.setSpeedMode(geofs.autopilot.speedMode);
                    geofs.autothrottle.on = !1;
                    
                    if (window.V40_NOTIF) {
                        window.V40_NOTIF.show("🛬 Autothrottle Disengaged - Control Returned to Pilot");
                    }
                    document.dispatchEvent(new CustomEvent('V40_autothrottleStateChanged', { detail: { active: !1 } }));
                });

                // Safety: Automatically disengage if the main Autopilot is turned on.
                $(document).on("autopilotOn", () => {
                    geofs.autopilot.setSpeedMode("kias");
                    geofs.autopilot.setSpeed(geofs.animation.values.kias);
                    geofs.autothrottle.on && $(document).trigger("autothrottleOff")
                });

                /**
                 * Input Suppression: Joystick Compatibility
                 * While Autothrottle is active, physical throttle axis inputs are suppressed
                 * to prevent conflicting commands between the pilot and the PID controller.
                 */
                const o = controls.axisSetters.throttle.process;
                controls.axisSetters.throttle.process = (e, t) => {
                    if (geofs.autothrottle.on) return;
                    o(e, t);
                };
            },
            /**
             * Injects the necessary CSS for the legacy bar button and panel states.
             * This ensures the addon looks correct even if the main design system is slow to load.
             */
            initStyles: () => {
                const style = document.createElement("style");
                style.innerHTML = `
                   .ext-autothrottle-pad {
                       width: 60px;
                       margin: 0px 10px;
                   }
                   .ext-autothrottle-bar {
                       white-space: nowrap;
                       display: flex;
                       align-items: flex-start;
                       pointer-events: all;
                   }
                   .ext-autothrottle-control-pad {
                       border: 1px solid #888;
                       background-color: #000;
                       box-shadow: 0px 0px 5px #000;
                       border-radius: 15px;
                       cursor: pointer !important;
                   }
                   .ext-autothrottle-controls {
                       vertical-align: bottom;
                       display: none;
                       margin-right: 10px;
                   }
                   .ext-autothrottle-control {
                       position: relative;
                       text-align: center;
                       margin: 0px 5px;
                       color: white;
                       line-height: 25px;
                       display: inline-block;
                   }
                   .ext-autothrottle-control span {
                       display: block;
                       text-align: center;
                       text-shadow: #000 1px 1px 3px;
                       font-size: 12px;
                       top: 0px;
                       position: relative;
                   }
                   .ext-autothrottle-bar .ext-autothrottle-switch .ext-autothrottle-switchRight {
                       top: 0px !important;
                       border-radius: 0px 15px 15px 0px;
                       left: 0px;
                   }
                   .ext-autothrottle-bar .ext-autothrottle-switch .ext-autothrottle-switchLeft {
                       top: 0px !important;
                       border-radius: 15px 0px 0px 15px;
                       border-right: 5px;
                       right: -3px;
                   }
                   .ext-autothrottle-bar .ext-autothrottle-switch a {
                       user-select: none;
                       -webkit-user-select: none;
                       position: relative;
                       display: inline-block;
                       width: 35px;
                       height: 17px;
                       line-height: 19px;
                       cursor: pointer;
                       color: white;
                       background: #000;
                       margin: 2px 0px;
                       display: inline-block;
                       border: 1px solid white;
                       box-shadow: 0px 0px 5px #000;
                   }
                   .ext-autothrottle-bar .ext-autothrottle-control {
                       position: relative;
                       text-align: center;
                       margin: 0px 5px;
                       color: white;
                       line-height: 25px;
                       display: inline-block;
                   }
                   .ext-autothrottle-bar .ext-autothrottle-speed {
                       width: 50px !important;
                   }
                   .ext-autothrottle-numberDown {
                       border-radius: 15px 0px 0px 15px;
                       line-height: 23px;
                       right: -5px;
                       position: relative !important;
                   }
                   .ext-autothrottle-numberUp {
                       border-radius: 0px 15px 15px 0px;
                       line-height: 26px;
                       left: -5px;
                       position: relative !important;
                   }
                   .ext-autothrottle-control .ext-autothrottle-numberDown,.ext-autothrottle-control .ext-autothrottle-numberUp {
                       user-select: none;
                       -webkit-user-select: none;
                       vertical-align: top;
                       cursor: pointer;
                       text-align: center;
                       color: white;
                       background: #000;
                       margin: 0px;
                       width: 30px;
                       display: inline-block;
                       border: 1px solid white;
                       height: 25px;
                       box-shadow: 0px 0px 5px #000;
                   }
                   .ext-autothrottle-control .ext-autothrottle-numberValue {
                       font-family: 'LCD-Bold', monospace;
                       font-size: 20px !important;
                       letter-spacing: 1px;
                       display: inline-block;
                       vertical-align: top;
                       padding: 0px 5px;
                       margin: 0px;
                       background: #000;
                       border: 1px solid;
                       border-radius: 0px;
                       height: 25px;
                       line-height: 26px;
                       box-shadow: 0px 0px 5px #000;
                       color: white;
                       width: 120px; /* overriden in ext-autothrottle-speed */
                       text-align: right;
                    }
                    .green-pad {
                       border-color: #10b981 !important;
                       box-shadow: 0 0 10px rgba(16, 185, 129, 0.4) !important;
                    }
                    .red-pad {
                       border-color: #ef4444 !important;
                       box-shadow: 0 0 10px rgba(239, 68, 68, 0.4) !important;
                    }
                    #autothrottle-landing-mode-switch .landing-selected {
                       background: #555;
                       border-color: #888;
                    }
                `;
                document.head.appendChild(style);
            },
            /**
             * Toggles the system state between ON and OFF.
             * Triggers the corresponding document events for synchronization.
             * Includes a pre-engagement validation check to ensure modes are selected.
             */
            toggle: () => {
                if (geofs.autothrottle.error) return;
                
                if (!geofs.autothrottle.on) {
                    // Electrical System Dependency: Block engagement if no power.
                    if (window.failureSimulator?.fails?.electrical) {
                        if (window.V40_NOTIF) window.V40_NOTIF.show("⚡ AUTOTHROTTLE OFFLINE - NO ELECTRICAL POWER");
                        return;
                    }

                    // Auto-initialize Speed Mode to Knots if not set or invalid
                    const mode = geofs.autopilot.speedMode;
                    const isModeValid = (mode === "mach" || mode === "knots");
                    if (!isModeValid) {
                        geofs.autopilot.setAutothrottleSpeedMode('knots');
                    }

                    // Auto-initialize Landing Mode to OFF if not set
                    const isArmValid = (typeof geofs.autothrottle.armed !== "undefined");
                    if (!isArmValid) {
                        geofs.autopilot.setArm(!1);
                    }
                }
                
                geofs.autothrottle.on ? $(document).trigger("autothrottleOff") : $(document).trigger("autothrottleOn");
            },
            /**
             * Core Feedback Engine (PID Controller)
             * Calculates the differential throttle command required to reach the 
             * target indicated airspeed or Mach number.
             * @param {number} a - Integrated delta time (seconds).
             * @param {number} b - Frame delta time (milliseconds).
             */
            tick: (a, b) => {
                // Physics scaling: Normalize delta based on simulation frequency
                var A = clamp(Math.floor(b / geofs.api.renderingSettings.physicsDeltaMs), 1, 10)
                  , B = a / A;
                var c = geofs.animation.values
                , d = geofs.autopilot
                , e = d.values.speed
                , f = c.kias;

                // Mode logic: Convert Mach target to knots for internal PID processing
                geofs.autopilot.speedMode == "mach" && (e = geofs.utils.machToKnots(d.values.speed),
                f = geofs.utils.machToKnots(c.mach));

                // --- 1. Reverse Thrust Engine ---
                const currentMach = c.mach || (f / 661.47);
                const reverseThreshold = clamp(0.8 - (currentMach * 0.05), 0.1, 0.8);
                
                if (e < f * reverseThreshold && !geofs.autothrottle.reverseEngaged) {
                    geofs.autothrottle.reverseEngaged = true;
                    // Force the aircraft definition to support reverse thrust so controls.update doesn't clamp negative throttle
                    if (geofs.aircraft.instance.definition) {
                        geofs.autothrottle._origReverse = geofs.aircraft.instance.definition.reverse;
                        geofs.aircraft.instance.definition.reverse = true;
                    }
                    $("#V40-at-rev").show();
                } else if (f <= e * 1.05 && geofs.autothrottle.reverseEngaged) {
                    geofs.autothrottle.reverseEngaged = false;
                    // Restore original reverse property of aircraft definition
                    if (geofs.aircraft.instance.definition && geofs.autothrottle._origReverse !== undefined) {
                        geofs.aircraft.instance.definition.reverse = geofs.autothrottle._origReverse;
                    }
                    $("#V40-at-rev").hide();
                }

                /**
                 * --- 2. [Integration] Seamless OP Engines Bridge ---
                 */
                const mass = geofs.aircraft.instance.setup?.mass || 1000; // Default to 1 ton if missing
                const OP_LIMIT_KNOTS = (mass < 10000) ? 200 : 500;
                
                // Keep OP Engines engaged if targeting supersonic, OR if air-braking from supersonic
                if (e > OP_LIMIT_KNOTS || (geofs.autothrottle.reverseEngaged && f > OP_LIMIT_KNOTS)) {
                    // Preserve the pilot's settings before automatic management begins.
                    if (!geofs.autothrottle.opSyncActive && (window.toggleThrustMode || window.toggleCeilingMode)) {
                        previousOpState = { thrust: !!globalThis.isThrustActive, ceiling: !!globalThis.isCeilingActive, multiplier: window.opMultiplier };
                    }
                    // Auto-activate OP Engines if target speed exceeds physical aircraft limits
                    if (!globalThis.isThrustActive && window.toggleThrustMode) {
                        window.toggleThrustMode();
                        if (window.V40_NOTIF) window.V40_NOTIF.show(`🚀 Physical limit (${OP_LIMIT_KNOTS}kts) exceeded. OP Engines engaged.`);
                    }
                    
                    // Auto-activate Ceiling Bypass to handle extreme high-altitude atmospheric heights
                    if (!globalThis.isCeilingActive && window.toggleCeilingMode) {
                        window.toggleCeilingMode();
                    }
                    
                    if (!geofs.autothrottle.opSyncActive) {
                        geofs.autothrottle.opSyncActive = true;
                        document.dispatchEvent(new CustomEvent('V40_opSyncStateChanged', { detail: { active: true } }));
                    }
                    
                    if (globalThis.isThrustActive) {
                        const activeSpeed = geofs.autothrottle.reverseEngaged ? f : e; // Use current speed for base multiplier if braking
                        const rawError = Math.abs(e - f); // Absolute error
                        const baseMult = activeSpeed / 500;
                        
                        // Scale errorBoost aggressively for massive hypersonic target differences
                        let errorBoost = rawError / 100;
                        if (rawError > 1000) {
                            errorBoost = (rawError / 10) * (1 + (rawError / 10000));
                        }
                        
                        const targetMult = clamp(baseMult + errorBoost, 1, 1000000000);
                        
                        // Smoothly slide the multiplier towards the optimal target
                        window.opMultiplier += (targetMult - window.opMultiplier) * 0.15;
                        
                        window.opMultiplier = clamp(window.opMultiplier, 1, 1000000000);
                        
                        // Broadcast live updates to sync the Overpowered Engines UI
                        document.dispatchEvent(new CustomEvent('V40_opMultiplierUpdated', { detail: { value: window.opMultiplier } }));
                    }
                } else {
                    // Restore the pilot's settings when automatic management ends.
                    releaseOpSync();
                }

                const mult = (globalThis.isThrustActive && window.opMultiplier) ? window.opMultiplier : 1.0;
                const error = Math.abs(e - f); // Absolute Difference
                
                // Track real-time acceleration in knots/second
                const now = geofs.utils.now();
                if (!geofs.autothrottle._lastFrameTime) {
                    geofs.autothrottle._lastFrameTime = now;
                    geofs.autothrottle._prevKias = f;
                    geofs.autothrottle._currentAccelKts = 0;
                }
                const dt = Math.max((now - geofs.autothrottle._lastFrameTime) / 1000, 0.001);
                geofs.autothrottle._lastFrameTime = now;

                const dKias = f - geofs.autothrottle._prevKias;
                geofs.autothrottle._prevKias = f;

                if (dt > 0 && Math.abs(dKias) < 2000) {
                    const rawAccel = dKias / dt;
                    geofs.autothrottle._currentAccelKts = geofs.autothrottle._currentAccelKts * 0.8 + rawAccel * 0.2;
                }
                
                // Base Formula: More permissive fractional damping (50 instead of 12) for high-multiplier authority
                let damping = (50 / (mult + 49)); 
                
                // Hypersonic Scaling: If error is huge, smoothly transition damping towards 1.0 (no damping) to unleash full thrust
                const errorRatio = clamp(error / 1000, 0, 1);
                damping = damping * (1 - errorRatio) + 1.0 * errorRatio;
                
                // Boost Factor: Increase authority when far from target speed
                damping *= (1 + 0.2 * Math.sin(Math.min(error / 150, Math.PI / 2)));
                
                // PID Update: Inject dynamic dampening into the controller
                const pid = d.PIDs.throttle;
                
                if (geofs.autothrottle.reverseEngaged) {
                    pid.set(e, -1, 1); // Expand bounds to allow negative throttle computation during deceleration
                } else {
                    pid.set(e, 0, 1);
                }
                
                // State Sync: Apply dampening to Proportional and Integral components
                let throttleCmd = pid.compute(f, B);
                
                if (geofs.autothrottle.reverseEngaged) {
                    // Invert negative PID output to positively spool engines in reverse mode
                    throttleCmd = Math.abs(throttleCmd);
                }
                
                // Acceleration Guard: Force thrust reduction if acceleration is excessive (limit to 100 knots/sec)
                const currentAccel = geofs.autothrottle._currentAccelKts || 0;
                if (mult > 1 && currentAccel > 100) {
                     throttleCmd *= (100 / currentAccel); // Proportional cut to maintain exactly 100 kts/sec
                }

                const targetVal = geofs.autothrottle.reverseEngaged ? 
                     clamp(-throttleCmd * damping, -1, 0) : 
                     clamp(throttleCmd * damping, 0, 1);
                controls.manipulatorSetters.setThrottle(targetVal);
                if (controls.throttleLeft !== undefined) controls.throttleLeft = targetVal;
                if (controls.throttleRight !== undefined) controls.throttleRight = targetVal;
                if (controls.throttle1 !== undefined) controls.throttle1 = targetVal;
                if (controls.throttle2 !== undefined) controls.throttle2 = targetVal;
                if (controls.throttle3 !== undefined) controls.throttle3 = targetVal;
                if (controls.throttle4 !== undefined) controls.throttle4 = targetVal;
            },
            /**
             * Tick Orchestrator & Safety Guard
             * Manages the execution context for the PID loop and implements 
             * the Landing Mode (Auto-Retard) logic.
             */
            tickWrapper: (a) => {
                if (geofs.autothrottle.on) {
                    // Electrical System Dependency: Immediate emergency cut if power is lost.
                    if (window.failureSimulator?.fails?.electrical) {
                        if (window.V40_NOTIF) window.V40_NOTIF.show("⚡ AUTOTHROTTLE DISENGAGED - ELECTRICAL FAILURE");
                        $(document).trigger("autothrottleOff");
                        return;
                    }

                    // Touchdown Guard: Immediate engine cut upon ground contact if ARMED
                    if (geofs.aircraft.instance.groundContact && geofs.autothrottle.armed) {
                        controls.manipulatorSetters.setThrottle(0);
                        if (controls.throttleLeft !== undefined) controls.throttleLeft = 0;
                        if (controls.throttleRight !== undefined) controls.throttleRight = 0;
                        if (controls.throttle1 !== undefined) controls.throttle1 = 0;
                        if (controls.throttle2 !== undefined) controls.throttle2 = 0;
                        if (controls.throttle3 !== undefined) controls.throttle3 = 0;
                        if (controls.throttle4 !== undefined) controls.throttle4 = 0;
                        $(document).trigger("autothrottleOff");
                        return;
                    }
                    const now = geofs.utils.now();
                    const previous = geofs.autothrottle._tickTime;
                    geofs.autothrottle._tickTime = now;
                    const c = previous == null ? 0.016 : Math.max(0.001, Math.min((now - previous) / 1000, 0.1));
                    const b = c * 1000;
                    try {
                        geofs.autothrottle.tick(c, b);
                    } catch (err) {
                        geofs.autothrottle.handleError(err);
                    }
                }
            },
            /**
             * Standardized error handling to prevent the script from crashing the simulator.
             */
            handleError: (a) => {
                console.error(a);
                if (window.V40_NOTIF) window.V40_NOTIF.critical('Autothrottle error: disabled. Check the console for details.');
                else window.GeoFSV4Core.notify('Autothrottle error: disabled. Check the console for details.', 'error');
                geofs.debug.log("meatbroc autothrottle error");
                geofs.api.removeFrameCallback(geofs.autothrottle.callbackID);
                $(document).trigger("autothrottleOff");
                geofs.autothrottle.error = !0;
            },
            _ktsSpeedAttributes: {smallstep: "5", stepthreshold: "100", step: "10", maxlength: "4", max: "9999"},
            _machSpeedAttributes: {smallstep: "0.01", decimals: "2", max: "10"}
        };
        geofs.autothrottle.init();
        /**
         * Autopilot API Extensions
         * Overrides default GeoFS autopilot functions to integrate the Autothrottle's 
         * enhanced speed and landing modes.
         */

        /**
         * Custom Landing Mode (Arming) toggle.
         * Renamed to "Landing Mode" in the UI for better user understanding.
         */
        geofs.autopilot.setArm = (a) => {
            const b = JSON.parse(a);
            geofs.autothrottle.armed = b;
            $("#armOn").toggleClass("green-pad active", b).attr("aria-pressed", String(b));
            $("#armOff").toggleClass("landing-selected active", !b).attr("aria-pressed", String(!b));
        };

        /**
         * Manages switching between KNOTS and MACH speed hold modes.
         * Updates the UI inputs to reflect the correct precision (e.g., 2 decimals for Mach).
         */
        geofs.autopilot.setAutothrottleSpeedMode = function (e) {
            const isMach = "mach" == e;
            $("#machMode").toggleClass("green-pad active", isMach);
            $("#knotsMode").toggleClass("green-pad active", !isMach);
            
            const $input = $(".ext-autothrottle-speed");
            let currentTarget = parseFloat($input.val());
            if (isNaN(currentTarget) || currentTarget <= 0) {
                currentTarget = geofs.autopilot.values.speed || (isMach ? 0.8 : 250);
            }
            
            const kias = geofs.animation.values.kias;
            const mach = geofs.animation.values.mach;
            const prevMode = this.speedMode; // "mach" or "kias" / "knots"

            if (isMach && prevMode !== "mach") {
                // Transitioning Knots -> Mach: convert knots value to mach
                if (kias && kias > 50 && mach) {
                    currentTarget = (currentTarget / kias) * mach;
                } else {
                    currentTarget = currentTarget / 661.47;
                }
            } else if (!isMach && prevMode === "mach") {
                // Transitioning Mach -> Knots: convert mach value to knots
                if (kias && kias > 50 && mach) {
                    currentTarget = (currentTarget / mach) * kias;
                } else {
                    currentTarget = currentTarget * 661.47;
                }
                currentTarget = Math.round(currentTarget);
            }

            this.setSpeedMode(isMach ? "mach" : "kias");
            this.setSpeed(currentTarget);
            
            // UI Sync: Update attributes before value to ensure correct clamping/formatting.
            $input.removeAttr("max");
            $input.attr(isMach ? geofs.autothrottle._machSpeedAttributes : geofs.autothrottle._ktsSpeedAttributes);
            $input.val(isMach ? currentTarget.toFixed(6) : Math.round(currentTarget)); // Increased precision to maintain exact user values

            if (window.V40_NOTIF) {
                window.V40_NOTIF.show(`🔄 Speed Mode Switched to ${isMach ? 'Mach' : 'Knots'} (${currentTarget.toFixed(isMach ? 2 : 0)} ${isMach ? 'M' : 'kts'})`);
            }
        }

        if (window.V40_NOTIF) {
            window.V40_NOTIF.show("GeoFS-V4.0_Autothrottle v1.0.0 Loaded.");
        }
        console.log("[GeoFS-V4.0_Autothrottle] >> Autothrottle System Initialized.");
    }
    window.GeoFSV4Core.initialize('Autothrottle', main).catch(() => {});
})();
