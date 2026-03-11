import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enableDemoMode } from "../App";
import "./HomePage.css";

/* ── Animated counter hook ──────────────────────────────────── */
function useCountUp(end, duration = 2000, startOnView = false) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return { count, ref };
}

/* ── Intersection observer fade-in ─────────────────────────── */
function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("fade-in-visible");
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ── Feature data ──────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "🤟",
    title: "Sign Language Recognition",
    desc: "Record sign language videos and our AI-powered BiLSTM model ensemble instantly translates ISL gestures to text with high accuracy.",
    tag: "AI / Deep Learning",
    gradient: "linear-gradient(135deg, #25d366, #128c7e)",
  },
  {
    icon: "🗣️",
    title: "Text-to-Speech",
    desc: "Natural-sounding voice synthesis converts text messages to speech in real-time, enabling blind users to hear conversations naturally.",
    tag: "Accessibility",
    gradient: "linear-gradient(135deg, #00b894, #55efc4)",
  },
  {
    icon: "🎙️",
    title: "Speech-to-Text",
    desc: "Speak your messages and our Whisper-based speech recognition converts your voice to text instantly, making hands-free messaging effortless.",
    tag: "Voice AI",
    gradient: "linear-gradient(135deg, #0984e3, #74b9ff)",
  },
  {
    icon: "🧍",
    title: "3D Avatar Signing",
    desc: "Text messages are automatically translated into sign language performed by a lifelike 3D avatar, making content accessible to Deaf users.",
    tag: "3D Animation",
    gradient: "linear-gradient(135deg, #e17055, #fab1a0)",
  },
  {
    icon: "🔒",
    title: "End-to-End Encryption",
    desc: "All messages are encrypted using AES-256 before storage. Your conversations stay private — only you and your contacts can read them.",
    tag: "Security",
    gradient: "linear-gradient(135deg, #fdcb6e, #ffeaa7)",
  },
  {
    icon: "♿",
    title: "Adaptive Accessibility",
    desc: "Three user profiles — General, Blind, Deaf — each with a tailored UI, keyboard shortcuts, screen reader support, and high-contrast themes.",
    tag: "Inclusive Design",
    gradient: "linear-gradient(135deg, #e84393, #fd79a8)",
  },
];

const ARCHITECTURE = [
  { label: "Frontend", tech: "React + Vite", port: "5173", icon: "⚛️" },
  { label: "Gateway API", tech: "FastAPI", port: "8000", icon: "🚪" },
  { label: "TTS Service", tech: "gTTS / FastAPI", port: "8001", icon: "🔊" },
  { label: "STT Service", tech: "Whisper / FastAPI", port: "8002", icon: "🎤" },
  { label: "SLR Service", tech: "PyTorch + MediaPipe", port: "8006", icon: "🧠" },
  { label: "Avatar Service", tech: "Node.js + Three.js", port: "5003", icon: "🎭" },
];

