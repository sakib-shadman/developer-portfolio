# Case study draft: Inspector Android

Status: draft, not published.

## Sourced facts

- Native Android app used by Wigersma & Sikkema technicians to inspect gas lines and pressure stations. (LinkedIn; CV: "gas line and pressure station inspection app")
- Communicates with measurement devices over Bluetooth: Bluetooth commands and data exchange. (CV, LinkedIn)
- Runs inspection instructions and visualizes results such as pressure and leakage in graphs. (CV, LinkedIn)
- Revamped the UI, added new features and reworked core logic "to make the app far more stable". (LinkedIn; CV: "reworked core logic for stability")
- Upgraded to the latest Android version. (CV)
- Kotlin, Bluetooth, BLE, MVVM, Retrofit. (CV)
- Vivasoft, 2024 to 2025. (CV, LinkedIn)

## Draft

```mdx
---
project: inspector-android
problem: Technicians inspecting gas lines and pressure stations drive measurement devices from the app over Bluetooth. The app had to run inspections reliably in the field, and its core logic was not stable enough.
outcomes:
  - Revamped the UI and reworked the core logic to make the app far more stable.
  - Upgraded the app to the latest Android version.
---

<Section eyebrow="Context" title="Inspections driven over Bluetooth">

Wigersma & Sikkema technicians use Inspector Android to inspect gas lines and pressure stations. The app talks to their measurement devices over Bluetooth, walks the technician through inspection instructions and shows results such as pressure and leakage as graphs. I worked on it at Vivasoft in 2024 and 2025.

</Section>

<Section eyebrow="What I built" title="Stability, a new UI and new features">

- Bluetooth commands and data exchange with the measurement devices.
- Inspection instructions, and pressure and leakage graphs.
- A revamped UI and new features.
- Reworked core logic for stability, and an upgrade to the latest Android version.

Built with Kotlin, Bluetooth and BLE, MVVM and Retrofit.

</Section>
```

The `problem` line is a framing of the sourced facts ("reworked core logic to make the app far more stable"); confirm or rewrite it.

## Questions for the owner

1. What made the old core logic unstable? (Connection handling, threading, state across screen rotation, a protocol issue?) This is the heart of the case study.
2. How does the Bluetooth layer work now: classic Bluetooth, BLE or both; a command queue; how disconnects and retries are handled?
3. How did you test against real devices? Was there a simulator or a test rig?
4. What did the Android upgrade involve (target SDK, permissions such as `BLUETOOTH_CONNECT`, background restrictions)?
5. Any before/after you can share: crash rate, failed-inspection rate, support tickets. Only if real.
6. Is it OK to name Wigersma & Sikkema on the page? (Already on the public CV and LinkedIn.)
