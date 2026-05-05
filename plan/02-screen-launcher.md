# Component 02: Screen Launcher / Orchestrator
## المكون: منسق الشاشات المتعددة

---

## الهدف
إنشاء صفحة ويب (`ScreenLauncher`) يستخدمها المعلم أو مدير القاعة لفتح جميع شاشات العرض تلقائياً بضغطة زر واحدة. تقوم بحساب التوزيع وفتح نافذة لكل شاشة.

---

## الموقع في المشروع
```
wall-client/src/components/ScreenLauncher.tsx   ← الواجهة
wall-client/src/App.tsx                         ← Route: /launcher
```

---

## كيف تعمل

### 1. واجهة المستخدم
```
┌─────────────────────────────────────────────┐
│         SOVEREIGN SCREEN LAUNCHER           │
│                                             │
│  محاضرة نشطة: [اختر من القائمة ▼]          │
│                                             │
│  عدد الشاشات: [ 15 ] (←→ للتعديل)          │
│  طلاب لكل شاشة: [ 4 ] (محسوب تلقائياً)     │
│                                             │
│  ┌──────────────────────────────────┐       │
│  │  🖥️ Screen 1: طلاب 1-4          │       │
│  │  🖥️ Screen 2: طلاب 5-8          │       │
│  │  🖥️ Screen 3: طلاب 9-12         │       │
│  │  ...                            │       │
│  │  🖥️ Screen 15: طلاب 57-60       │       │
│  └──────────────────────────────────┘       │
│                                             │
│  [ 🚀 LAUNCH ALL SCREENS ]                 │
│  [ ❌ CLOSE ALL SCREENS ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. خوارزمية التوزيع
```typescript
function calculateDistribution(totalStudents: number, numberOfScreens: number) {
  const perScreen = Math.ceil(totalStudents / numberOfScreens);
  const screens = [];
  
  for (let i = 0; i < numberOfScreens; i++) {
    screens.push({
      screenIndex: i,
      startIndex: i * perScreen,
      count: Math.min(perScreen, totalStudents - (i * perScreen)),
    });
  }
  
  return screens;
}

// مثال: 60 طالب ÷ 15 شاشة = 4 طلاب/شاشة
// Screen 0: start=0,  count=4
// Screen 1: start=4,  count=4
// ...
// Screen 14: start=56, count=4
```

### 3. فتح النوافذ
```typescript
function launchAllScreens(lectureId: string, screens: ScreenConfig[]) {
  const openWindows: Window[] = [];
  
  screens.forEach((screen, index) => {
    const url = `/grid?lecture=${lectureId}&start=${screen.startIndex}&count=${screen.count}&screen=${index}`;
    
    // فتح نافذة جديدة
    const win = window.open(
      url,
      `sovereign-screen-${index}`,
      `width=1920,height=1080,left=${index * 1920},top=0,fullscreen=yes`
    );
    
    if (win) {
      openWindows.push(win);
      // الانتظار ثم تفعيل Fullscreen
      setTimeout(() => {
        win.document.documentElement.requestFullscreen?.();
      }, 2000);
    }
  });
  
  return openWindows;
}
```

### 4. إغلاق جميع النوافذ
```typescript
function closeAllScreens(windows: Window[]) {
  windows.forEach(win => {
    try { win.close(); } catch (e) {}
  });
}
```

### 5. اكتشاف الشاشات (Multi-Screen API)
```typescript
// Modern API (Chrome 100+)
async function detectScreens() {
  if ('getScreenDetails' in window) {
    const details = await (window as any).getScreenDetails();
    return details.screens.length;
  }
  // Fallback: عدد الشاشات غير معروف → يدخله المستخدم يدوياً
  return null;
}
```

---

## الحالات الخاصة
- **عدد الطلاب = 0:** عرض رسالة "لا يوجد طلاب بعد" على كل الشاشات
- **عدد الطلاب < عدد الشاشات:** بعض الشاشات ستكون فارغة
- **طالب جديد يدخل بعد التوزيع:** يظهر في آخر شاشة بها مكان
- **المتصفح يمنع Popup:** عرض تعليمات للمعلم لتفعيل Popups

---

## التبعيات
- `axios` (موجود) — لجلب قائمة المحاضرات النشطة
- `react-router-dom` (موجود)
- Multi-Screen Window Placement API (Chrome)

---

## معايير القبول
1. ✅ عرض قائمة المحاضرات النشطة
2. ✅ حساب التوزيع تلقائياً عند تغيير عدد الشاشات
3. ✅ فتح N نافذة بضغطة واحدة
4. ✅ كل نافذة تحمل URL صحيح مع params مختلفة
5. ✅ إغلاق جميع النوافذ بضغطة واحدة
6. ✅ عرض معاينة التوزيع قبل الإطلاق
