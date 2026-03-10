import CryptoJS from 'crypto-js';

// Note: In a real E2E environment, key derivation involves complex handshakes.
// For this local frontend demo, we use a simple SHA-256 hash of the user's password/secret 
// to quickly derive a deterministic AES key for their session.
export const deriveKey = (secret) => {
    return CryptoJS.SHA256(secret).toString();
};

export const encryptMessage = (text, key) => {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text, key).toString();
};

export const decryptMessage = (cipherText, key) => {
    if (!cipherText) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption failed", e);
        return "[Encrypted Message - Key Mismatch]";
    }
};
