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
*   ✅ **Raise Hand Queue:** Implemented with visual pulsing and dashboard alerts.
*   ✅ **Smart Chat / Q&A:** High-performance system with private messaging and unread counts.
*   ✅ **Voice Activity Detection (VAD):** Visual highlighting for active speakers implemented.
*   ✅ **Responsive Controls:** Controls adapt to screen size and device type.
*   ✅ **Smart Wake-Up System:** Auto-trigger UI visibility on critical events.

*   ✅ **Network Health Indicators:** Live signal bars implemented for real-time monitoring.
*   ✅ **Lock Room:** Dynamic room entry lock fully functional.
*   ✅ **Teacher Self-View (Floating):** Draggable and resizable cockpit monitor.
*   ✅ **Interactive Whiteboard:** Sovereign drawing system with real-time sync.

### ❌ Missing (To Be Implemented)
*   ❌ **Pause Session:** Full session suspension logic (media + UI overlay).
*   ❌ **Live Polls & Quizzes:** Not implemented.
*   ❌ **Auto-Attendance:** Not implemented.

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

### 2. Spotlight / Focus Mode (Orchestration & Multi-Select)
*   **Approach:** Local state managed by Teacher Dashboard, emitting commands to external screens via Socket.io.
*   **Action (Teacher):** Clicks "Spotlight" (Wall or Dashboard) on one or multiple student tiles.
*   **Multi-Select:** Emits `teacher:feature_student` with a comma-separated list of IDs to bypass backend limitations.
*   **Action (Display Clients):** The Teacher Dashboard and External Wall dynamically calculate grid columns based on the number of featured students. Unselected students are hidden from the target destination.

### 3. Pause Session (LiveKit Tracks)
*   **Approach:** Instead of disconnecting Socket.io or WebRTC, manipulate the media tracks directly to save bandwidth and instantly pause.
*   **Action (Teacher):** Clicks "Pause Session". Emits `teacher:pause_session`.
*   **Backend:** Broadcasts `room:session_paused`.
*   **Action (Clients):**
    *   **Students:** Automatically disable their local video/audio tracks (`track.mute()`). UI shows a "Session Paused by Teacher" overlay.
    *   **Displays:** Render a placeholder image or screensaver, pausing incoming stream decoding to drop CPU usage.
    *   **Resuming:** Emitting `teacher:resume_session` reverses the process, calling `track.unmute()` on student clients.

---

## 5. جدول حالة الإضافات (Features Status Table)

| اسم الإضافة | توضيح | نسبة التنفيذ |
| :--- | :--- | :--- |
| **الدخول والخروج الأساسي** | نظام الانضمام للغرفة وتوليد التوكينز | 100% |
| **الاستقرار المعماري (Stability)** | حل مشاكل WebRTC Race Conditions وثبات الاتصال | 100% |
| **كتم/إلغاء كتم الجميع** | التحكم الجماعي في ميكروفونات الطلاب من المعلم | 100% |
| **التحكم الفردي (Mute/Kick)** | كتم صوت طالب معين أو طرده من الجلسة | 100% |
| **عرض الشبكة (Grid View)** | توزيع تلقائي للمشاركين على الشاشات الكبيرة | 100% |
| **صورة داخل صورة (PiP)** | عرض كاميرا الطالب بشكل عائم وقابل للتحريك | 100% |
| **شريط التحكم (Control Bar)** | أزرار التحكم في الكاميرا والميكروفون والمغادرة | 100% |
| **طابور رفع اليد** | نظام لترتيب الطلاب الراغبين في التحدث مع تنبيهات وميض | 100% |
| **الدردشة والأسئلة (Chat)** | قناة تواصل نصية خاصة وعامة مع عداد رسائل | 100% |
| **اكتشاف التحدث (VAD)** | تمييز بصري للطالب الذي يتحدث حالياً | 100% |
| **الاستيقاظ الذكي (Wake-Up)** | ظهور القوائم تلقائياً عند حدوث تفاعل أو طوارئ | 100% |
| **التنسيق المستجيب (Responsive)** | تكييف حجم القوائم مع مقاس الشاشة والجهاز | 100% |
| **وضع التركيز (Spotlight & Multi-Select)** | توجيه طالب أو أكثر لشاشة المعلم أو الشاشة الخارجية | 100% |
| **مشاركة الشاشة (المعلم)** | عرض شاشة المعلم أو العرض التقديمي للطلاب | 100% |
| **السبورة التفاعلية (Whiteboard)** | لوحة رسم سيادية للمعلم مع بث لحظي للطلاب | 90% |
| **مؤشرات صحة الشبكة** | عرض جودة اتصال المعلم والطلاب (Signal Bars) | 100% |
| **قفل الغرفة** | منع دخول طلاب جدد بعد بدء المحاضرة | 100% |
| **الحضور التلقائي** | تتبع وقت دخول وخروج كل طالب آلياً | 0% |
| **تعليق الجلسة (Pause)** | إيقاف البث مؤقتاً دون قطع الاتصال | 50% |
| **الاستطلاعات الحية (Polls)** | إنشاء تصويت سريع للطلاب أثناء المحاضرة | 0% |

---

## 6. Detailed Implementation: Sovereign Whiteboard (Phase 1)

The Sovereign Whiteboard is a high-performance, low-latency drawing canvas designed for the teacher to deliver visual explanations. Unlike standard screen sharing, it transmits vector drawing data (coordinates and paths) via Socket.io, ensuring crisp quality even on low bandwidth.

### Step 1: Teacher Canvas Engine (The Creator)
*   **Technology:** HTML5 Canvas API + `react-konva` or standard Canvas context.
*   **Tools:**
    *   **Pen Tool:** Smooth Bezier curves for handwriting.
    *   **Eraser:** Path-based erasing.
    *   **Shapes:** Lines, Circles, Rectangles.
    *   **Backgrounds:** Ability to "Slide" a PDF page or Image behind the drawing layer.
    *   **Clear All:** Instant canvas wipe.
*   **Sync:** Every `mousedown`, `mousemove`, and `mouseup` event calculates relative coordinates (0 to 1) to ensure consistent rendering across different student screen sizes.

### Step 2: Synchronization Layer (Socket.io)
*   **Events:**
    *   `whiteboard:draw_data`: Broadcasts `{ type, path, color, thickness, isLastPoint }`.
    *   `whiteboard:clear`: Broadcasts a wipe command.
    *   `whiteboard:request_state`: When a new student joins, they request the full current drawing history to rebuild the canvas.
*   **Persistence:** Store current session paths in an in-memory buffer (or Redis) for late-joiners.

### Step 3: Student Mirror (The Viewer)
*   **Interface:** A read-only canvas module that slides into view when the teacher activates "Whiteboard Mode".
*   **Rendering:** Listens for `whiteboard:draw_data` and executes drawing commands on a local hidden canvas, then paints to the UI.
*   **Zero-Interference:** Students cannot draw or erase by default, preserving the teacher's "Sovereign" control.

### Step 4: UI Integration
*   **Teacher Dashboard:** A new toggle in the side Command Dock to launch the Whiteboard overlay.
*   **HUD Integration:** Minimize/Maximize whiteboard while keeping student feeds visible in a sidebar or PiP mode.

