// Top-level React error boundary. Prevents any uncaught render error from
// producing a completely blank screen. In development it surfaces the error
// message; in production it stays generic (no stack traces / secrets).

import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[ErrorBoundary] caught", error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const isDev = typeof __DEV__ !== "undefined" && __DEV__;
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>NASUKI</Text>
        <Text style={styles.title}>Something went wrong.</Text>
        {isDev && this.state.message ? (
          <Text style={styles.message}>{this.state.message}</Text>
        ) : null}
        <Pressable onPress={this.handleRetry} style={styles.button} accessibilityLabel="Retry">
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  brand: { fontSize: 22, fontWeight: "700", color: "#0A0A0A", letterSpacing: 2 },
  title: { fontSize: 17, color: "#0A0A0A", marginTop: 16 },
  message: {
    fontSize: 13,
    color: "#9B9BA1",
    marginTop: 8,
    textAlign: "center",
    maxWidth: 320,
  },
  button: {
    marginTop: 24,
    backgroundColor: "#E24A4A",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
