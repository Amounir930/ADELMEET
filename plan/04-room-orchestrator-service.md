# Component 04: Room Orchestrator Service
## المكون: خدمة إدارة الغرف والشاشات (Backend)

---

## الهدف
خدمة مركزية في الـ Backend تدير: تسجيل الشاشات، توزيع الطلاب، حالة كل غرفة، وتنسيق الأوامر بين المعلم والشاشات.

---

## الموقع في المشروع
```
backend/src/services/room-orchestrator.service.ts   ← الخدمة الرئيسية
backend/src/models/Display.ts                       ← نموذج الشاشة
backend/src/routes/display.routes.ts                ← API endpoints
backend/src/controllers/display.controller.ts       ← التحكم
```

---

## نموذج البيانات: Display

```typescript
// backend/src/models/Display.ts
const displaySchema = new mongoose.Schema({
  hardwareId: { type: String, required: true, unique: true },
  roomId: { type: String, required: true },        // معرف القاعة الفيزيائية
  lectureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' },
  displayIndex: { type: Number, required: true },   // رقم الشاشة (0-15)
  ipAddress: { type: String },
  status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
  assignedStudents: [{ type: String }],             // student identities
  lastHeartbeat: { type: Date, default: Date.now },
  config: {
    quality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    gridLayout: { type: String, default: 'auto' },   // auto, 2x2, 3x3, 4x4
  }
}, { timestamps: true });
```

---

## API Endpoints

### 1. تسجيل شاشة جديدة
```
POST /api/displays/register
Body: {
  hardwareId: "PC-A1-001",
  roomId: "room-1",
  displayIndex: 3,
  ipAddress: "10.0.200.11"
}
Response: {
  success: true,
  display: { _id, hardwareId, roomId, displayIndex, status: "online" }
}
```

### 2. جلب توزيع الطلاب لمحاضرة معينة
```
GET /api/displays/:lectureId/assignment
Response: {
  totalStudents: 60,
  totalScreens: 15,
  studentsPerScreen: 4,
  screens: [
    { screenIndex: 0, students: ["student1", "student2", ...], status: "online" },
    { screenIndex: 1, students: [...], status: "online" },
    ...
  ]
}
```

### 3. إعادة توزيع يدوي
```
POST /api/displays/:lectureId/rebalance
Response: {
  success: true,
  message: "Rebalanced 60 students across 15 screens"
}
```

### 4. تحديث حالة شاشة (Heartbeat)
```
POST /api/displays/heartbeat
Body: { hardwareId: "PC-A1-001", lectureId: "...", metrics: { cpu: 45, ram: 60 } }
Response: { acknowledged: true }
```

### 5. أمر تحكم لشاشة معينة
```
POST /api/displays/:displayId/command
Body: { command: "refresh" | "set_quality" | "shutdown", params: { quality: "high" } }
Response: { sent: true }
```

---

## الخدمة الرئيسية

```typescript
// backend/src/services/room-orchestrator.service.ts
class RoomOrchestratorService {
  
  // تسجيل شاشة عند الاتصال
  async registerDisplay(data: RegisterDisplayDTO): Promise<Display> {}
  
  // جلب كل الشاشات لمحاضرة معينة
  async getDisplaysForLecture(lectureId: string): Promise<Display[]> {}
  
  // حساب وتوزيع الطلاب على الشاشات
  async computeAssignment(lectureId: string): Promise<AssignmentResult> {}
  
  // إعادة التوزيع عند تغيير عدد الطلاب أو الشاشات
  async rebalance(lectureId: string): Promise<void> {}
  
  // تحديث heartbeat لشاشة
  async updateHeartbeat(hardwareId: string): Promise<void> {}
  
  // اكتشاف الشاشات المنقطعة
  async detectOfflineDisplays(): Promise<Display[]> {}
  
  // إرسال أمر لشاشة محددة
  async sendCommand(displayId: string, command: string, params?: any): Promise<void> {}
}
```

---

## التكامل مع Socket.io

```typescript
// أحداث جديدة في socket.service.ts:

// شاشة تسجل نفسها
socket.on('display:register', (data) => {
  orchestrator.registerDisplay(data);
  socket.join(`screen:${data.displayIndex}`);
});

// شاشة ترسل heartbeat
socket.on('display:heartbeat', (data) => {
  orchestrator.updateHeartbeat(data.hardwareId);
});

// المعلم يطلب إعادة التوزيع
socket.on('teacher:rebalance', ({ lectureId }) => {
  orchestrator.rebalance(lectureId);
});

// المعلم يرسل أمر لشاشة محددة
socket.on('teacher:screen_command', ({ screenIndex, command }) => {
  io.to(`screen:${screenIndex}`).emit(`display:${command}`);
});
```

---

## معايير القبول
1. ✅ شاشة جديدة تسجل نفسها عبر API أو Socket
2. ✅ API يرجع توزيع صحيح للطلاب
3. ✅ إعادة التوزيع تعمل عند طلب المعلم
4. ✅ أوامر التحكم تصل للشاشة المحددة فقط
5. ✅ Heartbeat يُحدَّث كل 5 ثواني
