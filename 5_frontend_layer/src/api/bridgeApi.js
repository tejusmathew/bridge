import axios from "axios";

// ── Direct microservice URLs (no gateway) ─────────────────────
const TTS_URL = "http://localhost:8001";
const STT_URL = "http://localhost:8002";
const SLR_URL = "http://localhost:8006";
const AVATAR_URL = "http://localhost:5003";

// Internal service auth token (matches backend config)
const SERVICE_TOKEN = "bridge-dev-token-123";

export const bridgeApi = {
  // ── Speech-to-Text (STT on port 8002) ───────────────
  speechToText: async (audioFile) => {
    const formData = new FormData();
    formData.append("audio", audioFile);
    const response = await axios.post(`${STT_URL}/speech-to-text`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      timeout: 180000,
    });
    return response.data;
  },

  // ── Sign-Video-to-Text (SLR on port 8006) ──────────
  signVideoToTranscript: async (videoFile) => {
    try {
      const formData = new FormData();
      formData.append("file", videoFile);
      const response = await axios.post(
        `${SLR_URL}/generate-transcript`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Sign-Video-to-Transcript failed:", error);
      throw error;
    }
  },

  // ── Text-to-Sign (Avatar on port 5003) ─────────────
  textToSign: async (text) => {
    try {
      const response = await axios.post(
        `${AVATAR_URL}/generate-sign-video`,
        { text },
        { headers: { "Content-Type": "application/json" } },
      );
      return { video_url: response.data.video_url };
    } catch (error) {
      console.error("Text-to-Sign failed:", error);
      throw error;
    }
  },

  // ── Text-to-Speech (TTS on port 8001) ──────────────
  textToSpeech: async (text) => {
    try {
      console.log(
        "[TTS] POST",
        `${TTS_URL}/generate-speech`,
        "| text:",
        text?.slice(0, 80),
      );

      const response = await axios.post(
        `${TTS_URL}/generate-speech`,
        { text, language: "en", voice: "default", speed: 1.0 },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_TOKEN}`,
          },
          timeout: 30000,
        },
      );

      console.log("[TTS] HTTP status:", response.status);
      console.log("[TTS] Response body:", response.data);

      const { status, audio_url, format, duration } = response.data;

      if (status !== "success") {
        throw new Error(`TTS service returned status="${status}"`);
      }
      if (!audio_url || typeof audio_url !== "string") {
        throw new Error(
          `TTS response missing audio_url. Got: ${JSON.stringify(response.data)}`,
        );
      }

      console.log("[TTS] audio_url:", audio_url);
      return { audio_url, format, duration, status };
    } catch (error) {
      if (error.response) {
        // Server responded with non-2xx
        console.error(
          "[TTS] Server error",
          error.response.status,
          error.response.data,
        );
        throw new Error(
          error.response.data?.detail ||
            `TTS server error ${error.response.status}`,
        );
      } else if (error.request) {
        // Request made but no response (service down)
        console.error(
          "[TTS] No response — is the TTS service running on port 8001?",
          error.message,
        );
        throw new Error(
          "TTS service unreachable (port 8001). Make sure it is running.",
        );
      } else {
        console.error("[TTS] Unexpected error:", error.message);
        throw error;
      }
    }
  },

  // ── WebSocket (disabled — no gateway) ───────────────
  connectWebSocket: () => {
    console.log("WebSocket disabled (no gateway mode)");
    // Return a stub so callers don't crash
    return {
      readyState: WebSocket.CLOSED,
      send: () => {},
      close: () => {},
    };
  },
};
