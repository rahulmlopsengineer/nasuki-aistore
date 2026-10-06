import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  Header,
  ScreenContainer,
} from "@/src/components/ui";
import {
  LocalInference,
  ModelStatus,
  InferenceMetrics,
  LocalAIErrorCode,
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
} from "@/src/services/local-inference";
import { useTheme } from "@/src/theme";
import { formatSize } from "@/src/utils/format";

const TEST_PROMPT = "Explain gravity in one short sentence.";

export default function LocalAITestScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const modelDef = SUPPORTED_MODELS[DEFAULT_MODEL_ID];
  const [modelFilename, setModelFilename] = useState(modelDef.filename);

  const getPlatformModelPath = useCallback(() => {
    if (Platform.OS === "web") return modelFilename;
    // On Android, use the private models directory
    const { getModelDirectory } = require("@/src/services/local-inference-poc");
    return `${getModelDirectory()}${modelFilename}`;
  }, [modelFilename]);

  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [status, setStatus] = useState<ModelStatus>("IDLE");
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [output, setOutput] = useState<string>("");
  const [metrics, setMetrics] = useState<InferenceMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LocalAIErrorCode | null>(null);

  const checkFile = useCallback(async () => {
    setErrorMessage(null);
    setErrorCode(null);
    const result = await LocalInference.checkModelAvailable({
      modelId: modelDef.id,
      filename: getPlatformModelPath()
    });
    setFileExists(result.exists);
    setFileSizeBytes(result.sizeBytes || null);

    if (!result.exists && Platform.OS !== "web") {
      setErrorMessage(
        `Model file not found at local storage. To test, push the model file to your Android device using ADB.`
      );
    }
  }, [modelFilename, modelDef]);

  useEffect(() => {
    checkFile();
    setStatus(LocalInference.getStatus());
  }, [checkFile]);

  const handleLoadModel = useCallback(async () => {
    setErrorMessage(null);
    setErrorCode(null);
    setStatus("LOADING");
    setLoadProgress(0);

    const result = await LocalInference.loadModel({
      modelId: modelDef.id,
      filename: getPlatformModelPath(),
      onProgress: (p) => setLoadProgress(p)
    });

    if (result.success) {
      setStatus("READY");
    } else {
      setStatus("ERROR");
      setErrorMessage(result.error || "Unknown load error");
      setErrorCode("MODEL_LOAD_FAILED");
    }
  }, [modelFilename, modelDef]);

  const handleRunInference = useCallback(async () => {
    setErrorMessage(null);
    setErrorCode(null);
    setOutput("");
    setStatus("GENERATING");

    const result = await LocalInference.generate(TEST_PROMPT, {
      onToken: (token) => setOutput((prev) => prev + token)
    });

    if (result.error) {
      setStatus("ERROR");
      setErrorMessage(result.error);
      setErrorCode(result.errorCode || "GENERATION_ERROR");
    } else {
      setStatus("READY");
      setOutput(result.text);
      setMetrics(result.metrics);
    }
  }, []);

  const handleReleaseModel = useCallback(async () => {
    await LocalInference.unloadModel();
    setStatus("IDLE");
    setOutput("");
    setMetrics(null);
    setErrorMessage(null);
    setErrorCode(null);
  }, []);

  const isWeb = Platform.OS === "web";

  return (
    <ScreenContainer testID="local-ai-test-screen">
      <Header title="Local AI Test (POC)" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        {/* Environment banner */}
        {isWeb ? (
          <Card style={{ backgroundColor: "#FFF4E5", borderColor: "#FFE2B8" }}>
            <View style={styles.rowAlign}>
              <Ionicons name="warning" size={24} color="#D97706" />
              <View style={styles.flex}>
                <Text style={[typography.bodyStrong, { color: "#92400E" }]}>
                  Web Development Fallback
                </Text>
                <Text style={[typography.caption, { color: "#B45309", marginTop: 2 }]}>
                  Local Gemma inference requires the native Android development build. No cloud API is called.
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              TARGET ARCHITECTURE
            </Text>
            <Text style={[typography.bodyStrong, { color: colors.text, marginTop: 4 }]}>
              Gemma 2 2B IT (Q4_K_M) · llama.rn (llama.cpp)
            </Text>
            <View style={[styles.rowWrap, { marginTop: spacing.sm }]}>
              <Badge label="arm64-v8a" tone="info" />
              <Badge label="New Architecture" tone="success" />
              <Badge label="Zero Cloud" tone="neutral" />
            </View>
          </Card>
        )}

        {/* Model File Location & Status */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[typography.h3, { color: colors.text }]}>Model File</Text>
            <Badge
              label={
                fileExists === null
                  ? "Checking..."
                  : fileExists
                  ? "Found on Device"
                  : "Not Found"
              }
              tone={fileExists ? "success" : "danger"}
            />
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            File: {modelFilename}
            {fileSizeBytes ? ` (${formatSize(Math.round(fileSizeBytes / (1024 * 1024)))})` : ""}
          </Text>
          <View style={[styles.pathBox, { backgroundColor: colors.cardBorder }]}>
            <TextInput
              value={modelFilename}
              onChangeText={setModelFilename}
              placeholder="Model file path..."
              placeholderTextColor={colors.textTertiary}
              style={[typography.caption, { color: colors.text, paddingVertical: 4 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={[styles.rowWrap, { marginTop: spacing.md }]}>
            <Button
              label="Re-check File"
              variant="outline"
              size="sm"
              icon="refresh"
              onPress={checkFile}
            />
          </View>
        </Card>

        {/* Runtime State & Controls */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[typography.h3, { color: colors.text }]}>Native Context</Text>
            <Badge
              label={status}
              tone={
                status === "READY"
                  ? "success"
                  : ["GENERATING", "LOADING", "WARMING_UP", "DOWNLOADING", "VERIFYING"].includes(status)
                  ? "accent"
                  : status === "ERROR" || status === "FAILED"
                  ? "danger"
                  : "neutral"
              }
            />
          </View>
          {["LOADING", "DOWNLOADING", "WARMING_UP"].includes(status) && (
            <View style={[styles.rowAlign, { marginTop: spacing.md }]}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={[typography.body, { color: colors.textSecondary, marginLeft: spacing.md }]}>
                {status === "DOWNLOADING" ? "Downloading model weights..." : "Initializing native engine..."} {loadProgress > 0 ? `${Math.round(loadProgress * 100)}%` : ""}
              </Text>
            </View>
          )}
          <View style={[styles.controlsGrid, { marginTop: spacing.lg }]}>
            <Button
              label="1. Load Model"
              variant="solid"
              icon="hardware-chip-outline"
              disabled={["LOADING", "GENERATING", "DOWNLOADING", "WARMING_UP"].includes(status)}
              onPress={handleLoadModel}
            />
            <Button
              label="2. Run Inference"
              variant="solid"
              icon="play-outline"
              disabled={status !== "READY"}
              onPress={handleRunInference}
            />
            <Button
              label="3. Release Model"
              variant="outline"
              icon="trash-outline"
              disabled={status === "IDLE" || status === "LOADING"}
              onPress={handleReleaseModel}
            />
          </View>
        </Card>

        {/* Error Banner */}
        {errorMessage && (
          <Card style={{ backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }}>
            <View style={styles.rowAlign}>
              <Ionicons name="alert-circle" size={24} color="#DC2626" />
              <View style={styles.flex}>
                <Text style={[typography.bodyStrong, { color: "#991B1B" }]}>
                  {errorCode || "ERROR"}
                </Text>
                <Text style={[typography.caption, { color: "#B91C1C", marginTop: 4 }]}>
                  {errorMessage}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Inference Output Box */}
        <Card>
          <Text style={[typography.label, { color: colors.textSecondary }]}>TEST PROMPT</Text>
          <Text style={[typography.bodyStrong, { color: colors.text, marginTop: 4 }]}>
            {`"${TEST_PROMPT}"`}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <Text style={[typography.label, { color: colors.textSecondary }]}>
            REAL MODEL RESPONSE
          </Text>
          <View style={[styles.outputBox, { backgroundColor: colors.background, borderRadius: radius.md }]}>
            {output ? (
              <Text style={[typography.body, { color: colors.text }]}>{output}</Text>
            ) : (
              <Text style={[typography.body, { color: colors.textTertiary, fontStyle: "italic" }]}>
                {status === "GENERATING"
                  ? "Generating response from Gemma..."
                  : "Response will appear here after running inference."}
              </Text>
            )}
          </View>
        </Card>

        {/* Performance Metrics */}
        {metrics && (
          <Card>
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
              Inference Timings
            </Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Load Time</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {metrics.loadTimeMs ? `${metrics.loadTimeMs} ms` : "—"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>First Token</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {metrics.firstTokenLatencyMs ? `${metrics.firstTokenLatencyMs} ms` : "—"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Gen Time</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {metrics.generationTimeMs ? `${metrics.generationTimeMs} ms` : "—"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Tokens</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {metrics.tokenCount ?? "—"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Speed</Text>
                <Text style={[typography.bodyStrong, { color: colors.accent }]}>
                  {metrics.tokensPerSec ? `${metrics.tokensPerSec} t/s` : "—"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Tokens</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {metrics.tokenCount ?? 200}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowAlign: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pathBox: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlsGrid: { gap: 10 },
  divider: { height: 1, marginVertical: 12 },
  outputBox: {
    marginTop: 8,
    padding: 14,
    minHeight: 80,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricItem: {
    width: "30%",
    flexGrow: 1,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
  },
});