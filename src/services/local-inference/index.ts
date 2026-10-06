import { Platform } from "react-native";
import { LocalInferenceEngine } from "./types";

let engine: LocalInferenceEngine;

if (Platform.OS === "android" || Platform.OS === "ios") {
  // @ts-ignore - Platform specific files
  engine = require("./engine.android").engine;
} else {
  // @ts-ignore - Platform specific files
  engine = require("./engine.web").engine;
}

export * from "./types";
export { engine };
