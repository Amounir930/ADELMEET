Component 12: Local Recording & Permission Control
المكون: التسجيل المحلي وإدارة الصلاحيات (Zero-Server-Load)
الهدف
تمكين المعلم من تسجيل المحاضرة محلياً بأعلى جودة عبر تطبيق القاعة (Electron)، وتمكين الطلاب من تسجيل المحاضرة من المتصفح (مربوطاً بجودة البث الخاصة بهم) بشرط حصولهم على إذن لحظي من المعلم. الملفات تُحفظ مباشرة على الأجهزة الشخصية للمستخدمين لضمان 0% ضغط على سيرفرات المنصة وتوفير 100% من تكاليف التسجيل السحابي.

الموقع في المشروع
backend/src/services/socket.service.ts           ← بث صلاحيات التسجيل
backend/src/services/state.service.ts            ← حفظ حالة السماح بالتسجيل في Redis
student-client/src/hooks/useLocalRecorder.ts     ← محرك التسجيل المحلي (MediaRecorder)
student-client/src/components/StudentCinema.tsx  ← زر التسجيل للطالب (يظهر ويختفي حسب الصلاحية)
wall-client/src/components/TeacherDashboard.tsx  ← أزرار التسجيل للمعلم + زر التحكم بصلاحية الطلاب
معمارية التسجيل (The Workflow)
1. تسجيل المعلم (الأساس - عبر Electron/Browser)
التقنية: استخدام MediaRecorder API.

الآلية: يتم التقاط مسار شاشة المعلم (Screen Share) ومسار الصوت (Microphone)، ودمجهما في ملف فيديو واحد.

الميزة: يمكن للمعلم إيقاف التسجيل وبدء تسجيل جديد في نفس المحاضرة (تسجيل مجزأ) لحفظ الذاكرة، ويتم تحميل الملف (.webm أو .mp4) مباشرة على جهاز المعلم.

2. تسجيل الطالب (التابع - عبر Browser)
التقنية: MediaRecorder API داخل متصفح الطالب.

الآلية: المتصفح يسجل ما يستقبله الطالب حالياً. بفضل نظام (Simulcast)، إذا كان الطالب يختار جودة (360p)، سيتم تسجيل الفيديو بحجم صغير جداً.

الذاكرة: التسجيل يعمل بنظام "الجلسات" (Sessions) لمنع امتلاء رامات (RAM) جهاز الطالب. كل ضغطة "إيقاف" تُنزل ملفاً مستقلاً.

3. نظام التحكم في الصلاحيات (Permission Engine)
يقوم المعلم بتفعيل/إلغاء خيار "السماح للطلاب بالتسجيل".

السيرفر يرسل حدث recording_permission_changed عبر الـ Socket.

إذا قام المعلم بـ إلغاء الصلاحية أثناء قيام طالب بالتسجيل، يقوم كود الطالب بإجبار المتصفح على (إيقاف التسجيل + تحميل الملف الحالي فوراً + إخفاء زر التسجيل).

الأكواد الأساسية (المنطق البرمجي)
1. تحديث حالة الغرفة في Redis (Backend)
TypeScript
// يضاف إلى RoomState interface في state.service.ts
export interface RoomState {
  isMuted: boolean;
  isRecordingAllowed: boolean; // ← إضافة حالة التسجيل
  lectureId?: string;
  roomName: string;
  status: 'live' | 'completed';
}
2. أحداث السوكيت (Backend)
TypeScript
// داخل socket.service.ts (Teacher Commands)
socket.on('teacher:toggle_recording_permission', async ({ roomName, allowed }: { roomName: string, allowed: boolean }) => {
  logger.info(`[TEACHER-COMMAND] Recording permission set to ${allowed} for room: ${roomName}`);
  await stateService.setRoomState(roomName, { isRecordingAllowed: allowed });
  this.io?.to(roomName).emit('recording_permission_changed', { allowed });
});
3. محرك التسجيل المحلي (Frontend Custom Hook)
TypeScript
// student-client/src/hooks/useLocalRecorder.ts
import { useState, useRef, useCallback } from 'react';

export const useLocalRecorder = (mediaStream: MediaStream | null) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!mediaStream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp9' });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lecture_Part_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start(1000); // تجميع البيانات كل ثانية لحماية الرام
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [mediaStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return { isRecording, startRecording, stopRecording };
};
واجهة المستخدم (UI Controls)
واجهة المعلم (Teacher Dashboard)
Plaintext
┌────────────────────────────────────────────────────────┐
│  ⏺️ تسجيل المحاضرة (محلي)     [ 🔴 إيقاف التسجيل ]         │
│  🔒 السماح للطلاب بالتسجيل: [ مفعّل ✅ ] / [ معطّل ❌ ]    │
└────────────────────────────────────────────────────────┘
واجهة الطالب (Student Cinema)
إذا كانت الصلاحية (معطّلة): لا يظهر أي زر للتسجيل.

إذا كانت الصلاحية (مفعّلة):

Plaintext
┌─────────────────────────────────────┐
│  ⏺️ بدء التسجيل المحلي               │
└─────────────────────────────────────┘
معايير القبول (Acceptance Criteria)
✅ Zero Server Load: عملية دمج وتسجيل الفيديو تتم 100% داخل أجهزة المستخدمين دون المساس بـ Backend أو LiveKit Cloud.

✅ تسجيل مجزأ (Chunking): يمكن للمستخدم إيقاف وبدء التسجيل عدة مرات، وينتج عن كل مرة ملف مستقل.

✅ تحكم مطلق للمعلم: الصلاحية بيد المعلم لحظياً (Real-time Toggle).

✅ حماية السحب (Revoke Protection): إذا سحب المعلم الإذن أثناء تسجيل الطالب، ينتهي التسجيل فوراً ويُحفظ ما تم تسجيله حتى تلك اللحظة على جهاز الطالب.

✅ توافق الجودة: تسجيل الطالب يعكس جودة الـ Simulcast التي يستقبلها (Low/Medium/High).