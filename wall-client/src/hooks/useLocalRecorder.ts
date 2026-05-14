import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MISSION 12: TEACHER SOVEREIGN RECORDER (v2.0)
 * Persistent local recording engine utilizing IndexedDB to prevent RAM exhaustion.
 */

// --- IndexedDB Helper (Sovereign Storage) ---
const DB_NAME = 'SovereignRecorderDB';
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

export const useLocalRecorder = (room: any, featuredStudent?: string, featuredDestination?: string, mixerStream?: MediaStream | null) => {
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
    if (!room || !room.localParticipant) return;

    // Reset IndexedDB before starting
    await clearDB();

    const tracks: MediaStreamTrack[] = [];
    
    // MISSION 15: PRIORITIZE FEATURED STUDENT VIDEO
    let studentVideoTrack: MediaStreamTrack | null = null;
    if (featuredDestination === 'dashboard' && featuredStudent) {
      const p = room.remoteParticipants.get(featuredStudent);
      if (p) {
        p.videoTrackPublications.forEach((pub: any) => {
          if (pub.track?.mediaStreamTrack) {
            studentVideoTrack = pub.track.mediaStreamTrack;
          }
        });
      }
    }

    // 1. ADD TEACHER'S AUDIO FIRST
    room.localParticipant.trackPublications.forEach((pub: any) => {
      if (pub.track?.mediaStreamTrack && pub.kind === 'audio') {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    // Add other audio (remote students)
    room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
      });
    });

    // 2. Add Video Track
    if (mixerStream) {
      mixerStream.getTracks().forEach(t => {
        if (t.kind === 'video') tracks.push(t);
      });
    } else if (studentVideoTrack) {
      tracks.push(studentVideoTrack);
    } else {
      room.localParticipant.trackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack && pub.kind === 'video') {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
    }

    if (tracks.length === 0) {
      alert('Nothing to record. Please ensure your camera or screen is shared.');
      return;
    }

    const combinedStream = new MediaStream(tracks);
    setDuration(0);

    try {
      const mimeType = 'video/webm; codecs=vp9';
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 3000000 // 3Mbps for high quality
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // MISSION 22: STREAM TO DISK (IndexedDB)
          saveChunk(e.data).catch(err => console.error('[RECORDER] DB Write Error:', err));
        }
      };

      recorder.onstop = async () => {
        setIsExporting(true);
        try {
          console.log('[RECORDER] Assembling final lecture from IndexedDB...');
          const chunks = await getAllChunks();
          if (chunks.length === 0) return;

          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const timestamp = new Date().toISOString().slice(0, 16).replace(':', '-');
          a.download = `Sovereign_Lecture_${roomNameRef.current}_${timestamp}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Cleanup DB after successful export
          await clearDB();
        } catch (err) {
          console.error('[RECORDER] Export failed:', err);
        } finally {
          setIsExporting(false);
        }
      };

      // Chunk every 5 seconds to ensure minimal data loss on crash
      recorder.start(5000); 
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      console.error('[RECORDER] Failed to start:', err);
      alert('Recording failed: Browser might not support VP9/WebM.');
    }
  }, [room, featuredStudent, featuredDestination, mixerStream, startTimer]);

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
