// Database bootstrap: creates the platform executor and runs migrations once.
// Safe to call multiple times — initialization is memoized.

import { createExecutor } from "./executor";
import { SqlExecutor } from "./executor-types";
import { MIGRATIONS } from "./schema";

let _executor: SqlExecutor | null = null;
let _initPromise: Promise<SqlExecutor> | null = null;

async function runMigrations(exec: SqlExecutor): Promise<void> {
  const current = await exec.getUserVersion();
  console.log("[NASUKI][DB] Current user_version:", current);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );
  console.log("[NASUKI][DB] Pending migrations:", pending.length);
  for (const migration of pending) {
    console.log("[NASUKI][DB] Running migration version:", migration.version);
    await exec.withTransactionAsync(async () => {
      for (const stmt of migration.statements) {
        try {
          await exec.execAsync(stmt);
        } catch (err: any) {
          // Gracefully ignore duplicate column errors if column already exists
          if (!err?.message?.includes("duplicate column")) {
            throw err;
          }
        }
      }
    });
    // Persist the version only after the migration transaction has committed.
    await exec.setUserVersion(migration.version);
    console.log("[NASUKI][DB] Migration version committed:", migration.version);
  }
}

/** Initialize the local database (idempotent). Resolves to the executor. */
export async function initDatabase(): Promise<SqlExecutor> {
  if (_executor) return _executor;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    console.log("[NASUKI][DB] Initializing database executor...");
    const exec = await createExecutor();
    await runMigrations(exec);
    _executor = exec;
    console.log("[NASUKI][DB] Database initialized successfully.");
    return exec;
  })();

  try {
    return await _initPromise;
  } catch (e) {
    console.error("[NASUKI][DB] Database initialization failed:", e);
    _initPromise = null; // allow a retry on the next call
    throw e;
  }
}

/** Get the initialized executor. Throws if initDatabase() has not completed. */
export function getExecutor(): SqlExecutor {
  if (!_executor) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return _executor;
}

export function isDatabaseReady(): boolean {
  return _executor !== null;
}

/**
 * Reset init state and try again. Used by the DB error UI's Retry button.
 * Because initialization is memoized via a single promise, this never creates
 * multiple concurrent SQLite instances.
 */
export async function retryDatabaseInitialization(): Promise<SqlExecutor> {
  _executor = null;
  _initPromise = null;
  return initDatabase();
}
