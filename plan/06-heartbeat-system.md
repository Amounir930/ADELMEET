# Component 06: Heartbeat System
## المكون: نظام نبضات القلب (Heartbeat)

---

## الهدف
نظام اتصال دوري بين كل شاشة عرض والسيرفر المركزي للتأكد من أن الشاشة تعمل وتعرض المحتوى بشكل صحيح.

---

## الموقع في المشروع
```
wall-client/src/hooks/useHeartbeat.ts           ← React Hook للإرسال
backend/src/services/heartbeat.service.ts       ← خدمة الاستقبال والتحليل
```

---

## جانب العميل (GridPage)

### React Hook: useHeartbeat
```typescript
// wall-client/src/hooks/useHeartbeat.ts

function useHeartbeat(socket: Socket | null, config: HeartbeatConfig) {
  useEffect(() => {
    if (!socket || !config.hardwareId) return;
    
    const interval = setInterval(() => {
      const metrics = collectMetrics();
      
      socket.emit('display:heartbeat', {
        hardwareId: config.hardwareId,
        screenIndex: config.screenIndex,
        lectureId: config.lectureId,
        metrics,
        timestamp: Date.now()
      });
    }, 5000); // كل 5 ثواني
    
    return () => clearInterval(interval);
  }, [socket, config]);
}

function collectMetrics(): DisplayMetrics {
  return {
    // أداء الصفحة
    fps: Math.round(1000 / (performance.now() - lastFrameTime)),
    memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
    
    // حالة الاتصال
    connectionState: navigator.onLine ? 'online' : 'offline',
    
    // حالة الفيديو
    activeVideoTracks: document.querySelectorAll('video').length,
    
    // وقت التشغيل
    uptime: Date.now() - pageLoadTime
  };
}
```

---

## جانب السيرفر (Backend)

### Heartbeat Service
```typescript
// backend/src/services/heartbeat.service.ts

interface HeartbeatRecord {
  hardwareId: string;
  screenIndex: number;
  lastBeat: number;
  missedBeats: number;
  status: 'alive' | 'warning' | 'dead';
  metrics: DisplayMetrics;
}

class HeartbeatService {
  private records: Map<string, HeartbeatRecord> = new Map();
  private readonly BEAT_INTERVAL = 5000;     // 5 ثواني
  private readonly WARNING_AFTER = 2;         // تحذير بعد 2 نبضات مفقودة
  private readonly DEAD_AFTER = 3;            // ميت بعد 3 نبضات مفقودة
  
  // استقبال نبضة
  receiveBeat(data: HeartbeatData) {
    const record = this.records.get(data.hardwareId) || {
      hardwareId: data.hardwareId,
      screenIndex: data.screenIndex,
      lastBeat: 0,
      missedBeats: 0,
      status: 'alive',
      metrics: data.metrics
    };
    
    record.lastBeat = Date.now();
    record.missedBeats = 0;
    record.status = 'alive';
    record.metrics = data.metrics;
    
    this.records.set(data.hardwareId, record);
  }
  
  // فحص دوري (كل 5 ثواني)
  checkAll(): DeadDisplay[] {
    const now = Date.now();
    const deadDisplays: DeadDisplay[] = [];
    
    this.records.forEach((record) => {
      const elapsed = now - record.lastBeat;
      const missedBeats = Math.floor(elapsed / this.BEAT_INTERVAL);
      
      record.missedBeats = missedBeats;
      
      if (missedBeats >= this.DEAD_AFTER) {
        record.status = 'dead';
        deadDisplays.push({ hardwareId: record.hardwareId, screenIndex: record.screenIndex });
      } else if (missedBeats >= this.WARNING_AFTER) {
        record.status = 'warning';
      }
    });
    
    return deadDisplays;
  }
  
  // حالة كل الشاشات
  getStatusReport(): HeartbeatRecord[] {
    return Array.from(this.records.values());
  }
}
```

---

## تسلسل الأحداث

```
GridPage                    Backend                     Teacher Dashboard
   │                          │                              │
   │──heartbeat──────────────▶│                              │
   │  (كل 5 ثواني)           │──status update──────────────▶│
   │                          │                              │
   │──heartbeat──────────────▶│                              │
   │                          │                              │
   │  ❌ (انقطاع)             │                              │
   │                          │──[10 ثواني] warning────────▶│  🟡
   │                          │──[15 ثواني] offline────────▶│  🔴
   │                          │──rebalance students─────────│
   │                          │                              │
   │──heartbeat──────────────▶│  (عودة)                     │
   │                          │──[فوري] online─────────────▶│  🟢
   │                          │──reassign students──────────│
```

---

## معايير القبول
1. ✅ Heartbeat يُرسل كل 5 ثواني بدقة
2. ✅ تحذير بعد 10 ثواني بدون نبضة
3. ✅ "Offline" بعد 15 ثانية بدون نبضة
4. ✅ عند عودة الاتصال → الحالة تتحول لـ "Online" فوراً
5. ✅ Metrics (CPU, RAM, FPS) تُرسل مع كل نبضة
