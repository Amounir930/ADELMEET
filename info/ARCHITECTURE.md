# 🏗️ معمارية النظام (System Architecture)

## 📊 الرسم البياني العام

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Hybrid Classroom POC                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌──────────────────┐
│  Student Client     │         │  Wall Client     │
│  React + Vite       │         │  React + Vite    │
│  :5173              │         │  :5174           │
│                     │         │                  │
│ [Main Stage]        │         │ [Grid Layout]    │
│ [PiP Video]         │         │ [No Controls]    │
│ [Control Bar]       │         │ [Kiosk Mode]     │
└────────┬────────────┘         └────────┬─────────┘
         │                              │
         │    HTTP POST                 │ HTTP POST
         │    /api/rooms/join           │ /api/rooms/join
         │                              │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼────────────────┐
         │     Backend Server            │
         │   Node.js + Express           │
         │   :5000                       │
         │                               │
         │  [Route Handler]              │
         │  [Token Generator]            │
         │  [Error Handler]              │
         └──────────────┬────────────────┘
                        │
         ┌──────────────▼────────────────┐
         │   LiveKit Server (Docker)     │
         │   WebRTC + TURN                │
         │   :7880 (WS)                  │
         │                               │
         │  [Room Management]            │
         │  [Participant Tracking]       │
         │  [Media Relay]                │
         └───────────────────────────────┘
```

---

## 🔄 User Flow

### **Student Joining Flow**

```
┌──────────────┐
│ Student App  │
└──────┬───────┘
       │
       │ 1. Input: Room + Identity
       ▼
┌──────────────────────────────┐
│ JoinRoom Component           │
│ ├─ Validate input           │
│ └─ Call Backend API         │
└──────┬───────────────────────┘
       │
       │ 2. POST /api/rooms/join
       │    {roomName, identity}
       ▼
┌──────────────────────────────┐
│ Backend (Express)            │
│ ├─ Validate data            │
│ ├─ Generate JWT Token       │
│ └─ Return token + URL       │
└──────┬───────────────────────┘
       │
       │ 3. JWT + serverUrl
       ▼
┌──────────────────────────────┐
│ LiveKitContext               │
│ ├─ Create Room object        │
│ ├─ Connect to LiveKit        │
│ └─ Subscribe to tracks       │
└──────┬───────────────────────┘
       │
       │ 4. Connected!
       ▼
┌──────────────────────────────┐
│ VideoRoom Component          │
│ ├─ Render Main Stage        │
│ ├─ Render PiP               │
│ └─ Render Control Bar        │
└──────────────────────────────┘
```

### **Wall Display Auto-Join Flow**

```
┌──────────────┐
│ Wall App     │
└──────┬───────┘
       │
       │ 1. Load page
       ▼
┌──────────────────────────────┐
│ App Component                │
│ └─ Auto-call handleJoin()    │
└──────┬───────────────────────┘
       │
       │ 2. POST /api/rooms/join
       │    {roomName: "classroom-wall"}
       ▼
┌──────────────────────────────┐
│ Backend                      │
│ └─ Generate token (auto)     │
└──────┬───────────────────────┘
       │
       │ 3. JWT
       ▼
┌──────────────────────────────┐
│ VideoRoom (Grid)             │
│ ├─ Disable local media       │
│ ├─ Hide controls             │
│ └─ Show ParticipantGrid      │
└──────────────────────────────┘
```

---

## 📡 WebRTC Connection

```
┌─────────────────────────────────────────────────────────────┐
│                   LiveKit Server                             │
│                  (Docker Container)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Room: "test-room"                             │   │
│  │                                                      │   │
│  │  ┌───────────┐      ┌────────────┐      ┌────────┐ │   │
│  │  │ Participant│      │ Participant │      │ Wall   │ │   │
│  │  │ Ahmed      │      │ Dr. Ahmed   │      │Display │ │   │
│  │  │(Student1)  │      │ (Teacher)   │      │(Kiosk) │ │   │
│  │  │            │◄────►│             │◄────►│        │ │   │
│  │  │ Publish:   │      │ Publish:    │      │Consume │ │   │
│  │  │ Camera,Mic │      │ Camera,Mic, │      │ All    │ │   │
│  │  │ Subscribe: │      │ Screen      │      │Streams │ │   │
│  │  │ Teacher    │      │ Subscribe:  │      │No Pub  │ │   │
│  │  │            │      │ Student1    │      │        │ │   │
│  │  └───────────┘      └────────────┘      └────────┘ │   │
│  │        ▲                  ▲                    ▲     │   │
│  │        │                  │                    │     │   │
│  │        └──────────────────┴────────────────────┘     │   │
│  │               (Media Relay)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Component Hierarchy

### **Student Client**

```
App
 ├─ LiveKitProvider
 │   └─ AppContent
 │       ├─ JoinRoom (when !room)
 │       └─ VideoRoom (when room)
 │           ├─ MainStage
 │           │   └─ VideoTrack (Teacher)
 │           ├─ PictureInPicture
 │           │   └─ VideoTrack (Local)
 │           ├─ ParticipantGrid (optional)
 │           │   └─ VideoTrack[] (others)
 │           └─ ControlBar
 │               ├─ Mic Button
 │               ├─ Cam Button
 │               └─ Leave Button
```

