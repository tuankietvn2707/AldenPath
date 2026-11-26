import React, { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  GitFork,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AldenStoreData,
  CurriculumStage,
  CurriculumTemplate,
  TutorFlowLearner,
} from '../types/alden';
import { generateId } from '../lib/domainLogic';

interface CurriculaViewProps {
  store: AldenStoreData;
  learners: TutorFlowLearner[];
  openCreateSignal?: number;
  onSaveCurriculum: (cur: Partial<CurriculumTemplate>, existingId?: string) => Promise<void>;
  onDeleteCurriculum: (id: string) => Promise<void>;
  onForkToLearner: (template: CurriculumTemplate, learner: TutorFlowLearner) => Promise<void>;
  onEvaluateCurriculumWithAi: (curriculumId: string) => void;
}

function createEmptyCurriculum(): Partial<CurriculumTemplate> {
  return {
    title: '',
    titleEn: '',
    description: '',
    targetAudience: '',
    entryLevel: 'A2',
    exitGoal: '',
    estimatedSessions: 12,
    estimatedHours: 12,
    keyMaterialsSummary: '',
    keyActivitiesSummary: '',
    stages: [
      {
        id: generateId('stg'),
        title: 'Giai đoạn 1: Nền tảng',
        titleEn: 'Stage 1: Foundation',
        description: '',
        items: [],
      },
    ],
  };
}

