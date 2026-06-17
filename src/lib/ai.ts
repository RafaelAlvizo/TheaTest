import { analyzeDraft } from "./analysis";
import { AnalysisReport, DraftState } from "../types";

export async function analyzeDraftWithAI(draft: DraftState): Promise<AnalysisReport> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      throw new Error(`Analysis API failed (${response.status})`);
    }

    const report = (await response.json()) as AnalysisReport;
    return {
      ...report,
      id: report.id || crypto.randomUUID(),
      createdAt: report.createdAt || new Date().toISOString(),
      mode: draft.mode,
    };
  } catch {
    return analyzeDraft(draft);
  }
}
