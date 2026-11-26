import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type {
  ActiveNavSection,
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
} from './types/alden';
import { api } from './services/api';
import { computeDashboardSummary, forkCurriculumForLearner } from './lib/domainLogic';
import { LayoutShell } from './components/LayoutShell';
import { ConnectionStatusModal } from './components/ConnectionStatusModal';
import { DashboardView } from './components/DashboardView';
import { LessonsView } from './components/LessonsView';
import { CurriculaView } from './components/CurriculaView';
import { LearnersView } from './components/LearnersView';
import { SessionsView } from './components/SessionsView';
import { AiAssistantView, type AiToolTab } from './components/AiAssistantView';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [store, setStore] = useState<AldenStoreData | null>(null);
  const [tutorFlowStatus, setTutorFlowStatus] = useState<TutorFlowConnectionStatus | null>(null);
  const [learners, setLearners] = useState<TutorFlowLearner[]>([]);
  const [sessions, setSessions] = useState<TutorFlowSession[]>([]);
  const [aiStatus, setAiStatus] = useState<AiServiceStatus | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveNavSection>('dashboard');
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cross-view contextual navigation states
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [createLessonSignal, setCreateLessonSignal] = useState(0);
  const [createCurriculumSignal, setCreateCurriculumSignal] = useState(0);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [selectedSessionNav, setSelectedSessionNav] = useState<{
    sessionId: string | null;
    tab: 'plan' | 'post';
  }>({ sessionId: null, tab: 'plan' });
  const [aiNav, setAiNav] = useState<{ tab: AiToolTab; targetId: string | null }>({
    tab: 'generate',
    targetId: null,
  });

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.bootstrap();
      setStore(data.store);
      setTutorFlowStatus(data.tutorFlowStatus);
      setLearners(data.learners);
      setSessions(data.sessions);
      setAiStatus(data.aiStatus);
    } catch (err) {
      setLoadError((err as Error).message || 'Không thể tải dữ liệu ứng dụng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const pendingLogCount = useMemo(() => {
    if (!store) return 0;
    return computeDashboardSummary(sessions, store).completedMissingLogSessions.length;
  }, [sessions, store]);

  // =========================================================================
  // MUTATION HANDLERS (All persisted to server storage)
  // =========================================================================
  const handleSaveLesson = async (payload: Partial<LessonTemplate>, existingId?: string) => {
    if (existingId) {
      const updated = await api.updateLesson(existingId, payload);
      setStore((prev) =>
        prev
          ? {
              ...prev,
              lessonTemplates: prev.lessonTemplates.map((l) =>
                l.id === existingId ? updated : l
              ),
            }
          : prev
      );
      notify('success', `Đã cập nhật giáo án "${updated.title}".`);
    } else {
      const created = await api.createLesson(payload);
      setStore((prev) =>
        prev ? { ...prev, lessonTemplates: [created, ...prev.lessonTemplates] } : prev
      );
      notify('success', `Đã lưu giáo án "${created.title}".`);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    await api.deleteLesson(id);
    setStore((prev) =>
      prev
        ? { ...prev, lessonTemplates: prev.lessonTemplates.filter((l) => l.id !== id) }
        : prev
    );
    notify('success', 'Đã xóa giáo án khỏi thư viện.');
  };

  const handleSaveActivity = async (payload: Partial<ReusableActivity>, existingId?: string) => {
    if (existingId) {
      const updated = await api.updateActivity(existingId, payload);
      setStore((prev) =>
        prev
          ? {
              ...prev,
              activityBank: prev.activityBank.map((a) => (a.id === existingId ? updated : a)),
            }
          : prev
      );
      notify('success', 'Đã cập nhật hoạt động trong ngân hàng.');
    } else {
      const created = await api.createActivity(payload);
      setStore((prev) =>
        prev ? { ...prev, activityBank: [created, ...prev.activityBank] } : prev
      );
      notify('success', 'Đã thêm hoạt động vào ngân hàng tái sử dụng.');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    await api.deleteActivity(id);
    setStore((prev) =>
      prev ? { ...prev, activityBank: prev.activityBank.filter((a) => a.id !== id) } : prev
    );
    notify('success', 'Đã xóa hoạt động khỏi ngân hàng.');
  };

  const handleCreateMaterial = async (
    payload: Partial<MaterialItem> & { fileBase64?: string; originalFileName?: string }
  ) => {
    const created = await api.createMaterial(payload);
    setStore((prev) => (prev ? { ...prev, materials: [created, ...prev.materials] } : prev));
    notify('success', `Đã lưu tài liệu "${created.title}".`);
  };

  const handleDeleteMaterial = async (id: string) => {
    await api.deleteMaterial(id);
    setStore((prev) =>
      prev ? { ...prev, materials: prev.materials.filter((m) => m.id !== id) } : prev
    );
    notify('success', 'Đã xóa tài liệu.');
  };

  const handleSaveCurriculum = async (
    payload: Partial<CurriculumTemplate>,
    existingId?: string
  ) => {
    if (existingId) {
      const updated = await api.updateCurriculum(existingId, payload);
      setStore((prev) =>
        prev
          ? {
              ...prev,
              curriculumTemplates: prev.curriculumTemplates.map((c) =>
                c.id === existingId ? updated : c
              ),
            }
          : prev
      );
      notify('success', `Đã cập nhật lộ trình mẫu "${updated.title}".`);
    } else {
      const created = await api.createCurriculum(payload);
      setStore((prev) =>
        prev
          ? { ...prev, curriculumTemplates: [created, ...prev.curriculumTemplates] }
          : prev
      );
      notify('success', `Đã tạo lộ trình mẫu "${created.title}".`);
    }
  };

  const handleDeleteCurriculum = async (id: string) => {
    await api.deleteCurriculum(id);
    setStore((prev) =>
      prev
        ? {
            ...prev,
            curriculumTemplates: prev.curriculumTemplates.filter((c) => c.id !== id),
          }
        : prev
    );
    notify('success', 'Đã xóa lộ trình mẫu.');
  };

  const handleForkCurriculumToLearner = async (
    template: CurriculumTemplate,
    learner: TutorFlowLearner
  ) => {
    if (!store) return;
    const forked = forkCurriculumForLearner(template, learner, store.lessonTemplates);
    const saved = await api.createRoadmap(forked);
    setStore((prev) =>
      prev ? { ...prev, studentRoadmaps: [saved, ...prev.studentRoadmaps] } : prev
    );
    setSelectedLearnerId(learner.id);
    setActiveSection('learners');
    notify(
      'success',
      `Đã tạo bản lộ trình riêng cho ${learner.displayName} (lộ trình mẫu gốc giữ nguyên).`
    );
  };

  const handleUpdateRoadmap = async (roadmap: StudentRoadmap) => {
    const updated = await api.updateRoadmap(roadmap.id, roadmap);
    setStore((prev) =>
      prev
        ? {
            ...prev,
            studentRoadmaps: prev.studentRoadmaps.map((r) =>
              r.id === updated.id ? updated : r
            ),
          }
        : prev
    );
    notify('success', 'Đã lưu thay đổi lộ trình riêng của học viên.');
  };

  const handleDeleteRoadmap = async (id: string) => {
    await api.deleteRoadmap(id);
    setStore((prev) =>
      prev
        ? { ...prev, studentRoadmaps: prev.studentRoadmaps.filter((r) => r.id !== id) }
        : prev
    );
    notify('success', 'Đã xóa lộ trình riêng.');
  };

  const handleSaveSessionPlan = async (sessionId: string, plan: Partial<SessionPlan>) => {
    const saved = await api.upsertSessionPlan(sessionId, plan);
    setStore((prev) => {
      if (!prev) return prev;
      const exists = prev.sessionPlans.some((p) => p.tutorFlowSessionId === sessionId);
      return {
        ...prev,
        sessionPlans: exists
          ? prev.sessionPlans.map((p) => (p.tutorFlowSessionId === sessionId ? saved : p))
          : [saved, ...prev.sessionPlans],
      };
    });
    notify('success', 'Đã lưu kế hoạch bài dạy cho buổi học (không thay đổi giáo án gốc).');
  };

  const handleSavePostSessionLog = async (sessionId: string, log: Partial<PostSessionLog>) => {
    const saved = await api.upsertPostSessionLog(sessionId, log);
    setStore((prev) => {
      if (!prev) return prev;
      const exists = prev.postSessionLogs.some((l) => l.tutorFlowSessionId === sessionId);
      return {
        ...prev,
        postSessionLogs: exists
          ? prev.postSessionLogs.map((l) => (l.tutorFlowSessionId === sessionId ? saved : l))
          : [saved, ...prev.postSessionLogs],
      };
    });
    notify('success', 'Đã lưu ghi nhận tiến độ sau buổi học.');
  };

  const handleSaveAiSuggestion = async (payload: Partial<AiSuggestionRecord>) => {
    const saved = await api.saveAiSuggestion(payload);
    setStore((prev) =>
      prev ? { ...prev, aiSuggestions: [saved, ...prev.aiSuggestions] } : prev
    );
    notify('success', 'Đã lưu bản nháp đề xuất AI.');
  };

  const handleUpdateSuggestionStatus = async (
    id: string,
    status: 'accepted' | 'dismissed'
  ) => {
    const updated = await api.updateAiSuggestion(id, { status });
    setStore((prev) =>
      prev
        ? {
            ...prev,
            aiSuggestions: prev.aiSuggestions.map((s) => (s.id === id ? updated : s)),
          }
        : prev
    );
    notify(
      'success',
      status === 'accepted' ? 'Đã đánh dấu chấp nhận đề xuất.' : 'Đã bỏ qua đề xuất.'
    );
  };

  const handleDeleteSuggestion = async (id: string) => {
    await api.deleteAiSuggestion(id);
    setStore((prev) =>
      prev ? { ...prev, aiSuggestions: prev.aiSuggestions.filter((s) => s.id !== id) } : prev
    );
    notify('success', 'Đã xóa đề xuất AI.');
  };

  return (
    <LayoutShell
      activeSection={activeSection}
      onSelectSection={(sec) => {
        setActiveSection(sec);
        if (sec !== 'lessons') setSelectedLessonId(null);
      }}
      tutorFlowStatus={tutorFlowStatus}
      aiStatus={aiStatus}
      onOpenConnectionModal={() => setConnectionModalOpen(true)}
      onQuickCreateLesson={() => {
        setActiveSection('lessons');
        setCreateLessonSignal((n) => n + 1);
      }}
      toast={toast}
      onDismissToast={() => setToast(null)}
      pendingLogCount={pendingLogCount}
    >
      {loading && (
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải dữ liệu">
          <div className="h-8 w-64 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 bg-white border border-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-white border border-slate-200 rounded-xl" />
        </div>
      )}

      {!loading && loadError && (
        <div className="bg-white border border-rose-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
            <AlertCircle className="h-5 w-5" />
            <span>Không thể kết nối máy chủ dữ liệu Alden Path</span>
          </div>
          <p className="text-xs text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={loadBootstrap}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử tải lại</span>
          </button>
        </div>
      )}

      {!loading && !loadError && store && (
        <>
          {activeSection === 'dashboard' && (
            <DashboardView
              store={store}
              sessions={sessions}
              tutorFlowStatus={tutorFlowStatus}
              onNavigate={setActiveSection}
              onOpenCreateLesson={() => {
                setActiveSection('lessons');
                setCreateLessonSignal((n) => n + 1);
              }}
              onOpenCreateCurriculum={() => {
                setActiveSection('curricula');
                setCreateCurriculumSignal((n) => n + 1);
              }}
              onOpenSession={(sessionId, tab) => {
                setSelectedSessionNav({ sessionId, tab });
                setActiveSection('sessions');
              }}
              onOpenLearner={(learnerId) => {
                setSelectedLearnerId(learnerId);
                setActiveSection('learners');
              }}
              onOpenLesson={(lessonId) => {
                setSelectedLessonId(lessonId);
                setActiveSection('lessons');
              }}
              onOpenConnectionModal={() => setConnectionModalOpen(true)}
            />
          )}

          {activeSection === 'lessons' && (
            <LessonsView
              store={store}
              initialEditLessonId={selectedLessonId}
              openCreateSignal={createLessonSignal}
              onSaveLesson={handleSaveLesson}
              onDeleteLesson={handleDeleteLesson}
              onSaveActivity={handleSaveActivity}
              onDeleteActivity={handleDeleteActivity}
              onCreateMaterial={handleCreateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onEvaluateLessonWithAi={(lessonId) => {
                setAiNav({ tab: 'evaluate', targetId: lessonId });
                setActiveSection('ai');
              }}
            />
          )}

          {activeSection === 'curricula' && (
            <CurriculaView
              store={store}
              learners={learners}
              openCreateSignal={createCurriculumSignal}
              onSaveCurriculum={handleSaveCurriculum}
              onDeleteCurriculum={handleDeleteCurriculum}
              onForkToLearner={handleForkCurriculumToLearner}
              onEvaluateCurriculumWithAi={(curriculumId) => {
                setAiNav({ tab: 'evaluate', targetId: curriculumId });
                setActiveSection('ai');
              }}
            />
          )}

          {activeSection === 'learners' && (
            <LearnersView
              store={store}
              learners={learners}
              initialLearnerId={selectedLearnerId}
              onForkFromTemplate={handleForkCurriculumToLearner}
              onUpdateRoadmap={handleUpdateRoadmap}
              onDeleteRoadmap={handleDeleteRoadmap}
              onAskAiProgress={(learnerId) => {
                setAiNav({ tab: 'progress', targetId: learnerId });
                setActiveSection('ai');
              }}
              onAskAiNextSession={(learnerId) => {
                setAiNav({ tab: 'next_session', targetId: learnerId });
                setActiveSection('ai');
              }}
            />
          )}

          {activeSection === 'sessions' && (
            <SessionsView
              store={store}
              sessions={sessions}
              aiStatus={aiStatus}
              initialSessionId={selectedSessionNav.sessionId}
              initialTab={selectedSessionNav.tab}
              onSaveSessionPlan={handleSaveSessionPlan}
              onSavePostSessionLog={handleSavePostSessionLog}
              onSaveAiSuggestion={handleSaveAiSuggestion}
              onNotify={notify}
            />
          )}

          {activeSection === 'ai' && (
            <AiAssistantView
              store={store}
              learners={learners}
              aiStatus={aiStatus}
              initialTab={aiNav.tab}
              initialTargetId={aiNav.targetId}
              onSaveGeneratedLesson={async (lesson) => {
                await handleSaveLesson(lesson);
                setActiveSection('lessons');
              }}
              onSaveSuggestion={handleSaveAiSuggestion}
              onUpdateSuggestionStatus={handleUpdateSuggestionStatus}
              onDeleteSuggestion={handleDeleteSuggestion}
            />
          )}
        </>
      )}

      <ConnectionStatusModal
        open={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        tutorFlowStatus={tutorFlowStatus}
        aiStatus={aiStatus}
      />
    </LayoutShell>
  );
}
