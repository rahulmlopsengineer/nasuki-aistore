// Database-level enums + raw row shapes (snake_case, as stored in SQLite).

export type AuthProvider = "google" | "demo";
export type ConversationMode = "offline" | "online" | "rag" | "private";
export type DbMessageRole = "user" | "assistant" | "system";
export type DbMessageStatus = "pending" | "generating" | "completed" | "failed";
export type DbDocumentStatus = "pending" | "processing" | "ready" | "failed";
export type ModelStatus = "available" | "coming_soon" | "deprecated";
export type InstalledModelStatus =
  | "not_installed"
  | "downloading"
  | "installed"
  | "error";

export type CreditTxType =
  | "BONUS"
  | "PURCHASE"
  | "AD_REWARD"
  | "CHAT_USAGE"
  | "RAG_USAGE"
  | "IMAGE_USAGE"
  | "VIDEO_USAGE"
  | "REFUND"
  | "ADMIN_ADJUSTMENT";

export interface UserRow {
  id: string;
  remote_id: string | null;
  name: string;
  email: string | null;
  profile_image: string | null;
  auth_provider: string;
  is_demo_user: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model_id: string | null;
  mode: string;
  last_message: string;
  message_count: number;
  is_pinned: number;
  is_archived: number;
  is_private: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  status: string;
  model_id: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreditWalletRow {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
}

export interface CreditTransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  feature: string | null;
  reference_id: string | null;
  label: string | null;
  created_at: string;
}
