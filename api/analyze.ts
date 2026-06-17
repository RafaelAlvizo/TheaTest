import type { DraftState } from "../src/types";

type VercelRequest = {
  method?: string;
  body: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: unknown): void;
  };
};

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "OPENAI_API_KEY is not configured" });
  }

  try {
    const draft = req.body as DraftState;
    const report = await requestOpenAIAnalysis(process.env.OPENAI_API_KEY, draft);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Analysis failed",
    });
  }
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
