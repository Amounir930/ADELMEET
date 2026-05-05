# Component 12: Recording & Playback
## المكون: تسجيل المحاضرات وإعادة تشغيلها

---

## الهدف
تسجيل بث المعلم (وبعض الطلاب اختيارياً) أثناء المحاضرة، وحفظ التسجيل للمشاهدة لاحقاً.

---

## الموقع في المشروع
```
backend/src/services/recording.service.ts        ← خدمة التسجيل
backend/src/models/Recording.ts                  ← نموذج التسجيل
backend/src/routes/recording.routes.ts           ← API endpoints
wall-client/src/components/RecordingControls.tsx  ← أزرار التسجيل للمعلم
student-client/src/pages/RecordingsPage.tsx       ← صفحة المشاهدة
```

---

## طرق التسجيل المتاحة

### الطريقة 1: LiveKit Egress (الموصى بها)
LiveKit يوفر خدمة Egress مدمجة تسجل الغرفة server-side:

```typescript
// backend/src/services/recording.service.ts
import { EgressClient, EncodedFileOutput } from 'livekit-server-sdk';

class RecordingService {
  private egressClient: EgressClient;
  
  constructor() {
    this.egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
  }
  
  // بدء تسجيل
  async startRecording(roomName: string, lectureId: string): Promise<string> {
    const output = new EncodedFileOutput({
      fileType: 'mp4',
      filepath: `/recordings/${lectureId}/{room_name}-{time}.mp4`,
      // يمكن الحفظ في S3/GCS:
      // s3: { bucket: 'sovereign-recordings', region: 'me-south-1' }
    });
    
    const info = await this.egressClient.startRoomCompositeEgress(
      roomName,
      { file: output },
      {
        layout: 'grid',               // تخطيط الفيديو
        customBaseUrl: '',             // يمكن استخدام template مخصص
        audioOnly: false,
        videoOnly: false,
      }
    );
    
    return info.egressId;
  }
  
  // إيقاف تسجيل
  async stopRecording(egressId: string): Promise<void> {
    await this.egressClient.stopEgress(egressId);
  }
  
  // قائمة التسجيلات
  async listRecordings(lectureId: string): Promise<Recording[]> {
    return await Recording.find({ lectureId }).sort({ createdAt: -1 });
  }
}
```

---

## نموذج البيانات

```typescript
// backend/src/models/Recording.ts
const recordingSchema = new mongoose.Schema({
  lectureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomName: { type: String, required: true },
  egressId: { type: String },                    // LiveKit Egress ID
  filePath: { type: String },                     // مسار الملف
  fileUrl: { type: String },                      // رابط المشاهدة
  duration: { type: Number },                     // المدة بالثواني
  fileSize: { type: Number },                     // الحجم بالبايت
  status: { type: String, enum: ['recording', 'processing', 'ready', 'failed'], default: 'recording' },
}, { timestamps: true });
```

---

## API Endpoints

```
POST   /api/recordings/start      ← بدء تسجيل (المعلم فقط)
POST   /api/recordings/stop       ← إيقاف تسجيل
GET    /api/recordings/:lectureId ← قائمة تسجيلات محاضرة
GET    /api/recordings/:id/stream ← مشاهدة تسجيل (streaming)
DELETE /api/recordings/:id        ← حذف تسجيل
```

---

## واجهة المعلم (أزرار التسجيل)
```
┌─────────────────────────────────────┐
│  ⏺️ REC  00:45:23   [ ⏹ STOP ]    │
└─────────────────────────────────────┘
```

---

## معايير القبول
1. ✅ المعلم يبدأ التسجيل بزر واحد
2. ✅ التسجيل يشمل فيديو المعلم + صوت
3. ✅ الملف يُحفظ بصيغة MP4
4. ✅ الطلاب يمكنهم مشاهدة التسجيلات السابقة
5. ✅ التسجيل لا يؤثر على أداء البث المباشر
