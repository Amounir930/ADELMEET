# Component 13: Analytics Dashboard
## المكون: لوحة التحليلات والإحصائيات

---

## الهدف
لوحة تحليلات تعرض إحصائيات المحاضرات: حضور الطلاب، مدة المشاركة، جودة الاتصال، وأداء الشاشات — لمساعدة المعلم والإدارة في اتخاذ قرارات مبنية على بيانات.

---

## الموقع في المشروع
```
backend/src/services/analytics.service.ts          ← خدمة جمع البيانات
backend/src/models/AnalyticsEvent.ts               ← نموذج الأحداث
backend/src/routes/analytics.routes.ts             ← API endpoints
wall-client/src/components/AnalyticsDashboard.tsx  ← لوحة العرض
```

---

## البيانات المجموعة

### 1. أحداث المحاضرة (Lecture Events)
```typescript
// كل حدث يُسجَّل تلقائياً:
interface AnalyticsEvent {
  type: 'student_join' | 'student_leave' | 'mute' | 'unmute' | 'kick' |
        'screen_online' | 'screen_offline' | 'quality_change' | 
        'recording_start' | 'recording_stop';
  lectureId: string;
  userId?: string;
  screenIndex?: number;
  metadata: Record<string, any>;
  timestamp: Date;
}
```

### 2. مقاييس الجلسة (Session Metrics)
```typescript
interface SessionMetrics {
  lectureId: string;
  
  // حضور
  peakStudents: number;          // أقصى عدد طلاب في نفس الوقت
  totalUniqueStudents: number;   // إجمالي الطلاب المختلفين
  averageAttendanceDuration: number; // متوسط مدة الحضور (دقائق)
  
  // جودة
  averageLatency: number;        // متوسط التأخير (ms)
  averageFps: number;            // متوسط الإطارات
  packetLossRate: number;        // نسبة فقد الحزم
  
  // شاشات
  totalScreens: number;
  screenUptimePercent: number;   // نسبة التشغيل
  
  // تفاعل
  totalMuteEvents: number;
  totalKickEvents: number;
  
  duration: number;              // مدة المحاضرة (دقائق)
}
```

---

## نموذج البيانات

```typescript
// backend/src/models/AnalyticsEvent.ts
const analyticsEventSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  lectureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  screenIndex: { type: Number },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Index مركب للاستعلامات السريعة
analyticsEventSchema.index({ lectureId: 1, type: 1, timestamp: -1 });
```

---

## API Endpoints

```
GET /api/analytics/lectures/:lectureId/summary
  → ملخص المحاضرة (عدد الطلاب، المدة، الجودة)

GET /api/analytics/lectures/:lectureId/timeline
  → جدول زمني للأحداث (دخول/خروج/mute/kick)

GET /api/analytics/lectures/:lectureId/attendance
  → قائمة الحضور التفصيلية (من حضر ومتى دخل/خرج)

GET /api/analytics/teacher/:teacherId/overview
  → إحصائيات المعلم الشاملة (عدد المحاضرات، إجمالي الطلاب)

GET /api/analytics/screens/:lectureId/performance
  → أداء كل شاشة (CPU, FPS, Uptime)
```

---

## لوحة العرض (AnalyticsDashboard)

```
┌─────────────────────────────────────────────────────┐
│  📊 LECTURE ANALYTICS                               │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 👥 58    │  │ ⏱️ 1:23  │  │ 📡 99.2% │          │
│  │ Students │  │ Duration │  │ Uptime   │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  📈 Attendance Timeline                             │
│  ┌─────────────────────────────────────────┐       │
│  │  60 ─┤     ╱────────────────╲           │       │
│  │  40 ─┤   ╱                    ╲         │       │
│  │  20 ─┤ ╱                        ╲       │       │
│  │   0 ─┤──────────────────────────────    │       │
│  │       10:00  10:30  11:00  11:30        │       │
│  └─────────────────────────────────────────┘       │
│                                                     │
│  📋 Attendance List                                 │
│  ┌────────────┬──────────┬──────────┬──────┐       │
│  │ Student    │ Joined   │ Left     │ Dur  │       │
│  ├────────────┼──────────┼──────────┼──────┤       │
│  │ أحمد محمد  │ 10:02    │ 11:28    │ 86m  │       │
│  │ سارة علي   │ 10:05    │ 11:30    │ 85m  │       │
│  │ محمد خالد  │ 10:15    │ 10:45    │ 30m  │       │
│  └────────────┴──────────┴──────────┴──────┘       │
└─────────────────────────────────────────────────────┘
```

---

## خدمة التحليلات

```typescript
// backend/src/services/analytics.service.ts
class AnalyticsService {
  
  // تسجيل حدث
  async trackEvent(event: Partial<AnalyticsEvent>): Promise<void> {
    await AnalyticsEvent.create({
      ...event,
      timestamp: new Date()
    });
  }
  
  // ملخص محاضرة
  async getLectureSummary(lectureId: string): Promise<SessionMetrics> {
    const events = await AnalyticsEvent.find({ lectureId });
    
    const joins = events.filter(e => e.type === 'student_join');
    const leaves = events.filter(e => e.type === 'student_leave');
    
    return {
      lectureId,
      peakStudents: this.calculatePeak(joins, leaves),
      totalUniqueStudents: new Set(joins.map(j => j.userId)).size,
      averageAttendanceDuration: this.calculateAvgDuration(joins, leaves),
      totalMuteEvents: events.filter(e => e.type === 'mute').length,
      totalKickEvents: events.filter(e => e.type === 'kick').length,
      // ... المزيد
    };
  }
  
  // جدول الحضور
  async getAttendanceReport(lectureId: string): Promise<AttendanceRecord[]> {
    // يرجع قائمة الطلاب مع وقت الدخول/الخروج والمدة
  }
}
```

---

## التكامل (أين تُسجَّل الأحداث)

| الحدث | المكان | الكود |
|-------|--------|-------|
| طالب يدخل | `socket.service.ts` → `join_room` | `analytics.trackEvent({type:'student_join', ...})` |
| طالب يخرج | `socket.service.ts` → `disconnect` | `analytics.trackEvent({type:'student_leave', ...})` |
| Mute/Unmute | `socket.service.ts` → `teacher:mute_all` | `analytics.trackEvent({type:'mute', ...})` |
| Kick | `lecture.service.ts` → `banUser` | `analytics.trackEvent({type:'kick', ...})` |
| شاشة Online | `heartbeat.service.ts` | `analytics.trackEvent({type:'screen_online', ...})` |

---

## معايير القبول
1. ✅ كل حدث يُسجَّل تلقائياً في قاعدة البيانات
2. ✅ ملخص المحاضرة يظهر: عدد الطلاب + المدة + الجودة
3. ✅ جدول الحضور يظهر: من حضر ومتى
4. ✅ رسم بياني للحضور عبر الزمن
5. ✅ أداء الشاشات (CPU, FPS) مسجل ومعروض
6. ✅ البيانات تُحذف تلقائياً بعد 90 يوم (GDPR compliance)
