import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  GitFork,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import type {
  AldenStoreData,
  CurriculumTemplate,
  RoadmapItemStatus,
  StudentRoadmap,
  TutorFlowLearner,
} from '../types/alden';
import {
  computeLearnerProgress,
  detectTemplateDrift,
  generateId,
} from '../lib/domainLogic';
import { ROADMAP_STATUS_META } from '../utils/formatters';

interface LearnersViewProps {
  store: AldenStoreData;
  learners: TutorFlowLearner[];
  initialLearnerId?: string | null;
  onForkFromTemplate: (template: CurriculumTemplate, learner: TutorFlowLearner) => Promise<void>;
  onUpdateRoadmap: (roadmap: StudentRoadmap) => Promise<void>;
  onDeleteRoadmap: (id: string) => Promise<void>;
  onAskAiProgress: (learnerId: string) => void;
  onAskAiNextSession: (learnerId: string) => void;
}

const STATUS_OPTIONS: RoadmapItemStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'needs_review',
];

export function LearnersView({
  store,
  learners,
  initialLearnerId,
  onForkFromTemplate,
  onUpdateRoadmap,
  onDeleteRoadmap,
  onAskAiProgress,
  onAskAiNextSession,
}: LearnersViewProps) {
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(
    initialLearnerId || learners[0]?.id || ''
  );
  const [selectedTemplateToFork, setSelectedTemplateToFork] = useState<string>(
    store.curriculumTemplates[0]?.id || ''
  );
  const [editingRoadmap, setEditingRoadmap] = useState<StudentRoadmap | null>(null);
  const [savingRoadmap, setSavingRoadmap] = useState(false);
  const [forking, setForking] = useState(false);

  React.useEffect(() => {
    if (initialLearnerId) {
      setSelectedLearnerId(initialLearnerId);
    }
  }, [initialLearnerId]);

  const activeLearner = useMemo(
    () => learners.find((l) => l.id === selectedLearnerId) || learners[0] || null,
    [learners, selectedLearnerId]
  );

  const learnerRoadmaps = useMemo(
    () =>
      activeLearner
        ? store.studentRoadmaps.filter((r) => r.learnerId === activeLearner.id)
        : [],
    [store.studentRoadmaps, activeLearner]
  );

  // Sync editingRoadmap when switching learner or when roadmaps change
  React.useEffect(() => {
    if (!activeLearner) {
      setEditingRoadmap(null);
      return;
    }
    const found = store.studentRoadmaps.find((r) => r.learnerId === activeLearner.id) || null;
    setEditingRoadmap(found ? structuredClone(found) : null);
  }, [activeLearner?.id, store.studentRoadmaps]);

  const progressStats = useMemo(() => {
    if (!activeLearner) return null;
    return computeLearnerProgress(
      activeLearner.id,
      store.studentRoadmaps,
      store.postSessionLogs
    );
  }, [activeLearner, store.studentRoadmaps, store.postSessionLogs]);

  const drifts = useMemo(() => {
    if (!editingRoadmap) return [];
    return detectTemplateDrift(
      editingRoadmap,
      store.curriculumTemplates,
      store.lessonTemplates
    );
  }, [editingRoadmap, store.curriculumTemplates, store.lessonTemplates]);

  const handleFork = async () => {
    if (!activeLearner) return;
    const tpl = store.curriculumTemplates.find((c) => c.id === selectedTemplateToFork);
    if (!tpl) return;
    setForking(true);
    try {
      await onForkFromTemplate(tpl, activeLearner);
    } finally {
      setForking(false);
    }
  };

  const handleSaveRoadmap = async () => {
    if (!editingRoadmap) return;
    setSavingRoadmap(true);
    try {
      await onUpdateRoadmap(editingRoadmap);
    } finally {
      setSavingRoadmap(false);
    }
  };

  const updateItem = (
    sIdx: number,
    iIdx: number,
    patch: Partial<StudentRoadmap['stages'][number]['items'][number]>
  ) => {
    if (!editingRoadmap) return;
    const next = structuredClone(editingRoadmap);
    next.stages[sIdx].items[iIdx] = {
      ...next.stages[sIdx].items[iIdx],
      ...patch,
      isCustomized: true,
    };
    setEditingRoadmap(next);
  };

  const moveItem = (sIdx: number, iIdx: number, dir: -1 | 1) => {
    if (!editingRoadmap) return;
    const next = structuredClone(editingRoadmap);
    const items = next.stages[sIdx].items;
    const target = iIdx + dir;
    if (target < 0 || target >= items.length) return;
    [items[iIdx], items[target]] = [items[target], items[iIdx]];
    setEditingRoadmap(next);
  };

  const addLessonToStage = (sIdx: number, lessonId: string) => {
    if (!editingRoadmap) return;
    const lesson = store.lessonTemplates.find((l) => l.id === lessonId);
    const next = structuredClone(editingRoadmap);
    next.stages[sIdx].items.push({
      id: generateId('rm_item'),
      lessonTemplateId: lesson?.id,
      lessonTemplateVersionSnapshot: lesson?.version,
      customTitle: lesson?.title || 'Nội dung bổ sung riêng',
      topic: lesson?.topic || lesson?.unit || '',
      estimatedSessions: 1,
      status: 'not_started',
      personalNotes: '',
      isCustomized: true,
    });
    setEditingRoadmap(next);
  };

  const dismissDriftKeepCustom = async () => {
    if (!editingRoadmap) return;
    const next = structuredClone(editingRoadmap);
    if (next.sourceTemplateId) {
      const tpl = store.curriculumTemplates.find((c) => c.id === next.sourceTemplateId);
      if (tpl) next.sourceTemplateVersionSnapshot = tpl.version;
    }
    const lessonMap = new Map(store.lessonTemplates.map((l) => [l.id, l.version]));
    for (const st of next.stages) {
      for (const it of st.items) {
        if (it.lessonTemplateId && lessonMap.has(it.lessonTemplateId)) {
          it.lessonTemplateVersionSnapshot = lessonMap.get(it.lessonTemplateId);
        }
      }
    }
    setEditingRoadmap(next);
    await onUpdateRoadmap(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Học viên &amp; Lộ trình riêng
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Danh sách học viên và nhóm được đọc chỉ đọc từ TutorFlow (hiện dùng dữ liệu mẫu). Lộ trình riêng được lưu và tùy chỉnh độc lập trong Alden Path.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 cols: TutorFlow Read-Only Learners List */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Danh sách học viên &amp; nhóm
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
              <Lock className="h-3 w-3" />
              <span>Chỉ đọc</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {learners.map((learner) => {
              const isSelected = activeLearner?.id === learner.id;
              const hasRoadmap = store.studentRoadmaps.some((r) => r.learnerId === learner.id);
              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => setSelectedLearnerId(learner.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {learner.entityType === 'group' ? (
                          <Users className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        )}
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-blue-900' : 'text-slate-900'
                          }`}
                        >
                          {learner.displayName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {learner.levelNote} · {learner.entityType === 'group' ? 'Nhóm' : '1–1'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ID TutorFlow: {learner.id}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] shrink-0 ${
                        hasRoadmap ? 'text-emerald-700 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {hasRoadmap ? 'Có lộ trình' : 'Chưa tạo'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right 8 cols: Read-Only Profile Strip + Personalized Roadmap + Progress */}
        <div className="lg:col-span-8 space-y-6">
          {!activeLearner ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
              Chọn một học viên hoặc nhóm để xem lộ trình riêng.
            </div>
          ) : (
            <>
              {/* Read-Only TutorFlow Profile Card (Zero Edit/Delete Buttons) */}
              <section
                aria-label="Thông tin học viên từ TutorFlow (chỉ đọc)"
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Thông tin đọc từ TutorFlow (Dữ liệu mẫu · Không sửa/xóa tại đây)</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {activeLearner.displayName}
                      {activeLearner.englishName && (
                        <span className="text-sm font-normal text-slate-500 ml-2">
                          ({activeLearner.englishName})
                        </span>
                      )}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAskAiProgress(activeLearner.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-xs font-medium text-blue-800 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI tóm tắt tiến bộ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAskAiNextSession(activeLearner.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Đề xuất buổi tới
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Mã định danh ổn định</span>
                    <span className="font-mono text-slate-800">{activeLearner.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Trình độ ghi nhận</span>
                    <span className="font-medium text-slate-800">{activeLearner.levelNote}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Lịch học (mẫu)</span>
                    <span className="text-slate-800">{activeLearner.scheduleSummary}</span>
                  </div>
                </div>
                {activeLearner.memberNames && activeLearner.memberNames.length > 0 && (
                  <p className="text-xs text-slate-600">
                    <strong>Thành viên nhóm:</strong> {activeLearner.memberNames.join(', ')}
                  </p>
                )}
              </section>

              {/* Progress Overview Strip */}
              {progressStats && (
                <section className="grid grid-cols-2 sm:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 overflow-hidden text-xs">
                  <div className="p-4">
                    <span className="text-slate-500">Hoàn thành lộ trình</span>
                    <p className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700">
                      {progressStats.completedCount}/{progressStats.totalRoadmapItems}
                    </p>
                  </div>
                  <div className="p-4">
                    <span className="text-slate-500">Đang học</span>
                    <p className="mt-1 text-lg font-bold font-mono tabular-nums text-blue-700">
                      {progressStats.inProgressCount}
                    </p>
                  </div>
                  <div className="p-4">
                    <span className="text-slate-500">Cần ôn tập</span>
                    <p className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-700">
                      {progressStats.needsReviewCount}
                    </p>
                  </div>
                  <div className="p-4">
                    <span className="text-slate-500">Hoạt động dạy dở</span>
                    <p className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-700">
                      {progressStats.unfinishedActivities.length}
                    </p>
                  </div>
                </section>
              )}

              {/* Personalized Roadmap Editor or Fork Prompt */}
              {!editingRoadmap ? (
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Chưa có lộ trình riêng cho {activeLearner.displayName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Chọn một lộ trình mẫu để tạo bản riêng. Bản riêng hoàn toàn độc lập với lộ trình gốc.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      aria-label="Chọn lộ trình mẫu để tạo bản riêng"
                      value={selectedTemplateToFork}
                      onChange={(e) => setSelectedTemplateToFork(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {store.curriculumTemplates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.estimatedSessions} buổi)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={forking || !selectedTemplateToFork}
                      onClick={handleFork}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      <GitFork className="h-4 w-4" />
                      <span>{forking ? 'Đang tạo...' : 'Tạo bản riêng từ mẫu'}</span>
                    </button>
                  </div>
                </section>
              ) : (
                <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                  {/* Switch between multiple roadmaps if learner has >1 */}
                  {learnerRoadmaps.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Chọn lộ trình:</span>
                      <select
                        value={editingRoadmap.id}
                        onChange={(e) => {
                          const found = learnerRoadmaps.find((r) => r.id === e.target.value);
                          if (found) setEditingRoadmap(structuredClone(found));
                        }}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white"
                      >
                        {learnerRoadmaps.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Template Drift Notice — never auto-overwrites personalized roadmap */}
                  {drifts.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            Bản mẫu gốc có cập nhật mới ({drifts.length} mục)
                          </p>
                          <p className="text-amber-800 mt-0.5">
                            Alden Path không tự động ghi đè các chỉnh sửa cá nhân của bạn. Bạn có thể giữ nguyên bản riêng này.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={dismissDriftKeepCustom}
                        className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Giữ bản riêng &amp; Đã biết
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-[240px]">
                      <p className="text-xs text-slate-500">
                        Bản riêng của học viên · Tạo từ mẫu:{' '}
                        <strong>{editingRoadmap.sourceTemplateTitleSnapshot || 'Tự tạo'}</strong>
                      </p>
                      <input
                        type="text"
                        aria-label="Tên lộ trình riêng"
                        value={editingRoadmap.title}
                        onChange={(e) =>
                          setEditingRoadmap({ ...editingRoadmap, title: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-base font-bold text-slate-900 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={savingRoadmap}
                        onClick={handleSaveRoadmap}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{savingRoadmap ? 'Đang lưu...' : 'Lưu thay đổi lộ trình'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRoadmap(editingRoadmap.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        aria-label="Xóa lộ trình riêng"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label htmlFor="rm-custom-goal" className="block font-medium text-slate-600 mb-1">
                        Mục tiêu điều chỉnh riêng cho học viên
                      </label>
                      <input
                        id="rm-custom-goal"
                        type="text"
                        value={editingRoadmap.customGoals}
                        onChange={(e) =>
                          setEditingRoadmap({ ...editingRoadmap, customGoals: e.target.value })
                        }
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="rm-est-sessions" className="block font-medium text-slate-600 mb-1">
                        Tổng số buổi dự kiến
                      </label>
                      <input
                        id="rm-est-sessions"
                        type="number"
                        min={1}
                        value={editingRoadmap.estimatedSessions}
                        onChange={(e) =>
                          setEditingRoadmap({
                            ...editingRoadmap,
                            estimatedSessions: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-1.5 font-mono border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor="rm-teacher-notes" className="block font-medium text-slate-600 mb-1">
                        Lưu ý giảng dạy quan trọng
                      </label>
                      <textarea
                        id="rm-teacher-notes"
                        rows={2}
                        value={editingRoadmap.teacherNotes || ''}
                        onChange={(e) =>
                          setEditingRoadmap({ ...editingRoadmap, teacherNotes: e.target.value })
                        }
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Stages & Lesson Items */}
                  <div className="space-y-4">
                    {editingRoadmap.stages.map((stage, sIdx) => (
                      <div
                        key={stage.id}
                        className="border border-slate-200 rounded-xl overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="text"
                            value={stage.title}
                            onChange={(e) => {
                              const next = structuredClone(editingRoadmap);
                              next.stages[sIdx].title = e.target.value;
                              setEditingRoadmap(next);
                            }}
                            aria-label={`Tên giai đoạn ${sIdx + 1}`}
                            className="text-xs font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1 min-w-[180px]"
                          />
                          <select
                            aria-label={`Thêm giáo án vào ${stage.title}`}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addLessonToStage(sIdx, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md"
                          >
                            <option value="">+ Thêm giáo án vào giai đoạn...</option>
                            {store.lessonTemplates.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.title}
                              </option>
                            ))}
                            <option value="__custom__">+ Mục tự nhập mới</option>
                          </select>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {stage.items.map((item, iIdx) => (
                            <div key={item.id} className="p-4 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={item.customTitle}
                                  onChange={(e) =>
                                    updateItem(sIdx, iIdx, { customTitle: e.target.value })
                                  }
                                  aria-label={`Tên bài học ${iIdx + 1}`}
                                  className="flex-1 px-2.5 py-1 text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <select
                                    aria-label={`Trạng thái bài ${item.customTitle}`}
                                    value={item.status}
                                    onChange={(e) =>
                                      updateItem(sIdx, iIdx, {
                                        status: e.target.value as RoadmapItemStatus,
                                      })
                                    }
                                    className={`px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white ${
                                      ROADMAP_STATUS_META[item.status].textClass
                                    }`}
                                  >
                                    {STATUS_OPTIONS.map((st) => (
                                      <option key={st} value={st}>
                                        {ROADMAP_STATUS_META[st].label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(sIdx, iIdx, -1)}
                                    disabled={iIdx === 0}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                    aria-label="Chuyển lên"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(sIdx, iIdx, 1)}
                                    disabled={iIdx === stage.items.length - 1}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                    aria-label="Chuyển xuống"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = structuredClone(editingRoadmap);
                                      next.stages[sIdx].items.splice(iIdx, 1);
                                      setEditingRoadmap(next);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                    aria-label={`Xóa ${item.customTitle} khỏi lộ trình riêng`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-2 text-xs">
                                <input
                                  type="text"
                                  value={item.personalNotes || ''}
                                  onChange={(e) =>
                                    updateItem(sIdx, iIdx, { personalNotes: e.target.value })
                                  }
                                  placeholder="Ghi chú điều chỉnh riêng cho học viên..."
                                  className="flex-1 px-2.5 py-1 border border-slate-200 rounded-md text-slate-600"
                                />
                                <label className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                                  <span>Số buổi:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.estimatedSessions}
                                    onChange={(e) =>
                                      updateItem(sIdx, iIdx, {
                                        estimatedSessions: Number(e.target.value),
                                      })
                                    }
                                    className="w-14 px-2 py-1 font-mono border border-slate-200 rounded-md text-slate-800"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const next = structuredClone(editingRoadmap);
                        next.stages.push({
                          id: generateId('rm_stg'),
                          title: `Giai đoạn ${next.stages.length + 1}`,
                          items: [],
                        });
                        setEditingRoadmap(next);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm giai đoạn mới</span>
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
