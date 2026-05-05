# مرجع المكونات (Components Reference)

## 📦 المكونات المشتركة (Shared Components)

### 1. `VideoTrack`
عرض مسار فيديو واحد من مشارك.

**Props:**
```tsx
interface VideoTrackProps {
  participant: Participant;
  fit?: 'cover' | 'contain';  // object-fit للفيديو
  showName?: boolean;          // عرض اسم المشارك والميكروفون
}
```

**الاستخدام:**
```tsx
<VideoTrack 
  participant={teacherParticipant} 
  fit="contain"  // للمحاضر: لا نقطع الشاشة
  showName={true}
/>
```

**الميزات:**
- ✅ Avatar تلقائي عند إيقاف الكاميرا
- ✅ عرض حالة الميكروفون (Muted/Unmuted)
- ✅ معالجة تركيب/فك تركيب المسارات تلقائياً

---

### 2. `ControlBar` (Student Client فقط)
شريط تحكم عائم بأزرار المايك والكاميرا والخروج.

**Props:**
```tsx
interface ControlBarProps {
  isMicOn: boolean;
  isCamOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
  isVisible?: boolean;  // إظهار/إخفاء
}
```

**الاستخدام:**
```tsx
<ControlBar 
  isMicOn={isMicOn}
  isCamOn={isCamOn}
  onToggleMic={toggleMic}
  onToggleCam={toggleCam}
  onLeave={disconnect}
  isVisible={viewMode === 'STUDENT'}
/>
```

**الميزات:**
- ✅ عائم في أسفل الشاشة
- ✅ تأثير Glass Morphism
- ✅ أيقونات وألوان حسب الحالة
- ✅ يختفي في Kiosk Mode

---

### 3. `PictureInPicture` (Student Client فقط)
فيديو محلي الطالب قابل للسحب في الزاوية.

**Props:**
```tsx
interface PictureInPictureProps {
  participant: Participant;  // عادة room.localParticipant
  isVisible?: boolean;
}
```

**الاستخدام:**
```tsx
<PictureInPicture 
  participant={room.localParticipant}
  isVisible={true}
/>
```

**الميزات:**
- ✅ موضع افتراضي: أسفل يمين الشاشة
- ✅ قابل للسحب (Draggable) بالفأرة
- ✅ يبقى ضمن حدود الشاشة
- ✅ حجم: 200×150 بكسل

---

### 4. `ParticipantGrid` (كلا العميلين)
شبكة ديناميكية لعرض عدة مشاركين.

**Props:**
```tsx
interface ParticipantGridProps {
  participants: (Participant | RemoteParticipant)[];
  showUserTags?: boolean;  // عرض الأسماء وحالة الميكروفون
}
```

**الاستخدام:**
```tsx
<ParticipantGrid 
  participants={remoteParticipants}
  showUserTags={true}
/>
```

**الميزات:**
- ✅ CSS Grid ديناميكي: `repeat(auto-fit, minmax(300px, 1fr))`
- ✅ توزيع تلقائي على عدة أعمدة
- ✅ أسماء على خلفية شفافة أسفل كل مربع
- ✅ أيقونة الميكروفون (أخضر = مفتوح، أحمر = مغلق)

---

## 🎨 الألوان والتصميم

```css
:root {
  --bg-color: #0a0a0c;           /* أسود عميق */
  --panel-bg: rgba(255, 255, 255, 0.05);
  --accent-color: #7c3aed;        /* بنفسجي أساسي */
  --accent-hover: #8b5cf6;        /* بنفسجي فاتح */
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;      /* رمادي فاتح */
  --error-color: #ef4444;         /* أحمر للتحذير */
  --success-color: #10b981;       /* أخضر للنجاح */
}
```

---

## 🔄 Flow الاتصال

```
[Student] ──── Login ───→ [Backend] ───→ [LiveKit Server]
   │                           ↓
   │                    JWT Token + URL
   │←──────────────────────────┘
   │
   ├──→ Subscribe to remote tracks (Teacher)
   │
   ├──→ Publish local tracks (Camera + Mic)
   │
   └──→ Display: MainStage + PiP + Controls
```

```
[Wall Display] ──── Auto-Join ───→ [Backend] ───→ [LiveKit Server]
   │                                   ↓
   │                           JWT Token + URL
   │←──────────────────────────────────┘
   │
   ├──→ Subscribe to all remote tracks
   │
   ├──→ NO local video/audio publish
   │
   └──→ Display: ParticipantGrid (Grid Layout)
```

---

## 🧪 الاختبار المحلي

### سيناريو 1: طالب واحد + محاضر
1. ابدأ Backend و LiveKit
2. افتح `http://localhost:5173` في Tab 1 (Student)
3. افتح `http://localhost:5174` في Tab 2 (كطالب آخر/معلم)
4. انظر المحاضر على Main Stage و PiP محلي

### سيناريو 2: حائط القاعة
1. ابدأ Wall Client: `cd wall-client && npm run dev`
2. انقر "Activate Display"
3. يجب أن ترى جميع الطلاب في شبكة

---

## ⚙️ الإعدادات المستقبلية

```tsx
// يمكن إضافة في context
interface ClientConfig {
  layout: 'STUDENT' | 'WALL' | 'TEACHER';
  enableScreenShare: boolean;
  enableRecording: boolean;
  quality: 'LOW' | 'MEDIUM' | 'HIGH';
}
```
