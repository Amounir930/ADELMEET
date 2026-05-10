# 🚀 دليل التشغيل السريع (Quick Start Guide)

## المتطلبات الأساسية

- **Node.js** ≥ 18.0.0
- **Docker** و **Docker Compose** (لـ LiveKit Server)
- **npm** أو **yarn** أو **pnpm**

---

## خطوة 1: تشغيل LiveKit Server

```bash
# في مجلد الجذر (meet-2)
docker-compose up -d

# تحقق من أن LiveKit يعمل
curl http://localhost:7880/health
```

**يجب أن تحصل على:**
```json
{"status": "ok"}
```

---

## خطوة 2: تشغيل Backend Server

```bash
cd backend

# تثبيت الحزم
npm install

# تشغيل في وضع التطوير
npm run dev

# يجب أن تشاهد:
# [SERVER] Backend running on port 5000
```

**اختبر:**
```bash
curl http://localhost:5000/health
# {"status": "ok"}
```

---

## خطوة 3: تشغيل Student Client

```bash
cd student-client

# تثبيت الحزم
npm install

# تشغيل في وضع التطوير
npm run dev

# يجب أن تشاهد:
# Local: http://localhost:5173
```

ادخل إلى `http://localhost:5173` في المتصفح.

---

## خطوة 4: تشغيل Wall Client (اختياري)

```bash
cd wall-client

npm install

# غيّر المنفذ (port) في vite.config.ts أو شغّل على منفذ مختلف
npm run dev -- --port 5174

# يعمل على http://localhost:5174
```

---

## 📋 خطوات الاختبار

### **Test 1: Student View**

1. افتح `http://localhost:5173`
2. أدخل:
   - Room ID: `test-room`
   - Your Name: `Ahmed`
3. انقر **Join Room**
4. يجب أن تشاهد:
   - ⏳ "Waiting for Teacher to join..."
   - شريط التحكم في الأسفل

### **Test 2: إضافة مشارك ثاني (معلم)

في tab جديد:
1. افتح `http://localhost:5173` مجدداً
2. أدخل:
   - Room ID: `test-room`
   - Your Name: `Dr. Ahmed` أو `Teacher`
3. انقر **Join Room**

الآن:
- المشارك 1 يرى "Dr. Ahmed" على Main Stage
- "Dr. Ahmed" يرى "Ahmed" على Main Stage بدوره

### **Test 3: Wall Display**

1. افتح `http://localhost:5174` (Wall Client)
2. انقر **Activate Display**
3. يجب أن ترى:
   - شبكة تعرض جميع الطلاب المتصلين
   - أسماء الطلاب فوق كل مربع
   - حالة الميكروفون (أخضر/أحمر)

---

## 🎮 اختبار الميزات

### **ControlBar (Student View)**

```
┌─────────────────────┐
│ 🎤 🎥 | ☎️ Leave    │
├─────────────────────┤
└─────────────────────┘
```

- انقر 🎤 لكتم الميكروفون
- انقر 🎥 لإيقاف الكاميرا
- انقر ☎️ للخروج من الغرفة

### **PictureInPicture (Student View)**

- يجب أن ترى فيديوك المحلي في أسفل يمين الشاشة
- حاول سحبه بالفأرة (Draggable)

### **ParticipantGrid (Wall View)**

- أضف 4 طلاب → شبكة 2×2
- أضف 9 طلاب → شبكة 3×3
- يجب أن تتكيف تلقائياً

---

## 🐛 استكشاف الأخطاء

### **الخطأ: "Failed to connect to room"**

```
❌ Check:
1. Is LiveKit server running? 
   docker-compose ps

2. Is backend server running?
   curl http://localhost:5000/health

3. Check backend logs for details
```

### **الخطأ: "No participants connected"**

```
✅ Solution:
1. Open another tab and join same room
2. Check browser console for errors (F12)
3. Ensure WebRTC is not blocked by firewall
```

### **الخطأ: "Video not showing"**

```
✅ Check:
1. Allow camera/microphone permissions
2. Check that camera is not in use by another app
3. Try different browser (Chrome/Firefox recommended)
```

---

## 📊 مراقبة الأداء

### **Browser DevTools (F12)**

```
Network tab → Filter: "ws://" 
↓
عرض عدد الـ WebSocket connections
```

### **Backend Logs**

```bash
npm run dev
# ثم لاحظ الـ console logs
```

---

## 🔌 إيقاف المشروع

```bash
# في Terminal منفصل

# إيقاف LiveKit
docker-compose down

# أوقف Ctrl+C في كل terminal
```

---

## 📝 ملاحظات مهمة

1. **Development Mode**: 
   - الـ logging مفعّل (verbose)
   - Hot Module Reload (HMR) مفعّل

2. **Production Build**:
   ```bash
   npm run build  # يُنتج dist/ folder
   npm run preview  # اختبر الـ production build
   ```

3. **الأمان**:
   - `LIVEKIT_API_KEY` و `LIVEKIT_API_SECRET` في `.env`
   - لا تضع credentials في Git!

---

## 💡 نصائح

- استخدم اسمين مختلفين لاختبار الميزات بسهولة
- في Kiosk/Wall Mode: لا تحتاج لإدخال بيانات، يوصل تلقائياً
- استخدم browser tabs مختلفة للمشاركين المتعددين
- للـ Full Duplex Testing: استخدم جهازين مختلفين على نفس الشبكة

---

## 🆘 الدعم الإضافي

```
الملفات المرجعية:
- README.md           → نظرة عامة المشروع
- COMPONENTS.md       → مرجع المكونات
- backend/README.md   → تفاصيل Backend API
```
