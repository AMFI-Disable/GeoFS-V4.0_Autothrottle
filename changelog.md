# Changelog

All notable changes, features, and architectural capabilities of this project are documented in this file.

---

## [Unreleased]

### Changed

- **Version 1.0.0 Release Preparation**: Promoted the standalone script to version 1.0.0, updated userscript metadata and notification banners to v1.0.0, and aligned documentation, version badges, and fair-play disclaimers with the GeoFS V4.0 ecosystem.

---

## [1.0.1] - Compatibility And Documentation

### Changed

- Align shared userscript metadata with the other standalone scripts.
- Correct the documented GeoFS version compatibility.
- Add concise localized metadata for the supported locales.

---

## [1.0.0] - GeoFS V4.0 Release

### Changed

- Promote the existing GeoFS V4.0 standalone script to version 1.0.0.
- Align the release documentation and userscript metadata with the V4.0 ecosystem.

### Fixed

- **Standalone Error Handling**: Made throttle limits independent of the Landing Statistics script by introducing local clamping logic and ensured safe execution with the shared notification API (`window.V40_NOTIF.show`).

---

## [0.1.5] - V4 Integration Update

- Synchronizes available multi-engine throttle channels during control and landing retard.
- Live GeoFS V4 validation is pending.

## [0.1.4] - V4 Compatibility Fixes

- Restores the pilot’s OP Engines settings and multiplier when automatic synchronization ends.

## [0.1.3] - V4 Foundation Integration

- Use V4 ecosystem event and notification names.

## [0.1.2] - V3.9 Autothrottle Port

- Restore the V3.9 native-style A/THR bar, KTS/Mach controls, landing arming switch, and PID controller.
- Adapt initialization, throttle output, and frame timing for GeoFS V4.
- Experimental: V4 flight and landing testing is pending.

## [0.1.1] - Autopilot Bar

- Place A/THR and its KIAS controls in the GeoFS autopilot bar.
- Add the GeoFS favicon.

## [0.1.0] - Experimental KIAS Hold

### Added

- Independent KIAS hold using the GeoFS V4 unified throttle setter.
- Automatic disconnect on native autopilot engagement, aircraft changes, ground contact, or invalid inputs.

This initial version is unstable and has not been flight-tested.
