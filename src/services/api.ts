import type {
  AiServiceStatus,
  AiSuggestionRecord,
  AldenStoreData,
  CurriculumTemplate,
  LessonTemplate,
  MaterialItem,
  PostSessionLog,
  ReusableActivity,
  SessionPlan,
  StudentRoadmap,
  TutorFlowConnectionStatus,
  TutorFlowLearner,
  TutorFlowSession,
} from '../types/alden';

export interface BootstrapResponse {
  store: AldenStoreData;
  tutorFlowStatus: TutorFlowConnectionStatus;
  learners: TutorFlowLearner[];
  sessions: TutorFlowSession[];
  aiStatus: AiServiceStatus;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : `Yêu cầu thất bại (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  bootstrap: () => requestJson<BootstrapResponse>('/api/bootstrap'),

  // Lessons
  createLesson: (payload: Partial<LessonTemplate>) =>
    requestJson<LessonTemplate>('/api/lessons', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLesson: (id: string, payload: Partial<LessonTemplate>) =>
    requestJson<LessonTemplate>(`/api/lessons/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLesson: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/lessons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Activity Bank
  createActivity: (payload: Partial<ReusableActivity>) =>
    requestJson<ReusableActivity>('/api/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateActivity: (id: string, payload: Partial<ReusableActivity>) =>
    requestJson<ReusableActivity>(`/api/activities/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteActivity: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/activities/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Materials
  createMaterial: (
    payload: Partial<MaterialItem> & { fileBase64?: string; originalFileName?: string }
  ) =>
    requestJson<MaterialItem>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteMaterial: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/materials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Curriculum Templates
  createCurriculum: (payload: Partial<CurriculumTemplate>) =>
    requestJson<CurriculumTemplate>('/api/curricula', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCurriculum: (id: string, payload: Partial<CurriculumTemplate>) =>
    requestJson<CurriculumTemplate>(`/api/curricula/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCurriculum: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/curricula/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Student Roadmaps
  createRoadmap: (payload: StudentRoadmap) =>
    requestJson<StudentRoadmap>('/api/roadmaps', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRoadmap: (id: string, payload: Partial<StudentRoadmap>) =>
    requestJson<StudentRoadmap>(`/api/roadmaps/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteRoadmap: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/roadmaps/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Session Plans
  upsertSessionPlan: (sessionId: string, payload: Partial<SessionPlan>) =>
    requestJson<SessionPlan>(`/api/session-plans/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Post-Session Logs
  upsertPostSessionLog: (sessionId: string, payload: Partial<PostSessionLog>) =>
    requestJson<PostSessionLog>(`/api/post-session-logs/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Saved AI Suggestions
  saveAiSuggestion: (payload: Partial<AiSuggestionRecord>) =>
    requestJson<AiSuggestionRecord>('/api/ai-suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAiSuggestion: (id: string, payload: Partial<AiSuggestionRecord>) =>
    requestJson<AiSuggestionRecord>(`/api/ai-suggestions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAiSuggestion: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/ai-suggestions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Live Server-Side AI Endpoints
  aiEvaluate: (targetType: 'lesson' | 'curriculum', targetId: string) =>
    requestJson<{ result: Record<string, unknown>; model: string }>('/api/ai/evaluate', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    }),
  aiNextSession: (learnerId: string, extraContext?: string) =>
    requestJson<{ result: Record<string, unknown>; model: string }>('/api/ai/next-session', {
      method: 'POST',
      body: JSON.stringify({ learnerId, extraContext }),
    }),
  aiProgressSummary: (learnerId: string) =>
    requestJson<{ result: Record<string, unknown>; model: string }>('/api/ai/progress-summary', {
      method: 'POST',
      body: JSON.stringify({ learnerId }),
    }),
  aiGenerateLesson: (payload: {
    titleOrTopic: string;
    bookInfo?: string;
    targetAudience?: string;
    level?: string;
    objectives?: string;
    durationMinutes?: number;
    skills?: string[];
    languageMode?: string;
    notes?: string;
    materialId?: string;
  }) =>
    requestJson<{ result: Record<string, unknown>; model: string }>('/api/ai/generate-lesson', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  aiOrganizeNotes: (freeformNotes: string, activityOutcomesSummary: string) =>
    requestJson<{ result: Record<string, unknown>; model: string }>('/api/ai/organize-notes', {
      method: 'POST',
      body: JSON.stringify({ freeformNotes, activityOutcomesSummary }),
    }),
};
