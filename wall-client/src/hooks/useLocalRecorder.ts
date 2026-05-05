import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MISSION 12: TEACHER SOVEREIGN RECORDER
 * Local recording engine for the teacher.
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

    const tracks: MediaStreamTrack[] = [];
    
    // 1. Add Teacher's Local Tracks (Camera + Screen + Mic)
    room.localParticipant.trackPublications.forEach((pub: any) => {
      if (pub.track?.mediaStreamTrack) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    // 2. Add Remote Audio (If any student is speaking)
    room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
    });

    if (tracks.length === 0) {
      alert('Nothing to record. Please ensure your camera or screen is shared.');
      return;
    }

    const combinedStream = new MediaStream(tracks);
    chunksRef.current = [];
    setDuration(0);

    try {
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType: 'video/webm; codecs=vp9' 
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Teacher_Lecture_${new Date().toISOString().slice(0, 16).replace(':', '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      console.error('[RECORDER] Failed to start:', err);
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
