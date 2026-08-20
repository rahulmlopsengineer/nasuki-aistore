// Versioned, idempotent migrations. The runner (client.ts) reads PRAGMA
// user_version and applies only migrations whose version is greater than the
// stored one, each inside a transaction. All DDL uses IF NOT EXISTS so a
// partially-applied or re-run migration never destroys data. There is NO
// destructive reset on startup.

export interface Migration {
  version: number;
  statements: string[];
}

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      // ---- users ----
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        remote_id TEXT,
        name TEXT NOT NULL,
        email TEXT,
        profile_image TEXT,
        auth_provider TEXT NOT NULL,
        is_demo_user INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_users_remote ON users(remote_id);`,

      // ---- conversations ----
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        model_id TEXT,
        mode TEXT NOT NULL DEFAULT 'offline',
        last_message TEXT NOT NULL DEFAULT '',
        message_count INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_user_order
        ON conversations(user_id, is_archived, is_pinned DESC, updated_at DESC);`,

      // ---- messages ----
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        model_id TEXT,
        token_count INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id, created_at);`,

      // ---- models (metadata only; no downloads in Phase 2) ----
      `CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT,
        size_mb INTEGER,
        min_ram_gb INTEGER,
        license TEXT,
        license_url TEXT,
        developer TEXT,
        price REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        download_url TEXT,
        checksum TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS installed_models (
        model_id TEXT PRIMARY KEY,
        local_path TEXT,
        installed_version TEXT,
        status TEXT NOT NULL DEFAULT 'not_installed',
        checksum TEXT,
        installed_at TEXT,
        updated_at TEXT NOT NULL
      );`,

      // ---- documents (RAG metadata prep; no extraction/embeddings in Phase 2) ----
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT,
        mime_type TEXT,
        file_size INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);`,
      `CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding_reference TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_chunks_document
        ON document_chunks(document_id, chunk_index);`,

      // ---- credits (local schema foundation only; server is authoritative) ----
      `CREATE TABLE IF NOT EXISTS credit_wallet (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        lifetime_earned INTEGER NOT NULL DEFAULT 0,
        lifetime_spent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        feature TEXT,
        reference_id TEXT,
        label TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_credit_tx_user
        ON credit_transactions(user_id, created_at DESC);`,
    ],
  },
];
