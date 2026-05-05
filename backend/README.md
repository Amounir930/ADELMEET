# Backend Server Documentation

## نظرة عامة

خادم Node.js + Express يتوسط بين عملاء الواجهة الأمامية و LiveKit Server.

مسؤولياته:
- توليد JWT tokens للعملاء
- التحقق من بيانات المستخدمين
- إدارة غرف الفصول الدراسية

---

## المتطلبات البيئية

```env
# .env.local
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
PORT=5000
NODE_ENV=development
```

---

## API Endpoints

### 1. Health Check

**Request:**
```
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### 2. Join Room

**Endpoint:**
```
POST /api/rooms/join
```

**Request Body:**
```json
{
  "roomName": "classroom-101",
  "identity": "ahmed-ali",
  "isTeacher": false,
  "isWallDisplay": false
}
```

**Response (Success - 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "serverUrl": "ws://localhost:7880"
}
```

**Response (Error - 400):**
```json
{
  "error": "Room name is required",
  "status": 400
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to generate token",
  "status": 500
}
```

---

## التفاصيل التقنية

### Token Generation

```typescript
// استخدام AccessToken من @livekit/server-sdk

const token = new AccessToken(apiKey, apiSecret, {
  identity: identity,
  name: identity,
  grants: {
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    room: roomName,
    roomJoin: true,
  },
  ttl: 14400, // 4 hours
});

const jwt = await token.toJwt();
```

### CORS Configuration

```typescript
app.use(cors());  // السماح بـ cross-origin requests من الـ browsers
```

### Error Handling

```typescript
// الـ middleware يلتقط جميع الأخطاء
app.use(errorHandler);  // يعيد JSON response
```

---

## أمثلة الاستخدام

### **Example 1: Student Joining**

```bash
curl -X POST http://localhost:5000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "math-101",
    "identity": "Ahmed Ahmed",
    "isTeacher": false,
    "isWallDisplay": false
  }'
```

### **Example 2: Teacher Joining**

```bash
curl -X POST http://localhost:5000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "math-101",
    "identity": "Dr. Muhammad",
    "isTeacher": true,
    "isWallDisplay": false
  }'
```

### **Example 3: Wall Display Auto-Join**

```bash
curl -X POST http://localhost:5000/api/rooms/join \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "math-101",
    "identity": "ClassroomWall-001",
    "isTeacher": false,
    "isWallDisplay": true
  }'
```

---

## معالجة الأخطاء

### Validation Errors

```typescript
// roomName missing
{
  "error": "Room name is required",
  "status": 400
}

// identity missing
{
  "error": "Identity is required",
  "status": 400
}
```

### Server Errors

```typescript
// LiveKit server not reachable
{
  "error": "Failed to generate token",
  "status": 500
}

// Invalid credentials
{
  "error": "Invalid LiveKit credentials",
  "status": 500
}
```

---

## معمارية الملفات

```
backend/
├── src/
│   ├── index.ts                # نقطة البداية الرئيسية
│   ├── middleware/
│   │   ├── errorHandler.ts     # معالج الأخطاء المركزي
│   │   └── asyncHandler.ts     # wrapper للـ async routes
│   ├── services/
│   │   └── livekit.service.ts  # تفاعل LiveKit
│   ├── routes/
│   │   └── room.routes.ts      # room-related routes
│   ├── infra/
│   │   └── errors.ts           # custom error classes
│   └── ...
└── package.json
```

---

## متطلبات الحزم

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@livekit/server-sdk": "^0.8.4",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0"
  }
}
```

---

## الإرشادات الأمنية

1. **لا تضع API Keys في الكود**
   ```typescript
   // ❌ خطأ
   const apiKey = "devkey";

   // ✅ صحيح
   const apiKey = process.env.LIVEKIT_API_KEY;
   ```

2. **استخدم HTTPS في الإنتاج**
   ```
   ws://localhost:7880    // Development
   wss://yourdomain.com   // Production
   ```

3. **التحقق من بيانات الإدخال**
   ```typescript
   if (!roomName || !identity) {
     return res.status(400).json({ error: 'Missing required fields' });
   }
   ```

---

## سيناريوهات الاختبار

### Test 1: Connection Success
```bash
✅ التوقع: token و serverUrl يُرجعان
```

### Test 2: Missing roomName
```bash
✅ التوقع: 400 error
```

### Test 3: Multiple Users Same Room
```bash
✅ التوقع: جميع المستخدمين يحصلون على نفس room name
```

---

## المستقبل

- [ ] Database integration (store room history)
- [ ] Authentication (verify user credentials)
- [ ] Rate limiting (prevent abuse)
- [ ] Logging (structured logging)
- [ ] Metrics (Prometheus/Grafana)
