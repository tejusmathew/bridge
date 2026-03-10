import { useCallback } from 'react';

// Custom hook to handle UI Audio Reader for the Blind profile
export const useUIReader = (userProfile) => {
    const speak = useCallback((text) => {
        // Only speak UI elements if the user's profile is Blind
        if (userProfile !== 'Blind') return;

        // Check if the browser supports SpeechSynthesis
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech to prioritize the new UI action
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1; // Slightly faster for UI navigation
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("SpeechSynthesis API not supported in this browser.");
        }
    }, [userProfile]);

    return { speak };
};
