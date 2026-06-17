import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { AnalysisReport, DraftState } from "../types";

const userIdKey = "threadneedle-user-id";

export type StoredDraft = DraftState & {
  id: string;
  updatedAt: string;
};

export type StoredReport = AnalysisReport & {
  draftId: string;
};

function getUserId() {
  let userId = window.localStorage.getItem(userIdKey);
  if (!userId) {
    userId = crypto.randomUUID();
    window.localStorage.setItem(userIdKey, userId);
  }
  return userId;
}

function userDraftRef(draftId: string) {
  return doc(db, "users", getUserId(), "drafts", draftId);
}

function userReportsCollection() {
  return collection(db, "users", getUserId(), "reports");
}

export async function saveDraft(draft: DraftState, draftId: string) {
  const payload: StoredDraft = {
    ...draft,
    id: draftId,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(
    userDraftRef(draftId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
}

export async function loadDraft(draftId: string): Promise<StoredDraft | null> {
  const snapshot = await getDoc(userDraftRef(draftId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const updatedAt =
    data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date().toISOString();

  return {
    id: draftId,
    projectTitle: data.projectTitle ?? "",
    book: data.book ?? "",
    chapter: data.chapter ?? "",
    previousChapter: data.previousChapter ?? "",
    mode: data.mode ?? "continuity",
    chapterText: data.chapterText ?? "",
    contextNotes: data.contextNotes ?? "",
    sources: data.sources ?? [],
    updatedAt,
  };
}

export async function saveReport(report: AnalysisReport, draftId: string) {
  const reportRef = doc(userReportsCollection(), report.id);
  const payload: StoredReport = {
    ...report,
    draftId,
  };

  await setDoc(reportRef, {
    ...payload,
    createdAt: report.createdAt,
    savedAt: serverTimestamp(),
  });

  return payload;
}

export async function listRecentReports(limitCount = 10): Promise<StoredReport[]> {
  const reportsQuery = query(userReportsCollection(), orderBy("createdAt", "desc"), limit(limitCount));
  const snapshot = await getDocs(reportsQuery);

  return snapshot.docs.map((entry) => {
    const data = entry.data() as StoredReport;
    return {
      ...data,
      id: entry.id,
    };
  });
}

export function getActiveDraftId() {
  const key = "threadneedle-active-draft-id";
  let draftId = window.localStorage.getItem(key);
  if (!draftId) {
    draftId = crypto.randomUUID();
    window.localStorage.setItem(key, draftId);
  }
  return draftId;
}
