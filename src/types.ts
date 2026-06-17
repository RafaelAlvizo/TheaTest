export type EditorialMode = "copyedit" | "continuity";

export type SourceFile = {
  id: string;
  name: string;
  type: "Manuscript" | "Series Bible" | "Timeline" | "Character Notes" | "Clue Tracker";
  status: "Ready" | "Queued";
};

export type DraftState = {
  projectTitle: string;
  book: string;
  chapter: string;
  previousChapter: string;
  mode: EditorialMode;
  chapterText: string;
  contextNotes: string;
  sources: SourceFile[];
};

export type ReportIssue = {
  id: string;
  title: string;
  severity: "Minor" | "Medium" | "Major";
  location: string;
  problem: string;
  why: string;
  source: string;
  fixOptions: string[];
  typeOfFix: "Line edit" | "Scene adjustment" | "Larger plot decision";
};

export type RepetitionIssue = {
  id: string;
  name: string;
  type: string;
  exact: string;
  first: string;
  second: string;
  why: string;
  suggestions: string[];
  recommendation: "Keep" | "Vary" | "Cut" | "Combine" | "Move" | "Delete first" | "Delete second";
};

export type AnalysisReport = {
  id: string;
  createdAt: string;
  mode: EditorialMode;
  summary: string[];
  issues: ReportIssue[];
  repetitions: RepetitionIssue[];
  topIssues: string[];
  continuityQuestions: string[];
  canonicalFacts: string[];
  correctedText?: string;
};
