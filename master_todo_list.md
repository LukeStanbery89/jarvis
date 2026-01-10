# ✅ MASTER TODO LIST (ORDERED)

---

## 🧱 TIER 0 — FOUNDATIONS

---

### Device Identity & Registration (`@jarvis/device-identity`)

* [ ] Generate persistent device UUID

  * [ ] Define UUID generation strategy
  * [ ] Store UUID on disk
  * [ ] Reload UUID on reboot
  * **Acceptance:** Device reconnects with same ID after reboot

* [ ] Define device metadata schema

  * [ ] room
  * [ ] capabilities (mic, speaker, camera)
  * [ ] hardware info
  * **Acceptance:** Server stores & exposes metadata

---

### Authentication & Authorization (`@jarvis/auth-protocol`)

* [ ] Implement shared-secret auth handshake (POC)

  * [ ] Token sent during WS connect
  * [ ] Server validates token
  * **Acceptance:** Unauthorized device rejected

* [ ] Capability-based authorization

  * [ ] Attach capabilities to device session
  * [ ] Enforce on message handling
  * **Acceptance:** Device cannot perform unsupported actions

---

### Messaging & Protocol (`@jarvis/protocol`)

* [ ] Define message envelope

  * [ ] `type`
  * [ ] `version`
  * [ ] `payload`
  * [ ] binary payload support
  * **Acceptance:** Audio & images transmitted safely

* [ ] Protocol version negotiation

  * [ ] Client advertises version
  * [ ] Server responds with accepted version
  * **Acceptance:** Older clients don’t crash

---

### WebSocket Transport

#### Client (`@jarvis/ws-client`)

* [ ] WebSocket connection logic
* [ ] Auto-reconnect with backoff
* [ ] Heartbeat ping/pong
* **Acceptance:** Client reconnects within 5s

#### Server (`@jarvis/ws-server`)

* [ ] Connection lifecycle handling
* [ ] Device presence tracking
* [ ] Offline timeout
* **Acceptance:** No zombie sessions

---

## 🔊 TIER 1 — AUDIO (FIRST VERTICAL SLICE)

---

### Wake Word Detection (`@jarvis/wake-word`)

* [ ] Benchmark Vosk vs Porcupine (POC)

  * [ ] CPU usage
  * [ ] latency
  * [ ] false positives
  * **Acceptance:** One engine selected

* [ ] Implement wake event emission

  * [ ] Cooldown logic
  * [ ] Structured wake message
  * **Acceptance:** Wake fires once per utterance

---

### Audio Capture (`@jarvis/audio-capture`)

* [ ] Capture mic audio via ALSA
* [ ] Normalize to 16kHz mono PCM
* [ ] Validate audio integrity
* **Acceptance:** Clean PCM stream

---

### Audio Streaming (`@jarvis/audio-stream`)

* [ ] Define audio chunk size
* [ ] Implement PCM framing
* [ ] Start/stop streaming commands
* [ ] Silence suppression
* **Acceptance:** <300kbps bandwidth

---

### Speech-to-Text (`@jarvis/stt`)

* [ ] Whisper integration (POC)
* [ ] Stream PCM into Whisper
* [ ] Emit partial transcripts
* [ ] Emit final transcript
* **Acceptance:** Partial <1s, final accurate

---

### Text-to-Speech (`@jarvis/tts`)

* [ ] Evaluate local TTS engines
* [ ] Select default voice
* [ ] Generate PCM output
* **Acceptance:** Natural, offline speech

---

### Audio Playback (`@jarvis/audio-playback`)

* [ ] Receive PCM stream
* [ ] Buffer for smooth playback
* [ ] Handle stop/interrupt
* **Acceptance:** Playback <500ms latency

---

## 👁️ TIER 1 — VISION (EDGE AI)

---

### Camera Capture (`@jarvis/camera`)

* [ ] Integrate libcamera (POC)
* [ ] Capture still image on command
* [ ] JPEG encode
* **Acceptance:** Image delivered <300ms

---

### Face Detection (`@jarvis/vision-face-detect`)

* [ ] Integrate IMX500 face detection model
* [ ] Extract bounding boxes
* [ ] Tune confidence thresholds
* **Acceptance:** <200ms/frame, <5% false positives

---

### Face Embeddings (`@jarvis/vision-embeddings`)

* [ ] Integrate embedding model
* [ ] Normalize vectors
* [ ] Version embeddings
* **Acceptance:** Same face similarity >0.9

---

### Local Face Registry (`@jarvis/face-registry-client`)

* [ ] In-memory registry (POC)
* [ ] Persistent storage
* [ ] Cosine similarity search
* **Acceptance:** Lookup <10ms

---

### Unknown Face Handling (`@jarvis/identity-resolution`)

* [ ] Generate temporary face IDs
* [ ] Track unknown across frames
* [ ] Optional face snapshot capture
* **Acceptance:** Unknown faces escalated once

---

### Server Face Registry (`@jarvis/face-registry-server`)

* [ ] Identity schema
* [ ] Store embeddings (pgvector)
* [ ] CRUD API
* [ ] Versioning
* **Acceptance:** Identities sync correctly

---

### Identity Sync

* [ ] Push registry updates to clients
* [ ] Handle revocations
* [ ] Conflict resolution
* **Acceptance:** No stale identities

---

## 🧠 TIER 2 — INTELLIGENCE & FUSION

---

### Context Fusion (`@jarvis/context-fusion`)

* [ ] Correlate face + mic
* [ ] Determine active speaker
* [ ] Resolve ambiguity
* **Acceptance:** Correct user selected

---

### Authorization (`@jarvis/authorization`)

* [ ] Define auth levels (guest/known/trusted)
* [ ] Map tasks → required level
* [ ] Enforce at execution time
* **Acceptance:** Sensitive tasks gated

---

## 🛠️ TIER 3 — OPS & HARDENING

---

### Telemetry (`@jarvis/telemetry`)

* [ ] Structured event logging
* [ ] Device health metrics
* [ ] Privacy-safe redaction
* **Acceptance:** Full request traceable

---

### Provisioning (`@jarvis/provisioning`)

* [ ] New device bootstrap flow
* [ ] Config fetch on first boot
* [ ] OTA update POC
* [ ] Rollback support
* **Acceptance:** New node online <10 min

---

## ✨ OPTIONAL — J.A.R.V.I.S. POLISH

* [ ] Follow-me room continuity
* [ ] Emotion detection
* [ ] Gesture recognition
* [ ] Personalized voice per user
* [ ] Proactive alerts
