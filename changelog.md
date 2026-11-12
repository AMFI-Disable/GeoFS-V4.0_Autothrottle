# Changelog

## Unreleased - V4 compatibility fixes

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
