import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { DriveFile } from '../types/drive';
import { fetchDriveMediaBlobUrl } from '../lib/driveApi';
import {
  formatBytes,
  formatDateShort,
  getMediaPreviewType,
} from '../lib/organizer';

interface MediaLightboxModalProps {
  file: DriveFile | null;
  mediaList: DriveFile[];
  getValidToken: () => Promise<string>;
  onSelectFile: (file: DriveFile) => void;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MediaLightboxModal({
  file,
  mediaList,
  getValidToken,
  onSelectFile,
  onClose,
}: MediaLightboxModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [useDriveIframeFallback, setUseDriveIframeFallback] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  // Video playback state (kept crisp outside CSS zoom transform)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaType = file ? getMediaPreviewType(file) : null;
  const currentIndex = file
    ? mediaList.findIndex((item) => item.id === file.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < mediaList.length - 1;

  const resetZoomAndPan = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const updateZoom = useCallback((nextZoomRaw: number) => {
    const clamped = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.round(nextZoomRaw * 100) / 100)
    );
    setZoom(clamped);
    if (clamped <= 1) {
      setPan({ x: 0, y: 0 });
    }
  }, []);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onSelectFile(mediaList[currentIndex - 1]);
    }
  }, [hasPrev, mediaList, currentIndex, onSelectFile]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      onSelectFile(mediaList[currentIndex + 1]);
    }
  }, [hasNext, mediaList, currentIndex, onSelectFile]);

  // Load authenticated media bytes when file changes
  useEffect(() => {
    if (!file) return;
    let objectUrlToRevoke: string | null = null;
    const controller = new AbortController();

    setMediaUrl(null);
    setLoadError(null);
    setUseDriveIframeFallback(false);
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    resetZoomAndPan();

    const load = async () => {
      try {
        const token = await getValidToken();
        const url = await fetchDriveMediaBlobUrl(
          token,
          file.id,
          controller.signal
        );
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlToRevoke = url;
        setMediaUrl(url);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof Error ? err.message : 'تعذر تحميل معاينة الملف.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [file, getValidToken, resetZoomAndPan]);

  // Sync browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        updateZoom(zoom + ZOOM_STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        updateZoom(zoom - ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoomAndPan();
      } else if (e.key === 'ArrowRight') {
        goToPrev();
      } else if (e.key === 'ArrowLeft') {
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, zoom, updateZoom, resetZoomAndPan, goToPrev, goToNext, onClose]);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // Fallback: modal already covers 100% of viewport (fixed inset-0)
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    updateZoom(zoom + delta);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    setPan({
      x: dragStartRef.current.originX + dx,
      y: dragStartRef.current.originY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  if (!file) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة ${file.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-slate-100 select-none backdrop-blur-xs"
    >
      {/* Top Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-sm font-bold text-slate-100"
            dir="auto"
          >
            {file.name}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
            <span>{mediaType === 'video' ? 'فيديو' : 'صورة'}</span>
            {file.size && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{formatBytes(file.size)}</span>
              </>
            )}
            {file.modifiedTime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatDateShort(file.modifiedTime)}</span>
              </>
            )}
            {mediaList.length > 1 && currentIndex >= 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  {currentIndex + 1} / {mediaList.length}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Zoom + Fullscreen + Close Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!useDriveIframeFallback && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => updateZoom(zoom - ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="تصغير"
                className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  zoom === 1 ? updateZoom(2) : resetZoomAndPan()
                }
                aria-label="تبديل مستوى التكبير"
                className="min-w-[54px] rounded-md px-2 py-1 text-center font-mono text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => updateZoom(zoom + ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="تكبير"
                className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={resetZoomAndPan}
                  aria-label="إعادة ضبط التكبير إلى 100%"
                  className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isNativeFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
          >
            {isNativeFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إنهاء ملء الشاشة</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>ملء الشاشة</span>
              </>
            )}
          </button>

          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noreferrer"
              aria-label="فتح في Google Drive"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">فتح في Drive</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق المعاينة"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main Zoomable Stage */}
      <div
        onWheel={handleWheel}
        onDoubleClick={() =>
          zoom === 1 ? updateZoom(2) : resetZoomAndPan()
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex flex-1 items-center justify-center overflow-hidden p-4 ${
          zoom > 1
            ? isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-zoom-in'
        }`}
      >
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            <p className="text-xs text-slate-400">
              جارٍ تحميل الملف للمعاينة بجودة كاملة...
            </p>
          </div>
        )}

        {!isLoading && loadError && !useDriveIframeFallback && (
          <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-sm font-semibold text-red-400">{loadError}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setUseDriveIframeFallback(true)}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                عرض عبر مشغّل Drive
              </button>
              {file.webViewLink && (
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  فتح في Google Drive
                </a>
              )}
            </div>
          </div>
        )}

        {!isLoading && useDriveIframeFallback && (
          <iframe
            src={`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/preview`}
            title={file.name}
            allow="autoplay; fullscreen"
            className="h-full w-full max-w-5xl rounded-xl border border-slate-800 bg-black"
          />
        )}

        {!isLoading && !loadError && !useDriveIframeFallback && mediaUrl && (
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transition: isDragging
                ? 'none'
                : 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="flex max-h-full max-w-full items-center justify-center will-change-transform"
          >
            {mediaType === 'image' ? (
              <img
                src={mediaUrl}
                alt={file.name}
                draggable={false}
                className="max-h-[82vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <video
                ref={videoRef}
                src={mediaUrl}
                playsInline
                autoPlay
                onClick={(e) => {
                  e.stopPropagation();
                  if (zoom === 1) togglePlayPause();
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) =>
                  setCurrentTime(e.currentTarget.currentTime)
                }
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || 0);
                  setIsMuted(e.currentTarget.muted);
                }}
                onError={() => setUseDriveIframeFallback(true)}
                className="max-h-[78vh] max-w-[92vw] rounded-lg bg-black shadow-2xl"
              />
            )}
          </div>
        )}

        {/* Prev / Next Navigation Buttons */}
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="الملف السابق"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-900/80 p-2.5 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="الملف التالي"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-900/80 p-2.5 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Dedicated Unscaled Video Playback Bar + Zoom Tip */}
      <footer className="border-t border-slate-800 bg-slate-950/90 px-4 py-2.5 sm:px-6">
        {mediaType === 'video' &&
        mediaUrl &&
        !loadError &&
        !useDriveIframeFallback ? (
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <input
              type="range"
              dir="ltr"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={currentTime}
              aria-label="موضع تشغيل الفيديو"
              onChange={(e) => {
                const next = Number(e.target.value);
                if (videoRef.current) {
                  videoRef.current.currentTime = next;
                }
                setCurrentTime(next);
              }}
              className="h-1.5 flex-1 cursor-pointer accent-blue-500"
            />

            <span className="font-mono text-xs text-slate-300 tabular-nums whitespace-nowrap">
              {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
            <span>استخدم عجلة الفأرة أو أزرار + / - للتكبير والتصغير</span>
            <span aria-hidden="true">·</span>
            <span>انقر مرتين للتكبير السريع (200%)</span>
            <span aria-hidden="true">·</span>
            <span>اسحب للتحريك عند التكبير</span>
          </div>
        )}
      </footer>
    </div>
  );
}
