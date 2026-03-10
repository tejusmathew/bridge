import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, UserPlus } from 'lucide-react';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import { getContacts, getMessages, saveMessage, clearSession, addContact } from '../utils/storage';
import { bridgeApi } from '../api/bridgeApi';
import { useUIReader } from '../utils/useUIReader';

const ChatApp = () => {
    const navigate = useNavigate();
    const [sessionKey, setSessionKey] = useState(null);
    const [username, setUsername] = useState('User');
    const [userProfile, setUserProfile] = useState('General');

    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);

    // UI Tailoring
    const { speak } = useUIReader(userProfile);
    const socketRef = useRef(null);

    // Filter messages for the active conversation
    const activeMessages = messages.filter(m =>
        (m.sender === 'me' && m.to === activeContact?.name) ||
        (m.sender === activeContact?.name)
    );

    useEffect(() => {
        // Check for active login session
        const key = sessionStorage.getItem('bridge_auth_key');
        const user = sessionStorage.getItem('bridge_username');
        const profile = sessionStorage.getItem('bridge_user_profile');

        if (!key) {
            navigate('/login');
            return;
        }

        setSessionKey(key);
        setUsername(user || 'User');
        setUserProfile(profile || 'General');

        // Load static contacts
        getContacts().then(data => {
            setContacts(data);
            setActiveContact(data[0]); // Default open first chat
        });

        // Load encrypted messages
        getMessages(key).then(data => {
            setMessages(data);
        });

        // Initialize WebSocket connection for Real-Time Receiving
        socketRef.current = bridgeApi.connectWebSocket(user, async (incomingData) => {
            // Note: In real E2E, the key is shared. Here we use our session key for local demo decrypting 
            // OR if it's sent from another instance, we'd need a shared key. 
            // For simplicity in this local demo, if both users type the same "Secret", the key matches!

            // Re-format the incoming raw socket data into our app's message shape
            const incomingMessage = {
                sender: incomingData.from,
                to: user, // sent to me
                text: incomingData.payload, // The encrypted blob
                timestamp: Date.now()
            };

            // Save to my local indexDB using my encryption key 
            // (If the sender used the *same* secret, this will decrypt properly on my end later!)
            await saveMessage(incomingMessage, key);

            // Fetch the updated, decrypted list of messages to trigger UI re-render
            const updatedMessages = await getMessages(key);
            setMessages(updatedMessages);

            // Blind Profile Accessibility: Speak incoming message
            speak(`New message from ${incomingData.from}`);
        });

        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, [navigate, speak]);

    const handleLogout = () => {
        clearSession();
        navigate('/login');
    };

    const handleSendMessage = async (msgObj) => {
        // Tag with the intended recipient
        const fullMsg = { ...msgObj, to: activeContact?.name };

        // Save to my own local history (unencrypted state is passed, `saveMessage` encrypts it)
        await saveMessage(fullMsg, sessionKey);

        // Optimistically update UI
        const updatedMessages = await getMessages(sessionKey);
        setMessages(updatedMessages);

        // Emit through WebSocket to the recipient
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            // Re-fetch the message to get its AES Encrypted form before sending over the wire
            const dbMsgs = await getMessages(sessionKey);
            const myEncryptedText = dbMsgs[dbMsgs.length - 1].rawEncryptedText || fullMsg.text;

            // Alternatively, encrypt specifically for the wire:
            import('../utils/crypto').then(({ encryptMessage }) => {
                const wireCipher = encryptMessage(fullMsg.text, sessionKey);
                socketRef.current.send(JSON.stringify({
                    to: activeContact.name,
                    payload: wireCipher
                }));
            });
        }

        // --- MOCK BOT SIMULATION FOR TESTING ---
        if (activeContact?.name === 'Bridge AI Assistant') {
            setTimeout(async () => {
                const replyMsg = {
                    sender: 'Bridge AI Assistant',
                    to: username,
                    text: "Hi i am bridge.",
                    timestamp: Date.now()
                };
                await saveMessage(replyMsg, sessionKey);
                const newMessages = await getMessages(sessionKey);
                setMessages(newMessages);
                speak("New message from Bridge AI Assistant");
            }, 1000); // 1-second delay for realism
        }
    };

    const handleAddContact = async () => {
        const name = prompt("Enter the exact Username of the contact you want to add:");
        if (name && name.trim()) {
            const newC = await addContact(name.trim());
            setContacts(prev => [...prev, newC]);
            speak(`Added contact ${name.trim()}`);
            setActiveContact(newC);
        }
    };

    const handleSelectContact = (c) => {
        setActiveContact(c);
        speak(`Selected conversation with ${c.name}`);
    };

    const handleAddTranslation = async (originalMsg, type, url) => {
        const translatedMsg = {
            sender: originalMsg.sender,
            to: username,
            text: '', // Blank text for media-only messages
            mediaUrl: url,
            mediaType: type,
            timestamp: Date.now()
        };
        await saveMessage(translatedMsg, sessionKey);

        const updatedMessages = await getMessages(sessionKey);
        setMessages(updatedMessages);

        if (type === 'audio') {
            speak(`Audio translation ready`);
        } else if (type === 'video') {
            speak(`Sign video ready`);
        }
    };

    if (!sessionKey) return null; // Wait for redirect if not logged in

    return (
        <div className="chat-layout">

            {/* Sidebar Contacts List */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="contact-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                                {username.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                                    {username}
                                    <span className="role-badge" style={{ marginLeft: '8px', fontSize: '10px' }}>{userProfile}</span>
                                </h3>
                                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>Online</span>
                            </div>
                        </div>
                        <button className="action-btn" onClick={handleLogout} title="Log Out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                <div className="contact-list">
                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={handleAddContact}
                    >
                        <UserPlus size={16} /> Add Contact
                    </button>

                    {contacts.map(c => (
                        <div
                            key={c.id}
                            className={`contact-item ${activeContact?.id === c.id ? 'active' : ''}`}
                            onClick={() => handleSelectContact(c)}
                        >
                            <div className="contact-avatar">{c.avatar}</div>
                            <div className="contact-info">
                                <h4>{c.name}</h4>
                                <p>{c.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Canvas */}
            <div className="chat-main">
                {activeContact ? (
                    <>
                        <header className="chat-header">
                            <div className="contact-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                                {activeContact.avatar}
                            </div>
                            <div className="contact-info">
                                <h4>{activeContact.name}</h4>
                                <p className="text-secondary" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    End-to-End Encrypted via Local Environment
                                </p>
                            </div>
                        </header>

                        <MessageList messages={activeMessages} userProfile={userProfile} onTranslate={handleAddTranslation} />
                        <ChatInput onSendMessage={handleSendMessage} userProfile={userProfile} />
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="text-secondary">Select a contact to begin messaging</p>
                    </div>
                )}
            </div>

        </div>
    );
};

export default ChatApp;
