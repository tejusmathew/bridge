import React, { useEffect, useRef, useState, useCallback } from "react";
import { bridgeApi } from "../api/bridgeApi";
import {
  PlayCircle,
  PauseCircle,
  Video as VideoIcon,
  X,
  Volume2,
  AlertCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Inline Audio Player  — WhatsApp-style waveform bars + controls
   ───────────────────────────────────────────────────────────── */
const InlineAudioPlayer = ({ audioUrl }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const seekRef = useRef(null);

  // Auto-play when mounted
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* autoplay blocked — user can press play */
    });
  }, [audioUrl]);

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleToggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setCurrentTime(el.currentTime);
    setProgress((el.currentTime / el.duration) * 100);
  };

  const handleLoaded = () => {
    const el = audioRef.current;
    if (el) setDuration(el.duration);
  };

  const handleSeek = (e) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = ratio * el.duration;
  };

  // Fake waveform bars (static visual, WhatsApp-style)
  const bars = [
    3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 6, 4, 8, 5, 9, 7, 6, 3, 8, 5, 10,
    7,
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 2px",
        marginTop: "4px",
        minWidth: "220px",
      }}
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        preload="auto"
        style={{ display: "none" }}
      />

      {/* Play / Pause */}
      <button
        onClick={handleToggle}
        style={{
          background: "var(--accent-primary)",
          border: "none",
          borderRadius: "50%",
          width: "34px",
          height: "34px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          color: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        aria-label={playing ? "Pause audio" : "Play audio"}
      >
        {playing ? (
          <PauseCircle size={18} strokeWidth={2.5} />
        ) : (
          <PlayCircle size={18} strokeWidth={2.5} />
        )}
      </button>

      {/* Waveform + seek bar */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Waveform bars */}
        <div
          ref={seekRef}
          onClick={handleSeek}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            height: "24px",
            cursor: "pointer",
            position: "relative",
          }}
          aria-label="Seek audio"
        >
          {bars.map((h, i) => {
            const barProgress = (i / bars.length) * 100;
            const filled = barProgress <= progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 2}px`,
                  borderRadius: "2px",
                  background: filled
                    ? "var(--accent-primary)"
                    : "rgba(var(--glow-rgb), 0.25)",
                  transition: "background 0.1s",
                }}
              />
            );
          })}
        </div>
        {/* Time */}
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--message-meta-color)",
            letterSpacing: "0.2px",
            lineHeight: 1,
          }}
        >
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Audio Trigger Button  — "🔊 Audio" chip shown inside bubble
   ───────────────────────────────────────────────────────────── */
const AudioChip = ({ onClick, loading, done }) => (
  <button
    onClick={onClick}
    disabled={loading || done}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontSize: "0.72rem",
      fontWeight: 600,
      padding: "4px 10px",
      borderRadius: "12px",
      border: "none",
      cursor: loading || done ? "default" : "pointer",
      background: done
        ? "rgba(var(--glow-rgb), 0.06)"
        : "rgba(var(--glow-rgb), 0.10)",
      color: done ? "var(--text-secondary)" : "var(--accent-primary)",
      transition: "background 0.2s, transform 0.15s",
      transform: "none",
      fontFamily: "var(--font-family)",
    }}
    onMouseEnter={(e) => {
      if (!loading && !done) e.currentTarget.style.transform = "scale(1.05)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1)";
    }}
    aria-label={
      loading ? "Generating audio…" : done ? "Audio ready" : "Convert to audio"
    }
  >
    {loading ? (
      <>
        <div
          className="spinner"
          style={{ width: 11, height: 11, borderWidth: 2, flexShrink: 0 }}
        />
        Generating…
      </>
    ) : done ? (
      <>
        <Volume2 size={12} />
        Audio
      </>
    ) : (
      <>
        <Volume2 size={12} />
        Audio
      </>
    )}
  </button>
);

/* ─────────────────────────────────────────────────────────────
   Sign-Video Chip
   ───────────────────────────────────────────────────────────── */
const SignVideoChip = ({ onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontSize: "0.72rem",
      fontWeight: 600,
      padding: "4px 10px",
      borderRadius: "12px",
      border: "none",
      cursor: loading ? "default" : "pointer",
      background: "rgba(var(--glow-rgb), 0.10)",
      color: "var(--accent-primary)",
      transition: "background 0.2s, transform 0.15s",
      fontFamily: "var(--font-family)",
    }}
    onMouseEnter={(e) => {
      if (!loading) e.currentTarget.style.transform = "scale(1.05)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "scale(1)";
    }}
    aria-label="Convert to sign video"
  >
    {loading ? (
      <>
        <div
          className="spinner"
          style={{ width: 11, height: 11, borderWidth: 2, flexShrink: 0 }}
        />
        Generating…
      </>
    ) : (
      <>
        <VideoIcon size={12} />
        Sign&nbsp;Video
      </>
    )}
  </button>
);

/* ─────────────────────────────────────────────────────────────
   Main Bubble Component
   ───────────────────────────────────────────────────────────── */
const DynamicMessageBubble = ({
  msg,
  userProfile,
  onTranslate,
  onExpandVideo,
}) => {
  // ── Audio state (fully inline, no new message needed) ──────
  const [audioUrl, setAudioUrl] = useState(
    msg.mediaType === "audio" ? msg.mediaUrl : null,
  );
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

  // ── Sign-video state ────────────────────────────────────────
  const [loadingVideo, setLoadingVideo] = useState(false);

  // ── Auto-translate flags ────────────────────────────────────
  const [autoTranslated, setAutoTranslated] = useState(false);

  // Auto: Deaf → sign video for incoming text messages
  useEffect(() => {
    if (
      userProfile === "Deaf" &&
      msg.sender !== "me" &&
      msg.text &&
      !msg.mediaUrl &&
      !autoTranslated
    ) {
      setAutoTranslated(true);
      handleSignVideo();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto: Blind → TTS for incoming text messages
  useEffect(() => {
    if (
      userProfile === "Blind" &&
      msg.sender !== "me" &&
      msg.text &&
      !msg.mediaUrl &&
      !autoTranslated
    ) {
      setAutoTranslated(true);
      handlePlayAudio();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── TTS: fetch from API and play inline ─────────────────── */
  const handlePlayAudio = useCallback(async () => {
    // If audio already loaded, nothing to fetch
    if (audioUrl) return;

    if (!msg.text || !msg.text.trim()) {
      setAudioError("No text to convert");
      return;
    }

    setLoadingAudio(true);
    setAudioError(null);

    try {
      console.log("[TTS] Requesting audio for:", msg.text.slice(0, 60));
      const res = await bridgeApi.textToSpeech(msg.text);

      console.log("[TTS] Raw response:", res);

      // Validate the response
      const url = res?.audio_url;
      if (!url || typeof url !== "string" || !url.startsWith("http")) {
        throw new Error(
          `Invalid audio_url in response: ${JSON.stringify(res)}`,
        );
      }

      console.log("[TTS] Audio URL received:", url);
      setAudioUrl(url);
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.message || "TTS request failed";
      console.error("[TTS] Error:", detail, err);
      setAudioError(detail);
    } finally {
      setLoadingAudio(false);
    }
  }, [audioUrl, msg.text]);

  /* ── Sign video: delegate to parent via onTranslate ─────── */
  const handleSignVideo = useCallback(async () => {
    if (!msg.text?.trim()) return;
    setLoadingVideo(true);
    try {
      const res = await bridgeApi.textToSign(msg.text);
      const url = res?.video_url;
      if (!url) throw new Error("No video_url in response");
      if (onTranslate) onTranslate(msg, "video", url);
    } catch (err) {
      console.error("[Avatar] Sign video error:", err);
    } finally {
      setLoadingVideo(false);
    }
  }, [msg, onTranslate]);

  /* ── Visibility rules ───────────────────────────────────────
       Show audio chip: received messages only, with text, not already showing audio
       Show video chip: received messages only, with text, General / Mute profiles      */
  const isReceived = msg.sender !== "me";
  const hasText = Boolean(msg.text?.trim());
  const showAudioBtn =
    isReceived && hasText && !audioUrl && userProfile !== "Deaf";
  const showVideoBtn =
    isReceived &&
    hasText &&
    !msg.mediaUrl &&
    (userProfile === "Mute" || userProfile === "General");

  return (
    <div
      className={`message-wrapper ${msg.sender === "me" ? "sent" : "received"}`}
      role="article"
      aria-label={`${msg.sender === "me" ? "You" : msg.sender}: ${msg.text || "media message"}`}
    >
      <div className="message-bubble">
        {/* ── Text content ─────────────────────────────── */}
        {msg.text && (
          <div
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {msg.text}
          </div>
        )}

        {/* ── Inline Audio Player (shown once TTS URL is ready) ─── */}
        {audioUrl && <InlineAudioPlayer audioUrl={audioUrl} />}

        {/* ── Audio error ───────────────────────────────── */}
        {audioError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.72rem",
              color: "var(--error)",
              marginTop: "4px",
              padding: "4px 8px",
              background: "rgba(241, 92, 109, 0.08)",
              borderRadius: "8px",
            }}
          >
            <AlertCircle size={12} />
            {audioError}
          </div>
        )}

        {/* ── Sign-Video media (legacy — from parent-managed messages) ── */}
        {msg.mediaType === "video" && msg.mediaUrl && (
          <div
            className="sign-video-thumb"
            style={{ marginTop: msg.text ? "0.5rem" : "0" }}
            onClick={() => onExpandVideo && onExpandVideo(msg.mediaUrl)}
            title="Click to enlarge"
          >
            <video
              src={msg.mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: "240px",
                borderRadius: "8px",
                display: "block",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
            <div className="sign-video-expand-hint">
              <span>▶ Click to enlarge</span>
            </div>
          </div>
        )}

        {/* ── Action chips ──────────────────────────────── */}
        {(showAudioBtn || showVideoBtn) && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginTop: "6px",
              flexWrap: "wrap",
            }}
          >
            {showAudioBtn && (
              <AudioChip
                onClick={handlePlayAudio}
                loading={loadingAudio}
                done={Boolean(audioUrl)}
              />
            )}
            {showVideoBtn && (
              <SignVideoChip onClick={handleSignVideo} loading={loadingVideo} />
            )}
          </div>
        )}

        {/* ── Input-type metadata badges ────────────────── */}
        {msg.metadata?.inputType === "sign_video" && (
          <span
            style={{
              fontSize: "0.68rem",
              display: "block",
              marginTop: "3px",
              color: "var(--success)",
            }}
          >
            🤟 Sent via Sign Video
          </span>
        )}
        {msg.metadata?.inputType === "audio" && (
          <span
            style={{
              fontSize: "0.68rem",
              display: "block",
              marginTop: "3px",
              color: "var(--success)",
            }}
          >
            🎙️ Sent via Voice
          </span>
        )}

        {/* ── Timestamp ─────────────────────────────────── */}
        <span className="message-time">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   MessageList
   ───────────────────────────────────────────────────────────── */
const MessageList = ({ messages, userProfile, onTranslate }) => {
  const bottomRef = useRef(null);
  const [expandedVideoUrl, setExpandedVideoUrl] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setExpandedVideoUrl(null);
    };
    if (expandedVideoUrl) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expandedVideoUrl]);

  return (
    <div
      className="message-list"
      role="log"
      aria-label="Message history"
      aria-live="polite"
    >
      {messages.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            marginTop: "3rem",
            animation: "fadeInUp 0.5s ease-out",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>
            {userProfile === "Deaf"
              ? "🤟"
              : userProfile === "Blind"
                ? "🎧"
                : userProfile === "Mute"
                  ? "📹"
                  : "💬"}
          </span>
          <p style={{ fontWeight: 500 }}>No messages yet.</p>
          <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>
            Start chatting using your preferred method!
          </p>
          <p
            style={{ fontSize: "0.78rem", opacity: 0.6, marginTop: "0.25rem" }}
          >
            🔒 End-to-End Encrypted · <b>{userProfile}</b> Mode
          </p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <DynamicMessageBubble
            key={`${msg.timestamp}-${index}`}
            msg={msg}
            userProfile={userProfile}
            onTranslate={onTranslate}
            onExpandVideo={setExpandedVideoUrl}
          />
        ))
      )}

      <div ref={bottomRef} />

      {/* ── Fullscreen Sign-Video Lightbox ─────────────── */}
      {expandedVideoUrl && (
        <div
          className="video-lightbox-overlay"
          onClick={() => setExpandedVideoUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Sign language video fullscreen"
        >
          <button
            className="video-lightbox-close"
            onClick={() => setExpandedVideoUrl(null)}
            title="Close (Esc)"
            aria-label="Close video"
          >
            <X size={22} />
          </button>
          <div
            className="video-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={expandedVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              controls
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
