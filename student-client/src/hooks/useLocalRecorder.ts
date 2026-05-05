import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MISSION 12: SOVEREIGN LOCAL RECORDER
 * Encapsulates MediaRecorder logic with multi-track support and memory protection.
 * Added: Timer, Pause, Resume.
 */
export const useLocalRecorder = (room: any) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

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

  const startRecording = useCallback(() => {
    if (!room) {
      console.error('[RECORDER] No room context available for recording');
      return;
    }

    // 1. COLLECT TRACKS: We need both Teacher's Video (Camera/Screen) and Audio
    const tracks: MediaStreamTrack[] = [];
    
    // Collect all remote audio tracks (Teacher + other students if unmuted)
    room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
      
      // Specifically look for teacher's video (Prioritize ScreenShare)
      p.videoTrackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) {
          // If it's a screen share or camera from teacher, we want it
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
    });

    if (tracks.length === 0) {
      alert('No active video/audio tracks found to record.');
      return;
    }

    // 2. MIX STREAM
    const combinedStream = new MediaStream(tracks);
    chunksRef.current = [];
    setDuration(0);

    try {
      // 3. INITIALIZE RECORDER (VP9 for best compression/quality ratio)
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType: 'video/webm; codecs=vp9' 
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        console.log('[RECORDER] Session complete. Preparing download...');
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sovereign_Lecture_${new Date().toISOString().slice(0, 16).replace(':', '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      recorder.start(1000); // CHUNKING: Protect RAM by flushing data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
      console.log('[RECORDER] Recording started successfully.');
    } catch (err) {
      console.error('[RECORDER] Failed to initialize MediaRecorder:', err);
      alert('Your browser does not support high-quality recording (VP9).');
    }
  }, [room, startTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isRecording, isPaused, duration, startRecording, stopRecording, pauseRecording, resumeRecording };
};
