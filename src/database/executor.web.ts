// WEB SQL executor — sql.js (SQLite compiled to WASM) with persistence to
// AsyncStorage (IndexedDB on web). This exists so the web preview + testing
// agent can run the SAME parameterized SQL as native. On real devices the
// native expo-sqlite executor (executor.ts) is used instead.

import AsyncStorage from "@react-native-async-storage/async-storage";
import initSqlJs, { Database } from "sql.js";

import { RunResult, SqlExecutor, SqlValue } from "./executor-types";

const PERSIST_KEY = "nasuki.sqlite.web.v1";

// Resolve the WASM from the app's OWN origin (served from /public/sql-wasm.wasm).
// No external CDN dependency — works in preview, local dev, and deployed builds,
// and survives domain changes because it is computed from window.location.origin.
function locateWasm(file: string): string {
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "";
  return `${origin}/${file}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createExecutor(): Promise<SqlExecutor> {
  const SQL = await initSqlJs({ locateFile: (f: string) => locateWasm(f) });

  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(PERSIST_KEY);
  } catch {
    saved = null;
  }
  const db: Database = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(PERSIST_KEY, toBase64(db.export()));
      } catch (e) {
        console.warn("[db.web] persist failed", e);
      }
    }, 120);
  };

  const all = <T>(sql: string, params: SqlValue[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      if (params.length) stmt.bind(params as (string | number | null)[]);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    async execAsync(sql: string) {
      db.run(sql);
      persist();
    },
    async runAsync(sql: string, params: SqlValue[] = []): Promise<RunResult> {
      db.run(sql, params as (string | number | null)[]);
      const changes = db.getRowsModified();
      const row = all<{ id: number }>("SELECT last_insert_rowid() AS id");
      persist();
      return { changes, lastInsertRowId: row[0]?.id ?? 0 };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return all<T>(sql, params);
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      return all<T>(sql, params)[0] ?? null;
    },
    async withTransactionAsync(cb: () => Promise<void>) {
      db.run("BEGIN");
      try {
        await cb();
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      } finally {
        persist();
      }
    },
    async getUserVersion() {
      return all<{ user_version: number }>("PRAGMA user_version")[0]?.user_version ?? 0;
    },
    async setUserVersion(version: number) {
      db.run(`PRAGMA user_version = ${Math.trunc(version)}`);
      persist();
    },
  };
}
