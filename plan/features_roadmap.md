# Sovereign Distributed Live Classroom System
## Application-Layer Features Roadmap

---

## 1. Feature Categorization & Audit

Managing a 200-student live session requires robust application-layer features categorized into four main domains:

### A. Session Control (Moderation & Flow)
*   **Mute/Unmute All:** Instantly silence or unmute all participants.
*   **Granular Audio/Video Control:** Mute/unmute or disable/enable video for specific students.
*   **Kick/Ban Student:** Remove disruptive students temporarily or permanently.
*   **Pause Session:** Temporarily suspend media transmission without disconnecting the session (e.g., for a quick break).
*   **Spotlight / Focus Mode:** Bring a specific student's video to the main screen (Teacher PC) while minimizing others.
*   **Lock Room:** Prevent new students from joining after a certain time.

### B. Student Engagement (Interaction)
*   **Raise Hand Queue:** A structured queue system for students wanting to speak, showing who raised their hand first.
*   **Smart Chat:** Real-time text chat with moderation filters, direct messaging (Teacher <-> Student), and Q&A modes.
*   **Live Polls & Quizzes:** Quick pop-up polls to gauge understanding.
*   **Reactions:** Ephemeral emojis (👍, 👏, ❓) that float on the student's video tile without disrupting audio.

### C. Media & Presentation (Content Delivery)
*   **Teacher Screen Share (Dual Track):** Always available, high-quality sharing of the teacher's screen/presentation alongside their webcam feed.
*   **Student Screen Share (Restricted):** Restricted feature that cannot be used by default. Requires manual activation/permission by the teacher for only one (or a very limited number of) students at a time to present their screen.
*   **Interactive Whiteboard:** A shared canvas for the teacher to draw, write, and optionally allow specific students to interact.
*   **Media Player Sync:** Synchronized playback of pre-recorded videos for all participants.
*   **Document Sharing:** In-session file distribution (PDFs, images).

### D. Monitoring & Analytics (Observability)
*   **Network Health Indicators:** Visual cues (e.g., signal bars) on each student's tile showing their connection quality.
*   **Voice Activity Detection (VAD):** Visual highlight on the tile of the student currently speaking.
*   **Auto-Attendance:** Automated tracking of join/leave times for the session.
*   **Engagement Score:** A calculated metric based on chat activity, polls answered, and attention tracking.

---

## 2. Current State vs. Gap Analysis

Based on the existing Node.js, Socket.io, LiveKit SFU, and Next.js setup:

### ✅ Existing (Implemented or Partially Implemented)
*   ✅ **Basic Join/Leave:** Token service and basic entry mechanics are functional.
*   ✅ **Mute/Unmute All (Audio):** Implemented via Socket.io signaling.
*   ✅ **Targeted Mute/Unmute:** Implemented via Socket.io signaling.
*   ✅ **Kick Student:** Implemented (banning logic exists in Lecture service).
*   ✅ **Grid View:** Foundational multi-screen grid layout logic exists.

### ❌ Missing (To Be Implemented)
*   ❌ **Raise Hand Queue:** No structured queue system yet.
*   ❌ **Pause Session:** No logic to suspend media streams temporarily.
*   ❌ **Spotlight / Focus Mode:** Missing logic to enlarge a specific student.
*   ❌ **Smart Chat / Q&A:** No text communication channel built.
*   ❌ **Live Polls & Quizzes:** Not implemented.
*   ❌ **Screen Share / Whiteboard:** Only webcam tracks are currently handled.
*   ❌ **Voice Activity Detection (VAD):** Missing UI highlighting for active speakers.
*   ❌ **Network Health Indicators:** Missing visual representation of connection stats.
*   ❌ **Lock Room:** No feature to prevent late entries dynamically.

---

## 3. Execution & Phasing Strategy

### Phase 1: MVP (Must-haves for initial launch - Focus on Control & Stability)
1.  **Voice Activity Detection (VAD):** Critical for identifying who is speaking in a 200-student grid.
2.  **Spotlight / Focus Mode:** Essential for the teacher to interact 1-on-1.
3.  **Raise Hand Queue:** Basic interaction mechanism to maintain order.
4.  **Network Health Indicators:** Needed for troubleshooting individual student issues.

### Phase 2: Enhancements (High-value additions - Focus on Engagement)
1.  **Pause Session:** For breaks without ending the room.
2.  **Screen Share (Teacher):** Allowing presentation delivery.
3.  **Smart Chat (Q&A Mode):** Text-based interaction with moderation.
4.  **Lock Room:** Administrative control over latecomers.

### Phase 3: Future Polish (Advanced enterprise features)
1.  **Interactive Whiteboard:** For complex visual explanations.
2.  **Live Polls & Quizzes:** For active assessment.
3.  **Auto-Attendance & Engagement Scoring:** For post-session analytics.
4.  **Reactions:** For non-verbal feedback.

---

## 4. Technical Implementation Notes (Top 3 Critical Missing Features)

### 1. Raise Hand Queue (Socket.io & Redis)
*   **Approach:** Maintain a sorted set (ZSET) in Redis representing the queue for a specific `roomId`.
*   **Action (Student):** Emits `student:raise_hand`.
*   **Backend:** Adds the student's ID to the Redis ZSET using the current timestamp as the score.
*   **Broadcast:** Emits `room:hand_queue_update` with the ordered list to the Teacher Dashboard.
*   **Action (Teacher):** Acknowledges the student, emitting `teacher:lower_hand`. Backend removes the ID from Redis and broadcasts the updated queue.

### 2. Spotlight / Focus Mode (LiveKit & React State)
*   **Approach:** Manage a `spotlightedStudentId` state in the Central Orchestrator/Redis.
*   **Action (Teacher):** Clicks "Spotlight" on a student tile. Emits `teacher:spotlight(studentId)`.
*   **Backend:** Updates room state in Redis and broadcasts `room:spotlight_active(studentId)`.
*   **Action (Display Clients):** The Teacher PC renders that student's `VideoTrack` in a large main container. The Grid PCs (Mini PCs) can optionally apply a visual border or keep their grid layout. LiveKit's `TrackSubscribed` event ensures the Teacher PC requests the `HIGH` quality layer for the spotlighted student via `pub.setVideoQuality(VideoQuality.HIGH)`.

### 3. Pause Session (LiveKit Tracks)
*   **Approach:** Instead of disconnecting Socket.io or WebRTC, manipulate the media tracks directly to save bandwidth and instantly pause.
*   **Action (Teacher):** Clicks "Pause Session". Emits `teacher:pause_session`.
*   **Backend:** Broadcasts `room:session_paused`.
*   **Action (Clients):**
    *   **Students:** Automatically disable their local video/audio tracks (`track.mute()`). UI shows a "Session Paused by Teacher" overlay.
    *   **Displays:** Render a placeholder image or screensaver, pausing incoming stream decoding to drop CPU usage.
    *   **Resuming:** Emitting `teacher:resume_session` reverses the process, calling `track.unmute()` on student clients.
