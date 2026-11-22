"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Pause, Play } from "lucide-react";
import type { Exercise } from "@/lib/types/domain";

interface ExerciseVisualProps {
  exercise: Pick<
    Exercise,
    "name" | "media_gif_url" | "media_image_start_url" | "media_image_end_url"
  >;
  size: "thumb" | "detail";
  animateFallback?: boolean;
}

export function ExerciseVisual({
  exercise,
  size,
  animateFallback = size === "detail",
}: ExerciseVisualProps) {
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});
  const [frameIndex, setFrameIndex] = useState<0 | 1>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(animateFallback);

  const gifUrl =
    exercise.media_gif_url && !failedUrls[exercise.media_gif_url]
      ? exercise.media_gif_url
      : null;

  const startUrl =
    exercise.media_image_start_url && !failedUrls[exercise.media_image_start_url]
      ? exercise.media_image_start_url
      : null;

  const endUrl =
    exercise.media_image_end_url && !failedUrls[exercise.media_image_end_url]
      ? exercise.media_image_end_url
      : null;

  const usingPhotoFlipbook = !gifUrl && Boolean(startUrl);
  const hasTwoFrames = Boolean(startUrl && endUrl);

  useEffect(() => {
    if (!usingPhotoFlipbook || !hasTwoFrames || !animateFallback || !isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev === 0 ? 1 : 0));
    }, 1400);

    return () => window.clearInterval(timer);
  }, [usingPhotoFlipbook, hasTwoFrames, animateFallback, isPlaying]);

  const activeSrc = gifUrl
    ? gifUrl
    : usingPhotoFlipbook
      ? frameIndex === 1 && endUrl
        ? endUrl
        : startUrl
      : null;

  const markFailed = (url: string) => {
    setFailedUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  };

  if (size === "thumb") {
    return (
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {activeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeSrc}
            alt={exercise.name}
            loading="lazy"
            onError={() => markFailed(activeSrc)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Dumbbell className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex aspect-square max-h-64 w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      {activeSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSrc}
            alt={exercise.name}
            onError={() => markFailed(activeSrc)}
            className="h-full w-full object-contain"
          />
          {gifUrl && (
            <span className="absolute top-3 left-3 rounded-full border border-zinc-700/80 bg-zinc-900/85 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              GIF Demo
            </span>
          )}
          {usingPhotoFlipbook && hasTwoFrames && (
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
              <span className="tabular-nums rounded-full border border-zinc-700/80 bg-zinc-900/85 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
                Frame {frameIndex + 1}/2
              </span>
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/90 px-3 text-xs font-medium text-zinc-100 hover:border-zinc-500"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Play</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <Dumbbell className="h-10 w-10" aria-hidden="true" />
          <span className="text-xs">No visual demo attached</span>
        </div>
      )}
    </div>
  );
}
