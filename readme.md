# GeoFS-V4.0_Autothrottle

The A/THR button is integrated into the GeoFS autopilot bar, following V3.9. An experimental independent KIAS hold for GeoFS 4.0 Beta. This is a development prototype and has not yet been flight-tested. It commands all engines together through GeoFS's native throttle setter. Engage only in flight, with GeoFS's native autopilot off. It disconnects if the native autopilot engages, the aircraft changes, ground contact occurs, or inputs become invalid. It does not implement Mach hold, landing mode, engine-specific control, or manual-input override.

The design follows inspection of the current beta runtime; GeoFS can change. Use for testing only; controller behavior still needs live validation.
