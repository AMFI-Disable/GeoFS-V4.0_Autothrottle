// ==UserScript==
// @name         GeoFS-V4.0_Autothrottle
// @namespace    https://greasyfork.org/users/1594049
// @version      0.1.1
// @description  Experimental independent airspeed hold for GeoFS V4.0 beta.
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
    const core = window.GeoFSV4Core, design = window.GeoFSV4Design;
    if (!core || !design) { console.error('[GeoFS-V4.0_Autothrottle] Missing dependency'); return; }
    core.initialize('Autothrottle', () => {
        const sim = window.geofs, controls = window.controls;
        if (!controls?.manipulatorSetters?.setThrottle || !sim.api?.addFrameCallback) throw new Error('Required GeoFS controls unavailable');
        const bar = document.querySelector('.geofs-autopilot-bar');
        if (!bar) throw new Error('GeoFS autopilot bar unavailable');
        const style = document.createElement('style');
        style.textContent = `.v4-at-bar{display:inline-block;vertical-align:top;margin-left:5px;pointer-events:auto}.v4-at-pad{cursor:pointer}.v4-at-controls{display:inline-block;vertical-align:top;margin-left:5px}.v4-at-controls[hidden]{display:none}.v4-at-speed{width:70px;text-align:right}.v4-at-status{position:absolute;top:100%;font-size:11px;color:white;background:#222;white-space:nowrap}.v4-at-bar{position:relative}`;
        document.head.appendChild(style);
        const wrapper = document.createElement('div'); wrapper.className = 'v4-at-bar';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'control-pad v4-at-pad'; button.title = 'Toggle autothrottle on/off'; button.setAttribute('aria-pressed', 'false');
        const buttonLabel = document.createElement('span'); buttonLabel.className = 'control-pad-label transp-pad'; buttonLabel.textContent = 'A/THR'; button.appendChild(buttonLabel);
        const fields = document.createElement('span'); fields.className = 'v4-at-controls'; fields.hidden = true;
        const down = document.createElement('button'); down.type = 'button'; down.textContent = '−'; down.title = 'Decrease target speed';
        const input = document.createElement('input'); input.className = 'numberValue v4-at-speed'; input.type = 'number'; input.min = '40'; input.max = '600'; input.step = '1'; input.value = '200'; input.setAttribute('aria-label', 'Target KIAS');
        const up = document.createElement('button'); up.type = 'button'; up.textContent = '+'; up.title = 'Increase target speed';
        const unit = document.createElement('span'); unit.textContent = ' KTS';
        const status = document.createElement('span'); status.className = 'v4-at-status'; status.setAttribute('role', 'status');
        fields.append(down, input, up, unit); wrapper.append(button, fields, status); bar.appendChild(wrapper);
        down.addEventListener('click', () => { input.value = String(core.clamp(Number(input.value) - 5, 40, 600)); });
        up.addEventListener('click', () => { input.value = String(core.clamp(Number(input.value) + 5, 40, 600)); });
        let enabled = false, aircraft = null, last = 0;
        button.addEventListener('click', () => {
            if (enabled) { disengage('Off'); return; }
            const speed = Number(sim.animation?.values?.kias), target = Number(input.value);
            if (sim.autopilot?.on) { status.textContent = 'Turn off native autopilot first'; return; }
            if (!sim.aircraft?.instance || sim.aircraft.instance.groundContact || !Number.isFinite(speed) || !Number.isFinite(target) || target < 40 || target > 600) { status.textContent = 'Unavailable: check aircraft, flight and target'; return; }
            aircraft = sim.aircraft.instance; enabled = true; last = 0; button.classList.add('green-pad'); button.setAttribute('aria-pressed','true'); fields.hidden = false; status.textContent = '';
        });
        function disengage(reason) { enabled = false; button.classList.remove('green-pad'); button.setAttribute('aria-pressed','false'); fields.hidden = true; status.textContent = reason; }
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
