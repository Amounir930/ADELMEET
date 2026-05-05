# Component 08: Self-Hosted LiveKit SFU (DEFERRED / مؤجل)

> [!CAUTION]
> **تم تأجيل هذا المكون بناءً على قرار هندسي لتجنب تداخل الأخطاء.**
> يرجى الرجوع إلى الملف [14-deferred-livekit-optimization.md](file:///C:/Users/Dell/Desktop/learn/meet-2/plan/14-deferred-livekit-optimization.md) لمعرفة الأسباب الفنية والخطة البديلة.

---

## الهدف
نقل LiveKit من الخدمة السحابية (LiveKit Cloud) إلى سيرفر خاص (Self-Hosted) لتقليل التكلفة وزيادة التحكم والأداء، خاصة مع 200 مشارك.

---

## الموقع في المشروع
```
livekit.yaml                              ← تكوين LiveKit SFU (موجود، يحتاج تحديث)
docker-compose.yml                        ← إضافة LiveKit container
backend/src/services/livekit.service.ts   ← تحديث LIVEKIT_URL
nginx_meet.conf                           ← إضافة proxy لـ LiveKit
```

---

## مواصفات السيرفر المطلوبة

| المكون | الحد الأدنى (100 مشارك) | الموصى به (200 مشارك) |
|--------|------------------------|----------------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Network | 1 Gbps | 2.5 Gbps |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

---

## ملف التكوين: livekit.yaml

```yaml
# livekit.yaml — Production Configuration
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  tcp_fallback_port: 7881

redis:
  address: redis:6379

keys:
  # API Key → Secret (يجب تغييرها!)
  SOVEREIGN_API_KEY: YOUR_SECRET_HERE

room:
  max_participants: 250
  empty_timeout: 300        # 5 دقائق
  departure_timeout: 20     # 20 ثانية

logging:
  level: info
  
turn:
  enabled: true
  domain: livekit.60sec.shop
  tls_port: 5349
  udp_port: 3478
```

---

## Docker Compose

```yaml
services:
  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"          # HTTP/WebSocket
      - "7881:7881"          # TCP fallback
      - "50000-60000:50000-60000/udp"  # WebRTC media
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    command: --config /etc/livekit.yaml
    depends_on:
      - redis
    restart: always
```

---

## تحديث Backend

```typescript
// .env
LIVEKIT_URL=wss://livekit.60sec.shop      // قبل: wss://cloud.livekit.io
LIVEKIT_API_KEY=SOVEREIGN_API_KEY
LIVEKIT_API_SECRET=YOUR_SECRET_HERE
```

---

## Nginx Configuration

```nginx
# إضافة لـ nginx config
server {
    server_name livekit.60sec.shop;
    
    location / {
        proxy_pass http://localhost:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## خطوات النشر
```bash
1. sudo apt update && sudo apt install -y docker.io docker-compose
2. تحرير livekit.yaml بالمفاتيح الصحيحة
3. docker-compose up -d livekit redis
4. اختبار: curl http://localhost:7880
5. تحديث .env في Backend بالعنوان الجديد
6. pm2 restart meet-backend
```

---

## اختبار الأداء
```bash
# أداة LiveKit الرسمية لاختبار التحميل:
docker run --rm livekit/livekit-cli load-test \
  --url wss://livekit.60sec.shop \
  --api-key SOVEREIGN_API_KEY \
  --api-secret YOUR_SECRET_HERE \
  --room test-room \
  --publishers 50 \
  --subscribers 50
```

---

## معايير القبول
1. ✅ LiveKit SFU يعمل على السيرفر الخاص
2. ✅ 100 مشارك يتصلون بدون أخطاء
3. ✅ Latency < 200ms بين المشاركين
4. ✅ CPU < 70% مع 200 مشارك
5. ✅ TURN fallback يعمل للشبكات المقيدة
