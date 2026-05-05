# Component 01: Multi-Display Grid Page
## المكون: صفحة عرض الطلاب للشاشات الثانوية

---

## الهدف
إنشاء صفحة React مخصصة (`GridPage`) تعمل على الشاشات الثانوية (Display-Only). هذه الصفحة **لا تحتوي على أي أزرار تحكم** — فقط تعرض فيديوهات مجموعة محددة من الطلاب في شبكة (Grid) ملء الشاشة.

---

## الموقع في المشروع
```
wall-client/src/components/GridPage.tsx   ← المكون الرئيسي
wall-client/src/App.tsx                   ← إضافة Route جديد
```

---

## كيف تعمل

### 1. URL Parameters
الصفحة تعمل بناءً على معاملات URL:
```
https://wall.60sec.shop/grid?lecture=LECTURE_ID&start=0&count=4&screen=1
```

| Parameter | الوصف | مثال |
|-----------|-------|------|
| `lecture` | معرف المحاضرة النشطة | `6813abc...` |
| `start` | فهرس أول طالب يتم عرضه | `0`, `4`, `8` |
| `count` | عدد الطلاب المعروضين على هذه الشاشة | `4` |
| `screen` | رقم الشاشة (للعرض فقط) | `1`, `2`, `3` |

### 2. دورة الحياة (Lifecycle)
```
1. الصفحة تُفتح → تقرأ URL params
2. تتصل بالـ API: POST /api/lectures/{lectureId}/join
3. تحصل على LiveKit token + serverUrl
4. تتصل بـ LiveKit Room (view-only أو مع نشر محدود)
5. تستمع لأحداث الغرفة: ParticipantConnected, ParticipantDisconnected
6. تفرز المشاركين (تستبعد المعلم) وترتبهم أبجدياً
7. تعرض فقط الشريحة: participants.slice(start, start + count)
8. عند تغيير العدد → تُحدَّث الشبكة تلقائياً
```

### 3. تخطيط الشبكة (Grid Layout)
```
عدد الطلاب → التخطيط:
  1 طالب  → 1×1 (ملء الشاشة)
  2 طلاب  → 2×1 (جنب بعض)
  3-4 طلاب → 2×2
  5-6 طلاب → 3×2
  7-9 طلاب → 3×3
  10-12 طالب → 4×3
  13-16 طالب → 4×4
```
**الخوارزمية:** `cols = ceil(sqrt(n))`, `rows = ceil(n / cols)`

### 4. عناصر الواجهة
```
┌─────────────────────────────────────────────┐
│ [●] SCREEN 3  👥 4                          │  ← مؤشر الشاشة (شفاف)
│                                             │
│  ┌──────────┐  ┌──────────┐                 │
│  │ طالب 1   │  │ طالب 2   │                 │
│  │ [فيديو]  │  │ [فيديو]  │                 │
│  │ ──أحمد── │  │ ──سارة── │                 │
│  └──────────┘  └──────────┘                 │
│  ┌──────────┐  ┌──────────┐                 │
│  │ طالب 3   │  │ طالب 4   │                 │
│  │ [فيديو]  │  │ [فيديو]  │                 │
│  │ ──محمد── │  │ ──فاطمة─ │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

### 5. سلوكيات خاصة
- **Fullscreen تلقائي:** الصفحة تطلب وضع ملء الشاشة فور الفتح
- **إخفاء المؤشر:** بعد 3 ثواني بدون حركة → المؤشر يختفي
- **منع Right-Click:** `onContextMenu={e => e.preventDefault()}`
- **لا scrollbar:** `overflow: hidden` على كل العناصر
- **خلفية سوداء:** `background: #000` لتجنب الوهج

### 6. جودة الفيديو
- الافتراضي: `VideoQuality.MEDIUM` (480p) — توازن بين الجودة والأداء
- يمكن للمعلم تغييرها عبر Socket event: `display:set_quality`
- عند اشتراك جديد → تطبيق الجودة تلقائياً

---

## الواجهات البرمجية المطلوبة

### من Backend (موجود بالفعل):
```typescript
POST /api/lectures/:lectureId/join
Headers: { Authorization: "Bearer JWT_TOKEN" }
Response: { token: string, serverUrl: string, lecture: object }
```

### أحداث Socket.io المطلوبة (جديدة):
```typescript
// الشاشة تستمع:
socket.on('display:rebalance', (data: { start: number, count: number }) => {})
socket.on('display:set_quality', (data: { quality: 'low'|'medium'|'high' }) => {})
socket.on('display:refresh', () => { window.location.reload() })
```

---

## التبعيات
- `livekit-client` (موجود)
- `react-router-dom` (موجود)
- `axios` (موجود)
- `lucide-react` (موجود)

---

## معايير القبول
1. ✅ الصفحة تعرض العدد الصحيح من الطلاب بناءً على URL params
2. ✅ الشبكة تتكيف تلقائياً مع عدد الطلاب
3. ✅ دخول/خروج طالب → التحديث فوري (< 2 ثانية)
4. ✅ لا أزرار تحكم — عرض فقط
5. ✅ Fullscreen + مؤشر مخفي + منع Right-Click
6. ✅ مؤشر "Screen N" شفاف في الزاوية
