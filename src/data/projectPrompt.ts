import { EditorialMode } from "../types";

export const modeCards: Record<
  EditorialMode,
  {
    label: string;
    eyebrow: string;
    checks: string[];
    output: string;
  }
> = {
  copyedit: {
    label: "Copyedit Mode",
    eyebrow: "Mechanical review",
    checks: [
      "Spelling, punctuation, grammar, syntax, typos",
      "Formatting and proper noun consistency",
      "Nearby repeated words that may be accidental",
    ],
    output: "Issue list first, corrected chapter after approval",
  },
  continuity: {
    label: "Continuity Diagnosis Mode",
    eyebrow: "Editorial diagnosis",
    checks: [
      "Timeline, setting, clue, object, and knowledge continuity",
      "Character, relationship, motivation, and scene logic",
      "Repeated gestures, phrases, incidents, and information",
    ],
    output: "Diagnostic flags, repetition patterns, questions, and canon notes",
  },
};

export const defaultSources = [
  {
    id: "source-1",
    name: "Books 1-2 manuscripts",
    type: "Manuscript" as const,
    status: "Queued" as const,
  },
  {
    id: "source-2",
    name: "Series bible",
    type: "Series Bible" as const,
    status: "Queued" as const,
  },
  {
    id: "source-3",
    name: "Book 3 chapter summaries",
    type: "Timeline" as const,
    status: "Queued" as const,
  },
  {
    id: "source-4",
    name: "Character and clue notes",
    type: "Clue Tracker" as const,
    status: "Queued" as const,
  },
];
