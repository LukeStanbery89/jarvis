# 📦 Module / Library Inventory (High-Level)

> These are **logical packages**, not necessarily separate repos at first.
> Start monorepo → split later if needed.

---

## Core Infrastructure

* **`@jarvis/protocol`**
  Message envelopes, framing, versioning

* **`@jarvis/ws-client`**
  WebSocket client with reconnect, heartbeat

* **`@jarvis/ws-server`**
  WebSocket server, routing, device registry

* **`@jarvis/device-identity`**
  Device ID generation, persistence, metadata

* **`@jarvis/auth-protocol`**
  Device authentication & capability auth

---

## Audio

* **`@jarvis/wake-word`**
  Wake word detection abstraction

* **`@jarvis/audio-capture`**
  Mic capture, PCM normalization

* **`@jarvis/audio-stream`**
  Audio chunking, transport, flow control

* **`@jarvis/stt`**
  Speech-to-text (Whisper wrapper)

* **`@jarvis/tts`**
  Text-to-speech abstraction

* **`@jarvis/audio-playback`**
  Client-side PCM playback

---

## Vision

* **`@jarvis/camera`**
  libcamera abstraction, still capture

* **`@jarvis/vision-face-detect`**
  Face detection (IMX500 accelerated)

* **`@jarvis/vision-embeddings`**
  Face embedding generation

* **`@jarvis/face-registry-client`**
  Local known-face registry

* **`@jarvis/face-registry-server`**
  Global identity store (server authority)

* **`@jarvis/identity-resolution`**
  Unknown face handling & reconciliation

---

## Intelligence & Control

* **`@jarvis/context-fusion`**
  Vision + audio + device correlation

* **`@jarvis/authorization`**
  Identity → permission mapping

---

## Ops & Observability

* **`@jarvis/telemetry`**
  Logs, metrics, tracing

* **`@jarvis/provisioning`**
  Device bootstrap & OTA updates