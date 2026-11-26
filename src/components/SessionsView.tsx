import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ActivityExecutionStatus,
  ActivityOutcome,
  AiServiceStatus,
  AldenStoreData,
  ComprehensionLevel,
  LessonActivity,
  PostSessionLog,
  SessionPlan,
  TutorFlowSession,
} from '../types/alden';
import {
  createSessionPlanFromLesson,
  generateId,
  getTotalActivityMinutes,
} from '../lib/domainLogic';
import {
  ACTIVITY_OUTCOME_META,
  ACTIVITY_STAGES,
  COMPREHENSION_META,
  formatDateShortVi,
  formatDateTimeVi,
  TUTORFLOW_SESSION_STATUS_META,
} from '../utils/formatters';
import { api } from '../services/api';

interface SessionsViewProps {
  store: AldenStoreData;
  sessions: TutorFlowSession[];
  aiStatus: AiServiceStatus | null;
  initialSessionId?: string | null;
  initialTab?: 'plan' | 'post';
  onSaveSessionPlan: (sessionId: string, plan: Partial<SessionPlan>) => Promise<void>;
  onSavePostSessionLog: (sessionId: string, log: Partial<PostSessionLog>) => Promise<void>;
  onSaveAiSuggestion: (payload: {
    type: 'next_session';
    title: string;
    learnerId: string;
    sessionId: string;
    content: Record<string, unknown>;
    modelUsed: string;
  }) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

type SessionFilter = 'all' | 'scheduled' | 'completed' | 'needs_log';

export function SessionsView({
  store,
  sessions,
  aiStatus,
  initialSessionId,
  initialTab = 'plan',
  onSaveSessionPlan,
  onSavePostSessionLog,
  onSaveAiSuggestion,
  onNotify,
}: SessionsViewProps) {
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId || sessions[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'plan' | 'post'>(initialTab);

  // Plan editor state
  const [selectedLessonToAttach, setSelectedLessonToAttach] = useState<string>(
    store.lessonTemplates[0]?.id || ''
  );
  const [planDraft, setPlanDraft] = useState<Partial<SessionPlan> | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Post-session log state
  const [logDraft, setLogDraft] = useState<Partial<PostSessionLog> | null>(null);
  const [savingLog, setSavingLog] = useState(false);
  const [organizingNotes, setOrganizingNotes] = useState(false);

  // AI Next-Session Draft state (Draft-only until teacher confirms)
  const [aiNextDraft, setAiNextDraft] = useState<{
    result: Record<string, unknown>;
    model: string;
  } | null>(null);
  const [loadingAiNext, setLoadingAiNext] = useState(false);
  const [aiNextError, setAiNextError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
      setActiveTab(initialTab);
    }
  }, [initialSessionId, initialTab]);

  const planBySessionId = useMemo(
    () => new Map(store.sessionPlans.map((p) => [p.tutorFlowSessionId, p])),
    [store.sessionPlans]
  );

  const logBySessionId = useMemo(
    () => new Map(store.postSessionLogs.map((l) => [l.tutorFlowSessionId, l])),
    [store.postSessionLogs]
  );

