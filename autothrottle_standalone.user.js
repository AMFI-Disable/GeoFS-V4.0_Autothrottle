// ==UserScript==
// @name         GeoFS-V4.0_Autothrottle
// @namespace    https://greasyfork.org/users/1594049
// @version      0.1.0
// @description  Experimental independent airspeed hold for GeoFS V4.0 beta.
// @author       AMFI-Disable
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
    const core = window.GeoFSV4Core, design = window.GeoFSV4Design;
    if (!core || !design) { console.error('[GeoFS-V4.0_Autothrottle] Missing dependency'); return; }
    core.initialize('Autothrottle', () => {
        const sim = window.geofs, controls = window.controls;
        if (!controls?.manipulatorSetters?.setThrottle || !sim.api?.addFrameCallback) throw new Error('Required GeoFS controls unavailable');
        const panel = design.panel('AUTOTHROTTLE');
        panel.style.cssText = 'position:fixed;top:85px;right:12px;z-index:10000;min-width:200px';
        const label = document.createElement('label'); label.textContent = 'Target KIAS';
        const input = document.createElement('input'); input.type = 'number'; input.min = '40'; input.max = '600'; input.step = '1'; input.value = '200'; input.style.width = '78px'; label.appendChild(input);
        const status = document.createElement('p'); status.setAttribute('role','status');
        let enabled = false, aircraft = null, last = 0;
        const button = design.button('Engage', () => {
            if (enabled) { disengage('Off'); return; }
            const speed = Number(sim.animation?.values?.kias), target = Number(input.value);
            if (sim.autopilot?.on) { status.textContent = 'Turn off native autopilot first'; return; }
            if (!sim.aircraft?.instance || sim.aircraft.instance.groundContact || !Number.isFinite(speed) || !Number.isFinite(target) || target < 40 || target > 600) { status.textContent = 'Unavailable: check aircraft, flight and target'; return; }
            aircraft = sim.aircraft.instance; enabled = true; last = 0; button.textContent = 'Disengage'; button.setAttribute('aria-pressed','true'); status.textContent = 'Engaged';
        });
        function disengage(reason) { enabled = false; button.textContent = 'Engage'; button.setAttribute('aria-pressed','false'); status.textContent = reason; }
        button.setAttribute('aria-pressed','false'); status.textContent = 'Off';
        panel.append(label, button, status); document.body.appendChild(panel);
        sim.api.addFrameCallback(() => {
            if (!enabled) return;
            const now = performance.now(); if (last && now - last < 200) return;
            const dt = last ? Math.min((now-last)/1000, 0.5) : 0.2; last = now;
            const speed = Number(sim.animation?.values?.kias), target = Number(input.value), throttle = Number(controls.throttle);
            if (sim.autopilot?.on || sim.aircraft?.instance !== aircraft || aircraft.groundContact || !Number.isFinite(speed) || !Number.isFinite(target) || target < 40 || target > 600 || !Number.isFinite(throttle)) { disengage('Disconnected'); return; }
            const rate = core.clamp((target-speed)*0.003, -0.08, 0.08);
            controls.manipulatorSetters.setThrottle(core.clamp(throttle + rate*dt, 0, 1));
        });
    }).catch(() => {});
})();
