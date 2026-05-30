'use client';

import { useRef, useEffect, useState } from 'react';
import { useVideoShortcuts } from '@/hooks/useVideoShortcuts';

interface Props {
  src: string;
  lessonId: string;
  courseId: string;
  onComplete?: () => void;
}

const storageKey = (lessonId: string) => `vp-${lessonId}`;

export function VideoPlayer({ src, lessonId, courseId, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(false);
  useVideoShortcuts(videoRef);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const saved = localStorage.getItem(storageKey(lessonId));
    if (saved) v.currentTime = Number(saved);
  }, [lessonId]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || completed) return;
    localStorage.setItem(storageKey(lessonId), String(v.currentTime));
    if (v.duration && v.currentTime / v.duration >= 0.9) {
      setCompleted(true);
      fetch('/v1/progress/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, courseId, completed: true }),
      });
      onComplete?.();
    }
  };

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      onTimeUpdate={handleTimeUpdate}
      className="w-full rounded-lg bg-black dark:bg-black"
    />
  );
}
