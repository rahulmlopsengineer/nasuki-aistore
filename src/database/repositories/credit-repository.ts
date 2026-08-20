// Local credit wallet + transaction ledger. This is the LOCAL cache/schema
// foundation only — the server remains authoritative for real credits. No
// real purchases or ad rewards are implemented in Phase 2.

import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { CreditTransactionRow, CreditTxType, CreditWalletRow } from "../types";

export interface AddTransactionInput {
  userId: string;
  type: CreditTxType;
  amount: number; // +earned / -spent
  feature?: string | null;
  referenceId?: string | null;
  label?: string | null;
}

export const CreditRepository = {
  async getWallet(userId: string): Promise<CreditWalletRow | null> {
    return getExecutor().getFirstAsync<CreditWalletRow>(
      "SELECT * FROM credit_wallet WHERE user_id = ?",
      [userId],
    );
  },

  /** Create a wallet with a one-time BONUS if the user has none yet. */
  async ensureWallet(userId: string, startingBalance = 100): Promise<CreditWalletRow> {
    const existing = await this.getWallet(userId);
    if (existing) return existing;
    const db = getExecutor();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO credit_wallet (user_id, balance, lifetime_earned, lifetime_spent, updated_at)
         VALUES (?, ?, ?, 0, ?)`,
        [userId, startingBalance, startingBalance, now],
      );
      if (startingBalance > 0) {
        await db.runAsync(
          `INSERT INTO credit_transactions (id, user_id, type, amount, feature, reference_id, label, created_at)
           VALUES (?, ?, 'BONUS', ?, NULL, NULL, ?, ?)`,
          [uid("tx"), userId, startingBalance, "Welcome bonus", now],
        );
      }
    });
    const wallet = await this.getWallet(userId);
    if (!wallet) throw new Error("Failed to create wallet");
    return wallet;
  },

  async addTransaction(input: AddTransactionInput): Promise<void> {
    const db = getExecutor();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO credit_transactions
          (id, user_id, type, amount, feature, reference_id, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid("tx"), input.userId, input.type, input.amount, input.feature ?? null,
          input.referenceId ?? null, input.label ?? null, now,
        ],
      );
      const earned = input.amount > 0 ? input.amount : 0;
      const spent = input.amount < 0 ? -input.amount : 0;
      await db.runAsync(
        `UPDATE credit_wallet
           SET balance = balance + ?, lifetime_earned = lifetime_earned + ?,
               lifetime_spent = lifetime_spent + ?, updated_at = ?
         WHERE user_id = ?`,
        [input.amount, earned, spent, now, input.userId],
      );
    });
  },

  async listTransactions(
    userId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<CreditTransactionRow[]> {
    return getExecutor().getAllAsync<CreditTransactionRow>(
      `SELECT * FROM credit_transactions WHERE user_id = ?
        ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
      [userId, opts.limit ?? 50, opts.offset ?? 0],
    );
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM credit_transactions WHERE user_id = ?", [userId]);
      await db.runAsync("DELETE FROM credit_wallet WHERE user_id = ?", [userId]);
    });
  },
};
