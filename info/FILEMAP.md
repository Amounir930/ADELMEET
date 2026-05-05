# 📂 خريطة الملفات الكاملة (Complete File Structure)

```
meet-2/
│
├── 📄 README.md                 ← نظرة عامة المشروع
├── 📄 QUICKSTART.md             ← دليل التشغيل السريع
├── 📄 COMPONENTS.md             ← مرجع المكونات
├── 📄 SUMMARY.md                ← ملخص الإنجاز
├── 📄 FILEMAP.md                ← هذا الملف
├── 📄 docker-compose.yaml       ← تشغيل LiveKit Server
├── 📄 livekit.yaml              ← إعدادات LiveKit
│
│
├── 📁 backend/                  [Node.js + Express]
│   ├── src/
│   │   ├── index.ts              ← نقطة البداية
│   │   ├── routes/
│   │   │   └── room.routes.ts    ← Room endpoints
│   │   ├── services/
│   │   │   └── livekit.service.ts ← Token generation
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts   ← Error middleware
│   │   │   └── asyncHandler.ts   ← Async wrapper
│   │   ├── infra/
│   │   │   └── errors.ts         ← Custom errors
│   │   └── tsconfig.json
│   │
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 README.md              ← Backend API docs
│   └── 📄 .gitignore
│
│
├── 📁 student-client/           [React + Vite]
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoRoom.tsx        ← Main room logic ✨
│   │   │   ├── VideoTrack.tsx       ← Video renderer
│   │   │   ├── ControlBar.tsx       ← Floating controls ✨
│   │   │   ├── PictureInPicture.tsx ← Draggable PiP ✨
│   │   │   ├── ParticipantGrid.tsx  ← Grid layout ✨
│   │   │   ├── JoinRoom.tsx         ← Join form
│   │   │   └── ParticipantTile.tsx  ← Individual tile
│   │   │
│   │   ├── contexts/
│   │   │   └── LiveKitContext.tsx   ← Connection logic
│   │   │
│   │   ├── hooks/                   ← (Empty - ready for hooks)
│   │   │
│   │   ├── 📄 App.tsx               ← Root component
│   │   ├── 📄 main.tsx              ← Entry point
│   │   ├── 📄 index.css             ← Global styles
│   │   └── 📄 App.css               ← Component styles
│   │
│   ├── public/
│   │   └── favicon.svg
│   │
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 tsconfig.app.json
│   ├── 📄 tsconfig.node.json
│   ├── 📄 vite.config.ts            ← Vite config
│   ├── 📄 eslint.config.js
│   ├── 📄 index.html
│   ├── 📄 README.md                 ← Client docs
│   └── 📄 .gitignore
│
│
├── 📁 wall-client/              [React + Vite - Kiosk Mode]
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoRoom.tsx        ← Grid-based room ✨
│   │   │   ├── VideoTrack.tsx       ← Video renderer
│   │   │   ├── ParticipantGrid.tsx  ← Dynamic grid ✨
│   │   │   ├── JoinRoom.tsx         ← (Not used in auto-join)
│   │   │   └── ParticipantTile.tsx  ← (For future use)
│   │   │
│   │   ├── contexts/
│   │   │   └── LiveKitContext.tsx   ← Connection logic
│   │   │
│   │   ├── hooks/                   ← (Empty - ready for hooks)
│   │   │
│   │   ├── 📄 App.tsx               ← Root (auto-connect)
│   │   ├── 📄 main.tsx              ← Entry point
│   │   ├── 📄 index.css             ← Global styles
│   │   └── 📄 App.css               ← Component styles
│   │
│   ├── public/
│   │   └── favicon.svg
│   │
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📄 tsconfig.app.json
│   ├── 📄 tsconfig.node.json
│   ├── 📄 vite.config.ts            ← Vite config (port 5173)
│   ├── 📄 eslint.config.js
│   ├── 📄 index.html
│   ├── 📄 README.md                 ← Wall client docs
│   └── 📄 .gitignore
│
```

---

## 📋 شرح الملفات الأساسية

### **Backend**

```typescript
// backend/src/index.ts
import express from 'express';
import roomRoutes from './routes/room.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
app.use('/api/rooms', roomRoutes);
app.use(errorHandler);
app.listen(5000);
```

```typescript
// backend/src/routes/room.routes.ts
POST /api/rooms/join
  - توليد JWT token
  - إرجاع LiveKit URL
```

---

### **Student Client**

```typescript
// student-client/src/App.tsx
- اتصال ✅
- VideoRoom component

// student-client/src/components/VideoRoom.tsx
- Main Stage (المحاضر)
- Picture-in-Picture (محلي)
- ControlBar (Floating)
- Mode Toggle (STUDENT/WALL)

// student-client/src/components/ControlBar.tsx
- Mic toggle
- Camera toggle
- Leave button
- Glass morphism design

// student-client/src/components/PictureInPicture.tsx
- Draggable
- 200×150 px
- Keep within viewport
```

---

### **Wall Client**

