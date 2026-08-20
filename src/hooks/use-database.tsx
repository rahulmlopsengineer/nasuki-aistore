// Database bootstrap state machine + gate.
//
//   INITIALIZING -> READY | ERROR
//
// This wraps initDatabase() in try/catch so a local-DB failure (e.g. the web
// sql.js WASM failing to load) produces a controlled ERROR state with a Retry
// button instead of crashing the React tree into a blank screen.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Logo, Touchable } from "@/src/components/ui";
import { initDatabase, retryDatabaseInitialization } from "@/src/database";
import { useTheme } from "@/src/theme";

export type DatabaseStatus = "INITIALIZING" | "READY" | "ERROR";

type DatabaseContextValue = {
  status: DatabaseStatus;
  error: string | null;
  retry: () => void;
};

const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<DatabaseStatus>("INITIALIZING");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (isRetry: boolean) => {
    setStatus("INITIALIZING");
    setError(null);
    try {
      if (isRetry) {
        await retryDatabaseInitialization();
      } else {
        await initDatabase();
      }
      setStatus("READY");
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // Technical details in development only — never in production UI.
        console.warn("[database] initialization failed", e);
      }
      setError("Local database could not be initialized.");
      setStatus("ERROR");
    }
  }, []);

  useEffect(() => {
    run(false);
  }, [run]);

  const retry = useCallback(() => {
    run(true);
  }, [run]);

  return (
    <DatabaseContext.Provider value={{ status, error, retry }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseContextValue => {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error("useDatabase must be used within a DatabaseProvider");
  return ctx;
};

/**
 * Renders children only once the database is READY. Shows a branded loader
 * while INITIALIZING and a friendly, retryable error screen on ERROR.
 */
export const DatabaseGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { status, error, retry } = useDatabase();
  const { colors, spacing, typography, radius } = useTheme();

  if (status === "READY") return <>{children}</>;

  if (status === "ERROR") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Logo size={44} />
        <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xl }]}>
          Something went wrong
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.xl },
          ]}
        >
          {error ?? "Local database could not be initialized."}
        </Text>
        <Touchable
          testID="db-retry"
          onPress={retry}
          style={[
            styles.retryBtn,
            { backgroundColor: colors.accent, borderRadius: radius.md, marginTop: spacing.xl },
          ]}
          accessibilityLabel="Retry database initialization"
        >
          <Text style={[typography.bodyStrong, { color: "#FFFFFF" }]}>Retry</Text>
        </Touchable>
      </View>
    );
  }

  // INITIALIZING
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Logo size={44} />
      <ActivityIndicator
        color={colors.accent}
        style={{ marginTop: spacing.xl }}
        size="small"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  retryBtn: { paddingHorizontal: 32, paddingVertical: 14, minWidth: 160, alignItems: "center" },
});
