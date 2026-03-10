import React, { useEffect, useRef, useState } from 'react';
import { bridgeApi } from '../api/bridgeApi';
import { PlayCircle, Video as VideoIcon, X } from 'lucide-react';

const DynamicMessageBubble = ({ msg, userProfile, onTranslate, onExpandVideo }) => {
    const [loadingMedia, setLoadingMedia] = useState(false);

    // Mute & General users just read the text naturally.
    // Deaf users may want text-to-sign avatar visually applied.
    // Blind users may want text-to-speech audio audibly applied.

    const handleTranslateOutput = async (type) => {
        setLoadingMedia(true);
        try {
            if (type === 'audio') {
                const res = await bridgeApi.textToSpeech(msg.text);
                if (onTranslate) onTranslate(msg, 'audio', res.audio_url);
            } else if (type === 'video') {
                const res = await bridgeApi.textToSign(msg.text);
                if (onTranslate) onTranslate(msg, 'video', res.video_url);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMedia(false);
        }
    };

    return (
        <div className={`message-wrapper ${msg.sender === 'me' ? 'sent' : 'received'}`}>
            <div className="message-bubble">
                {msg.text && (
                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: '0', fontStyle: msg.mediaUrl ? 'italic' : 'normal', opacity: msg.mediaUrl ? 0.7 : 1 }}>
                        {msg.text}
                    </div>
                )}

                {/* Dynamic Actions for Incoming Messages if they don't have media already */}
                {msg.sender !== 'me' && !msg.mediaUrl && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {(userProfile === 'Blind' || userProfile === 'Mute') && (
                            <button
                                className="action-btn"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.08)', color: 'var(--accent-secondary)', borderRadius: '12px' }}
                                onClick={() => handleTranslateOutput('audio')}
                            >
                                <PlayCircle size={14} style={{ marginRight: '0.25rem' }} /> Audio
                            </button>
                        )}

                        {(userProfile === 'Deaf' || userProfile === 'Mute') && (
                            <button
                                className="action-btn"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.08)', color: 'var(--accent-secondary)', borderRadius: '12px' }}
                                onClick={() => handleTranslateOutput('video')}
                            >
                                <VideoIcon size={14} style={{ marginRight: '0.25rem' }} /> Sign-Video
                            </button>
                        )}
                    </div>
                )}

                {loadingMedia && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.5rem', color: 'var(--accent-primary)' }}>Translating...</div>}

                {msg.mediaType === 'audio' && (
                    <div style={{ marginTop: msg.text ? '0.75rem' : '0', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '24px', display: 'inline-flex' }}>
                        <audio controls src={msg.mediaUrl} style={{ height: '36px', width: '250px', outline: 'none' }} />
                    </div>
                )}

                {msg.mediaType === 'video' && (
                    <div
                        className="sign-video-thumb"
                        style={{ marginTop: msg.text ? '0.5rem' : '0' }}
                        onClick={() => onExpandVideo && onExpandVideo(msg.mediaUrl)}
                        title="Click to enlarge"
                    >
                        <video
                            src={msg.mediaUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{ width: '260px', borderRadius: '8px', display: 'block', objectFit: 'cover', pointerEvents: 'none' }}
                        />
                        <div className="sign-video-expand-hint">
                            <span>▶ Click to enlarge</span>
                        </div>
                    </div>
                )}

                {msg.metadata?.inputType === 'sign_video' && (
                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem', color: 'var(--success)' }}>(Sent via Sign Video)</span>
                )}
                {msg.metadata?.inputType === 'audio' && (
                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem', color: 'var(--success)' }}>(Sent via Voice)</span>
                )}

                <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

const MessageList = ({ messages, userProfile, onTranslate }) => {
    const bottomRef = useRef(null);
    const [expandedVideoUrl, setExpandedVideoUrl] = useState(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') setExpandedVideoUrl(null); };
        if (expandedVideoUrl) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [expandedVideoUrl]);

    return (
        <div className="message-list">
            {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                    <p>No messages yet. Start chatting using your preferred method!</p>
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
                        <p>🔒 Messages are Encrypted and your UI is tailored to the <b>{userProfile}</b> profile.</p>
                    </div>
                </div>
            ) : (
                messages.map((msg, index) => (
                    <DynamicMessageBubble
                        key={index}
                        msg={msg}
                        userProfile={userProfile}
                        onTranslate={onTranslate}
                        onExpandVideo={setExpandedVideoUrl}
                    />
                ))
            )}
            <div ref={bottomRef} />

            {/* Fullscreen Video Lightbox */}
            {expandedVideoUrl && (
                <div className="video-lightbox-overlay" onClick={() => setExpandedVideoUrl(null)}>
                    <button
                        className="video-lightbox-close"
                        onClick={() => setExpandedVideoUrl(null)}
                        title="Close (Esc)"
                    >
                        <X size={24} />
                    </button>
                    <div className="video-lightbox-content" onClick={(e) => e.stopPropagation()}>
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
