# Component 10: VLAN Network Isolation
## المكون: عزل الشبكة بتقنية VLAN

---

## الهدف
عزل حركة مرور كل قاعة دراسية في شبكة فرعية مستقلة (VLAN) لمنع التداخل بين القاعات وضمان جودة الفيديو.

---

## هذا المكون Hardware + Network — ليس كود

---

## تصميم الشبكة

```
                    ┌──────────────┐
                    │  Core Switch │
                    │  (10 Gbps)   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
    │ VLAN 100  │    │ VLAN 200  │    │ VLAN 201  │
    │ Management│    │ Room A    │    │ Room B    │
    │ 10.0.100.x│    │ 10.0.200.x│    │ 10.0.201.x│
    └───────────┘    └─────┬─────┘    └───────────┘
                           │
                    ┌──────┴───────┐
                    │ Access Switch│
                    │ (1 Gbps)     │
                    └──────┬───────┘
                           │
        ┌──────┬──────┬────┴─┬──────┬──────┐
        │PC #1 │PC #2 │PC #3 │ ... │PC #16│
        │Scr 1 │Scr 2 │Scr 3 │     │Scr16 │
        └──────┘──────┘──────┘─────┘──────┘
```

---

## توزيع الـ VLANs

| VLAN ID | الاسم | نطاق IP | الغرض | Bandwidth |
|---------|-------|---------|-------|-----------|
| 100 | Management | 10.0.100.0/24 | إدارة السيرفرات + SSH | 50 Mbps |
| 200 | Room-A-Media | 10.0.200.0/22 | فيديو القاعة A | 1 Gbps |
| 201 | Room-B-Media | 10.0.201.0/22 | فيديو القاعة B | 1 Gbps |
| 300 | Teacher-Control | 10.0.300.0/24 | تحكم المعلم | 20 Mbps |

---

## الأجهزة المطلوبة

| الجهاز | المواصفات | الكمية | السعر التقريبي |
|--------|-----------|--------|----------------|
| Core Switch (Layer 3) | Managed, 10Gbps, VLAN support | 1 | $500-800 |
| Access Switch (per room) | Managed, 1Gbps, 24 ports, PoE optional | 1/room | $200-400 |
| Cat6 Ethernet Cables | 5m-10m lengths | 20/room | $50-100 |

---

## QoS (Quality of Service) Policies

```
Priority 1 (Highest): WebRTC UDP Media (ports 50000-60000)
Priority 2: Socket.io Signaling (port 443/5000)
Priority 3: HTTP API Traffic
Priority 4 (Lowest): Everything else
```

### تكوين Switch (مثال Cisco):
```
interface range GigabitEthernet 0/1-16
  switchport mode access
  switchport access vlan 200
  spanning-tree portfast
  
vlan 200
  name Room-A-Media

interface vlan 200
  ip address 10.0.200.1 255.255.252.0
  
! QoS Policy
mls qos
class-map match-any WEBRTC-MEDIA
  match ip dscp ef
  match protocol udp
policy-map CLASSROOM-QOS
  class WEBRTC-MEDIA
    priority percent 60
  class class-default
    bandwidth remaining percent 40
```

---

## معايير القبول
1. ✅ كل قاعة في VLAN منفصل
2. ✅ قطع شبكة Room A لا يؤثر على Room B
3. ✅ WebRTC traffic يحصل على أولوية QoS
4. ✅ Broadcast storm في قاعة لا يؤثر على باقي القاعات
5. ✅ SSH إداري يعمل من VLAN 100 فقط