export function CurriculaView({
  store,
  learners,
  openCreateSignal,
  onSaveCurriculum,
  onDeleteCurriculum,
  onForkToLearner,
  onEvaluateCurriculumWithAi,
}: CurriculaViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CurriculumTemplate> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Presentation / Showcase view for introducing to new students
  const [showcaseTemplate, setShowcaseTemplate] = useState<CurriculumTemplate | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Fork modal
  const [forkTargetTemplate, setForkTargetTemplate] = useState<CurriculumTemplate | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [forking, setForking] = useState(false);

  React.useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      setEditingId(null);
      setDraft(createEmptyCurriculum());
      setFormError(null);
    }
  }, [openCreateSignal]);

  const handleSave = async () => {
    if (!draft?.title?.trim()) {
      setFormError('Vui lòng nhập tên lộ trình mẫu.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onSaveCurriculum(draft, editingId || undefined);
      setDraft(null);
      setEditingId(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    if (!draft) return;
    const nextIdx = (draft.stages?.length || 0) + 1;
    const newStage: CurriculumStage = {
      id: generateId('stg'),
      title: `Giai đoạn ${nextIdx}`,
      titleEn: `Stage ${nextIdx}`,
      description: '',
      items: [],
    };
    setDraft({ ...draft, stages: [...(draft.stages || []), newStage] });
  };

  const addItemToStage = (stageIdx: number, lessonId?: string) => {
    if (!draft?.stages) return;
    const stages = structuredClone(draft.stages);
    const lesson = lessonId ? store.lessonTemplates.find((l) => l.id === lessonId) : undefined;
    stages[stageIdx].items.push({
      id: generateId('ci'),
      lessonTemplateId: lesson?.id,
      customTitle: lesson?.title || 'Chủ đề / Bài học mới',
      topic: lesson?.topic || lesson?.unit || '',
      estimatedSessions: 1,
      keyMaterialsNote: '',
      keyActivitiesNote: '',
      notes: '',
    });
    setDraft({ ...draft, stages });
  };

  const handleConfirmFork = async () => {
    if (!forkTargetTemplate || !selectedLearnerId) return;
    const learner = learners.find((l) => l.id === selectedLearnerId);
    if (!learner) return;
    setForking(true);
    try {
      await onForkToLearner(forkTargetTemplate, learner);
      setForkTargetTemplate(null);
      setSelectedLearnerId('');
    } finally {
      setForking(false);
    }
  };

  const handleCopyShowcaseSummary = async (tpl: CurriculumTemplate) => {
    const lines = [
      `LỘ TRÌNH HỌC TIẾNG ANH — ALDEN PATH`,
      `${tpl.title}${tpl.titleEn ? ` (${tpl.titleEn})` : ''}`,
      ``,
      `• Đối tượng phù hợp: ${tpl.targetAudience}`,
      `• Trình độ đầu vào: ${tpl.entryLevel} → Mục tiêu đầu ra: ${tpl.exitGoal}`,
      `• Thời lượng dự kiến: ${tpl.estimatedSessions} buổi${tpl.estimatedHours ? ` (~${tpl.estimatedHours} giờ)` : ''}`,
      ``,
      `CÁC GIAI ĐOẠN HỌC:`,
      ...tpl.stages.flatMap((st, idx) => [
        `${idx + 1}. ${st.title}${st.description ? ` — ${st.description}` : ''}`,
        ...st.items.map(
          (it) => `   - ${it.customTitle} (${it.estimatedSessions} buổi)${it.keyActivitiesNote ? ` | Hoạt động: ${it.keyActivitiesNote}` : ''}`
        ),
      ]),
      tpl.keyMaterialsSummary ? `\nTài liệu chính: ${tpl.keyMaterialsSummary}` : '',
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lộ trình học mẫu
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Xây dựng khung lộ trình chuẩn để tư vấn học viên mới và nhân bản thành lộ trình riêng mà không làm đổi bản mẫu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraft(createEmptyCurriculum());
            setFormError(null);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium whitespace-nowrap self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo lộ trình mẫu</span>
        </button>
      </div>

      {/* Curriculum Cards List */}
      {store.curriculumTemplates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800">Chưa có lộ trình học mẫu nào</p>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft(createEmptyCurriculum());
            }}
            className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium"
          >
            Tạo lộ trình mẫu đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {store.curriculumTemplates.map((tpl) => {
            const totalItems = tpl.stages.reduce((acc, s) => acc + s.items.length, 0);
            return (
              <article
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 tabular-nums">
                    {tpl.entryLevel || 'Mọi trình độ'} → {tpl.exitGoal ? 'Có mục tiêu rõ' : 'Tùy chỉnh'} ·{' '}
                    {tpl.estimatedSessions} buổi · {tpl.stages.length} giai đoạn · {totalItems} bài học
                    {tpl.isSampleData && ' · Dữ liệu mẫu'}
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900">{tpl.title}</h2>
                    {tpl.titleEn && <p className="text-xs text-slate-500 italic mt-0.5">{tpl.titleEn}</p>}
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">{tpl.description}</p>
                  )}

                  <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                    <p>
                      <strong>Đối tượng:</strong> {tpl.targetAudience || 'Chưa ghi rõ'}
                    </p>
                    <p>
                      <strong>Đầu ra:</strong> {tpl.exitGoal || 'Chưa ghi rõ'}
                    </p>
                  </div>

                  {/* Compact Stage Outline */}
                  <div className="space-y-1.5 pt-1">
                    {tpl.stages.map((st, idx) => (
                      <div key={st.id} className="text-xs text-slate-700">
                        <span className="font-semibold">
                          {idx + 1}. {st.title}
                        </span>
                        <span className="text-slate-500"> ({st.items.length} bài)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowcaseTemplate(tpl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Chế độ giới thiệu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForkTargetTemplate(tpl);
                      setSelectedLearnerId(learners[0]?.id || '');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    <span>Tạo bản riêng cho học viên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(tpl.id);
                      setDraft(structuredClone(tpl));
                      setFormError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => onEvaluateCurriculumWithAi(tpl.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-xs font-medium text-blue-800 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI đánh giá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCurriculum(tpl.id)}
                    className="p-1.5 ml-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    aria-label={`Xóa lộ trình ${tpl.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* PRESENTATION / CONSULTATION VIEW MODAL */}
      {/* ================================================================= */}
      {showcaseTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="showcase-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
              <div className="text-xs font-semibold text-blue-800">
                Alden Path · Chế độ giới thiệu lộ trình cho học viên mới
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyShowcaseSummary(showcaseTemplate)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedText ? 'Đã sao chép nội dung' : 'Sao chép gửi học viên'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseTemplate(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                  aria-label="Đóng chế độ giới thiệu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <h2 id="showcase-title" className="text-2xl font-bold text-slate-900">
                  {showcaseTemplate.title}
                </h2>
                {showcaseTemplate.titleEn && (
                  <p className="text-sm text-slate-500 italic">{showcaseTemplate.titleEn}</p>
                )}
                <p className="text-sm text-slate-700 leading-relaxed pt-1">
                  {showcaseTemplate.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <p className="text-slate-500">Trình độ đầu vào</p>
                  <p className="mt-1 font-semibold text-slate-900">{showcaseTemplate.entryLevel}</p>
                </div>
                <div>
                  <p className="text-slate-500">Thời lượng dự kiến</p>
                  <p className="mt-1 font-semibold text-slate-900 tabular-nums">
                    {showcaseTemplate.estimatedSessions} buổi
                    {showcaseTemplate.estimatedHours ? ` (~${showcaseTemplate.estimatedHours} giờ)` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Mục tiêu đầu ra</p>
                  <p className="mt-1 font-semibold text-slate-900">{showcaseTemplate.exitGoal}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Lộ trình các giai đoạn học</h3>
                {showcaseTemplate.stages.map((stage, idx) => (
                  <div key={stage.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        0{idx + 1}. {stage.title}
                      </h4>
                      {stage.description && (
                        <p className="text-xs text-slate-600 mt-0.5">{stage.description}</p>
                      )}
                    </div>
                    <ol className="space-y-2 pt-1">
                      {stage.items.map((item, i) => (
                        <li
                          key={item.id}
                          className="text-xs text-slate-700 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-1.5 border-t border-slate-100"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {i + 1}. {item.customTitle}
                            </span>
                            {item.keyActivitiesNote && (
                              <p className="text-slate-500 mt-0.5">
                                Hoạt động chính: {item.keyActivitiesNote}
                              </p>
                            )}
                          </div>
                          <span className="font-mono tabular-nums text-slate-500 shrink-0">
                            {item.estimatedSessions} buổi
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>

              {(showcaseTemplate.keyMaterialsSummary || showcaseTemplate.keyActivitiesSummary) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 pt-2 border-t border-slate-200">
                  {showcaseTemplate.keyMaterialsSummary && (
                    <div>
                      <p className="font-semibold text-slate-900">Tài liệu &amp; Giáo trình</p>
                      <p className="mt-1 leading-relaxed">{showcaseTemplate.keyMaterialsSummary}</p>
                    </div>
                  )}
                  {showcaseTemplate.keyActivitiesSummary && (
                    <div>
                      <p className="font-semibold text-slate-900">Phương pháp &amp; Hoạt động nổi bật</p>
                      <p className="mt-1 leading-relaxed">{showcaseTemplate.keyActivitiesSummary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FORK CURRICULUM TO LEARNER MODAL */}
      {/* ================================================================= */}
      {forkTargetTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fork-modal-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="fork-modal-title" className="text-sm font-bold text-slate-900">
                Tạo lộ trình riêng từ bản mẫu
              </h2>
              <button
                type="button"
                onClick={() => setForkTargetTemplate(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống sẽ nhân bản lộ trình <strong>{forkTargetTemplate.title}</strong> thành một bản độc lập cho học viên
                hoặc nhóm bên dưới. Mọi chỉnh sửa trên bản riêng sẽ <strong>không thay đổi</strong> lộ trình mẫu gốc.
              </p>
              <div>
                <label htmlFor="fork-learner-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn học viên hoặc nhóm (TutorFlow · Dữ liệu mẫu)
                </label>
                <select
                  id="fork-learner-select"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.displayName} ({l.entityType === 'group' ? 'Nhóm' : '1–1'} · {l.levelNote})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForkTargetTemplate(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={forking || !selectedLearnerId}
                onClick={handleConfirmFork}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {forking ? 'Đang tạo...' : 'Tạo bản riêng ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CREATE / EDIT CURRICULUM TEMPLATE MODAL */}
      {/* ================================================================= */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cur-editor-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="cur-editor-title" className="text-base font-bold text-slate-900">
                {editingId ? 'Chỉnh sửa lộ trình mẫu' : 'Tạo lộ trình học mẫu mới'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label htmlFor="cur-title" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên lộ trình mẫu *
                  </label>
                  <input
                    id="cur-title"
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="VD: Lộ trình Giao tiếp Công việc (A2 → B1)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-title-en" className="block text-xs font-medium text-slate-600 mb-1">
                    Tên tiếng Anh (tùy chọn)
                  </label>
                  <input
                    id="cur-title-en"
                    type="text"
                    value={draft.titleEn || ''}
                    onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-audience" className="block text-xs font-medium text-slate-600 mb-1">
                    Đối tượng phù hợp
                  </label>
                  <input
                    id="cur-audience"
                    type="text"
                    value={draft.targetAudience || ''}
                    onChange={(e) => setDraft({ ...draft, targetAudience: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-entry" className="block text-xs font-medium text-slate-600 mb-1">
                    Trình độ đầu vào
                  </label>
                  <input
                    id="cur-entry"
                    type="text"
                    value={draft.entryLevel || ''}
                    onChange={(e) => setDraft({ ...draft, entryLevel: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-sessions" className="block text-xs font-medium text-slate-600 mb-1">
                    Số buổi dự kiến
                  </label>
                  <input
                    id="cur-sessions"
                    type="number"
                    min={1}
                    value={draft.estimatedSessions || 12}
                    onChange={(e) =>
                      setDraft({ ...draft, estimatedSessions: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cur-goal" className="block text-xs font-medium text-slate-600 mb-1">
                    Mục tiêu đầu ra
                  </label>
                  <input
                    id="cur-goal"
                    type="text"
                    value={draft.exitGoal || ''}
                    onChange={(e) => setDraft({ ...draft, exitGoal: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cur-desc" className="block text-xs font-medium text-slate-600 mb-1">
                    Mô tả ngắn gọn
                  </label>
                  <textarea
                    id="cur-desc"
                    rows={2}
                    value={draft.description || ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-mats" className="block text-xs font-medium text-slate-600 mb-1">
                    Tài liệu quan trọng
                  </label>
                  <input
                    id="cur-mats"
                    type="text"
                    value={draft.keyMaterialsSummary || ''}
                    onChange={(e) => setDraft({ ...draft, keyMaterialsSummary: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="cur-acts" className="block text-xs font-medium text-slate-600 mb-1">
                    Hoạt động trọng tâm
                  </label>
                  <input
                    id="cur-acts"
                    type="text"
                    value={draft.keyActivitiesSummary || ''}
                    onChange={(e) => setDraft({ ...draft, keyActivitiesSummary: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Stages Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Các giai đoạn &amp; Danh sách bài học theo thứ tự
                  </h3>
                  <button
                    type="button"
                    onClick={addStage}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm giai đoạn</span>
                  </button>
                </div>

                {(draft.stages || []).map((stage, sIdx) => (
                  <div
                    key={stage.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={stage.title}
                        onChange={(e) => {
                          const next = structuredClone(draft.stages || []);
                          next[sIdx].title = e.target.value;
                          setDraft({ ...draft, stages: next });
                        }}
                        placeholder="Tên giai đoạn..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-lg"
                      />
                      <select
                        aria-label={`Thêm giáo án từ thư viện vào ${stage.title}`}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addItemToStage(sIdx, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="">+ Gắn giáo án từ thư viện...</option>
                        {store.lessonTemplates.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addItemToStage(sIdx)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        + Mục tự nhập
                      </button>
                    </div>

                    <div className="space-y-2">
                      {stage.items.map((item, iIdx) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          <input
                            type="text"
                            value={item.customTitle}
                            onChange={(e) => {
                              const next = structuredClone(draft.stages || []);
                              next[sIdx].items[iIdx].customTitle = e.target.value;
                              setDraft({ ...draft, stages: next });
                            }}
                            className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-[11px] text-slate-500">
                              Buổi:
                              <input
                                type="number"
                                min={1}
                                value={item.estimatedSessions}
                                onChange={(e) => {
                                  const next = structuredClone(draft.stages || []);
                                  next[sIdx].items[iIdx].estimatedSessions = Number(e.target.value);
                                  setDraft({ ...draft, stages: next });
                                }}
                                className="w-14 ml-1 px-2 py-1 text-xs font-mono border border-slate-200 rounded"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const next = structuredClone(draft.stages || []);
                                next[sIdx].items.splice(iIdx, 1);
                                setDraft({ ...draft, stages: next });
                              }}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              aria-label="Xóa bài học khỏi giai đoạn"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Đang lưu...' : 'Lưu lộ trình mẫu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