```typescript
// wall-client/src/App.tsx
- Auto-join as "ClassroomWall"
- VideoRoom component

// wall-client/src/components/VideoRoom.tsx
- ParticipantGrid (Full screen)
- No controls
- No local video
- Emergency exit button (small)

// wall-client/src/components/ParticipantGrid.tsx
- CSS Grid layout
- Dynamic sizing
- User tags + Mic status
- Responsive design
```

---

## 🔄 الاتصال بين الملفات

### **Import Chain - Student Client**

```
App.tsx
  ├─ JoinRoom.tsx
  ├─ VideoRoom.tsx
  │   ├─ ControlBar.tsx
  │   ├─ PictureInPicture.tsx
  │   │   └─ VideoTrack.tsx
  │   ├─ ParticipantGrid.tsx
  │   │   └─ VideoTrack.tsx
  │   └─ VideoTrack.tsx
  └─ LiveKitContext.tsx
```

### **Import Chain - Wall Client**

```
App.tsx
  ├─ VideoRoom.tsx
  │   └─ ParticipantGrid.tsx
  │       └─ VideoTrack.tsx
  └─ LiveKitContext.tsx
```

---

## 📦 حجم المشروع

```
backend/
  ├── src/                    ~300 lines
  ├── package.json            ~30 lines

student-client/
  ├── src/components/
  │   ├── VideoRoom.tsx       ~150 lines
  │   ├── VideoTrack.tsx      ~130 lines
  │   ├── ControlBar.tsx      ~100 lines
  │   ├── PictureInPicture.tsx ~120 lines
  │   ├── ParticipantGrid.tsx  ~90 lines
  │   └── ...                  ~150 lines
  ├── styles/                 ~150 lines

wall-client/
  ├── src/components/
  │   ├── VideoRoom.tsx       ~100 lines
  │   ├── VideoTrack.tsx      ~130 lines
  │   ├── ParticipantGrid.tsx  ~90 lines
  │   └── ...                  ~100 lines
  ├── styles/                 ~150 lines

Total: ~2200+ lines of code
```

---

## 🚀 ملفات التشغيل

```bash
# Development scripts
npm run dev      # Vite HMR development server
npm run build    # TypeScript + Vite build
npm run preview  # Preview production build
npm run lint     # ESLint check

# Docker
docker-compose up     # LiveKit server
docker-compose down   # Stop server
```

---

## 📄 ملفات التوثيق

| الملف | الغرض | للمستخدم |
|------|------|---------|
| **README.md** | نظرة عامة | المطورين + المديرين |
| **QUICKSTART.md** | التشغيل السريع | المطورين |
| **COMPONENTS.md** | مرجع المكونات | المطورين |
| **backend/README.md** | API docs | Backend devs |
| **SUMMARY.md** | ملخص الإنجاز | المطورين + Lead |
| **FILEMAP.md** | خريطة الملفات | هذا الملف |

---

## 🔑 الملفات المهمة (Key Files)

### 🎯 للفهم السريع:
1. `student-client/src/components/VideoRoom.tsx` ← Main logic
2. `wall-client/src/components/VideoRoom.tsx` ← Grid layout
3. `backend/src/routes/room.routes.ts` ← API endpoints

### 🛠️ للتعديل:
1. `**/components/ControlBar.tsx` ← UI buttons
2. `**/components/ParticipantGrid.tsx` ← Grid layout
3. `backend/src/services/livekit.service.ts` ← Token

### 🎨 للتصميم:
1. `**/index.css` ← Global styles
2. `**/App.css` ← Component styles
3. `:root` CSS variables ← Theme colors

---

## ✅ Checklist للتحقق

```
✅ Backend folder
  ✅ src/index.ts
  ✅ routes/room.routes.ts
  ✅ services/livekit.service.ts
  ✅ package.json

✅ Student Client folder
  ✅ components/ (7 files)
  ✅ contexts/LiveKitContext.tsx
  ✅ App.tsx + main.tsx
  ✅ index.css + App.css
  ✅ package.json

✅ Wall Client folder
  ✅ components/ (5 files)
  ✅ contexts/LiveKitContext.tsx
  ✅ App.tsx + main.tsx
  ✅ index.css + App.css
  ✅ package.json

✅ Root files
  ✅ README.md
  ✅ QUICKSTART.md
  ✅ COMPONENTS.md
  ✅ SUMMARY.md
  ✅ FILEMAP.md (هذا)
  ✅ docker-compose.yaml
```

---

## 💡 نصائح للملاحة

### **للبحث عن ملف معين:**
```bash
# في terminal
find . -name "VideoRoom.tsx"
find . -name "*.tsx" -path "*/components/*"
```

### **لفهم التدفق:**
1. ابدأ من `App.tsx`
2. اتبع الـ imports
3. افهم المكونات الفردية

### **لإضافة ميزة جديدة:**
1. افهم المكون المرتبط
2. عدّل أو أنشئ componen جديد
3. استيرده في `VideoRoom.tsx`

---

**آخر تحديث:** 29 أبريل 2026  
**الحالة:** 🟢 مكتمل وجاهز للاستخدام
