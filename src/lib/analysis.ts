import { AnalysisReport, DraftState, RepetitionIssue, ReportIssue } from "../types";

const stopWords = new Set([
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "into",
  "were",
  "have",
  "for",
  "her",
  "his",
  "she",
  "him",
  "you",
  "but",
  "not",
  "all",
  "had",
  "was",
  "they",
  "then",
  "there",
]);

const gestureWords = ["looked", "glanced", "nodded", "turned", "smiled", "sighed", "paused"];

export function analyzeDraft(draft: DraftState): AnalysisReport {
  const words = tokenize(draft.chapterText);
  const repetitions = findRepetitions(draft.chapterText, words);
  const issues =
    draft.mode === "copyedit"
      ? buildCopyeditIssues(draft.chapterText, repetitions)
      : buildContinuityIssues(draft, repetitions);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: draft.mode,
    summary:
      draft.mode === "copyedit"
        ? buildCopyeditSummary(draft.chapterText, issues, repetitions)
        : buildContinuitySummary(draft, issues, repetitions),
    issues,
    repetitions,
    topIssues: buildTopIssues(issues, repetitions),
    continuityQuestions:
      draft.mode === "continuity"
        ? [
            "Does this chapter introduce any new facts about Grace or Daniel that should override earlier notes?",
            "Are all cited source files current for Book 3 placement?",
            "Should repeated emotional beats be escalated, combined, or saved for a later scene?",
          ]
        : [],
    canonicalFacts:
      draft.mode === "continuity"
        ? extractCanonicalFacts(draft.chapterText)
        : ["Copyedit mode does not add canon unless a proper noun spelling is confirmed."],
    correctedText: draft.mode === "copyedit" ? mechanicallyCorrect(draft.chapterText) : undefined,
  };
}

export function exportReport(report: AnalysisReport): string {
  const lines = [
    report.mode === "copyedit" ? "Copyedit Mode Report" : "Continuity Diagnosis Mode Report",
    `Generated: ${new Date(report.createdAt).toLocaleString()}`,
    "",
    "Quick List",
    ...report.summary.map((item) => `- ${item}`),
    "",
  ];

  if (report.issues.length) {
    lines.push("Flags", "");
    report.issues.forEach((issue, index) => {
      lines.push(
        `Flag ${index + 1}`,
        `Severity: ${issue.severity}`,
        `Location in submitted chapter: ${issue.location}`,
        `Problem: ${issue.problem}`,
        `Why it may be a continuity issue: ${issue.why}`,
        `Conflicting source or earlier fact: ${issue.source}`,
        "Suggested fix:",
        `Fix option 1: ${issue.fixOptions[0]}`,
        `Fix option 2: ${issue.fixOptions[1]}`,
        `Fix option 3: ${issue.fixOptions[2]}`,
        `Type of fix: ${issue.typeOfFix}`,
        "",
      );
    });
  }

  if (report.repetitions.length) {
    lines.push("Repetition Patterns", "");
    report.repetitions.forEach((rep, index) => {
      lines.push(
        `Repetition ${index + 1}: ${rep.name}`,
        `Type of repetition: ${rep.type}`,
        `Exact repetition: ${rep.exact}`,
        "Where it appears:",
        `First appearance: ${rep.first}`,
        `Second appearance: ${rep.second}`,
        `Why it stands out: ${rep.why}`,
        "Suggested fixes:",
        ...rep.suggestions.map((suggestion) => `- ${suggestion}`),
        `Recommendation: ${rep.recommendation}`,
        "",
      );
    });
  }

  lines.push(
    "Top 3 Issues To Fix First",
    ...report.topIssues.map((item) => `- ${item}`),
    "",
    "Possible Continuity Questions",
    ...(report.continuityQuestions.length ? report.continuityQuestions : ["- Not applicable for this mode."]).map(
      (item) => (item.startsWith("-") ? item : `- ${item}`),
    ),
    "",
    "New Canonical Facts",
    ...report.canonicalFacts.map((item) => `- ${item}`),
  );

  return lines.join("\n");
}

function tokenize(text: string) {
  return Array.from(text.matchAll(/\b[A-Za-z][A-Za-z'-]*\b/g)).map((match) => ({
    word: match[0],
    lower: match[0].toLowerCase(),
    index: match.index ?? 0,
  }));
}

