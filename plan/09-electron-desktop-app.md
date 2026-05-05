# Component 09: Electron Desktop App
## المكون: تطبيق سطح المكتب (Electron)

---

## الهدف
تطبيق يعمل على كمبيوتر القاعة، يكتشف جميع الشاشات المتصلة تلقائياً، ويفتح نافذة fullscreen على كل شاشة — الشاشة الرئيسية للمعلم (Teacher Dashboard)، والباقي لعرض الطلاب (GridPage).

---

## الموقع في المشروع
```
sovereign-desktop/
├── package.json
├── main.js                    ← Electron Main Process
├── preload.js                 ← Security bridge
├── screen-manager.js          ← اكتشاف وإدارة الشاشات
├── auto-updater.js            ← تحديث تلقائي
└── assets/
    └── icon.png
```

---

## الملف الرئيسي: main.js

```javascript
const { app, BrowserWindow, screen, ipcMain } = require('electron');

const BASE_URL = 'https://wall.60sec.shop';
let controlWindow = null;
let displayWindows = [];

app.whenReady().then(() => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  
  console.log(`[SOVEREIGN] Detected ${displays.length} displays`);
  
  // 1. الشاشة الرئيسية = Teacher Dashboard
  controlWindow = new BrowserWindow({
    x: primary.bounds.x,
    y: primary.bounds.y,
    width: primary.bounds.width,
    height: primary.bounds.height,
    fullscreen: true,
    title: 'Sovereign Command Center',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  controlWindow.loadURL(BASE_URL);
  
  // 2. باقي الشاشات = GridPage
  const secondaryDisplays = displays.filter(d => d.id !== primary.id);
  
  secondaryDisplays.forEach((display, index) => {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      fullscreen: true,
      frame: false,              // بدون شريط عنوان
      kiosk: true,               // وضع Kiosk
      closable: false,           // لا يمكن إغلاقها
      title: `Screen ${index + 1}`,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // URL يتحدد بعد أن يختار المعلم المحاضرة
    win.loadURL(`${BASE_URL}/grid?screen=${index}&count=4`);
    displayWindows.push(win);
  });
});

// التواصل بين الشاشة الرئيسية وشاشات العرض
ipcMain.on('launch-lecture', (event, { lectureId, studentsPerScreen }) => {
  displayWindows.forEach((win, index) => {
    const start = index * studentsPerScreen;
    win.loadURL(`${BASE_URL}/grid?lecture=${lectureId}&start=${start}&count=${studentsPerScreen}&screen=${index}`);
  });
});

ipcMain.on('close-all-displays', () => {
  displayWindows.forEach(win => {
    win.loadURL(`${BASE_URL}/grid?idle=true`);
  });
});
```

---

## Auto-Start (Windows)

```javascript
// auto-start.js — تسجيل التطبيق ليعمل عند بدء Windows
const { app } = require('electron');

app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe'),
  args: ['--autostart']
});
```

---

## بناء التطبيق

```json
// package.json
{
  "name": "sovereign-desktop",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64",
    "build:installer": "electron-builder --win nsis"
  },
  "build": {
    "appId": "com.sovereign.classroom",
    "productName": "Sovereign Classroom",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.png"
    },
    "nsis": {
      "oneClick": true,
      "perMachine": true
    }
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0"
  }
}
```

---

## معايير القبول
1. ✅ التطبيق يكتشف كل الشاشات المتصلة تلقائياً
2. ✅ نافذة fullscreen على كل شاشة بدون شريط عنوان
3. ✅ الشاشة الرئيسية = Teacher Dashboard
4. ✅ اختيار محاضرة → كل الشاشات تتحدث تلقائياً
5. ✅ يعمل تلقائياً عند تشغيل الكمبيوتر
6. ✅ يُنشئ ملف .exe قابل للتثبيت
