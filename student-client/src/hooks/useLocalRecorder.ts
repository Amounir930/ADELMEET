import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MISSION 12: STUDENT SOVEREIGN RECORDER (v2.0)
 * Persistent local recording engine utilizing IndexedDB to prevent RAM exhaustion.
 */

// --- IndexedDB Helper (Sovereign Storage) ---
const DB_NAME = 'SovereignStudentRecorderDB';
const STORE_NAME = 'chunks';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const clearDB = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
};

const saveChunk = async (blob: Blob) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(blob);
};

const getAllChunks = async (): Promise<Blob[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const useLocalRecorder = (room: any, mixerStream?: MediaStream | null) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const roomNameRef = useRef<string>(room?.name || 'Unknown');

  useEffect(() => {
    roomNameRef.current = room?.name || 'Unknown';
  }, [room?.name]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.warn('[RECORDER] Manually stopping recording session...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [startTimer]);

  const startRecording = useCallback(async () => {
    if (!room) {
      console.error('[RECORDER] No room context available for recording');
      return;
    }

    // Reset IndexedDB before starting
    await clearDB();

    const tracks: MediaStreamTrack[] = [];
    
    // 1. Add Audio Tracks (Teacher first)
    room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
      });
    });

    // 2. Add Video
    if (mixerStream) {
      mixerStream.getTracks().forEach(t => {
        if (t.kind === 'video') tracks.push(t);
      });
    } else {
      room.remoteParticipants.forEach((p: any) => {
        p.videoTrackPublications.forEach((pub: any) => {
          if (pub.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
        });
      });
    }

    if (tracks.length === 0) {
      alert('No active video/audio tracks found to record.');
      return;
    }

    const combinedStream = new MediaStream(tracks);
    setDuration(0);

    try {
      const mimeType = 'video/webm; codecs=vp9';
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5Mbps for student (slightly lower for network efficiency)
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // MISSION 22: STREAM TO DISK (IndexedDB)
          saveChunk(e.data).catch(err => console.error('[RECORDER] DB Write Error:', err));
        }
      };

      recorder.onstop = async () => {
        setIsExporting(true);
        console.log('[RECORDER] Session complete. Assembling from IndexedDB...');
        try {
          const chunks = await getAllChunks();
          if (chunks.length === 0) return;

          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const timestamp = new Date().toISOString().slice(0, 16).replace(':', '-');
          a.download = `Sovereign_Student_Rec_${roomNameRef.current}_${timestamp}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Cleanup
          await clearDB();
        } catch (err) {
          console.error('[RECORDER] Export failed:', err);
        } finally {
          setIsExporting(false);
        }
      };

      // Chunk every 5 seconds
      recorder.start(5000); 
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
      console.log(`[RECORDER] Recording started (${mimeType}).`);
    } catch (err) {
      console.error('[RECORDER] Failed to initialize MediaRecorder:', err);
      alert('Recording failed: Browser might not support VP9/WebM.');
    }
  }, [room, mixerStream, startTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { 
    isRecording, 
    isPaused, 
    duration, 
    isExporting,
    startRecording, 
    stopRecording, 
    pauseRecording, 
    resumeRecording 
  };
};
