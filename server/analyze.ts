import type { Connect } from "vite";
import type { DraftState } from "../src/types";

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function createAnalyzeHandler(apiKey: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }

      const draft = JSON.parse(Buffer.concat(chunks).toString("utf8")) as DraftState;
      const report = await requestOpenAIAnalysis(apiKey, draft);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(report));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Analysis failed",
        }),
      );
    }
  };
}

async function requestOpenAIAnalysis(apiKey: string, draft: DraftState) {
  const systemPrompt =
    draft.mode === "copyedit"
      ? "You are a copyeditor. Return JSON only with keys: summary (string[]), issues (array of {id,title,severity,location,problem,why,source,fixOptions,typeOfFix}), repetitions (array of {id,name,type,exact,first,second,why,suggestions,recommendation}), topIssues (string[]), continuityQuestions (string[]), canonicalFacts (string[]), correctedText (string)."
      : "You are a continuity editor for fiction. Return JSON only with keys: summary (string[]), issues (array of {id,title,severity,location,problem,why,source,fixOptions,typeOfFix}), repetitions (array of {id,name,type,exact,first,second,why,suggestions,recommendation}), topIssues (string[]), continuityQuestions (string[]), canonicalFacts (string[]).";

  const userPrompt = [
    `Project: ${draft.projectTitle}`,
    `Book: ${draft.book}`,
    `Chapter: ${draft.chapter}`,
    `Previous chapter: ${draft.previousChapter}`,
    `Context notes: ${draft.contextNotes || "None"}`,
    `Ready sources: ${draft.sources.filter((source) => source.status === "Ready").map((source) => source.name).join(", ") || "None"}`,
    "",
    "Chapter text:",
    draft.chapterText || "(empty)",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed: ${errorBody}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: draft.mode,
    summary: asStringArray(parsed.summary),
    issues: asArray(parsed.issues),
    repetitions: asArray(parsed.repetitions),
    topIssues: asStringArray(parsed.topIssues),
    continuityQuestions: asStringArray(parsed.continuityQuestions),
    canonicalFacts: asStringArray(parsed.canonicalFacts),
    correctedText: typeof parsed.correctedText === "string" ? parsed.correctedText : undefined,
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}
