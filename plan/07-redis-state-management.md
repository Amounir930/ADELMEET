# Component 07: Redis State Management
## المكون: إدارة الحالة بـ Redis

---

## الهدف
استبدال تخزين الحالة في ذاكرة Node.js (Maps) بـ Redis لضمان: سرعة الوصول، مشاركة الحالة بين عدة سيرفرات، واستمرارية البيانات عند إعادة تشغيل السيرفر.

---

## الموقع في المشروع
```
backend/src/infra/redis.ts                    ← اتصال Redis
backend/src/services/state.service.ts         ← خدمة إدارة الحالة
docker-compose.yml                            ← إضافة Redis container
```

---

## ما يتم تخزينه في Redis

### 1. حالة الغرفة (Room State)
```
Key:    room:{roomName}
Type:   Hash
TTL:    24 hours
Fields:
  - lectureId: "abc123"
  - teacherIdentity: "user1_teacher"
  - status: "live" | "paused" | "ended"
  - isMuted: "true" | "false"
  - totalStudents: "60"
  - totalScreens: "15"
  - createdAt: "1714819200000"
```

### 2. توزيع الشاشات (Display Assignment)
```
Key:    room:{roomName}:screens
Type:   Hash
Fields:
  - screen:0: '["student1","student2","student3","student4"]'
  - screen:1: '["student5","student6","student7","student8"]'
  - ...
  - screen:14: '["student57","student58","student59","student60"]'
```

### 3. حالة كل شاشة (Display Health)
```
Key:    display:{hardwareId}
Type:   Hash
TTL:    1 hour (يتجدد مع كل heartbeat)
Fields:
  - screenIndex: "3"
  - roomName: "room-abc"
  - status: "online"
  - lastHeartbeat: "1714819200000"
  - cpu: "45"
  - ram: "62"
  - fps: "30"
```

### 4. قائمة الشاشات النشطة لكل غرفة
```
Key:    room:{roomName}:displays
Type:   Set
Members: ["PC-A1-001", "PC-A1-002", ...]
```

---

## خدمة Redis

```typescript
// backend/src/infra/redis.ts
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Error:', err));
redisClient.on('connect', () => logger.info('[REDIS] Connected'));

export default redisClient;
```

```typescript
// backend/src/services/state.service.ts
class StateService {
  // حالة الغرفة
  async setRoomState(roomName: string, state: RoomState): Promise<void> {
    await redis.hSet(`room:${roomName}`, state);
    await redis.expire(`room:${roomName}`, 86400); // 24 hours
  }
  
  async getRoomState(roomName: string): Promise<RoomState | null> {
    return await redis.hGetAll(`room:${roomName}`);
  }
  
  // توزيع الشاشات
  async setScreenAssignment(roomName: string, screenIndex: number, students: string[]) {
    await redis.hSet(`room:${roomName}:screens`, `screen:${screenIndex}`, JSON.stringify(students));
  }
  
  async getScreenAssignment(roomName: string, screenIndex: number): Promise<string[]> {
    const data = await redis.hGet(`room:${roomName}:screens`, `screen:${screenIndex}`);
    return data ? JSON.parse(data) : [];
  }
  
  // Heartbeat
  async updateHeartbeat(hardwareId: string, metrics: DisplayMetrics) {
    await redis.hSet(`display:${hardwareId}`, {
      ...metrics,
      lastHeartbeat: Date.now().toString(),
      status: 'online'
    });
    await redis.expire(`display:${hardwareId}`, 3600); // 1 hour
  }
}
```

---

## Docker Compose Update
```yaml
# إضافة لـ docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: always
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

---

## معايير القبول
1. ✅ Redis يعمل ويتصل بالـ Backend
2. ✅ حالة الغرفة تُخزَّن وتُسترجع بسرعة < 5ms
3. ✅ إعادة تشغيل Backend → الحالة محفوظة في Redis
4. ✅ TTL يعمل — بيانات قديمة تُحذف تلقائياً
5. ✅ عدة سيرفرات تقرأ نفس الحالة من Redis
