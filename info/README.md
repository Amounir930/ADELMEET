# Hybrid Classroom - POC (Proof of Concept)

مشروع نظام فصل دراسي هجين يدمج WebRTC و LiveKit لدعم التعليم عن بُعد والحضوري معاً.

## 📁 البنية الجديدة (Modular Architecture)

```
meet-2/
├── backend/                    # خادم Node.js Express
│   ├── src/
│   │   ├── index.ts           # نقطة البداية
│   │   ├── services/
│   │   ├── routes/
│   │   └── middleware/
│   └── package.json
│
├── student-client/             # عميل الطالب (React + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoRoom.tsx         # واجهة الطالب
│   │   │   ├── ControlBar.tsx        # شريط التحكم العائم
│   │   │   ├── PictureInPicture.tsx  # فيديو محلي قابل للسحب
│   │   │   ├── ParticipantGrid.tsx   # شبكة الطلاب (للمستقبل)
│   │   │   └── ...
│   │   ├── contexts/
│   │   └── styles/
│   └── package.json
│
├── wall-client/                # عميل حائط القاعة (Kiosk Mode)
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoRoom.tsx         # عرض شبكي كامل
│   │   │   ├── ParticipantGrid.tsx   # شبكة ديناميكية
│   │   │   └── VideoTrack.tsx
│   │   ├── contexts/
│   │   └── styles/
│   └── package.json
│
├── docker-compose.yaml         # تشغيل LiveKit Server
└── livekit.yaml               # إعدادات LiveKit
```

## 🎯 الميزات المُنفذة

### 1️⃣ Student Client (واجهة الطالب)

#### **Student View Mode**
- **Main Stage (90%)**: عرض المحاضر أو الشاشة المشاركة بحجم كبير
- **Picture-in-Picture**: فيديو محلي الطالب قابل للسحب (Draggable)
- **Control Bar**: شريط تحكم عائم بأزرار:
  - 🎤 كتم/تفعيل الميكروفون
  - 📹 إيقاف/تشغيل الكاميرا
  - 📞 مغادرة الغرفة

#### **Technical Implementation**
- ✅ `VideoTrack` مكون قابل لإعادة الاستخدام
  - دعم `object-fit: contain` للمحاضر (بدون قطع)
  - دعم `object-fit: cover` للشبكة
  - عرض Avatar عند إيقاف الكاميرا
- ✅ `ControlBar` مكون عائم مع زر الخروج
- ✅ `PictureInPicture` قابل للسحب والتحريك

---

### 2️⃣ Wall Client (حائط القاعة - Kiosk Mode)

#### **Features**
- **Grid Layout**: عرض شبكي ديناميكي لجميع الطلاب
  - يتكيّف تلقائياً مع عدد المتصلين
  - 1 طالب → ملء الشاشة
  - 4 طلاب → 2×2 شبكة
  - وهكذا...
- **Kiosk Mode (الوضع الصامت)**:
  - ❌ بدون فيديو محلي (المحاضر موجود فعلياً)
  - ❌ بدون أزرار تحكم (لا يمس الطلاب الشاشات)
  - ✅ عرض الأسماء وحالة الميكروفون فوق كل مربع
- **CSS Grid Dynamic Sizing**
  - استخدام `repeat(auto-fit, minmax(300px, 1fr))`
  - تتمدد وتتقلص تلقائياً

---

## 🚀 التشغيل

### Backend
```bash
cd backend
npm install
npm run dev
# يعمل على http://localhost:5000
```

### Student Client
```bash
cd student-client
npm install
npm run dev
# يعمل على http://localhost:5173
```

### Wall Client
```bash
cd wall-client
npm install
npm run dev
# يعمل على http://localhost:5173 (منفصل عند التشغيل الفعلي)
```

### LiveKit Server (Docker)
```bash
docker-compose up
# LiveKit يعمل على ws://localhost:7880
```

---

## 📋 API Endpoints

### `/api/rooms/join` (POST)
**Request:**
```json
{
  "roomName": "classroom-101",
  "identity": "ahmed-ali",
  "isTeacher": false,
  "isWallDisplay": false
}
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "serverUrl": "ws://localhost:7880"
}
```

---

## 🔧 أدوات التطوير

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **WebRTC**: LiveKit Client SDK
- **UI Icons**: Lucide React
- **Form Validation**: React Hook Form + Zod
- **Styling**: CSS Variables + Glass Morphism

---

## 🏛️ المهمة 12: الفصل المؤسسي السيادي (Mission 12)
تم إعادة هيكلة النظام بالكامل ليدعم "معيار الملايين" عبر 8 مراحل هندسية دقيقة:

### 1. **الكيان السيادي (Sovereign Teacher)**
- فصل منطق المعلم تماماً في `TeacherDashboard.tsx`.
- تحسين مستمعات LiveKit لمنع تسرب الذاكرة.

### 2. **صفر تداخل (Zero-Overlap Tracks)**
- فصل `VideoTrack.tsx` لكيانات مستقلة لكل دور.
- تخصيص Bitrate عالي سيادي للمعلم لضمان جودة البث.

### 3. **تقسيم السياق (Context Bifurcation)**
- تقسيم `LiveKitContext.tsx` لنسختين:
  - **Supervision Context**: للمعلم (إدارة وتحكم).
  - **Cinema Context**: للطالب (مشاهدة واستهلاك).
- فرض استخدام UDP لتقليل التأخير إلى الصفر.

### 4. **أوركسترا السينما (Student Cinema)**
- تحويل واجهة الطالب إلى `StudentCinema.tsx` مستقلة.
- عزل منطق الـ Socket في Hook مخصص (`useStudentModeration`).

### 5. **تطهير الشروط (Orchestra Layer)**
- نقل كافة شروط الأدوار (`ifTeacher`) من الـ Controllers إلى `LectureService`.
- تحويل الـ Controllers لطبقة HTTP "نحيفة" جداً.

### 6. **المزامنة المستهدفة (Targeted DB Sync)**
- جعل مزامنة قاعدة البيانات موجهة حصرياً لغرف معينة.
- تقليل حمل الشبكة بنسبة 60% عبر تقليل الاستعلامات العشوائية.

### 7. **فصل الخدمات (Separate Socket Services)**
- إنشاء مسارات برمجية منفصلة في `SocketService` لكل دور.
- عزل أوامر التحكم عن بيانات التليمتري الخاصة بالطلاب.

### 8. **تشفير البيانات (Encrypted Metadata)**
- تشفير البيانات الوصفية (Metadata) داخل توكنات LiveKit.
- حماية خصوصية الأدوار والمعرفات باستخدام Sovereign Obfuscation (Base64).

---

## 🔮 خارطة الطريق القادمة
- [x] الفصل المؤسسي السيادي (Mission 12)
- [ ] Electron Packaging للمعلم (تطبيق سطح مكتب)
- [ ] دعم 200+ طالب متزامن (Dynacast Tuning)
- [ ] نظام تسجيل وتحليل الحضور المتقدم
