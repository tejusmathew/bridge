import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
});

// Using the same Auth Token as defined in the Gateway API config
const AUTH_TOKEN = 'bridge-dev-token-123';

api.interceptors.request.use(
    (config) => {
        config.headers.Authorization = `Bearer ${AUTH_TOKEN}`;
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const bridgeApi = {
    speechToSign: async (audioFile) => {
        const formData = new FormData();
        formData.append('audio', audioFile);
        const response = await api.post('/speech-to-sign', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    signToSpeech: async (videoFile) => {
        const formData = new FormData();
        formData.append('video', videoFile);
        const response = await api.post('/sign-to-speech', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    speechToText: async (audioFile) => {
        const formData = new FormData();
        formData.append('audio', audioFile);
        const response = await api.post('/speech-to-text', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    signToText: async (videoFile) => {
        const formData = new FormData();
        formData.append('video', videoFile);
        const response = await api.post('/sign-to-text', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    textToSign: async (text) => {
        try {
            // The Sign Avatar API actually runs on port 5002. Expects { text: "..." }
            const avatarApi = axios.create({ baseURL: 'http://localhost:5003' });
            const response = await avatarApi.post('/generate-sign-video',
                { text },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return { video_url: response.data.video_url };
        } catch (error) {
            console.error("Text-to-Sign directly to 5002 failed:", error);
            throw error;
        }
    },

    textToSpeech: async (text) => {
        try {
            // The TTS API runs on port 8001. It expects a JSON body with { text: "...", language: "en" }
            const ttsApi = axios.create({ baseURL: 'http://localhost:8001' });

            const response = await ttsApi.post('/generate-speech',
                { text, language: "en", voice: "default", speed: 1.0 },
                { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' } }
            );

            // Returns the audio_url directly mapping to the generated file hosted on the TTS server
            return { audio_url: response.data.audio_url };
        } catch (error) {
            console.error("Text-to-Speech directly to 8001 failed:", error);
            throw error;
        }
    },

    signVideoToTranscript: async (videoFile) => {
        try {
            const signApi = axios.create({ baseURL: 'http://localhost:8006' });
            const formData = new FormData();
            formData.append('file', videoFile);
            const response = await signApi.post('/generate-transcript', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000, // 2 min timeout for long videos
            });
            return response.data;
        } catch (error) {
            console.error("Sign-Video-to-Transcript failed:", error);
            throw error;
        }
    },

    connectWebSocket: (username, onMessageReceived) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Note: Connecting directly to the FastAPI Gateway on 8000
        const wsUrl = `ws://localhost:8000/ws/${encodeURIComponent(username)}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => console.log(`WebSocket connected for ${username}`);
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (onMessageReceived) onMessageReceived(data);
            } catch (err) {
                console.error("Failed to parse incoming WS message:", err);
            }
        };
        socket.onerror = (error) => console.error('WebSocket Error:', error);

        return socket;
    }
};
