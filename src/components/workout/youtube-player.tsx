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

const API_TIMEOUT_MS = 15_000;
const READY_TIMEOUT_MS = 20_000;
const HIDE_CONTROLS_AFTER_MS = 2500;
/** How long a programmatic play may stay unanswered before we hand the first tap to YouTube. */
const NATIVE_TAP_AFTER_MS = 1200;
/** Buffering is an answer of sorts: give the video that much longer before handing over the tap. */
const NATIVE_TAP_BUFFERING_MS = 4000;

let apiLoading: Promise<YTNamespace> | null = null;

/**
 * Loads the IFrame API once per page; YouTube calls the global hook when it is ready. A load that
 * fails or stalls is forgotten, so „Опитай пак" can try again instead of reusing a dead promise.
 */
function loadApi(): Promise<YTNamespace> {
  apiLoading ??= new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const fail = (why: string) => {
      apiLoading = null;
      reject(new Error(`youtube api ${why}`));
    };
    const timer = setTimeout(() => fail("timed out"), API_TIMEOUT_MS);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail("missing");
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      fail("failed to load");
    };
    document.head.append(script);
  });
  return apiLoading;
}

type Phase = "idle" | "starting" | "playing" | "paused" | "ended";

const noSubscribe = () => () => {};
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

/**
 * A YouTube video behind our own player: the embed runs with YouTube's controls off and never
 * receives a tap or a keypress (every control is ours), the poster covers it before the first
 * play, and an opaque pause / end screen covers the title bar and the related videos YouTube
 * shows then. Playback and the real length are reported upwards so watch time counts only while
 * the video really plays. Where the browser has no element fullscreen (iPhone) a fixed "theatre"
 * layout stands in.
 */
