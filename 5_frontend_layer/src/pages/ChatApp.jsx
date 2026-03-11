import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, UserPlus, Palette } from "lucide-react";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import {
  getContacts,
  getMessages,
  saveMessage,
  clearSession,
  addContact,
  lookupUserByUsername,
  subscribeToMessages,
  getCurrentProfile,
} from "../utils/storage";
import { bridgeApi } from "../api/bridgeApi";
import { useAccessibility } from "../utils/useAccessibility";

const THEMES = [
  { id: "whatsapp", label: "💬 WhatsApp", color: "#25d366" },
  { id: "midnight", label: "🌙 Midnight", color: "#6c5ce7" },
  { id: "ocean", label: "🌊 Ocean", color: "#00b4d8" },
  { id: "forest", label: "🌲 Forest", color: "#2ecc71" },
  { id: "light", label: "☀️ Light", color: "#f5f5f8" },
  { id: "high-contrast", label: "♿ High Contrast", color: "#ffdd00" },
];

const ChatApp = () => {
  const navigate = useNavigate();
  const [sessionKey, setSessionKey] = useState(null);
  const [username, setUsername] = useState("User");
  const [userProfile, setUserProfile] = useState("General");

  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);

  // Theme
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(
    localStorage.getItem("bridge_theme") || "whatsapp",
  );
  const themePickerRef = useRef(null);

  // Recording ref for blind keyboard shortcuts
  const chatInputRef = useRef(null);
  const socketRef = useRef(null);

  // Filter messages for the active conversation
  const activeMessages = messages.filter(
    (m) =>
      (m.sender === "me" && m.to === activeContact?.name) ||
      m.sender === activeContact?.name,
  );

  // Accessibility actions for keyboard shortcuts
  const accessibilityActions = useMemo(
    () => ({
      onStartRecording: () => {
        if (chatInputRef.current?.startVoiceRecording) {
          chatInputRef.current.startVoiceRecording();
        }
      },
      onStopRecording: () => {
        if (chatInputRef.current?.stopVoiceRecording) {
          chatInputRef.current.stopVoiceRecording();
        }
      },
      onReadLastMessage: () => {
        const received = activeMessages.filter((m) => m.sender !== "me");
        const last = received[received.length - 1];
        if (last?.text) {
          speak(last.text, true);
        } else {
          speak("No messages to read", true);
        }
      },
      onReadNewMessages: () => {
        const received = activeMessages.filter((m) => m.sender !== "me");
        const last3 = received.slice(-3);
        if (last3.length === 0) {
          speak("No new messages", true);
          return;
        }
        const texts = last3
          .map((m) => `${m.sender} said: ${m.text}`)
          .join(". ");
        speak(texts, true);
      },
      onAnnounceContact: () => {
        if (activeContact) {
          speak(`Current conversation with ${activeContact.name}`, true);
        } else {
          speak("No contact selected", true);
        }
      },
      onPrevContact: () => {
        if (contacts.length === 0) return;
        const idx = contacts.findIndex((c) => c.id === activeContact?.id);
        const prev =
          idx > 0 ? contacts[idx - 1] : contacts[contacts.length - 1];
        handleSelectContact(prev);
      },
      onNextContact: () => {
        if (contacts.length === 0) return;
        const idx = contacts.findIndex((c) => c.id === activeContact?.id);
        const next =
          idx < contacts.length - 1 ? contacts[idx + 1] : contacts[0];
        handleSelectContact(next);
      },
    }),
    [activeMessages, activeContact, contacts],
  );

  const { speak } = useAccessibility(userProfile, accessibilityActions);

  // Theme application
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("bridge_theme", currentTheme);
  }, [currentTheme]);

  // Close theme picker on outside click
  useEffect(() => {
    const handle = (e) => {
      if (
        themePickerRef.current &&
        !themePickerRef.current.contains(e.target)
      ) {
        setShowThemePicker(false);
      }
    };
    if (showThemePicker) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showThemePicker]);

  useEffect(() => {
    let unsubscribeRealtime = null;

    const init = async () => {
      const user = sessionStorage.getItem("bridge_username");
      const profile = sessionStorage.getItem("bridge_user_profile") || "general";

      let resolvedUsername = user || "DemoUser";
      try {
        const dbProfile = await getCurrentProfile();
        if (dbProfile?.username) resolvedUsername = dbProfile.username;
      } catch (e) { /* fallback */ }

      setSessionKey("active");
      setUsername(resolvedUsername);
      setUserProfile(
        profile ? profile.charAt(0).toUpperCase() + profile.slice(1) : "General",
      );

      if (profile.toLowerCase() === "blind") {
        setCurrentTheme("high-contrast");
      }

      const contactsData = await getContacts();
      setContacts(contactsData);
      setActiveContact(contactsData[0]);

      const messagesData = await getMessages();
      setMessages(messagesData);

      // Subscribe to realtime + polling
      unsubscribeRealtime = subscribeToMessages(resolvedUsername, (incomingMsg) => {
        setMessages((prev) => [...prev, incomingMsg]);
        speak(`New message from ${incomingMsg.sender}`);
      });
    };

    init();

    return () => {
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [navigate, speak]);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const handleSendMessage = async (msgObj) => {
    const fullMsg = { ...msgObj, to: activeContact?.name };

    await saveMessage(fullMsg);
    setMessages((prev) => [...prev, { ...fullMsg, timestamp: Date.now() }]);

    if (activeContact?.name === "Bridge AI Assistant") {
      setTimeout(async () => {
        const replyMsg = {
          sender: "Bridge AI Assistant",
          to: username,
          text: "Hi, I am Bridge \u2014 your accessible AI assistant.",
          timestamp: Date.now(),
        };
        await saveMessage(replyMsg);
        setMessages((prev) => [...prev, replyMsg]);
        speak("New message from Bridge AI Assistant");
      }, 1000);
    }
  };

  const handleAddContact = async () => {
    const contactName = prompt("Enter the username of the person you want to chat with:");
    if (!contactName || !contactName.trim()) return;

    const found = await lookupUserByUsername(contactName.trim());
    if (!found) {
      alert(`No user found with username: "${contactName.trim()}"\nMake sure they have signed up on Bridge.`);
      return;
    }

    const newC = await addContact(found.username);
    if (newC) {
      setContacts((prev) => {
        if (prev.some((c) => c.name === newC.name)) return prev;
        return [...prev, newC];
      });
      speak(`Added contact ${found.username}`);
      setActiveContact(newC);
    }
  };

  const handleSelectContact = useCallback(
    (c) => {
      setActiveContact(c);
      speak(`Selected conversation with ${c.name}`);
    },
    [speak],
  );

  const handleAddTranslation = async (originalMsg, type, url) => {
    const translatedMsg = {
      sender: originalMsg.sender,
      to: username,
      text: "",
      mediaUrl: url,
      mediaType: type,
      timestamp: Date.now(),
    };
    await saveMessage(translatedMsg);
    setMessages((prev) => [...prev, translatedMsg]);

    if (type === "video") speak("Sign video ready");
  };

  if (!sessionKey) return null;

  return (
    <div className="chat-layout page-enter">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <div
                className="contact-avatar"
                style={{ width: "40px", height: "40px", fontSize: "1rem" }}
              >
                {username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {username}
                  <span
                    className="role-badge"
                    style={{ marginLeft: "8px", fontSize: "10px" }}
                  >
                    {userProfile}
                  </span>
                </h3>
                <span
                  className="text-secondary"
                  style={{ fontSize: "0.75rem" }}
                >
                  Online
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.25rem" }}>
              {/* Theme Picker */}
              <div style={{ position: "relative" }} ref={themePickerRef}>
                <button
                  className="theme-picker-btn"
                  onClick={() => setShowThemePicker((p) => !p)}
                  title="Change Theme"
                  aria-label="Change theme"
                >
                  <Palette size={18} />
                </button>

                {showThemePicker && (
                  <div className="theme-dropdown">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        className={`theme-option ${currentTheme === t.id ? "active" : ""}`}
                        onClick={() => {
                          setCurrentTheme(t.id);
                          setShowThemePicker(false);
                        }}
                      >
                        <div
                          className="theme-swatch"
                          style={{ background: t.color }}
                        />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="action-btn"
                onClick={handleLogout}
                title="Log Out"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="contact-list">
          <button
            className="btn btn-primary"
            style={{
              width: "100%",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
            onClick={handleAddContact}
            aria-label="Add a new contact"
          >
            <UserPlus size={16} /> Add Contact
          </button>

          {contacts.map((c) => (
            <div
              key={c.id}
              className={`contact-item ${activeContact?.id === c.id ? "active" : ""}`}
              onClick={() => handleSelectContact(c)}
              role="button"
              tabIndex={0}
              aria-label={`Chat with ${c.name}`}
              onKeyDown={(e) => e.key === "Enter" && handleSelectContact(c)}
            >
              <div className="contact-avatar">{c.avatar}</div>
              <div className="contact-info">
                <h4>{c.name}</h4>
                <p>{c.status}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts bar for Blind */}
        {userProfile === "Blind" && (
          <div className="shortcuts-bar" aria-label="Keyboard shortcuts">
            <span className="shortcut-tag">
              <kbd>Alt+M</kbd> Mic
            </span>
            <span className="shortcut-tag">
              <kbd>Alt+S</kbd> Send
            </span>
            <span className="shortcut-tag">
              <kbd>Alt+R</kbd> Read
            </span>
            <span className="shortcut-tag">
              <kbd>Alt+↑↓</kbd> Nav
            </span>
          </div>
        )}
      </div>

      {/* Main Chat */}
      <div className="chat-main">
        {activeContact ? (
          <>
            <header className="chat-header">
              <div
                className="contact-avatar"
                style={{ width: "40px", height: "40px", fontSize: "1rem" }}
              >
                {activeContact.avatar}
              </div>
              <div className="contact-info">
                <h4>{activeContact.name}</h4>
                <p className="text-secondary" style={{ fontSize: "0.8rem" }}>
                  End-to-End Encrypted · {userProfile} Mode
                </p>
              </div>
            </header>

            <MessageList
              messages={activeMessages}
              userProfile={userProfile}
              onTranslate={handleAddTranslation}
            />
            <ChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              userProfile={userProfile}
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p className="text-secondary">
              Select a contact to begin messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;
