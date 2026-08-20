// FeedbackService + BugReportService — mock submissions (no backend in Phase 1).

import {
  BugReportPayload,
  FeedbackPayload,
  SubmitResult,
} from "@/src/types";
import { delay, uid } from "@/src/utils/misc";

export const FeedbackService = {
  async submit(payload: FeedbackPayload): Promise<SubmitResult> {
    await delay(900);
    if (!payload.message.trim()) {
      throw new Error("Message is required");
    }
    return { ok: true, reference: uid("fb").toUpperCase() };
  },
};

export const BugReportService = {
  async submit(payload: BugReportPayload): Promise<SubmitResult> {
    await delay(900);
    if (!payload.description.trim()) {
      throw new Error("Description is required");
    }
    return { ok: true, reference: uid("bug").toUpperCase() };
  },
};
