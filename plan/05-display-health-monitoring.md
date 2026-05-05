# Component 05: Display Health Monitoring
## المكون: نظام مراقبة صحة الشاشات

---

## الهدف
مراقبة حالة كل شاشة (Online/Offline/Warning) في الوقت الحقيقي، وعرض لوحة مراقبة للمعلم، وإرسال تنبيهات عند انقطاع أي شاشة.

---

## الموقع في المشروع
```
backend/src/services/health-monitor.service.ts       ← خدمة المراقبة
wall-client/src/components/ScreenStatusPanel.tsx     ← لوحة المراقبة في Teacher Dashboard
```

---

## كيف تعمل

### 1. جمع البيانات من كل شاشة
كل GridPage ترسل تقريراً كل 5 ثواني عبر Socket.io:
```typescript
// GridPage يرسل:
socket.emit('display:heartbeat', {
  hardwareId: 'PC-A1-003',
  screenIndex: 3,
  lectureId: 'abc123',
  metrics: {
    cpu: 45,              // نسبة استخدام المعالج
    ram: 62,              // نسبة استخدام الذاكرة
    fps: 30,              // معدل الإطارات
    bandwidth: 12.5,      // Mbps مستخدم
    studentsRendered: 4,  // عدد الفيديوهات المعروضة فعلاً
    errors: 0             // عدد الأخطاء
  },
  timestamp: Date.now()
});
```

### 2. Backend يحلل البيانات
```typescript
class HealthMonitorService {
  private displayStates: Map<string, DisplayHealth> = new Map();
  
  // تشغيل فحص دوري كل 10 ثواني
  startMonitoring() {
    setInterval(() => this.checkAllDisplays(), 10000);
  }
  
  checkAllDisplays() {
    const now = Date.now();
    
    this.displayStates.forEach((state, hardwareId) => {
      const timeSinceLastBeat = now - state.lastHeartbeat;
      
      if (timeSinceLastBeat > 15000) {        // > 15 ثانية
        state.status = 'offline';
        this.triggerAlert(hardwareId, 'OFFLINE');
      } else if (timeSinceLastBeat > 10000) { // > 10 ثواني
        state.status = 'warning';
      } else if (state.metrics.cpu > 90) {
        state.status = 'warning';
      } else {
        state.status = 'online';
      }
    });
    
    // بث الحالة للمعلم
    this.broadcastStatus();
  }
}
```

### 3. عرض الحالة للمعلم (ScreenStatusPanel)
```
┌─────────────────────────────────────────────┐
│  📊 SCREEN STATUS                           │
│                                             │
│  🟢 Screen 1  │ 4 students │ CPU 32% │ OK  │
│  🟢 Screen 2  │ 4 students │ CPU 28% │ OK  │
│  🟡 Screen 3  │ 4 students │ CPU 89% │ ⚠️  │
│  🔴 Screen 4  │ 0 students │ OFFLINE │ ❌  │
│  🟢 Screen 5  │ 4 students │ CPU 41% │ OK  │
│  ...                                       │
│  🟢 Screen 15 │ 4 students │ CPU 35% │ OK  │
│                                             │
│  [ 🔄 Refresh All ] [ ⚖️ Rebalance ]       │
└─────────────────────────────────────────────┘
```

### 4. التنبيهات
```typescript
// عند اكتشاف شاشة منقطعة:
async triggerAlert(hardwareId: string, type: 'OFFLINE' | 'HIGH_CPU' | 'ERROR') {
  // 1. إشعار للمعلم عبر Socket
  io.to('teacher').emit('display:alert', {
    hardwareId,
    type,
    message: `Screen ${hardwareId} is ${type}`,
    timestamp: Date.now()
  });
  
  // 2. (اختياري) إرسال إشعار Telegram/Email
  // await notificationService.send(...)
  
  // 3. تسجيل في Log
  logger.warn(`[HEALTH] Display ${hardwareId} alert: ${type}`);
}
```

---

## معايير القبول
1. ✅ كل شاشة ترسل heartbeat كل 5 ثواني
2. ✅ شاشة منقطعة > 15 ثانية → تظهر "Offline" للمعلم
3. ✅ CPU > 90% → تظهر تحذير أصفر
4. ✅ المعلم يرى حالة كل الشاشات في لوحة واحدة
5. ✅ زر "Refresh" يعيد تحميل شاشة محددة