### **Wall Client**

```
App
 ├─ LiveKitProvider
 │   └─ AppContent
 │       ├─ JoinRoom (activation screen)
 │       └─ VideoRoom (when connected)
 │           └─ ParticipantGrid
 │               └─ VideoTrack[] (all remotes)
```

---

## 🗂️ Data Flow

### **State Management - LiveKitContext**

```typescript
LiveKitContext {
  room: Room | null          ← Current connected room
  connect()                  ← Initialize connection
  disconnect()               ← Close connection
  isConnecting: boolean      ← Loading state
  error: string | null       ← Error message
}
```

### **Component State - VideoRoom**

```typescript
VideoRoom {
  participants: Participant[]
  remoteParticipants: RemoteParticipant[]
  viewMode: 'STUDENT' | 'WALL'
  isMicOn: boolean
  isCamOn: boolean
}
```

---

## 🎬 Event Flow

### **Participant Connected**

```
LiveKit Room
 │
 └─► room.on('participantConnected', (participant) => {
       updateParticipants()
     })
     │
     ├─ setRemoteParticipants([...])
     │
     └─ Re-render VideoRoom/ParticipantGrid
```

### **Track Published**

```
Participant
 │
 └─► participant.on('trackSubscribed', (track) => {
       videoRef.attach(track)
       setIsVideoEnabled(true)
     })
     │
     └─ Video appears on screen
```

### **Controls Updated**

```
ControlBar Button Click
 │
 ├─ room.localParticipant.setMicrophoneEnabled()
 │
 └─► LiveKit Server
       │
       └─► All Subscribers notified
            └─► Show Muted icon
```

---

## 🔐 Token Flow

```
Frontend                Backend               LiveKit
    │                      │                      │
    ├─ Join request ──────►│                      │
    │                      │                      │
    │                      ├─ Generate JWT ────►│
    │                      │                      │
    │                      │◄─ Token valid ──┐   │
    │                      │                 │   │
    │◄─────── Token ───────┤                 │   │
    │         + URL        │                 │   │
    │                      │                 │   │
    ├─ Connect WS ────────────────────────────► │
    │   (use Token)        │                     │
    │                      │                     │
    │                      │                ◄─ Authenticate
    │                      │                    │
    │◄─────────────────────────── Ready ───────┤
    │   (Connected!)       │
```

---

## 📱 Responsive Layout

### **Student View - Desktop**

```
┌─────────────────────────────────┐
│       Main Stage (90%)           │
│    ┌─────────────────────────┐  │
│    │                         │  │ 
│    │     Teacher Video       │  │
│    │   (object-fit: contain) │  │
│    │                         │  │
│    └─────────────────────────┘  │
│                    ┌──────┐     │
│                    │ PiP  │     │
│                    │ 200  │     │
│                    │ px   │     │
│                    └──────┘     │
│                                 │
│    [🎤] [🎥] | [☎️ Leave]      │
└─────────────────────────────────┘
```

### **Wall View - Grid**

```
┌─────────────────────────────────┐
│  [Student1] [Student2] [Student3] │
│  ┌──────────┐┌──────────┐        │
│  │ Name ↑  ││ Name ↑  ││        │
│  │   🎤    ││   🎤    ││        │
│  │ Video   ││ Video   ││        │
│  └──────────┘└──────────┘        │
│  [Student4]  [Student5]         │
│  ┌──────────┐┌──────────┐        │
│  │ Name ↑  ││ Name ↑  ││        │
│  │   🔴    ││   🎤    ││        │
│  │ Video   ││ Video   ││        │
│  └──────────┘└──────────┘        │
└─────────────────────────────────┘
```

---

## 🔄 Lifecycle Events

### **Room Connected**

```
1. room.on('participantConnected')
2. room.on('participantDisconnected')
3. room.on('localTrackPublished')
4. room.on('localTrackUnpublished')
5. participant.on('trackSubscribed')
6. participant.on('trackUnsubscribed')
7. participant.on('trackMuted')
8. participant.on('trackUnmuted')
```

### **Component Mounting**

```
VideoRoom
  └─ useEffect(() => {
       // 1. Attach listeners
       room.on('participantConnected', updateParticipants)
       
       // 2. Get initial state
       updateParticipants()
       
       // 3. Start media
       if (viewMode === 'STUDENT') startMedia()
       
       // 4. Cleanup on unmount
       return () => {
         room.off('participantConnected', ...)
         clearTimeout()
       }
     }, [room, viewMode])
```

---

## 🎯 CSS Grid Strategy

### **Grid Formula**

```css
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
```

**How it works:**
- `auto-fit`: تكييف عدد الأعمدة تلقائياً
- `minmax(300px, 1fr)`: كل عمود من 300px إلى حد أقصى متساوي

**Examples:**
- 1 participant → 1×1 (ملء الشاشة)
- 2 participants → 1×2 (جنباً إلى جنب)
- 3 participants → 1×3 أو 3×1
- 4 participants → 2×2
- 5-9 participants → 3×3
- 10+ participants → 4×4

---

**معمارية مرنة وقابلة للتطوير! 🚀**