  const filteredSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .filter((s) => {
        if (filter === 'scheduled') return s.tutorFlowStatus === 'scheduled';
        if (filter === 'completed') return s.tutorFlowStatus === 'completed';
        if (filter === 'needs_log')
          return s.tutorFlowStatus === 'completed' && !logBySessionId.has(s.id);
        return true;
      });
  }, [sessions, filter, logBySessionId]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || filteredSessions[0] || null,
    [sessions, filteredSessions, selectedSessionId]
  );

  // Load current plan and post-session log whenever activeSession changes
  React.useEffect(() => {
    if (!activeSession) {
      setPlanDraft(null);
      setLogDraft(null);
      return;
    }
    const existingPlan = planBySessionId.get(activeSession.id);
    setPlanDraft(existingPlan ? structuredClone(existingPlan) : null);

    const existingLog = logBySessionId.get(activeSession.id);
    if (existingLog) {
      setLogDraft(structuredClone(existingLog));
    } else {
      const outcomes: ActivityOutcome[] = (existingPlan?.activities || []).map((a) => ({
        activityId: a.id,
        activityTitle: a.title || 'Hoạt động',
        status: 'completed',
        actualMinutes: a.durationMinutes,
        note: '',
      }));
      setLogDraft({
        tutorFlowSessionId: activeSession.id,
        sessionPlanId: existingPlan?.id,
        learnerId: activeSession.learnerId,
        activityOutcomes: outcomes,
        taughtSummary: '',
        actualDurationMinutes: activeSession.durationMinutes,
        missingContent: '',
        comprehensionLevel: 'not_rated',
        strengths: '',
        weaknesses: '',
        commonErrors: '',
        homeworkAssigned: existingPlan?.homeworkPlan || '',
        homeworkResult: '',
        freeformNotes: '',
      });
    }
    setAiNextDraft(null);
    setAiNextError(null);
  }, [activeSession?.id, planBySessionId, logBySessionId]);

  const learnerRoadmap = useMemo(
    () =>
      activeSession
        ? store.studentRoadmaps.find((r) => r.learnerId === activeSession.learnerId) || null
        : null,
    [store.studentRoadmaps, activeSession]
  );

  const relatedPastSessions = useMemo(() => {
    if (!activeSession) return [];
    return sessions
      .filter(
        (s) =>
          s.learnerId === activeSession.learnerId &&
          s.id !== activeSession.id &&
          new Date(s.startTime).getTime() < new Date(activeSession.startTime).getTime()
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 3);
  }, [sessions, activeSession]);

  const nextUpcomingSessionForLearner = useMemo(() => {
    if (!activeSession) return null;
    return (
      sessions
        .filter(
          (s) =>
            s.learnerId === activeSession.learnerId &&
            s.id !== activeSession.id &&
            s.tutorFlowStatus === 'scheduled' &&
            new Date(s.startTime).getTime() >= new Date(activeSession.startTime).getTime()
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ||
      null
    );
  }, [sessions, activeSession]);

  const handleAttachLessonTemplate = (lessonId: string, roadmapItemId?: string) => {
    if (!activeSession) return;
    const lesson = store.lessonTemplates.find((l) => l.id === lessonId);
    if (!lesson) return;
    const cloned = createSessionPlanFromLesson(
      lesson,
      activeSession,
      learnerRoadmap?.id,
      roadmapItemId
    );
    setPlanDraft(cloned);
  };

  const handleCreateCustomPlan = () => {
    if (!activeSession) return;
    setPlanDraft({
      tutorFlowSessionId: activeSession.id,
      learnerId: activeSession.learnerId,
      roadmapId: learnerRoadmap?.id,
      title: `Kế hoạch bài dạy — ${activeSession.learnerName}`,
      objectives: '',
      preparationNotes: '',
      materialIds: [],
      activities: [
        {
          id: generateId('sact'),
          title: 'Khởi động & Ôn bài cũ',
          stage: 'Warm-up',
          durationMinutes: 10,
          objective: '',
          teacherInstructions: '',
          studentTask: '',
          guidingQuestions: '',
          answerKey: '',
        },
      ],
      homeworkPlan: '',
      teacherNotes: '',
    });
  };

  const handleSavePlan = async () => {
    if (!activeSession || !planDraft) return;
    if (!planDraft.title?.trim()) {
      onNotify('error', 'Vui lòng nhập tiêu đề kế hoạch bài dạy.');
      return;
    }
    setSavingPlan(true);
    try {
      await onSaveSessionPlan(activeSession.id, {
        ...planDraft,
        learnerId: activeSession.learnerId,
      });
    } finally {
      setSavingPlan(false);
    }
  };

  const updateOutcomeStatus = (idx: number, status: ActivityExecutionStatus) => {
    if (!logDraft) return;
    const list = [...(logDraft.activityOutcomes || [])];
    list[idx] = { ...list[idx], status };
    setLogDraft({ ...logDraft, activityOutcomes: list });
  };

  const handleSaveLog = async () => {
    if (!activeSession || !logDraft) return;
    setSavingLog(true);
    try {
      await onSavePostSessionLog(activeSession.id, {
        ...logDraft,
        learnerId: activeSession.learnerId,
        sessionPlanId: planDraft?.id,
      });
    } finally {
      setSavingLog(false);
    }
  };

  const handleOrganizeNotes = async () => {
    if (!logDraft?.freeformNotes?.trim()) {
      onNotify('error', 'Hãy viết ghi chú tự do trước khi nhờ AI sắp xếp.');
      return;
    }
    setOrganizingNotes(true);
    try {
      const summary = (logDraft.activityOutcomes || [])
        .map((o) => `${o.activityTitle}: ${ACTIVITY_OUTCOME_META[o.status].label}`)
        .join('\n');
      const { result } = await api.aiOrganizeNotes(logDraft.freeformNotes, summary);
      setLogDraft({
        ...logDraft,
        taughtSummary: (result.taughtSummary as string) || logDraft.taughtSummary,
        missingContent: (result.missingContent as string) || logDraft.missingContent,
        strengths: (result.strengths as string) || logDraft.strengths,
        weaknesses: (result.weaknesses as string) || logDraft.weaknesses,
        commonErrors: (result.commonErrors as string) || logDraft.commonErrors,
        homeworkAssigned: (result.homeworkAssigned as string) || logDraft.homeworkAssigned,
        organizedNotesByAi: (result.organizedSummaryText as string) || '',
      });
      onNotify('success', 'AI đã sắp xếp lại ghi chú (bản nháp). Hãy kiểm tra rồi nhấn Lưu.');
    } catch (err) {
      onNotify('error', (err as Error).message);
    } finally {
      setOrganizingNotes(false);
    }
  };

  const handleRequestNextSessionAi = async () => {
    if (!activeSession) return;
    setLoadingAiNext(true);
    setAiNextError(null);
    try {
      const unfinishedSummary = (logDraft?.activityOutcomes || [])
        .filter((o) => o.status !== 'completed')
        .map((o) => `${o.activityTitle} (${ACTIVITY_OUTCOME_META[o.status].label})${o.note ? `: ${o.note}` : ''}`)
        .join('; ');
      const extraContext = unfinishedSummary
        ? `Hoạt động chưa hoàn thành ở buổi vừa chọn: ${unfinishedSummary}. Ghi chú thêm: ${logDraft?.missingContent || ''}`
        : logDraft?.freeformNotes || undefined;

      const data = await api.aiNextSession(activeSession.learnerId, extraContext);
      setAiNextDraft(data);
    } catch (err) {
      setAiNextError((err as Error).message);
    } finally {
      setLoadingAiNext(false);
    }
  };

  const handleSaveNextDraftToArchive = async () => {
    if (!activeSession || !aiNextDraft) return;
    await onSaveAiSuggestion({
      type: 'next_session',
      title: `Đề xuất buổi tiếp theo cho ${activeSession.learnerName} (sau buổi ${formatDateShortVi(
        activeSession.startTime
      )})`,
      learnerId: activeSession.learnerId,
      sessionId: activeSession.id,
      content: aiNextDraft.result,
      modelUsed: aiNextDraft.model,
    });
  };

  const handleApplyDraftToUpcomingSession = async () => {
    if (!nextUpcomingSessionForLearner || !aiNextDraft) return;
    const res = aiNextDraft.result;
    const rawActs = Array.isArray(res.suggestedActivities)
      ? (res.suggestedActivities as {
          title?: string;
          stage?: string;
          durationMinutes?: number;
          notes?: string;
        }[])
      : [];
    const objectives = Array.isArray(res.nextObjectives)
      ? (res.nextObjectives as string[]).join(' ')
      : '';
    const prep = Array.isArray(res.prepMaterials)
      ? (res.prepMaterials as string[]).join('; ')
      : '';

    const newActivities: LessonActivity[] = rawActs.map((a) => ({
      id: generateId('sact'),
      title: a.title || 'Hoạt động đề xuất',
      stage: a.stage || 'Practice',
      durationMinutes: Number(a.durationMinutes) || 15,
      objective: a.notes || '',
      teacherInstructions: a.notes || '',
      studentTask: '',
      guidingQuestions: '',
      answerKey: '',
    }));

    await onSaveSessionPlan(nextUpcomingSessionForLearner.id, {
      learnerId: nextUpcomingSessionForLearner.learnerId,
      roadmapId: learnerRoadmap?.id,
      title: `Kế hoạch tiếp nối (đã duyệt từ đề xuất AI) — ${nextUpcomingSessionForLearner.learnerName}`,
      objectives,
      preparationNotes: prep,
      materialIds: [],
      activities: newActivities,
      homeworkPlan: '',
      teacherNotes: typeof res.reason === 'string' ? res.reason : '',
    });
    setSelectedSessionId(nextUpcomingSessionForLearner.id);
    setActiveTab('plan');
    setAiNextDraft(null);
  };

  const unfinishedOutcomes = (logDraft?.activityOutcomes || []).filter(
    (o) => o.status === 'partial' || o.status === 'not_done'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Buổi học, Kế hoạch bài dạy &amp; Cập nhật sau buổi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Lịch và trạng thái buổi học đọc chỉ đọc từ TutorFlow (mẫu). Kế hoạch bài dạy chỉnh sửa độc lập không ảnh hưởng giáo án gốc.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg self-start">
          {(
            [
              ['all', 'Tất cả'],
              ['scheduled', 'Sắp tới'],
              ['completed', 'Đã hoàn thành'],
              ['needs_log', 'Chờ cập nhật'],
            ] as [SessionFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                filter === val
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 cols: Read-only TutorFlow Sessions List */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Danh sách buổi học ({filteredSessions.length})
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
              <Lock className="h-3 w-3" />
              <span>TutorFlow mẫu</span>
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
            {filteredSessions.map((sess) => {
              const hasPlan = planBySessionId.has(sess.id);
              const hasLog = logBySessionId.has(sess.id);
              const isSelected = activeSession?.id === sess.id;
              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => setSelectedSessionId(sess.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer space-y-1 ${
                    isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {sess.learnerName}
                    </span>
                    <span
                      className={`text-[11px] whitespace-nowrap shrink-0 ${
                        TUTORFLOW_SESSION_STATUS_META[sess.tutorFlowStatus].textClass
                      }`}
                    >
                      {TUTORFLOW_SESSION_STATUS_META[sess.tutorFlowStatus].label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatDateTimeVi(sess.startTime)} · {sess.durationMinutes} phút
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={hasPlan ? 'text-emerald-700' : 'text-amber-700'}>
                      {hasPlan ? 'Đã có kế hoạch' : 'Chưa có kế hoạch'}
                    </span>
                    {sess.tutorFlowStatus === 'completed' && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className={hasLog ? 'text-emerald-700' : 'text-rose-700 font-medium'}>
                          {hasLog ? 'Đã cập nhật tiến độ' : 'Chưa cập nhật tiến độ'}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right 8 cols: Session Detail Workspace */}
        <div className="lg:col-span-8 space-y-5">
          {!activeSession ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
              Chọn một buổi học để chuẩn bị kế hoạch bài dạy hoặc cập nhật kết quả sau buổi học.
            </div>
          ) : (
            <>
              {/* Read-Only Session Metadata Header */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        Dữ liệu buổi học từ TutorFlow (Chỉ đọc · ID: {activeSession.id})
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {activeSession.learnerName}
                    </h2>
                    <p className="text-xs text-slate-600 tabular-nums mt-0.5">
                      {formatDateTimeVi(activeSession.startTime)} · {activeSession.durationMinutes} phút ·{' '}
                      {activeSession.meetingFormat === 'online' ? 'Online' : 'Trực tiếp'} · Trạng thái TutorFlow:{' '}
                      <span
                        className={
                          TUTORFLOW_SESSION_STATUS_META[activeSession.tutorFlowStatus].textClass
                        }
                      >
                        {TUTORFLOW_SESSION_STATUS_META[activeSession.tutorFlowStatus].label}
                      </span>
                    </p>
                    {activeSession.tutorFlowNote && (
                      <p className="text-xs text-slate-500 mt-1">
                        Ghi chú TutorFlow: {activeSession.tutorFlowNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2-Tab Switcher: Plan vs Post-Session */}
                <div
                  role="tablist"
                  aria-label="Chế độ buổi học"
                  className="pt-2 border-t border-slate-100 flex items-center gap-2"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'plan'}
                    onClick={() => setActiveTab('plan')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeTab === 'plan'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Kế hoạch bài dạy</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'post'}
                    onClick={() => setActiveTab('post')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeTab === 'post'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <ClipboardEdit className="h-3.5 w-3.5" />
                    <span>Cập nhật sau buổi học</span>
                  </button>
                </div>
              </section>

              {/* ========================================================= */}
              {/* TAB A: SESSION LESSON PLAN */}
              {/* ========================================================= */}
              {activeTab === 'plan' && (
                <div className="space-y-5">
                  {/* Attach / Switch Lesson Bar */}
                  <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1">
                        <label
                          htmlFor="attach-lesson-select"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Gắn giáo án mẫu vào buổi học này (tạo bản sao riêng, không sửa bản mẫu gốc)
                        </label>
                        <select
                          id="attach-lesson-select"
                          value={selectedLessonToAttach}
                          onChange={(e) => setSelectedLessonToAttach(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        >
                          {store.lessonTemplates.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.title} ({l.durationMinutes} phút)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAttachLessonTemplate(selectedLessonToAttach)}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Áp dụng giáo án
                        </button>
                        {!planDraft && (
                          <button
                            type="button"
                            onClick={handleCreateCustomPlan}
                            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
                          >
                            Tạo kế hoạch trống
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick pick from Learner's Roadmap */}
                    {learnerRoadmap && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-xs font-semibold text-slate-600">
                          Hoặc chọn nhanh bài từ lộ trình riêng ({learnerRoadmap.title}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {learnerRoadmap.stages
                            .flatMap((st) => st.items)
                            .filter((it) => it.lessonTemplateId)
                            .map((it) => (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() =>
                                  handleAttachLessonTemplate(it.lessonTemplateId!, it.id)
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs text-slate-700 cursor-pointer"
                              >
                                {it.customTitle}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Session Plan Editor */}
                  {planDraft ? (
                    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">
                          Nội dung kế hoạch riêng cho buổi học
                        </h3>
                        <button
                          type="button"
                          disabled={savingPlan}
                          onClick={handleSavePlan}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>{savingPlan ? 'Đang lưu...' : 'Lưu kế hoạch buổi học'}</span>
                        </button>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <label htmlFor="sp-title" className="block text-xs font-semibold text-slate-600 mb-1">
                            Tiêu đề kế hoạch buổi
                          </label>
                          <input
                            id="sp-title"
                            type="text"
                            value={planDraft.title || ''}
                            onChange={(e) => setPlanDraft({ ...planDraft, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="sp-obj" className="block text-xs font-semibold text-slate-600 mb-1">
                              Mục tiêu buổi học
                            </label>
                            <textarea
                              id="sp-obj"
                              rows={2}
                              value={planDraft.objectives || ''}
                              onChange={(e) =>
                                setPlanDraft({ ...planDraft, objectives: e.target.value })
                              }
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                            />
                          </div>
                          <div>
                            <label htmlFor="sp-prep" className="block text-xs font-semibold text-slate-600 mb-1">
                              Chuẩn bị trước buổi
                            </label>
                            <textarea
                              id="sp-prep"
                              rows={2}
                              value={planDraft.preparationNotes || ''}
                              onChange={(e) =>
                                setPlanDraft({ ...planDraft, preparationNotes: e.target.value })
                              }
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                            />
                          </div>
                        </div>

                        {/* Activities Sequence */}
                        <div className="space-y-2.5 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 tabular-nums">
                              Chuỗi hoạt động (Tổng {getTotalActivityMinutes(planDraft.activities || [])} /{' '}
                              {activeSession.durationMinutes} phút)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPlanDraft({
                                  ...planDraft,
                                  activities: [
                                    ...(planDraft.activities || []),
                                    {
                                      id: generateId('sact'),
                                      title: 'Hoạt động mới',
                                      stage: 'Practice',
                                      durationMinutes: 10,
                                      objective: '',
                                      teacherInstructions: '',
                                      studentTask: '',
                                      guidingQuestions: '',
                                      answerKey: '',
                                    },
                                  ],
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Thêm hoạt động</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(planDraft.activities || []).map((act, idx) => (
                              <div
                                key={act.id}
                                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-slate-500">{idx + 1}.</span>
                                  <input
                                    type="text"
                                    value={act.title}
                                    onChange={(e) => {
                                      const list = structuredClone(planDraft.activities || []);
                                      list[idx].title = e.target.value;
                                      setPlanDraft({ ...planDraft, activities: list });
                                    }}
                                    className="flex-1 min-w-[180px] px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded"
                                  />
                                  <select
                                    value={act.stage}
                                    onChange={(e) => {
                                      const list = structuredClone(planDraft.activities || []);
                                      list[idx].stage = e.target.value;
                                      setPlanDraft({ ...planDraft, activities: list });
                                    }}
                                    className="px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                                  >
                                    {ACTIVITY_STAGES.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min={1}
                                    value={act.durationMinutes}
                                    onChange={(e) => {
                                      const list = structuredClone(planDraft.activities || []);
                                      list[idx].durationMinutes = Number(e.target.value);
                                      setPlanDraft({ ...planDraft, activities: list });
                                    }}
                                    className="w-16 px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const list = (planDraft.activities || []).filter(
                                        (_, i) => i !== idx
                                      );
                                      setPlanDraft({ ...planDraft, activities: list });
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                    aria-label="Xóa hoạt động khỏi buổi học"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={act.teacherInstructions}
                                  onChange={(e) => {
                                    const list = structuredClone(planDraft.activities || []);
                                    list[idx].teacherInstructions = e.target.value;
                                    setPlanDraft({ ...planDraft, activities: list });
                                  }}
                                  placeholder="Ghi chú hướng dẫn nhanh cho hoạt động này..."
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded text-slate-600"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label htmlFor="sp-hw" className="block text-xs font-semibold text-slate-600 mb-1">
                              Bài tập về nhà dự kiến
                            </label>
                            <input
                              id="sp-hw"
                              type="text"
                              value={planDraft.homeworkPlan || ''}
                              onChange={(e) =>
                                setPlanDraft({ ...planDraft, homeworkPlan: e.target.value })
                              }
                              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                            />
                          </div>
                          <div>
                            <label htmlFor="sp-notes" className="block text-xs font-semibold text-slate-600 mb-1">
                              Ghi chú giảng dạy riêng cho buổi này
                            </label>
                            <input
                              id="sp-notes"
                              type="text"
                              value={planDraft.teacherNotes || ''}
                              onChange={(e) =>
                                setPlanDraft({ ...planDraft, teacherNotes: e.target.value })
                              }
                              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                      Buổi học này chưa có kế hoạch bài dạy. Hãy chọn một giáo án ở trên và nhấn{' '}
                      <strong>Áp dụng giáo án</strong> để bắt đầu chuẩn bị bài.
                    </div>
                  )}

                  {/* Related Past Sessions History */}
                  {relatedPastSessions.length > 0 && (
                    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Lịch sử các buổi trước của {activeSession.learnerName}
                      </h3>
                      <div className="divide-y divide-slate-100">
                        {relatedPastSessions.map((ps) => {
                          const pLog = logBySessionId.get(ps.id);
                          const pPlan = planBySessionId.get(ps.id);
                          return (
                            <div key={ps.id} className="py-3 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900">
                                  {formatDateShortVi(ps.startTime)} · {pPlan?.title || 'Chưa gắn giáo án'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSessionId(ps.id);
                                    setActiveTab('post');
                                  }}
                                  className="text-blue-700 hover:underline font-medium"
                                >
                                  Xem chi tiết
                                </button>
                              </div>
                              {pLog ? (
                                <p className="text-slate-600">
                                  {pLog.taughtSummary}{' '}
                                  {pLog.missingContent && (
                                    <span className="text-amber-700 font-medium">
                                      · Còn thiếu: {pLog.missingContent}
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-slate-400">Chưa có ghi nhận sau buổi học.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB B: FAST POST-SESSION UPDATE & AI NEXT-SESSION DRAFT */}
              {/* ========================================================= */}
              {activeTab === 'post' && logDraft && (
                <div className="space-y-5">
                  <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Cập nhật tiến độ sau buổi học
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Chạm nhanh trạng thái từng hoạt động, ghi nhận ngắn gọn và lưu lại.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingLog}
                        onClick={handleSaveLog}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{savingLog ? 'Đang lưu...' : 'Lưu cập nhật buổi học'}</span>
                      </button>
                    </div>

                    {/* Fast Activity Outcome Toggles */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          1. Trạng thái từng hoạt động / nhiệm vụ
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLogDraft({
                              ...logDraft,
                              activityOutcomes: [
                                ...(logDraft.activityOutcomes || []),
                                {
                                  activityId: generateId('out'),
                                  activityTitle: 'Nội dung dạy bổ sung',
                                  status: 'completed',
                                  note: '',
                                },
                              ],
                            })
                          }
                          className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                        >
                          + Thêm mục kiểm tra
                        </button>
                      </div>

                      {(logDraft.activityOutcomes || []).length === 0 ? (
                        <p className="text-xs text-slate-500 p-3 rounded-lg bg-slate-50 border border-slate-200">
                          Buổi học này chưa có danh sách hoạt động từ kế hoạch bài dạy. Bạn có thể gắn giáo án ở tab
                          &ldquo;Kế hoạch bài dạy&rdquo; hoặc nhấn &ldquo;+ Thêm mục kiểm tra&rdquo;.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {(logDraft.activityOutcomes || []).map((outcome, idx) => (
                            <div
                              key={outcome.activityId}
                              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={outcome.activityTitle}
                                  onChange={(e) => {
                                    const list = [...(logDraft.activityOutcomes || [])];
                                    list[idx] = { ...list[idx], activityTitle: e.target.value };
                                    setLogDraft({ ...logDraft, activityOutcomes: list });
                                  }}
                                  aria-label={`Tên hoạt động ${idx + 1}`}
                                  className="text-sm font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1"
                                />

                                {/* Fast 3-state Segmented Control */}
                                <div
                                  role="group"
                                  aria-label={`Trạng thái hoàn thành cho ${outcome.activityTitle}`}
                                  className="inline-flex p-0.5 bg-slate-200/80 rounded-lg shrink-0"
                                >
                                  {(
                                    [
                                      ['completed', 'Hoàn thành'],
                                      ['partial', 'Một phần'],
                                      ['not_done', 'Chưa làm'],
                                    ] as [ActivityExecutionStatus, string][]
                                  ).map(([st, label]) => {
                                    const active = outcome.status === st;
                                    let activeCls = 'bg-white text-slate-900 shadow-sm';
                                    if (active && st === 'completed')
                                      activeCls = 'bg-emerald-600 text-white shadow-sm';
                                    if (active && st === 'partial')
                                      activeCls = 'bg-amber-600 text-white shadow-sm';
                                    if (active && st === 'not_done')
                                      activeCls = 'bg-rose-600 text-white shadow-sm';
                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => updateOutcomeStatus(idx, st)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                          active
                                            ? activeCls
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <input
                                type="text"
                                value={outcome.note || ''}
                                onChange={(e) => {
                                  const list = [...(logDraft.activityOutcomes || [])];
                                  list[idx] = { ...list[idx], note: e.target.value };
                                  setLogDraft({ ...logDraft, activityOutcomes: list });
                                }}
                                placeholder="Ghi chú nhanh (VD: Hết giờ, cần ôn lại phát âm...)"
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <hr className="border-slate-200" />

                    {/* Free-form Notes + AI Organize Helper */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="post-freeform"
                          className="text-xs font-bold uppercase tracking-wider text-slate-500"
                        >
                          2. Ghi chú tự do nhanh (AI có thể sắp xếp lại giúp bạn)
                        </label>
                        <button
                          type="button"
                          disabled={organizingNotes || !logDraft.freeformNotes?.trim()}
                          onClick={handleOrganizeNotes}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-xs font-medium text-blue-800 disabled:opacity-50 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>
                            {organizingNotes ? 'AI đang sắp xếp...' : 'AI sắp xếp ghi chú'}
                          </span>
                        </button>
                      </div>
                      <textarea
                        id="post-freeform"
                        rows={3}
                        value={logDraft.freeformNotes || ''}
                        onChange={(e) =>
                          setLogDraft({ ...logDraft, freeformNotes: e.target.value })
                        }
                        placeholder="Viết nhanh bất kỳ ý nào sau buổi dạy (VD: Hôm nay Minh Anh nói phần warm-up rất tốt, nhưng phần role-play chưa kịp xong, vẫn hay quên đuôi -ed ở worked...)"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>

                    {/* Structured Reflection Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <label htmlFor="post-summary" className="block font-semibold text-slate-600 mb-1">
                          Tóm tắt phần đã dạy
                        </label>
                        <textarea
                          id="post-summary"
                          rows={2}
                          value={logDraft.taughtSummary || ''}
                          onChange={(e) =>
                            setLogDraft({ ...logDraft, taughtSummary: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-missing" className="block font-semibold text-slate-600 mb-1">
                          Nội dung còn thiếu / cần nối tiếp
                        </label>
                        <textarea
                          id="post-missing"
                          rows={2}
                          value={logDraft.missingContent || ''}
                          onChange={(e) =>
                            setLogDraft({ ...logDraft, missingContent: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-duration" className="block font-semibold text-slate-600 mb-1">
                          Thời lượng thực tế (phút)
                        </label>
                        <input
                          id="post-duration"
                          type="number"
                          min={5}
                          value={logDraft.actualDurationMinutes ?? activeSession.durationMinutes}
                          onChange={(e) =>
                            setLogDraft({
                              ...logDraft,
                              actualDurationMinutes: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-comp" className="block font-semibold text-slate-600 mb-1">
                          Mức độ tiếp thu
                        </label>
                        <select
                          id="post-comp"
                          value={logDraft.comprehensionLevel || 'not_rated'}
                          onChange={(e) =>
                            setLogDraft({
                              ...logDraft,
                              comprehensionLevel: e.target.value as ComprehensionLevel,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                        >
                          {Object.entries(COMPREHENSION_META).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="post-strengths" className="block font-semibold text-slate-600 mb-1">
                          Điểm mạnh ghi nhận
                        </label>
                        <textarea
                          id="post-strengths"
                          rows={2}
                          value={logDraft.strengths || ''}
                          onChange={(e) => setLogDraft({ ...logDraft, strengths: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-weaknesses" className="block font-semibold text-slate-600 mb-1">
                          Điểm yếu &amp; Lỗi thường gặp
                        </label>
                        <textarea
                          id="post-weaknesses"
                          rows={2}
                          value={logDraft.weaknesses || ''}
                          onChange={(e) => setLogDraft({ ...logDraft, weaknesses: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-errors" className="block font-semibold text-slate-600 mb-1">
                          Ví dụ lỗi cụ thể của học viên
                        </label>
                        <input
                          id="post-errors"
                          type="text"
                          value={logDraft.commonErrors || ''}
                          onChange={(e) =>
                            setLogDraft({ ...logDraft, commonErrors: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label htmlFor="post-hw" className="block font-semibold text-slate-600 mb-1">
                          Bài tập về nhà đã giao &amp; Kết quả
                        </label>
                        <input
                          id="post-hw"
                          type="text"
                          value={logDraft.homeworkAssigned || ''}
                          onChange={(e) =>
                            setLogDraft({ ...logDraft, homeworkAssigned: e.target.value })
                          }
                          placeholder="Bài đã giao..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-1.5"
                        />
                        <input
                          type="text"
                          aria-label="Kết quả bài tập về nhà"
                          value={logDraft.homeworkResult || ''}
                          onChange={(e) =>
                            setLogDraft({ ...logDraft, homeworkResult: e.target.value })
                          }
                          placeholder="Kết quả nộp bài (nếu có)..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </section>

                  {/* AI Follow-up Proposal Panel for Unfinished / Partial Tasks */}
                  <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          AI đề xuất kế hoạch cho buổi học tiếp theo (Bản nháp)
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {unfinishedOutcomes.length > 0
                            ? `Đang có ${unfinishedOutcomes.length} hoạt động chưa hoàn thành / làm một phần. AI sẽ đề xuất cách nối tiếp và ôn tập phù hợp.`
                            : 'Dựa trên lộ trình riêng và ghi nhận buổi học để gợi ý kế hoạch dự kiến cho buổi kế tiếp.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={loadingAiNext}
                        onClick={handleRequestNextSessionAi}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                          {loadingAiNext ? 'AI đang phân tích...' : 'Tạo đề xuất buổi tiếp theo'}
                        </span>
                      </button>
                    </div>

                    {!aiStatus?.configured && (
                      <p className="text-xs text-amber-700">
                        Lưu ý: AI trên máy chủ hiện chưa được cấu hình khóa API — hệ thống sẽ báo lỗi rõ ràng thay vì tạo đề xuất giả.
                      </p>
                    )}

                    {aiNextError && (
                      <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{aiNextError}</span>
                      </div>
                    )}

                    {aiNextDraft && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                          <span className="font-bold text-blue-800">
                            Bản nháp đề xuất từ AI ({aiNextDraft.model}) — Chưa tự động áp dụng
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSaveNextDraftToArchive}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-medium text-slate-800 cursor-pointer"
                            >
                              Lưu bản nháp
                            </button>
                            {nextUpcomingSessionForLearner && (
                              <button
                                type="button"
                                onClick={handleApplyDraftToUpcomingSession}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>
                                  Chấp nhận &amp; áp dụng vào buổi{' '}
                                  {formatDateShortVi(nextUpcomingSessionForLearner.startTime)}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setAiNextDraft(null)}
                              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Bỏ qua
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3 text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-900">Lý do đề xuất:</p>
                            <p className="mt-0.5 leading-relaxed">
                              {String(aiNextDraft.result.reason || '')}
                            </p>
                          </div>

                          {Array.isArray(aiNextDraft.result.carryOverAndReview) && (
                            <div>
                              <p className="font-semibold text-slate-900">
                                Nội dung cần tiếp tục / ôn tập:
                              </p>
                              <ul className="list-disc pl-5 mt-1 space-y-1">
                                {(aiNextDraft.result.carryOverAndReview as string[]).map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(aiNextDraft.result.nextObjectives) && (
                            <div>
                              <p className="font-semibold text-slate-900">
                                Mục tiêu buổi tiếp theo:
                              </p>
                              <ul className="list-disc pl-5 mt-1 space-y-1">
                                {(aiNextDraft.result.nextObjectives as string[]).map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(aiNextDraft.result.suggestedActivities) && (
                            <div>
                              <p className="font-semibold text-slate-900">
                                Hoạt động &amp; Thời lượng dự kiến:
                              </p>
                              <ul className="mt-1 space-y-1.5">
                                {(
                                  aiNextDraft.result.suggestedActivities as {
                                    title?: string;
                                    stage?: string;
                                    durationMinutes?: number;
                                    notes?: string;
                                  }[]
                                ).map((a, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start justify-between gap-2 bg-white p-2 rounded border border-slate-200"
                                  >
                                    <div>
                                      <span className="font-semibold text-slate-900">
                                        {i + 1}. {a.title}
                                      </span>{' '}
                                      {a.stage && (
                                        <span className="text-slate-500">({a.stage})</span>
                                      )}
                                      {a.notes && <p className="text-slate-600 mt-0.5">{a.notes}</p>}
                                    </div>
                                    <span className="font-mono tabular-nums text-slate-600 shrink-0 inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {a.durationMinutes}p
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(aiNextDraft.result.missingInfoToConfirm) &&
                            (aiNextDraft.result.missingInfoToConfirm as string[]).length > 0 && (
                              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                                <p className="font-semibold">
                                  Thông tin còn thiếu cần giáo viên xác nhận:
                                </p>
                                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                  {(aiNextDraft.result.missingInfoToConfirm as string[]).map(
                                    (x, i) => (
                                      <li key={i}>{x}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
