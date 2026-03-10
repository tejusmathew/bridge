import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { deriveKey } from '../utils/crypto';
import { clearSession } from '../utils/storage';

const Login = () => {
    const [username, setUsername] = useState('');
    const [profile, setProfile] = useState('General');
    const navigate = useNavigate();

    useEffect(() => {
        // Ensure fresh session on login page load
        clearSession();
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        // Auto-generate a pseudo-E2E key from the username 
        // (In a real app, this would be a secure ECDH exchange, but this keeps the simulation frictionless)
        const secret = `${username.toLowerCase()}_secure_salt_2024`;
        const sessionKey = deriveKey(secret);

        // Store in ephemeral memory only (sessionStorage clears when tab closes)
        sessionStorage.setItem('bridge_auth_key', sessionKey);
        sessionStorage.setItem('bridge_username', username);
        sessionStorage.setItem('bridge_user_profile', profile);

        navigate('/chat');
    };

    return (
        <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--accent-gradient)', borderRadius: '50%', marginBottom: '1rem', color: 'white', boxShadow: '0 4px 20px rgba(108, 92, 231, 0.4)' }}>
                        <Shield size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Bridge Platform</h1>
                    <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Secure, Accessible Messaging.</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            type="text"
                            className="text-input"
                            style={{ minHeight: '48px', padding: '0 1rem' }}
                            placeholder="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    {/* Removed manual Secret Key input to simulate seamless onboarding */}

                    <div className="input-group">
                        <label className="input-label">User Profile (UI Tailoring)</label>
                        <select
                            className="text-input"
                            style={{ minHeight: '48px', padding: '0 1rem' }}
                            value={profile}
                            onChange={(e) => setProfile(e.target.value)}
                        >
                            <option value="General">General (Standard Messaging)</option>
                            <option value="Deaf">Deaf (Prefers Sign Language Avatar)</option>
                            <option value="Blind">Blind (Prefers Text-to-Speech Audio)</option>
                            <option value="Mute">Mute (Prefers Sign Video Input)</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '1rem', padding: '1rem', borderRadius: '24px' }}
                        disabled={!username.trim()}
                    >
                        Access Encrypted Chat
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
