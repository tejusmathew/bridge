-- ═══════════════════════════════════════════════════════════════
-- Bridge Platform — Supabase Database Schema
-- 
-- HOW TO USE:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor → New Query
-- 4. Paste this ENTIRE file and click "Run"
-- ═══════════════════════════════════════════════════════════════

-- ── 1. USERS TABLE ──────────────────────────────────────────────
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  profile_type  TEXT NOT NULL DEFAULT 'general'
                  CHECK (profile_type IN ('general', 'deaf', 'blind', 'mute')),
  avatar_emoji  TEXT DEFAULT '👤',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 2. CONTACTS TABLE ───────────────────────────────────────────
CREATE TABLE contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_username  TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, contact_username)
);

-- ── 3. MESSAGES TABLE ───────────────────────────────────────────
CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username     TEXT NOT NULL,
  recipient_username  TEXT NOT NULL,
  text                TEXT DEFAULT '',
  media_url           TEXT,
  media_type          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 4. INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_messages_sender    ON messages(sender_username, created_at);
CREATE INDEX idx_messages_recipient ON messages(recipient_username, created_at);
CREATE INDEX idx_contacts_owner     ON contacts(owner_id);
CREATE INDEX idx_users_username     ON users(username);

-- ── 5. ROW LEVEL SECURITY ──────────────────────────────────────
-- RLS enabled with permissive policies (required for anon key access)
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on users"    ON users    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- ── 6. ENABLE REALTIME ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