export function YouTubePlayer({
  videoId,
  title,
  focus,
  onPlayingChange,
  onEnded,
  onDuration,
}: {
  videoId: string;
  title: string;
  /** First focus of the workout: picks the poster photo. */
  focus: string | null;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  /** The real video length in seconds, once YouTube reports it. */
  onDuration: (seconds: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  // Before onReady the player object exists but its methods do not.
  const readyRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A tap before the player is ready: start as soon as it is.
  const wantPlay = useRef(false);
  // Set once YouTube answers a play call; until then iOS may be ignoring the API.
  const activated = useRef(false);
  const nativeTapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastDuration = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  // Keyboard focus inside the frame keeps the controls on screen.
  const [focusWithin, setFocusWithin] = useState(false);
  const [theatre, setTheatre] = useState(false);
  /**
   * iOS lets a cross-origin player start only from a tap inside its own frame. When a play call
   * goes unanswered on a touch device, the centre of the poster is opened for one tap that lands
   * on YouTube's own play button; the edges stay ours, so its title-bar links are never reachable.
   */
  const [nativeTap, setNativeTap] = useState(false);
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

  /** Shows the controls and arms the auto-hide (only effective while playing, see `controlsShown`). */
  function reveal() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), HIDE_CONTROLS_AFTER_MS);
  }

  function armNativeTap(delay = NATIVE_TAP_AFTER_MS) {
    if (activated.current || !window.matchMedia("(pointer: coarse)").matches) return;
    clearTimeout(nativeTapTimer.current);
    nativeTapTimer.current = setTimeout(() => {
      if (activated.current) return;
      setNativeTap(true);
      setPhase("idle");
    }, delay);
  }

  // The player is created once per video; its callbacks read the latest props and helpers here.
  const live = useRef({ onPlayingChange, onEnded, onDuration, reveal, armNativeTap });
  useEffect(() => {
    live.current = { onPlayingChange, onEnded, onDuration, reveal, armNativeTap };
  });

  useEffect(() => {
    const host = slot.current;
    if (!host) return;
    let cancelled = false;
    // The API swaps the element it is given for the iframe, so it gets a child React never touches.
    const target = document.createElement("div");
    host.replaceChildren(target);
    const readyTimer = setTimeout(() => {
      if (!cancelled && !readyRef.current) setFailed(true);
    }, READY_TIMEOUT_MS);
    const reportDuration = (seconds: number) => {
      if (seconds > 0 && seconds !== lastDuration.current) {
        lastDuration.current = seconds;
        live.current.onDuration(seconds);
      }
    };
    loadApi()
      .then((YT) => {
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
              clearTimeout(readyTimer);
              const p = player.current;
              readyRef.current = true;
              setReady(true);
              setMuted(p?.isMuted() ?? false);
              const duration = p?.getDuration() ?? 0;
              setTime({ current: 0, duration });
              reportDuration(duration);
              if (wantPlay.current && p) {
                wantPlay.current = false;
                p.playVideo();
                live.current.armNativeTap();
              }
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              const { PLAYING, PAUSED, ENDED, BUFFERING } = YT.PlayerState;
              if (data === PLAYING || data === PAUSED) {
                activated.current = true;
                clearTimeout(nativeTapTimer.current);
                setNativeTap(false);
              } else if (data === BUFFERING && !activated.current) {
                live.current.armNativeTap(NATIVE_TAP_BUFFERING_MS);
              }
              // Buffering and cued keep the previous phase: a stall is not a pause.
              if (data === PLAYING) {
                setPhase("playing");
                reportDuration(player.current?.getDuration() ?? 0);
                live.current.reveal();
              } else if (data === PAUSED) setPhase("paused");
              else if (data === ENDED) setPhase("ended");
              live.current.onPlayingChange(data === PLAYING);
              if (data === ENDED) live.current.onEnded();
            },
            onError: () => {
              if (cancelled) return;
              setFailed(true);
              setPhase("idle");
              live.current.onPlayingChange(false);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      player.current?.destroy();
      player.current = null;
      readyRef.current = false;
      host.replaceChildren();
    };
  }, [videoId, attempt]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const p = player.current;
      if (p) setTime({ current: p.getCurrentTime(), duration: p.getDuration() });
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!theatre) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [theatre]);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(nativeTapTimer.current);
    },
    [],
  );

  function retry() {
    setFailed(false);
    setReady(false);
    setPhase("idle");
    wantPlay.current = false;
    setAttempt((n) => n + 1);
  }

  function play() {
    const p = player.current;
    if (!p || !readyRef.current) {
      wantPlay.current = true;
      setPhase("starting");
      return;
    }
    if (phase === "ended") p.seekTo(0, true);
    if (phase === "idle" || phase === "ended") setPhase("starting");
    p.playVideo();
    reveal();
    armNativeTap();
  }

  function pause() {
    if (readyRef.current) player.current?.pauseVideo();
    reveal();
  }

  function toggle() {
    if (phase === "playing") pause();
    else play();
  }

  function seek(seconds: number) {
    if (!readyRef.current) return;
    const target = Math.min(Math.max(0, seconds), time.duration || seconds);
    player.current?.seekTo(target, true);
    setTime((t) => ({ ...t, current: target }));
    reveal();
  }

  function toggleMute() {
    const p = player.current;
    if (!p || !readyRef.current) return;
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
    if (canFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      } else {
        // Orientation lock is Android-only and absent from lib.dom; best effort.
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
        frame.current
          ?.requestFullscreen()
          .then(() => orientation.lock?.("landscape").catch(() => undefined))
          .catch(() => undefined);
      }
    } else {
      setTheatre((t) => !t);
    }
    reveal();
  }

  function onSurfaceClick() {
    if (failed) return;
    // While playing with hidden controls the first tap only brings them back.
    if (phase === "playing" && !controlsShown) {
      reveal();
      return;
    }
    toggle();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (failed) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft") seek(time.current - 10);
    else if (key === "arrowright") seek(time.current + 10);
    else if (key === "m") toggleMute();
    else if (key === "f") toggleFullscreen();
    else if (key === "escape" && theatre) setTheatre(false);
    else {
      reveal();
      return;
    }
    event.preventDefault();
  }

  function onFocus(event: React.FocusEvent) {
    // Only keyboard focus pins the controls; a mouse click leaves the auto-hide alone.
    if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
      setFocusWithin(true);
      reveal();
    }
  }

  function onBlur(event: React.FocusEvent) {
    if (!frame.current?.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
  }

  const playing = phase === "playing";
  const controlsShown = controls || !playing || focusWithin;
  const coverShown = !playing;
  const barShown = (playing || phase === "paused" || phase === "ended") && !failed;
  const isFull = fullscreen || theatre;
  const busy = !ready || phase === "starting";

  return (
    // The keys are shortcuts for the focused controls inside; the surface itself is not a control.
    <div
      ref={frame}
      data-phase={phase}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerMove={playing ? reveal : undefined}
      className={cn(
        "relative aspect-video w-full select-none overflow-hidden bg-ink text-white",
        "[&:fullscreen]:aspect-auto [&:fullscreen]:h-full [&:fullscreen]:w-full",
        theatre && "fixed inset-0 z-50 aspect-auto h-dvh w-full rounded-none",
        playing && !controlsShown && "cursor-none",
      )}
    >
      {/* `inert`: the hidden iframe must not be a tab stop or a way out to YouTube. */}
      <div
        ref={slot}
        inert={!nativeTap}
        className={cn(
          "absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full",
          !nativeTap && "[&_iframe]:pointer-events-none",
        )}
      />
      {coverShown && (
        <div
          className={cn("absolute inset-0", nativeTap && "pointer-events-none")}
          aria-hidden="true"
        >
          <WorkoutCover
            focus={focus}
            title={title}
            showTitle={false}
            decorative
            preload
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
      {nativeTap &&
        // Edges stay ours; only the centre (YouTube's own play button) lets the tap through.
        [
          "inset-x-0 top-0 h-[32%]",
          "inset-x-0 bottom-0 h-[32%]",
          "bottom-[32%] left-0 top-[32%] w-[35%]",
          "bottom-[32%] right-0 top-[32%] w-[35%]",
        ].map((edge) => (
          <div
            key={edge}
            role="presentation"
            onClick={onSurfaceClick}
            className={cn("absolute", edge)}
            data-testid="native-tap-edge"
          />
        ))}
      {playing && !controlsShown && (
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 bg-powder"
          style={{ width: `${progressPercent(time.current, time.duration)}%` }}
        />
      )}

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-semibold">Видеото не се зареди. Провери връзката и опитай пак.</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Опитай пак
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          {phase === "ended" && <p className="text-lg font-extrabold">Стигна до края. Браво!</p>}
          {nativeTap && <p className="text-sm font-semibold">Докосни бутона, за да започне</p>}
          <button
            type="button"
            onClick={toggle}
            aria-label={phase === "ended" ? "Пусни отначало" : playing ? "Пауза" : "Пусни видеото"}
            aria-busy={busy}
            className={cn(
              "inline-flex size-18 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-[opacity,transform] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none",
              // Hidden controls stay in the DOM so keyboard focus can bring them back.
              controlsShown ? "opacity-100" : "pointer-events-none opacity-0",
              // In native-tap mode the glyph only marks the spot; the tap must reach YouTube.
              nativeTap ? "pointer-events-none" : controlsShown && "pointer-events-auto",
            )}
          >
            {busy ? (
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
        </div>
      )}

      {barShown && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent px-3 pb-1 pt-10 transition-opacity duration-150 motion-reduce:transition-none",
            // Full screen on iPhone: keep the bar clear of the notch, rounded corners and home indicator.
            theatre &&
              "pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
            controlsShown ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
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
            <IconButton
              onClick={toggleFullscreen}
              label={isFull ? "Изход от цял екран" : "На цял екран"}
            >
              {isFull ? (
                <Minimize size={22} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Maximize size={22} strokeWidth={2.25} aria-hidden="true" />
              )}
            </IconButton>
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
