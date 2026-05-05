# Component 11: Simulcast Quality Layers
## المكون: بث متعدد الجودات (Simulcast)

---

## الهدف
كل طالب يبث فيديو بـ 3 جودات مختلفة (Low, Medium, High) في نفس الوقت. كل شاشة تستقبل الجودة المناسبة فقط — هذا يوفر 60-70% من bandwidth.

---

## الموقع في المشروع
```
backend/src/services/livekit.service.ts        ← تفعيل Simulcast في Token
student-client/src/contexts/LiveKitContext.tsx  ← إعدادات النشر
wall-client/src/components/GridPage.tsx         ← اختيار الجودة
wall-client/src/components/TeacherDashboard.tsx ← تبديل الجودة (موجود جزئياً)
```

---

## كيف يعمل Simulcast

```
الطالب يبث ←──── 3 طبقات في نفس الوقت:
  ┌─────────────────────────────────────┐
  │ Layer 0 (Low):    320×180  @ 15fps  │ → 150 Kbps
  │ Layer 1 (Medium): 640×360  @ 25fps  │ → 500 Kbps
  │ Layer 2 (High):   1280×720 @ 30fps  │ → 1.5 Mbps
  └─────────────────────────────────────┘
  
LiveKit SFU يختار الطبقة المناسبة لكل مشترك:
  - GridPage (4 طلاب/شاشة) ← Medium (480p)
  - GridPage (12 طالب/شاشة) ← Low (180p)
  - Teacher Focus View ← High (720p)
```

---

## التعديلات المطلوبة

### 1. Student Client — تفعيل Simulcast عند النشر
```typescript
// student-client/src/contexts/LiveKitContext.tsx
// عند الاتصال بالغرفة:
const room = new Room({
  adaptiveStream: true,
  dynacast: true,              // ← مهم: يوقف الطبقات غير المطلوبة
  videoCaptureDefaults: {
    resolution: { width: 1280, height: 720, frameRate: 30 }
  },
  publishDefaults: {
    simulcast: true,           // ← تفعيل Simulcast
    videoSimulcastLayers: [
      { width: 320, height: 180, encoding: { maxBitrate: 150_000, maxFramerate: 15 } },
      { width: 640, height: 360, encoding: { maxBitrate: 500_000, maxFramerate: 25 } },
    ],
    videoCodec: 'vp8',
  }
});
```

### 2. GridPage — اختيار الجودة بناءً على عدد الطلاب
```typescript
// wall-client/src/components/GridPage.tsx
function getOptimalQuality(studentsPerScreen: number): VideoQuality {
  if (studentsPerScreen <= 2) return VideoQuality.HIGH;    // 720p
  if (studentsPerScreen <= 6) return VideoQuality.MEDIUM;  // 360p
  return VideoQuality.LOW;                                  // 180p
}

// عند الاشتراك في فيديو طالب:
room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
  if (track.kind === Track.Kind.Video) {
    const quality = getOptimalQuality(count);
    pub.setVideoQuality(quality);
  }
});
```

### 3. Backend — Token مع Simulcast permissions
```typescript
// backend/src/services/livekit.service.ts
at.addGrant({
  roomJoin: true,
  room: options.roomName,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  roomAdmin: options.isTeacher || false,
  // Simulcast يعمل تلقائياً — لا يحتاج إذن خاص في Token
});
```

---

## حساب التوفير في Bandwidth

```
بدون Simulcast:
  60 طالب × 1.5 Mbps (720p) × 15 شاشة = 1,350 Mbps ❌ مستحيل

مع Simulcast + Selective:
  60 طالب × 500 Kbps (360p) × (كل شاشة تستقبل 4 فقط)
  = 15 شاشة × 4 طلاب × 500 Kbps = 30 Mbps ✅ ممتاز
```

---

## معايير القبول
1. ✅ الطالب يبث 3 طبقات جودة
2. ✅ GridPage تستقبل Medium عند 4 طلاب/شاشة
3. ✅ GridPage تستقبل Low عند 9+ طلاب/شاشة
4. ✅ تبديل الجودة يتم فوراً (< 1 ثانية)
5. ✅ Bandwidth الإجمالي < 100 Mbps لـ 60 طالب + 15 شاشة
