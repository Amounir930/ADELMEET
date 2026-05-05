# Component 03: Display Assignment Algorithm
## المكون: خوارزمية توزيع الطلاب على الشاشات

---

## الهدف
بناء خوارزمية ذكية توزع الطلاب على الشاشات بشكل متوازن، وتعيد التوزيع تلقائياً عند دخول/خروج طالب أو انقطاع شاشة.

---

## الموقع في المشروع
```
backend/src/services/display-assignment.service.ts   ← الخوارزمية
backend/src/services/socket.service.ts               ← بث التحديثات
```

---

## الخوارزمية الأساسية: Round-Robin Balanced

### 1. التوزيع الأولي
```typescript
interface DisplayAssignment {
  screenIndex: number;
  students: string[];  // student identities
}

function distributeStudents(
  students: string[],        // قائمة معرفات الطلاب
  numberOfScreens: number     // عدد الشاشات المتاحة
): DisplayAssignment[] {
  
  // ترتيب الطلاب أبجدياً لضمان ترتيب ثابت عبر كل الشاشات
  const sorted = [...students].sort();
  
  const perScreen = Math.ceil(sorted.length / numberOfScreens);
  const assignments: DisplayAssignment[] = [];
  
  for (let i = 0; i < numberOfScreens; i++) {
    assignments.push({
      screenIndex: i,
      students: sorted.slice(i * perScreen, (i + 1) * perScreen)
    });
  }
  
  return assignments;
}
```

### 2. إعادة التوزيع عند دخول طالب جديد
```typescript
function onStudentJoin(
  currentAssignments: DisplayAssignment[],
  newStudent: string
): { updatedAssignments: DisplayAssignment[], targetScreen: number } {
  
  // ابحث عن الشاشة الأقل عدداً
  let minScreen = 0;
  let minCount = Infinity;
  
  currentAssignments.forEach((a, i) => {
    if (a.students.length < minCount) {
      minCount = a.students.length;
      minScreen = i;
    }
  });
  
  // أضف الطالب للشاشة الأقل عدداً
  currentAssignments[minScreen].students.push(newStudent);
  
  return {
    updatedAssignments: currentAssignments,
    targetScreen: minScreen
  };
}
```

### 3. إعادة التوزيع عند خروج طالب
```typescript
function onStudentLeave(
  currentAssignments: DisplayAssignment[],
  leavingStudent: string
): { updatedAssignments: DisplayAssignment[], affectedScreen: number } {
  
  // ابحث عن الشاشة التي تحتوي على الطالب
  let affectedScreen = -1;
  
  currentAssignments.forEach((a, i) => {
    const idx = a.students.indexOf(leavingStudent);
    if (idx !== -1) {
      a.students.splice(idx, 1);
      affectedScreen = i;
    }
  });
  
  return {
    updatedAssignments: currentAssignments,
    affectedScreen
  };
}
```

### 4. إعادة التوزيع عند انقطاع شاشة
```typescript
function onScreenOffline(
  currentAssignments: DisplayAssignment[],
  offlineScreenIndex: number
): DisplayAssignment[] {
  
  // استخرج طلاب الشاشة المنقطعة
  const orphanStudents = currentAssignments[offlineScreenIndex].students;
  currentAssignments[offlineScreenIndex].students = [];
  
  // وزعهم على الشاشات المتبقية بالتساوي
  const onlineScreens = currentAssignments.filter((_, i) => i !== offlineScreenIndex);
  
  orphanStudents.forEach((student, i) => {
    const targetIdx = i % onlineScreens.length;
    onlineScreens[targetIdx].students.push(student);
  });
  
  return currentAssignments;
}
```

---

## بث التحديثات عبر Socket.io

### عند أي تغيير في التوزيع:
```typescript
// Backend يرسل لكل شاشة توزيعها الجديد
function broadcastAssignment(
  io: SocketServer,
  roomName: string,
  assignments: DisplayAssignment[]
) {
  assignments.forEach(a => {
    io.to(`${roomName}:screen:${a.screenIndex}`).emit('display:rebalance', {
      students: a.students,
      screenIndex: a.screenIndex,
      totalStudents: assignments.reduce((sum, x) => sum + x.students.length, 0),
      totalScreens: assignments.length
    });
  });
}
```

---

## جدول سيناريوهات الاختبار

| السيناريو | المدخل | المخرج المتوقع |
|-----------|--------|----------------|
| 60 طالب + 15 شاشة | `distribute(60, 15)` | 4 طلاب لكل شاشة |
| 61 طالب + 15 شاشة | `distribute(61, 15)` | 14 شاشة بـ 4 + شاشة واحدة بـ 5 |
| طالب جديد يدخل | `onStudentJoin(assignments, "new")` | يُضاف للشاشة الأقل |
| طالب يخرج | `onStudentLeave(assignments, "old")` | يُحذف من شاشته |
| شاشة تنقطع | `onScreenOffline(assignments, 3)` | طلابها يتوزعون على الباقي |
| 5 طلاب + 15 شاشة | `distribute(5, 15)` | 5 شاشات بطالب واحد + 10 فارغة |

---

## معايير القبول
1. ✅ التوزيع الأولي متوازن (فرق ≤ 1 طالب بين أي شاشتين)
2. ✅ الترتيب ثابت (نفس الطالب يظهر في نفس المكان عند Refresh)
3. ✅ إعادة التوزيع تتم خلال < 500ms
4. ✅ بث التحديث لكل الشاشات المتأثرة فقط (لا broadcast عشوائي)
5. ✅ حالة 0 طلاب = شاشات فارغة بدون أخطاء
