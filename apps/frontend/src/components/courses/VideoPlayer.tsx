'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { usePlaybackSpeed, SPEED_OPTIONS } from '@/hooks/usePlaybackSpeed';
import { seekForward, seekBackward, volumeUp, volumeDown } from '@/lib/videoKeyboard';

export interface CaptionTrack {
  src: string;
  srclang: string;
  label: string;
  default?: boolean;
}

export interface VideoPlayerProps {
  courseId: string;
  lessonId: string;
  /** MP4 URL or HLS .m3u8 URL */
  src: string;
  type?: 'video/mp4' | 'application/x-mpegURL';
  poster?: string;
  captions?: CaptionTrack[];
  /** Restored from store on mount; used to seek to last watched position */
  initialProgressPct?: number;
  onComplete?: () => void;
}

/**
 * Enhanced video player component.
 *
 * Features:
 * - Integrates with useVideoProgress for automatic progress tracking
 * - Playback speed controls with localStorage persistence via usePlaybackSpeed
 * - Picture-in-Picture (PiP) support with browser capability detection
 * - Full keyboard shortcuts (Space, Arrow keys, M, F)
 * - Keyboard shortcut reference popover
 * - ARIA labels on all interactive controls
 * - Error state with role="alert" for invalid/empty src
 * - Seeks to initialProgressPct position on mount
 */
export function VideoPlayer({
  courseId,
  lessonId,
  src,
  type = 'video/mp4',
  poster,
  captions,
  initialProgressPct,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pipAvailable, setPipAvailable] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { speed, setSpeed, speedOptions } = usePlaybackSpeed();
  const { handleTimeUpdate, handlePause, handleEnded } = useVideoProgress({
    courseId,
    lessonId,
    onComplete,
  });

  // Check PiP availability on mount (browser-side only)
  useEffect(() => {
    setPipAvailable(
      typeof document !== 'undefined' && !!document.pictureInPictureEnabled
    );
  }, []);

  // Apply playback speed whenever it changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, isReady]);

  // Reset state when src changes
  useEffect(() => {
    setHasError(false);
    setIsReady(false);
    setRetryCount(0);
  }, [src]);

  // Seek to initialProgressPct after the video metadata is loaded
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (initialProgressPct && initialProgressPct > 0 && v.duration) {
      v.currentTime = (initialProgressPct / 100) * v.duration;
    }
    // Apply stored playback speed
    v.playbackRate = speed;
    setIsReady(true);
  }, [initialProgressPct, speed]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsReady(false);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setRetryCount((c) => c + 1);
  }, []);

  const announce = useCallback((msg: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP request failed:', err);
    }
  }, []);

  // Track PiP enter/exit events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    v.addEventListener('enterpictureinpicture', onEnter);
    v.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      v.removeEventListener('enterpictureinpicture', onEnter);
      v.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Keyboard shortcuts on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (v.paused) {
            v.play();
            announce('Playing');
          } else {
            v.pause();
            announce('Paused');
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = seekForward(v.currentTime, v.duration);
          announce('Skipped forward 10 seconds');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = seekBackward(v.currentTime, v.duration);
          announce('Rewound 10 seconds');
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = volumeUp(v.volume);
          announce(`Volume ${Math.round(v.volume * 100)}%`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = volumeDown(v.volume);
          announce(`Volume ${Math.round(v.volume * 100)}%`);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          v.muted = !v.muted;
          announce(v.muted ? 'Muted' : 'Unmuted');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (!document.fullscreenElement) {
            v.requestFullscreen().catch(() => {});
            announce('Fullscreen');
          } else {
            document.exitFullscreen();
            announce('Exited fullscreen');
          }
          break;
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [announce]);

  // Render error state for empty or invalid src
  if (!src) {
    return (
      <div
        className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-4 py-16 px-6"
        role="alert"
      >
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No video source provided</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-4 py-16 px-6"
        role="alert"
      >
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Video failed to load</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
          This could be due to a network issue or an unsupported format. Please check your connection and try again.
        </p>
        <button
          onClick={handleRetry}
          aria-label="Retry loading video"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Append cache-bust param on retries
  const videoSrc =
    retryCount > 0
      ? `${src}${src.includes('?') ? '&' : '?'}_retry=${retryCount}`
      : src;

  return (
    <div
      ref={containerRef}
      className="relative w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      tabIndex={0}
      aria-label="Video player. Use Space to play/pause, arrow keys to seek and adjust volume, M to mute, F for fullscreen."
    >
      {/* Screen-reader live region for keyboard action announcements */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>

      {/* Loading indicator */}
      {!isReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg z-10 pointer-events-none"
          aria-hidden="true"
        >
          <svg
            className="w-10 h-10 text-white animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        key={`${videoSrc}-${retryCount}`}
        className="w-full rounded-lg bg-black"
        controls
        poster={poster}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) handleTimeUpdate(v.currentTime, v.duration);
        }}
        onPause={() => {
          const v = videoRef.current;
          if (v) handlePause(v.currentTime, v.duration);
        }}
        onEnded={handleEnded}
        onError={handleError}
      >
        <source src={videoSrc} type={type} />
        {captions?.map((track) => (
          <track
            key={track.srclang}
            kind="subtitles"
            src={track.src}
            srcLang={track.srclang}
            label={track.label}
            default={track.default}
          />
        ))}
        Your browser does not support HTML5 video.
      </video>

      {/* Controls overlay */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {/* Playback speed selector */}
        <label className="sr-only" htmlFor={`speed-select-${lessonId}`}>
          Playback speed
        </label>
        <select
          id={`speed-select-${lessonId}`}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value) as (typeof SPEED_OPTIONS)[number])}
          aria-label="Playback speed"
          className="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 cursor-pointer"
        >
          {speedOptions.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>

        {/* PiP toggle */}
        {pipAvailable && (
          <button
            onClick={togglePiP}
            aria-label={isPiP ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
            title={isPiP ? 'Exit picture-in-picture' : 'Picture-in-picture'}
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 7.5A2.25 2.25 0 0 1 4.5 5.25h15A2.25 2.25 0 0 1 21.75 7.5v9a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 16.5v-9Zm11.25 3.75h4.5v3h-4.5v-3Z"
              />
            </svg>
          </button>
        )}

        {/* Captions indicator */}
        {captions && captions.length > 0 && (
          <span
            aria-label="Captions available"
            title="Captions available"
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold select-none"
          >
            CC
          </span>
        )}

        {/* Keyboard shortcuts help */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            aria-label="Keyboard shortcuts help"
            aria-expanded={showShortcuts}
            title="Keyboard shortcuts"
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
              />
            </svg>
          </button>

          {showShortcuts && (
            <div
              role="tooltip"
              className="absolute right-0 bottom-10 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-gray-700 dark:text-gray-300 z-20"
            >
              <p className="font-semibold mb-2">Keyboard shortcuts</p>
              <ul className="space-y-1">
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Space</kbd> Play / Pause</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">→</kbd> Skip forward 10 s</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">←</kbd> Rewind 10 s</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">↑</kbd> Volume up</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">↓</kbd> Volume down</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">M</kbd> Toggle mute</li>
                <li><kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">F</kbd> Toggle fullscreen</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
