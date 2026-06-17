import {
  Archive,
  BookOpenText,
  Check,
  Clipboard,
  Database,
  FileText,
  ListChecks,
  PanelRight,
  Play,
  RotateCcw,
  Save,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultSources, modeCards } from "./data/projectPrompt";
import { analyzeDraftWithAI } from "./lib/ai";
import { exportReport } from "./lib/analysis";
import { getActiveDraftId, loadDraft as loadDraftFromDb, saveDraft, saveReport } from "./lib/db";
import { AnalysisReport, DraftState, EditorialMode, SourceFile } from "./types";

const storageKey = "threadneedle-editorial-studio";

const initialDraft: DraftState = {
  projectTitle: "Threadneedle Street Mysteries",
  book: "Book 3, A Pattern of Lies",
  chapter: "Chapter 1",
  previousChapter: "Book 3, Chapter 0",
  mode: "continuity",
  chapterText: "",
  contextNotes: "",
  sources: defaultSources,
};

function App() {
  const draftId = useMemo(() => getActiveDraftId(), []);
  const [draft, setDraft] = useState<DraftState>(() => loadLocalDraft());
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [approved, setApproved] = useState(false);
  const [activePanel, setActivePanel] = useState<"flags" | "repetition" | "canon">("flags");
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [dbStatus, setDbStatus] = useState<"loading" | "connected" | "error">("loading");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const stats = useMemo(() => getStats(draft.chapterText), [draft.chapterText]);
  const selectedMode = modeCards[draft.mode];

  useEffect(() => {
    let cancelled = false;

    async function hydrateDraft() {
      try {
        const stored = await loadDraftFromDb(draftId);
        if (cancelled) return;

        if (stored) {
          setDraft({
            projectTitle: stored.projectTitle,
            book: stored.book,
            chapter: stored.chapter,
            previousChapter: stored.previousChapter,
            mode: stored.mode,
            chapterText: stored.chapterText,
            contextNotes: stored.contextNotes,
            sources: stored.sources,
          });
        }
        setDbStatus("connected");
      } catch {
        if (!cancelled) setDbStatus("error");
      }
    }

    hydrateDraft();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));

    const timer = window.setTimeout(async () => {
      try {
        await saveDraft(draft, draftId);
        setDbStatus("connected");
      } catch {
        setDbStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, draftId]);

  function updateDraft<T extends keyof DraftState>(key: T, value: DraftState[T]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSource(id: string, nextStatus: SourceFile["status"]) {
    setDraft((current) => ({
      ...current,
      sources: current.sources.map((source) => (source.id === id ? { ...source, status: nextStatus } : source)),
    }));
  }

  async function runAnalysis() {
    setIsAnalyzing(true);
    try {
      const nextReport = await analyzeDraftWithAI(draft);
      setReport(nextReport);
      setApproved(false);
      setActivePanel(draft.mode === "continuity" ? "flags" : "repetition");
      await saveReport(nextReport, draftId);
      setDbStatus("connected");
    } catch {
      setDbStatus("error");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(exportReport(report));
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus("Copy"), 1400);
  }

  function resetDraft() {
    setDraft(initialDraft);
    setReport(null);
    setApproved(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-icon">
            <BookOpenText size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Threadneedle</p>
            <h1>Editorial Studio</h1>
          </div>
        </div>

        <section className="sidebar-section">
          <div className="section-title">
            <Sparkles size={16} aria-hidden="true" />
            <span>Mode</span>
          </div>
          <div className="mode-stack" role="tablist" aria-label="Editorial modes">
            {(["continuity", "copyedit"] as EditorialMode[]).map((mode) => (
              <button
                className={`mode-card ${draft.mode === mode ? "selected" : ""}`}
                key={mode}
                type="button"
                onClick={() => {
                  updateDraft("mode", mode);
                  setReport(null);
                  setApproved(false);
                }}
                role="tab"
                aria-selected={draft.mode === mode}
              >
                <span>{modeCards[mode].eyebrow}</span>
                <strong>{modeCards[mode].label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="section-title">
            <Archive size={16} aria-hidden="true" />
            <span>Context</span>
          </div>
          <div className="source-list">
            {draft.sources.map((source) => (
              <div className="source-row" key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.type}</span>
                </div>
                <button
                  className={`status-pill ${source.status === "Ready" ? "ready" : ""}`}
                  type="button"
                  onClick={() => updateSource(source.id, source.status === "Ready" ? "Queued" : "Ready")}
                  title={`Mark ${source.name} ${source.status === "Ready" ? "queued" : "ready"}`}
                >
                  {source.status === "Ready" ? <Check size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                  <span>{source.status}</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="status-grid" aria-label="System status">
          <div>
            <Database size={16} aria-hidden="true" />
            <span>{dbStatus === "loading" ? "Syncing..." : dbStatus === "connected" ? "Firestore" : "Firestore offline"}</span>
          </div>
          <div>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{isAnalyzing ? "Analyzing..." : "OpenAI"}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div className="project-fields">
            <label>
              <span>Project</span>
              <input value={draft.projectTitle} onChange={(event) => updateDraft("projectTitle", event.target.value)} />
            </label>
            <label>
              <span>Book</span>
              <input value={draft.book} onChange={(event) => updateDraft("book", event.target.value)} />
            </label>
            <label>
              <span>Chapter</span>
              <input value={draft.chapter} onChange={(event) => updateDraft("chapter", event.target.value)} />
            </label>
            <label>
              <span>After</span>
              <input value={draft.previousChapter} onChange={(event) => updateDraft("previousChapter", event.target.value)} />
            </label>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" onClick={resetDraft} title="Reset draft">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <button className="ghost-button" type="button" title="Draft synced to Firestore">
              <Save size={18} aria-hidden="true" />
              {dbStatus === "loading" ? "Syncing" : dbStatus === "connected" ? "Saved" : "Local only"}
            </button>
            <button className="primary-button" type="button" onClick={runAnalysis} disabled={isAnalyzing}>
              <Play size={18} aria-hidden="true" />
              {isAnalyzing ? "Running..." : "Run"}
            </button>
          </div>
        </header>

        <section className="mode-brief" aria-label={`${selectedMode.label} checks`}>
          <div>
            <p>{selectedMode.eyebrow}</p>
            <h2>{selectedMode.label}</h2>
          </div>
          <ul>
            {selectedMode.checks.map((check) => (
              <li key={check}>
                <Check size={15} aria-hidden="true" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
          <div className="output-chip">
            <ListChecks size={16} aria-hidden="true" />
            <span>{selectedMode.output}</span>
          </div>
        </section>

        <div className="work-grid">
          <section className="editor-pane">
            <div className="pane-toolbar">
              <div className="section-title">
                <FileText size={16} aria-hidden="true" />
                <span>Chapter Text</span>
              </div>
              <div className="stats-row">
                <span>{stats.words} words</span>
                <span>{stats.characters} chars</span>
                <span>{stats.paragraphs} paragraphs</span>
              </div>
            </div>
            <textarea
              className="chapter-input"
              value={draft.chapterText}
              onChange={(event) => updateDraft("chapterText", event.target.value)}
              placeholder="Paste chapter text here..."
              spellCheck="true"
            />
            <div className="notes-strip">
              <label>
                <span>Context Notes</span>
                <input
                  value={draft.contextNotes}
                  onChange={(event) => updateDraft("contextNotes", event.target.value)}
                  placeholder="Placement notes, known facts, source caveats"
                />
              </label>
            </div>
          </section>

          <section className="report-pane">
            <div className="pane-toolbar">
              <div className="section-title">
                <PanelRight size={16} aria-hidden="true" />
                <span>Report</span>
              </div>
              <div className="report-actions">
                <button className="icon-button" type="button" onClick={copyReport} disabled={!report} title="Copy report">
                  <Clipboard size={18} aria-hidden="true" />
                  <span>{copyStatus}</span>
                </button>
              </div>
            </div>

            {report ? (
              <>
                <div className="report-summary">
                  {report.summary.map((item) => (
                    <div key={item}>
                      <SearchCheck size={17} aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="tabs" role="tablist" aria-label="Report sections">
                  {[
                    ["flags", "Flags", report.issues.length],
                    ["repetition", "Repetition", report.repetitions.length],
                    ["canon", "Canon", report.canonicalFacts.length],
                  ].map(([key, label, count]) => (
                    <button
                      key={key}
                      className={activePanel === key ? "active" : ""}
                      type="button"
                      onClick={() => setActivePanel(key as typeof activePanel)}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>

                <div className="report-scroll">
                  {activePanel === "flags" && (
                    <div className="issue-list">
                      {report.issues.length ? (
                        report.issues.map((issue, index) => (
                          <article className="issue-card" key={issue.id}>
                            <div className="issue-card-header">
                              <span>Flag {index + 1}</span>
                              <strong className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</strong>
                            </div>
                            <h3>{issue.title}</h3>
                            <p className="quote">{issue.location}</p>
                            <dl>
                              <dt>Problem</dt>
                              <dd>{issue.problem}</dd>
                              <dt>Source</dt>
                              <dd>{issue.source}</dd>
                              <dt>Fix Options</dt>
                              <dd>{issue.fixOptions.join(" | ")}</dd>
                            </dl>
                          </article>
                        ))
                      ) : (
                        <EmptyState label="No flags in this mock pass." />
                      )}
                    </div>
                  )}

                  {activePanel === "repetition" && (
                    <div className="issue-list">
                      {report.repetitions.length ? (
                        report.repetitions.map((rep, index) => (
                          <article className="issue-card" key={rep.id}>
                            <div className="issue-card-header">
                              <span>Repetition {index + 1}</span>
                              <strong>{rep.recommendation}</strong>
                            </div>
                            <h3>{rep.name}</h3>
                            <p className="quote">{rep.exact}</p>
                            <dl>
                              <dt>First</dt>
                              <dd>{rep.first}</dd>
                              <dt>Second</dt>
                              <dd>{rep.second}</dd>
                              <dt>Fixes</dt>
                              <dd>{rep.suggestions.join(" | ")}</dd>
                            </dl>
                          </article>
                        ))
                      ) : (
                        <EmptyState label="No repetition patterns in this mock pass." />
                      )}
                    </div>
                  )}

                  {activePanel === "canon" && (
                    <div className="canon-list">
                      <h3>Top 3 issues to fix first</h3>
                      {report.topIssues.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                      <h3>Possible continuity questions</h3>
                      {(report.continuityQuestions.length ? report.continuityQuestions : ["Not applicable for this mode."]).map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                      <h3>Canon or log candidates</h3>
                      {report.canonicalFacts.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  )}
                </div>

                {draft.mode === "copyedit" && report.correctedText && (
                  <div className="approval-box">
                    <button className="primary-button" type="button" onClick={() => setApproved(true)}>
                      <Check size={18} aria-hidden="true" />
                      Approve Corrections
                    </button>
                    {approved && <textarea readOnly value={report.correctedText} />}
                  </div>
                )}
              </>
            ) : (
              <EmptyState label="Run a review to generate the first report." />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <SearchCheck size={32} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function loadLocalDraft() {
  try {
    const cached = window.localStorage.getItem(storageKey);
    return cached ? ({ ...initialDraft, ...JSON.parse(cached) } as DraftState) : initialDraft;
  } catch {
    return initialDraft;
  }
}

function getStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
  return {
    words,
    paragraphs,
    characters: text.length,
  };
}

export default App;