function findRepetitions(text: string, words: ReturnType<typeof tokenize>): RepetitionIssue[] {
  const reps: RepetitionIssue[] = [];
  const adjacent = Array.from(text.matchAll(/\b([A-Za-z][A-Za-z'-]*)\s+\1\b/gi));

  adjacent.slice(0, 4).forEach((match, index) => {
    reps.push({
      id: `adjacent-${index}`,
      name: `Repeated word "${match[1]}"`,
      type: "repeated word",
      exact: match[0],
      first: excerptAt(text, match.index ?? 0),
      second: excerptAt(text, (match.index ?? 0) + match[1].length),
      why: "The same word appears back-to-back, which usually reads as an accidental duplicate.",
      suggestions: [
        `Delete one instance of "${match[1]}".`,
        `Keep both only if the repetition is intentional dialogue or voice.`,
        "Read the sentence aloud after deletion to confirm the rhythm still holds.",
      ],
      recommendation: "Delete second",
    });
  });

  const seen = new Map<string, number>();
  words.forEach((entry, index) => {
    if (entry.lower.length < 4 || stopWords.has(entry.lower)) return;
    const previous = seen.get(entry.lower);
    if (previous !== undefined && index - previous <= 10 && !reps.some((rep) => rep.exact.includes(entry.word))) {
      reps.push({
        id: `nearby-${entry.lower}-${index}`,
        name: `Nearby echo "${entry.word}"`,
        type: "accidental echo",
        exact: entry.word,
        first: excerptAt(text, words[previous].index),
        second: excerptAt(text, entry.index),
        why: "The word repeats within a tight span and may draw attention unless it is intentional.",
        suggestions: [
          `Vary one use of "${entry.word}" with a more specific synonym.`,
          "Cut one instance if the sentence repeats the same information.",
          "Move one sentence if the echo is useful but too clustered.",
        ],
        recommendation: "Vary",
      });
    }
    seen.set(entry.lower, index);
  });

  const sentences = splitSentences(text);
  const starts = new Map<string, number>();
  sentences.forEach((sentence, index) => {
    const start = sentence.match(/^\W*([A-Za-z]+(?:\s+[A-Za-z]+)?)/)?.[1]?.toLowerCase();
    if (!start || start.length < 5) return;
    const previous = starts.get(start);
    if (previous !== undefined && index - previous <= 3) {
      reps.push({
        id: `structure-${start}-${index}`,
        name: `Repeated opening "${start}"`,
        type: "repeated structure",
        exact: start,
        first: sentences[previous],
        second: sentence,
        why: "Nearby sentences begin the same way, which can look like a drafting echo.",
        suggestions: [
          "Change one sentence opening.",
          "Combine the sentences if they deliver the same beat.",
          "Keep if the repeated opening is deliberate emphasis.",
        ],
        recommendation: "Vary",
      });
    }
    starts.set(start, index);
  });

  return reps.slice(0, 8);
}

function buildCopyeditIssues(text: string, repetitions: RepetitionIssue[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  const doubleSpaces = Array.from(text.matchAll(/[^\n] {2,}[^\n]/g));
  doubleSpaces.slice(0, 3).forEach((match, index) => {
    issues.push({
      id: `spaces-${index}`,
      title: "Extra interior spacing",
      severity: "Minor",
      location: excerptAt(text, match.index ?? 0),
      problem: "Multiple spaces appear inside a line.",
      why: "This is a mechanical formatting issue.",
      source: "No direct contradiction; copyedit-only mechanical issue.",
      fixOptions: [
        "Replace the extra spaces with a single space.",
        "Leave spacing only if it marks a deliberate formatting break.",
        "Check neighboring lines for the same formatting pattern.",
      ],
      typeOfFix: "Line edit",
    });
  });

  const punctuationSpacing = Array.from(text.matchAll(/\s+[,.!?;]/g));
  punctuationSpacing.slice(0, 3).forEach((match, index) => {
    issues.push({
      id: `punctuation-${index}`,
      title: "Space before punctuation",
      severity: "Minor",
      location: excerptAt(text, match.index ?? 0),
      problem: "A space appears before punctuation.",
      why: "Standard manuscript formatting closes the space before punctuation.",
      source: "No direct contradiction; copyedit-only mechanical issue.",
      fixOptions: [
        "Remove the space before the punctuation mark.",
        "Check whether the same punctuation spacing repeats nearby.",
        "Leave spacing only if it comes from intentional special formatting.",
      ],
      typeOfFix: "Line edit",
    });
  });

  repetitions.forEach((rep) => {
    issues.push({
      id: `copy-${rep.id}`,
      title: rep.name,
      severity: "Minor",
      location: rep.first,
      problem: "Possible mechanical repetition.",
      why: rep.why,
      source: "No direct contradiction; repeated-word copyedit concern.",
      fixOptions: rep.suggestions,
      typeOfFix: "Line edit",
    });
  });

  return issues.slice(0, 12);
}

function buildContinuityIssues(draft: DraftState, repetitions: RepetitionIssue[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  const readySources = draft.sources.filter((source) => source.status === "Ready").length;

  if (readySources === 0) {
    issues.push({
      id: "source-context",
      title: "Context sources not connected",
      severity: "Major",
      location: "Whole chapter",
      problem: "Continuity checks need prior manuscripts, bible, timelines, and clue notes before contradictions can be confirmed.",
      why: "Without source context, the app can flag scene logic and repetition but cannot verify Book 1-2 or earlier Book 3 facts.",
      source: "not found in provided context.",
      fixOptions: [
        "Attach the series bible and earlier chapter summaries before final diagnosis.",
        "Run this draft as a provisional pass and mark all continuity contradictions as possible issues.",
        "Add a short context note listing known facts for this chapter placement.",
      ],
      typeOfFix: "Larger plot decision",
    });
  }

  const timelineMarkers = draft.chapterText.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|morning|afternoon|evening|night|yesterday|tomorrow|hours?|minutes?)\b/gi);
  if (timelineMarkers && timelineMarkers.length >= 4) {
    issues.push({
      id: "timeline-density",
      title: "Timeline markers need verification",
      severity: "Medium",
      location: timelineMarkers.slice(0, 6).join(", "),
      problem: "Several time references appear in the chapter and should be checked against placement.",
      why: "Dense time language can create elapsed-time or sequence conflicts when compared with earlier chapters.",
      source: draft.previousChapter
        ? `Previous chapter field: ${draft.previousChapter}`
        : "No direct contradiction; this is a missing transition / unclear continuity beat / scene logic concern.",
      fixOptions: [
        "Compare the time references against the previous chapter ending.",
        "Clarify the elapsed time at the first transition.",
        "Remove one redundant time cue if it repeats information already established.",
      ],
      typeOfFix: "Scene adjustment",
    });
  }

  gestureWords.forEach((gesture) => {
    const matches = draft.chapterText.match(new RegExp(`\\b${gesture}\\b`, "gi"));
    if (matches && matches.length >= 4) {
      issues.push({
        id: `gesture-${gesture}`,
        title: `Repeated gesture "${gesture}"`,
        severity: "Minor",
        location: matches.slice(0, 4).join(", "),
        problem: "The same physical beat appears several times.",
        why: "Repeated gestures can blur emotional progression if they do not escalate or reveal new information.",
        source: "No direct contradiction; this is a repetition concern.",
        fixOptions: [
          `Vary one or two instances of "${gesture}".`,
          "Cut the least meaningful beat.",
          "Replace one gesture with a more specific reaction tied to the scene turn.",
        ],
        typeOfFix: "Line edit",
      });
    }
  });

  repetitions.forEach((rep) => {
    issues.push({
      id: `continuity-${rep.id}`,
      title: `Possible accidental echo repetition: ${rep.name}`,
      severity: "Minor",
      location: rep.first,
      problem: "Close repetition may distract from the diagnostic read.",
      why: rep.why,
      source: "No direct contradiction; this is a repetition concern.",
      fixOptions: rep.suggestions,
      typeOfFix: "Line edit",
    });
  });

  return issues.slice(0, 14);
}

function buildCopyeditSummary(text: string, issues: ReportIssue[], repetitions: RepetitionIssue[]) {
  if (!text.trim()) return ["No chapter text has been entered."];
  const summary = [
    `${issues.length} mechanical issue${issues.length === 1 ? "" : "s"} detected in the mock pass.`,
    `${repetitions.length} nearby repetition pattern${repetitions.length === 1 ? "" : "s"} found.`,
  ];
  if (!issues.length) summary.push("No obvious spacing, punctuation-spacing, or repeated-word issue found.");
  return summary;
}

function buildContinuitySummary(draft: DraftState, issues: ReportIssue[], repetitions: RepetitionIssue[]) {
  if (!draft.chapterText.trim()) return ["No chapter text has been entered."];
  return [
    `${issues.length} provisional diagnostic flag${issues.length === 1 ? "" : "s"} generated.`,
    `${repetitions.length} repetition pattern${repetitions.length === 1 ? "" : "s"} found.`,
    `${draft.sources.filter((source) => source.status === "Ready").length} context source${draft.sources.filter((source) => source.status === "Ready").length === 1 ? "" : "s"} marked ready.`,
  ];
}

function buildTopIssues(issues: ReportIssue[], repetitions: RepetitionIssue[]) {
  const top = issues.slice(0, 3).map((issue) => issue.title);
  while (top.length < 3) {
    top.push(repetitions[top.length]?.name ?? "No additional issue found in the mock pass.");
  }
  return top.slice(0, 3);
}

function mechanicallyCorrect(text: string) {
  return text
    .replace(/\b([A-Za-z][A-Za-z'-]*)\s+\1\b/gi, "$1")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1");
}

function extractCanonicalFacts(text: string) {
  const properNounPhrases = Array.from(text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g))
    .map((match) => match[1])
    .filter((phrase) => !["The", "Chapter", "Book"].includes(phrase));

  return Array.from(new Set(properNounPhrases)).slice(0, 6).map((phrase) => `Possible canon entry: ${phrase}`);
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function excerptAt(text: string, index: number) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + 120);
  return text.slice(start, end).replace(/\s+/g, " ").trim() || "Whole chapter";
}
