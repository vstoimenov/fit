"use client";

import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatClock, progressPercent } from "@/lib/video/player-time";
import { WorkoutCover } from "./workout-cover";

/*
 * The slice of the YouTube IFrame API this player uses
 * (https://developers.google.com/youtube/iframe_api_reference).
 */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoading: Promise<YTNamespace> | null = null;

/** Loads the IFrame API once per page; YouTube calls the global hook when it is ready. */
function loadApi(): Promise<YTNamespace> {
  apiLoading ??= new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.append(script);
  });
  return apiLoading;
}

type Phase = "idle" | "starting" | "playing" | "paused" | "ended";

const HIDE_CONTROLS_AFTER_MS = 2500;
/** How long a programmatic play may stay unanswered before we hand the first tap to YouTube. */
const NATIVE_TAP_AFTER_MS = 1200;
const noSubscribe = () => () => {};
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

/**
 * A YouTube video behind our own player: the embed runs with YouTube's controls off and never
 * receives a tap (every control is ours), the poster covers it before the first play, and an
 * opaque pause / end screen covers the title bar and the related videos YouTube shows then.
 * Playback is reported upwards so watch time counts only while the video really plays.
 */
export function YouTubePlayer({
  videoId,
  title,
  focus,
  onPlayingChange,
  onEnded,
}: {
  videoId: string;
  title: string;
  /** First focus of the workout: picks the poster photo. */
  focus: string | null;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const callbacks = useRef({ onPlayingChange, onEnded });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A tap before the API is ready: start as soon as it is.
  const wantPlay = useRef(false);
  // Set once YouTube answers a play call at all; until then iOS may be ignoring the API.
  const activated = useRef(false);
  const nativeTapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ready, setReady] = useState(false);
  /**
   * iOS lets a cross-origin player start only from a tap inside its own frame. When a play call
   * goes unanswered on a touch device, the centre of the poster is opened for one tap that lands
   * on YouTube's own play button; the edges stay ours, so its title-bar links are never reachable.
   */
  const [nativeTap, setNativeTap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  useEffect(() => {
    callbacks.current = { onPlayingChange, onEnded };
  });

  useEffect(() => {
    const host = slot.current;
    if (!host) return;
    let cancelled = false;
    // The API swaps the element it is given for the iframe, so it gets a child React never touches.
    const target = document.createElement("div");
    host.replaceChildren(target);
    loadApi().then((YT) => {
      if (cancelled) return;
      player.current = new YT.Player(target, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,
          rel: 0,
          playsinline: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            setMuted(player.current?.isMuted() ?? false);
            setTime({ current: 0, duration: player.current?.getDuration() ?? 0 });
            if (wantPlay.current) {
              wantPlay.current = false;
              player.current?.playVideo();
            }
          },
          onStateChange: ({ data }) => {
            if (cancelled) return;
            const { PLAYING, PAUSED, ENDED, BUFFERING } = YT.PlayerState;
            if (data === PLAYING || data === PAUSED || data === BUFFERING) {
              activated.current = true;
              setNativeTap(false);
            }
            // Buffering and cued keep the previous phase: a stall is not a pause.
            if (data === PLAYING) setPhase("playing");
            else if (data === PAUSED) setPhase("paused");
            else if (data === ENDED) setPhase("ended");
            callbacks.current.onPlayingChange(data === PLAYING);
            if (data === ENDED) callbacks.current.onEnded();
          },
          onError: () => {
            if (!cancelled) setFailed(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      host.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const p = player.current;
      if (p) setTime({ current: p.getCurrentTime(), duration: p.getDuration() });
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(nativeTapTimer.current);
    },
    [],
  );

  /** Shows the controls and arms the auto-hide (only effective while playing, see `controlsShown`). */
  function reveal() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), HIDE_CONTROLS_AFTER_MS);
  }

  function play() {
    const p = player.current;
    if (!p) {
      wantPlay.current = true;
      setPhase("starting");
      return;
    }
    if (phase === "ended") p.seekTo(0, true);
    if (phase === "idle" || phase === "ended") setPhase("starting");
    p.playVideo();
    reveal();
    if (!activated.current && window.matchMedia("(pointer: coarse)").matches) {
      clearTimeout(nativeTapTimer.current);
      nativeTapTimer.current = setTimeout(() => {
        if (activated.current) return;
        setNativeTap(true);
        setPhase("idle");
      }, NATIVE_TAP_AFTER_MS);
    }
  }

  function pause() {
    player.current?.pauseVideo();
    reveal();
  }

  function toggle() {
    if (phase === "playing") pause();
    else play();
  }

  function seek(seconds: number) {
    const target = Math.min(Math.max(0, seconds), time.duration || seconds);
    player.current?.seekTo(target, true);
    setTime((t) => ({ ...t, current: target }));
    reveal();
  }

  function toggleMute() {
    const p = player.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
    reveal();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen();
    reveal();
  }

  function onSurfaceClick() {
    if (failed) return;
    // While playing with hidden controls the first tap only brings them back.
    if (phase === "playing" && !controls) {
      reveal();
      return;
    }
    toggle();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!ready || failed) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft") seek(time.current - 10);
    else if (key === "arrowright") seek(time.current + 10);
    else if (key === "m") toggleMute();
    else if (key === "f" && canFullscreen) toggleFullscreen();
    else return;
    event.preventDefault();
  }

  const playing = phase === "playing";
  const controlsShown = controls || !playing;
  const coverShown = !playing;
  const barShown = (playing || phase === "paused") && controlsShown;

  return (
    // The keys are shortcuts for the focused controls inside; the surface itself is not a control.
    <div
      ref={frame}
      data-phase={phase}
      onKeyDown={onKeyDown}
      onPointerMove={playing ? reveal : undefined}
      className={cn(
        "relative aspect-video w-full select-none overflow-hidden bg-ink text-white",
        "[&:fullscreen]:aspect-auto [&:fullscreen]:h-full [&:fullscreen]:w-full",
        playing && !controlsShown && "cursor-none",
      )}
    >
      <div
        ref={slot}
        className={cn(
          "absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full",
          !nativeTap && "[&_iframe]:pointer-events-none",
        )}
      />
      {coverShown && (
        // No `preload` here: a preloaded image inside the streamed Suspense boundary holds back
        // the boundary's reveal (React 19.2), and with it the whole player, for many seconds.
        <div className="absolute inset-0" aria-hidden="true">
          <WorkoutCover
            focus={focus}
            title={title}
            showTitle={false}
            decorative
            className="absolute inset-0"
          />
          <div className="absolute inset-0 bg-ink/55" />
        </div>
      )}
      <div
        role="presentation"
        onClick={onSurfaceClick}
        className={cn("absolute inset-0", nativeTap && "pointer-events-none")}
        data-testid="player-surface"
      />
      {playing && !controlsShown && (
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 bg-powder"
          style={{ width: `${progressPercent(time.current, time.duration)}%` }}
        />
      )}

      {failed ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center font-semibold">
          Видеото не може да се пусне тук. Опитай пак по-късно.
        </p>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          {phase === "ended" && <p className="text-lg font-extrabold">Стигна до края. Браво!</p>}
          {controlsShown && (
            <button
              type="button"
              onClick={toggle}
              aria-label={
                phase === "ended" ? "Пусни отначало" : playing ? "Пауза" : "Пусни видеото"
              }
              aria-busy={!ready || phase === "starting"}
              className={cn(
                "inline-flex size-18 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                // In native-tap mode the glyph only marks the spot; the tap must reach YouTube.
                nativeTap ? "pointer-events-none" : "pointer-events-auto",
              )}
            >
              {!ready || phase === "starting" ? (
                <span
                  className="size-7 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : phase === "ended" ? (
                <RotateCcw size={30} strokeWidth={2.5} aria-hidden="true" />
              ) : playing ? (
                <Pause size={30} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Play size={30} strokeWidth={2.5} aria-hidden="true" className="ml-1" />
              )}
            </button>
          )}
        </div>
      )}

      {barShown && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent px-3 pb-1 pt-10">
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(time.duration))}
            step={1}
            value={Math.min(time.current, time.duration || time.current)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Позиция във видеото"
            aria-valuetext={`${formatClock(time.current)} от ${formatClock(time.duration)}`}
            className="block h-11 w-full cursor-pointer accent-powder"
          />
          <div className="flex items-center gap-0.5">
            <IconButton onClick={toggle} label={playing ? "Пауза" : "Пусни"}>
              {playing ? (
                <Pause size={22} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Play size={22} strokeWidth={2.25} aria-hidden="true" />
              )}
            </IconButton>
            <span className="ml-1 text-xs font-semibold tabular-nums">
              {formatClock(time.current)} / {formatClock(time.duration)}
            </span>
            <span className="flex-1" />
            <IconButton onClick={toggleMute} label={muted ? "Пусни звука" : "Без звук"}>
              {muted ? (
                <VolumeX size={22} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Volume2 size={22} strokeWidth={2.25} aria-hidden="true" />
              )}
            </IconButton>
            {canFullscreen && (
              <IconButton
                onClick={toggleFullscreen}
                label={fullscreen ? "Изход от цял екран" : "На цял екран"}
              >
                {fullscreen ? (
                  <Minimize size={22} strokeWidth={2.25} aria-hidden="true" />
                ) : (
                  <Maximize size={22} strokeWidth={2.25} aria-hidden="true" />
                )}
              </IconButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-full active:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    >
      {children}
    </button>
  );
}
