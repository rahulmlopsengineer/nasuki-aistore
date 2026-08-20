// NATIVE SQL executor — real on-device SQLite via expo-sqlite.
// (Metro serves executor.web.ts on web instead of this file.)

import * as SQLite from "expo-sqlite";

import { RunResult, SqlExecutor, SqlValue } from "./executor-types";

const DB_NAME = "nasuki.db";

export async function createExecutor(): Promise<SqlExecutor> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // WAL improves concurrent read/write; foreign_keys keeps referential intent.
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const bind = (params: SqlValue[]) => params;

  return {
    async execAsync(sql: string) {
      await db.execAsync(sql);
    },
    async runAsync(sql: string, params: SqlValue[] = []): Promise<RunResult> {
      const r = await db.runAsync(sql, bind(params));
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<T>(sql, bind(params));
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      return db.getFirstAsync<T>(sql, bind(params));
    },
    async withTransactionAsync(cb: () => Promise<void>) {
      await db.withTransactionAsync(cb);
    },
    async getUserVersion() {
      const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      return row?.user_version ?? 0;
    },
    async setUserVersion(version: number) {
      // PRAGMA cannot be parameterized; version is an integer we control.
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(version)}`);
    },
  };
}
