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

The project page already renders three sections from data: "The problem" (`problem` below), "What I did" (the project's `contributions`) and "Results" (`outcomes`). The MDX body is for what those don't cover (architecture, decisions, challenges, metrics), so it stays empty until the questions below are answered. Nothing in `outcomes` may repeat a contribution.

```mdx
---
project: inspector-android
problem: Technicians inspecting gas lines and pressure stations use the app to talk to measurement devices over Bluetooth, run inspection instructions and read pressure and leakage graphs. The app needed to become far more stable.
outcomes: []
---
```

The `problem` line is a framing of the sourced facts (LinkedIn: "reworked core logic to make the app far more stable"); confirm or rewrite it. A real before/after (question 5) would go in `outcomes`.

## Questions for the owner

1. What made the old core logic unstable? (Connection handling, threading, state across screen rotation, a protocol issue?) This is the heart of the case study.
2. How does the Bluetooth layer work now: classic Bluetooth, BLE or both; a command queue; how disconnects and retries are handled?
3. How did you test against real devices? Was there a simulator or a test rig?
4. What did the Android upgrade involve (target SDK, permissions such as `BLUETOOTH_CONNECT`, background restrictions)?
5. Any before/after you can share: crash rate, failed-inspection rate, support tickets. Only if real.
6. Is it OK to name Wigersma & Sikkema on the page? (Already on the public CV and LinkedIn.)
