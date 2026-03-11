/**
 * Message & contact storage using Supabase tables.
 * Auth is simple session-based (no Supabase auth).
 * In demo mode, uses in-memory storage.
 */
import { supabase } from "../api/supabaseClient";

/* ── Session helpers ─────────────────────────────────────────── */

function isDemoMode() {
  return sessionStorage.getItem("bridge_demo_mode") === "true";
}

function getSessionUser() {
  return {
    id: sessionStorage.getItem("bridge_user_id"),
    username: sessionStorage.getItem("bridge_username"),
    profile: sessionStorage.getItem("bridge_user_profile") || "general",
  };
}

// In-memory store for demo mode
let demoMessages = [];
let demoContacts = [];

/* ── Profile ─────────────────────────────────────────────────── */

export async function getCurrentProfile() {
  if (isDemoMode()) {
    return { username: "DemoUser", profile_type: "general" };
  }
  const { username } = getSessionUser();
  return { username, profile_type: getSessionUser().profile };
}

/* ── User Lookup ─────────────────────────────────────────────── */

export async function lookupUserByUsername(username) {
  if (isDemoMode()) {
    return { username, profile_type: "general" };
  }

  const { data, error } = await supabase
    .from("users")
    .select("username, profile_type")
    .eq("username", username.trim())
    .single();

  if (error || !data) return null;
  return data;
}

/* ── Contacts ────────────────────────────────────────────────── */

const DEFAULT_CONTACT = {
  id: "bridge-ai",
  name: "Bridge AI Assistant",
  status: "Online",
  avatar: "🤖",
};

export async function getContacts() {
  if (isDemoMode()) return [DEFAULT_CONTACT, ...demoContacts];

  const { id } = getSessionUser();
  if (!id) return [DEFAULT_CONTACT];

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching contacts:", error);
    return [DEFAULT_CONTACT];
  }

  return [
    DEFAULT_CONTACT,
    ...data.map((c) => ({
      id: c.id,
      name: c.contact_username,
      status: "Offline",
      avatar: c.contact_username.charAt(0).toUpperCase(),
    })),
  ];
}

export async function addContact(contactUsername) {
  const newContact = {
    id: Date.now().toString(),
    name: contactUsername.trim(),
    status: "Offline",
    avatar: contactUsername.trim().charAt(0).toUpperCase(),
  };

  if (isDemoMode()) {
    demoContacts.push(newContact);
    return newContact;
  }

  const { id } = getSessionUser();
  if (!id) return newContact;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      owner_id: id,
      contact_username: contactUsername.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding contact:", error);
    return newContact;
  }

  return {
    id: data.id,
    name: data.contact_username,
    status: "Offline",
    avatar: data.contact_username.charAt(0).toUpperCase(),
  };
}

/* ── Messages ────────────────────────────────────────────────── */

export async function saveMessage(messageObj) {
  if (isDemoMode()) {
    demoMessages.push({ ...messageObj, timestamp: messageObj.timestamp || Date.now() });
    return;
  }

  const { username } = getSessionUser();
  const isOutgoing = messageObj.sender === "me";

  const { error } = await supabase.from("messages").insert({
    sender_username: isOutgoing ? username : messageObj.sender,
    recipient_username: isOutgoing ? messageObj.to : username,
    text: messageObj.text || "",
    media_url: messageObj.mediaUrl || null,
    media_type: messageObj.mediaType || null,
  });

  if (error) console.error("Error saving message:", error);
}

export async function getMessages() {
  if (isDemoMode()) return [...demoMessages];

  const { username } = getSessionUser();
  if (!username) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_username.eq.${username},recipient_username.eq.${username}`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return data.map((msg) => ({
    sender: msg.sender_username === username ? "me" : msg.sender_username,
    to: msg.recipient_username === username ? msg.sender_username : msg.recipient_username,
    text: msg.text,
    mediaUrl: msg.media_url,
    mediaType: msg.media_type,
    timestamp: new Date(msg.created_at).getTime(),
  }));
}

/* ── Realtime + Polling ──────────────────────────────────────── */

export function subscribeToMessages(username, onNewMessage) {
  if (isDemoMode()) return () => {};

  let lastTimestamp = new Date().toISOString();
  let pollTimer = null;

  // Strategy 1: Supabase Realtime
  const channel = supabase
    .channel("bridge-messages-" + username)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        const msg = payload.new;
        if (msg.recipient_username !== username) return;
        if (msg.sender_username === username) return;

        onNewMessage({
          sender: msg.sender_username,
          to: msg.recipient_username,
          text: msg.text,
          mediaUrl: msg.media_url,
          mediaType: msg.media_type,
          timestamp: new Date(msg.created_at).getTime(),
        });

        lastTimestamp = msg.created_at;
      }
    )
    .subscribe((status) => {
      console.log("Realtime status:", status);
    });

  // Strategy 2: Polling fallback (every 3s)
  pollTimer = setInterval(async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("recipient_username", username)
        .gt("created_at", lastTimestamp)
        .neq("sender_username", username)
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) return;

      for (const msg of data) {
        onNewMessage({
          sender: msg.sender_username,
          to: msg.recipient_username,
          text: msg.text,
          mediaUrl: msg.media_url,
          mediaType: msg.media_type,
          timestamp: new Date(msg.created_at).getTime(),
        });
        lastTimestamp = msg.created_at;
      }
    } catch (e) {
      // Silent fail
    }
  }, 3000);

  return () => {
    supabase.removeChannel(channel);
    if (pollTimer) clearInterval(pollTimer);
  };
}

/* ── Session cleanup ─────────────────────────────────────────── */

export const clearSession = () => {
  sessionStorage.removeItem("bridge_demo_mode");
  sessionStorage.removeItem("bridge_user_id");
  sessionStorage.removeItem("bridge_username");
  sessionStorage.removeItem("bridge_user_profile");
  demoMessages = [];
  demoContacts = [];
};