/* ── Component ─────────────────────────────────────────────── */
const HomePage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const y = window.scrollY;
        heroRef.current.style.setProperty("--scroll-y", `${y * 0.3}px`);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const featuresRef = useFadeIn();
  const archRef = useFadeIn();
  const statsRef = useFadeIn();
  const ctaRef = useFadeIn();
  const profilesRef = useFadeIn();

  const s1 = useCountUp(926, 1800, true);
  const s2 = useCountUp(5, 1200, true);
  const s3 = useCountUp(6, 1000, true);
  const s4 = useCountUp(3, 800, true);

  return (
    <div className="hp">
      {/* Navbar */}
      <nav className="hp-nav" id="hp-navbar">
        <div className="hp-nav-inner">
          <a href="#" className="hp-logo" id="hp-logo">
            <span className="hp-logo-icon">🌉</span>
            <span className="hp-logo-text">Bridge</span>
          </a>
          <div className="hp-nav-links">
            <a href="#features" className="hp-nav-link">Features</a>
            <a href="#architecture" className="hp-nav-link">Architecture</a>
            <a href="#profiles" className="hp-nav-link">Profiles</a>
            <button
              className="hp-btn hp-btn-primary"
              id="hp-nav-cta"
              onClick={() => navigate("/login")}
            >
              Open App →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hp-hero" ref={heroRef} id="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-hero-grid" />
        <div className="hp-hero-content">
          <h1 className="hp-hero-title">
            Communication
            <br />
            <span className="hp-gradient-text">Without Barriers</span>
          </h1>
          <p className="hp-hero-subtitle">
            Bridge connects Deaf, Blind, and hearing communities through
            AI-powered sign language recognition, real-time speech synthesis,
            and encrypted messaging — making every conversation accessible.
          </p>
          <div className="hp-hero-actions">
            <button
              className="hp-btn hp-btn-hero"
              id="hp-hero-cta"
              onClick={() => navigate("/login")}
            >
              <span>Launch Bridge</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button
              className="hp-btn hp-btn-ghost"
              id="hp-hero-demo"
              onClick={() => { enableDemoMode(); navigate("/chat"); }}
            >
              Try Demo — No Sign Up
            </button>
          </div>
          <div className="hp-hero-techs">
            {["PyTorch", "MediaPipe", "Whisper", "React", "FastAPI", "Three.js"].map((t) => (
              <span key={t} className="hp-tech-badge">{t}</span>
            ))}
          </div>
        </div>
        <div className="hp-orb hp-orb-1" />
        <div className="hp-orb hp-orb-2" />
        <div className="hp-orb hp-orb-3" />
      </section>

      {/* Stats */}
      <section className="hp-stats" ref={statsRef} id="hp-stats">
        <div className="hp-stats-grid fade-in-section">
          <div className="hp-stat" ref={s1.ref}>
            <span className="hp-stat-number">{s1.count}+</span>
            <span className="hp-stat-label">ISL Signs Recognized</span>
          </div>
          <div className="hp-stat" ref={s2.ref}>
            <span className="hp-stat-number">{s2.count}</span>
            <span className="hp-stat-label">AI Model Ensemble</span>
          </div>
          <div className="hp-stat" ref={s3.ref}>
            <span className="hp-stat-number">{s3.count}</span>
            <span className="hp-stat-label">Microservices</span>
          </div>
          <div className="hp-stat" ref={s4.ref}>
            <span className="hp-stat-number">{s4.count}</span>
            <span className="hp-stat-label">Accessibility Profiles</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="hp-features" ref={featuresRef} id="features">
        <div className="hp-section-inner fade-in-section">
          <span className="hp-section-tag">Core Capabilities</span>
          <h2 className="hp-section-title">
            Everything you need for
            <br />
            <span className="hp-gradient-text">accessible communication</span>
          </h2>
          <p className="hp-section-desc">
            Six powerful features working in harmony to break down communication barriers.
          </p>
          <div className="hp-features-grid">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="hp-feature-card"
                id={`hp-feature-${i}`}
                style={{ "--card-gradient": f.gradient, animationDelay: `${i * 0.1}s` }}
              >
                <div className="hp-feature-icon-wrap">
                  <span className="hp-feature-icon">{f.icon}</span>
                </div>
                <span className="hp-feature-tag">{f.tag}</span>
                <h3 className="hp-feature-title">{f.title}</h3>
                <p className="hp-feature-desc">{f.desc}</p>
                <div className="hp-feature-glow" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Profiles */}
      <section className="hp-profiles" ref={profilesRef} id="profiles">
        <div className="hp-section-inner fade-in-section">
          <span className="hp-section-tag">Inclusive by Design</span>
          <h2 className="hp-section-title">
            Tailored for <span className="hp-gradient-text">every user</span>
          </h2>
          <p className="hp-section-desc">
            Bridge adapts its entire interface based on user accessibility needs.
          </p>
          <div className="hp-profiles-grid">
            <div className="hp-profile-card" id="hp-profile-general">
              <div className="hp-profile-emoji">👤</div>
              <h3>General</h3>
              <p>Full-featured messaging with text, voice, and video support.</p>
              <ul>
                <li>Text & voice messaging</li>
                <li>Sign video recording</li>
                <li>6 color themes</li>
                <li>E2E Encryption</li>
              </ul>
            </div>
            <div className="hp-profile-card hp-profile-featured" id="hp-profile-deaf">
              <div className="hp-profile-badge">Most Unique</div>
              <div className="hp-profile-emoji">🤟</div>
              <h3>Deaf</h3>
              <p>Optimized for Deaf and hard-of-hearing users with sign language AI.</p>
              <ul>
                <li>Sign-to-Text AI (BiLSTM)</li>
                <li>Text-to-Sign 3D Avatar</li>
                <li>Visual notifications</li>
                <li>Video-first interface</li>
              </ul>
            </div>
            <div className="hp-profile-card" id="hp-profile-blind">
              <div className="hp-profile-emoji">🦯</div>
              <h3>Blind</h3>
              <p>Voice-driven experience with screen reader integration.</p>
              <ul>
                <li>Auto Text-to-Speech</li>
                <li>Keyboard shortcuts (Alt+M/S/R)</li>
                <li>High-contrast mode</li>
                <li>Screen reader optimized</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="hp-arch" ref={archRef} id="architecture">
        <div className="hp-section-inner fade-in-section">
          <span className="hp-section-tag">System Design</span>
          <h2 className="hp-section-title">
            Microservices <span className="hp-gradient-text">Architecture</span>
          </h2>
          <p className="hp-section-desc">
            Six independent services communicating via REST APIs.
          </p>
          <div className="hp-arch-grid">
            {ARCHITECTURE.map((a, i) => (
              <div key={i} className="hp-arch-card" id={`hp-arch-${i}`}>
                <div className="hp-arch-icon">{a.icon}</div>
                <div className="hp-arch-info">
                  <h4>{a.label}</h4>
                  <span className="hp-arch-tech">{a.tech}</span>
                </div>
                <span className="hp-arch-port">:{a.port}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="hp-cta" ref={ctaRef} id="hp-cta">
        <div className="hp-cta-inner fade-in-section">
          <div className="hp-cta-glow" />
          <h2>Ready to break communication barriers?</h2>
          <p>Experience the future of accessible messaging — powered by AI.</p>
          <button
            className="hp-btn hp-btn-hero"
            id="hp-cta-launch"
            onClick={() => { enableDemoMode(); navigate("/chat"); }}
          >
            <span>Try Demo Now</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="hp-footer" id="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <span className="hp-logo-icon">🌉</span>
            <span className="hp-logo-text">Bridge</span>
          </div>
          <p className="hp-footer-copy">
            Built with ❤️ for accessibility. Connecting communities through technology.
          </p>
          <div className="hp-footer-techs">
            React · FastAPI · PyTorch · MediaPipe · Whisper · Three.js · Supabase
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
