import React, { useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  Check,
  CheckCircle2,
  FilePlus2,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AiServiceStatus,
  AiSuggestionRecord,
  AldenStoreData,
  LessonTemplate,
  TutorFlowLearner,
} from '../types/alden';
import { api } from '../services/api';
import { generateId } from '../lib/domainLogic';
import { COMMON_SKILLS, formatDateShortVi } from '../utils/formatters';

interface AiAssistantViewProps {
  store: AldenStoreData;
  learners: TutorFlowLearner[];
  aiStatus: AiServiceStatus | null;
  initialTab?: AiToolTab;
  initialTargetId?: string | null;
  onSaveGeneratedLesson: (lesson: Partial<LessonTemplate>) => Promise<void>;
  onSaveSuggestion: (payload: Partial<AiSuggestionRecord>) => Promise<void>;
  onUpdateSuggestionStatus: (id: string, status: 'accepted' | 'dismissed') => Promise<void>;
  onDeleteSuggestion: (id: string) => Promise<void>;
}

export type AiToolTab = 'generate' | 'evaluate' | 'next_session' | 'progress' | 'saved';

export function AiAssistantView({
  store,
  learners,
  aiStatus,
  initialTab = 'generate',
  initialTargetId,
  onSaveGeneratedLesson,
  onSaveSuggestion,
  onUpdateSuggestionStatus,
  onDeleteSuggestion,
}: AiAssistantViewProps) {
  const [tab, setTab] = useState<AiToolTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Generate Lesson State
  const [genTopic, setGenTopic] = useState('');
  const [genBook, setGenBook] = useState('');
  const [genAudience, setGenAudience] = useState('Người đi làm lớp 1–1');
  const [genLevel, setGenLevel] = useState('A2 – B1');
  const [genDuration, setGenDuration] = useState(60);
  const [genObjectives, setGenObjectives] = useState('');
  const [genSkills, setGenSkills] = useState<string[]>(['Speaking', 'Vocabulary']);
  const [genLangMode, setGenLangMode] = useState('Song ngữ Anh – Việt (giải thích tiếng Việt, ví dụ & câu hỏi tiếng Anh)');
  const [genNotes, setGenNotes] = useState('');
  const [genMaterialId, setGenMaterialId] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState<Partial<LessonTemplate> | null>(null);
  const [generatedModel, setGeneratedModel] = useState('');
  const [savingGenerated, setSavingGenerated] = useState(false);

  // 2. Evaluate Plan State
  const [evalType, setEvalType] = useState<'lesson' | 'curriculum'>('lesson');
  const [evalTargetId, setEvalTargetId] = useState<string>(
    initialTargetId || store.lessonTemplates[0]?.id || ''
  );
  const [evalResult, setEvalResult] = useState<{
    result: Record<string, unknown>;
    model: string;
  } | null>(null);

  // 3. Next Session State
  const [nextLearnerId, setNextLearnerId] = useState<string>(
    initialTargetId || learners[0]?.id || ''
  );
  const [nextExtra, setNextExtra] = useState('');
  const [nextResult, setNextResult] = useState<{
    result: Record<string, unknown>;
    model: string;
  } | null>(null);

  // 4. Progress Summary State
  const [progLearnerId, setProgLearnerId] = useState<string>(
    initialTargetId || learners[0]?.id || ''
  );
  const [progResult, setProgResult] = useState<{
    result: Record<string, unknown>;
    model: string;
  } | null>(null);

  React.useEffect(() => {
    setTab(initialTab);
    if (initialTargetId) {
      if (initialTab === 'evaluate') {
        const isLesson = store.lessonTemplates.some((l) => l.id === initialTargetId);
        setEvalType(isLesson ? 'lesson' : 'curriculum');
        setEvalTargetId(initialTargetId);
      } else if (initialTab === 'next_session') {
        setNextLearnerId(initialTargetId);
      } else if (initialTab === 'progress') {
        setProgLearnerId(initialTargetId);
      }
    }
  }, [initialTab, initialTargetId]);

  const readableMaterials = store.materials.filter((m) => m.textReadable);

  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) {
      setError('Vui lòng nhập tên bài hoặc chủ đề giáo án.');
      return;
    }
    setLoading(true);
    setError(null);
    setGeneratedDraft(null);
    try {
      const { result, model } = await api.aiGenerateLesson({
        titleOrTopic: genTopic.trim(),
        bookInfo: genBook.trim() || undefined,
        targetAudience: genAudience.trim() || undefined,
        level: genLevel.trim() || undefined,
        objectives: genObjectives.trim() || undefined,
        durationMinutes: genDuration,
        skills: genSkills,
        languageMode: genLangMode,
        notes: genNotes.trim() || undefined,
        materialId: genMaterialId || undefined,
      });

      const rawActs = Array.isArray(result.activities)
        ? (result.activities as Record<string, unknown>[])
        : [];
      const draft: Partial<LessonTemplate> = {
        title: String(result.title || genTopic),
        titleEn: String(result.titleEn || ''),
        status: 'draft',
        lessonType: result.lessonType === 'textbook' || genBook.trim() ? 'textbook' : 'standalone',
        bookSeries: String(result.bookSeries || genBook || ''),
        unit: String(result.unit || ''),
        lessonNumber: String(result.lessonNumber || ''),
        pages: String(result.pages || ''),
        topic: String(result.topic || genTopic),
        level: String(result.level || genLevel),
        targetAudience: String(result.targetAudience || genAudience),
        skills: Array.isArray(result.skills) ? (result.skills as string[]) : genSkills,
        learningObjectives: String(result.learningObjectives || ''),
        keyKnowledge: String(result.keyKnowledge || ''),
        durationMinutes: Number(result.durationMinutes) || genDuration,
        vocabulary: String(result.vocabulary || ''),
        grammar: String(result.grammar || ''),
        pronunciation: String(result.pronunciation || ''),
        preparationNotes: String(result.preparationNotes || ''),
        materialIds: genMaterialId ? [genMaterialId] : [],
        activities: rawActs.map((a) => ({
          id: generateId('act'),
          title: String(a.title || 'Hoạt động'),
          titleEn: String(a.titleEn || ''),
          stage: String(a.stage || 'Practice'),
          durationMinutes: Number(a.durationMinutes) || 10,
          objective: String(a.objective || ''),
          teacherInstructions: String(a.teacherInstructions || ''),
          studentTask: String(a.studentTask || ''),
          guidingQuestions: String(a.guidingQuestions || ''),
          answerKey: String(a.answerKey || ''),
        })),
        homework: String(result.homework || ''),
        assessmentMethod: String(result.assessmentMethod || ''),
        additionalNotes: String(result.additionalNotes || ''),
      };
      setGeneratedDraft(draft);
      setGeneratedModel(model);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneratedToLibrary = async () => {
    if (!generatedDraft) return;
    setSavingGenerated(true);
    try {
      await onSaveGeneratedLesson(generatedDraft);
      setGeneratedDraft(null);
    } finally {
      setSavingGenerated(false);
    }
  };

  const handleRunEvaluate = async () => {
    if (!evalTargetId) return;
    setLoading(true);
    setError(null);
    setEvalResult(null);
    try {
      const data = await api.aiEvaluate(evalType, evalTargetId);
      setEvalResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunNextSession = async () => {
    if (!nextLearnerId) return;
    setLoading(true);
    setError(null);
    setNextResult(null);
    try {
      const data = await api.aiNextSession(nextLearnerId, nextExtra.trim() || undefined);
      setNextResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunProgress = async () => {
    if (!progLearnerId) return;
    setLoading(true);
    setError(null);
    setProgResult(null);
    try {
      const data = await api.aiProgressSummary(progLearnerId);
      setProgResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Trợ lý AI sư phạm
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Mọi kết quả AI đều chạy phía máy chủ và chỉ là <strong>bản nháp</strong> chờ giáo viên xem, chỉnh sửa và xác nhận.
        </p>
      </div>

      {/* Honest AI Server Status Banner */}
      <div
        className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
          aiStatus?.configured
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {aiStatus?.configured ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
          )}
          <span>{aiStatus?.message || 'Đang kiểm tra trạng thái dịch vụ AI...'}</span>
        </div>
        <span className="font-mono text-[11px] opacity-80">
          {aiStatus?.provider} · {aiStatus?.model}
        </span>
      </div>

      {/* Tool Tabs */}
      <div
        role="tablist"
        aria-label="Chức năng AI"
        className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-lg"
      >
        {(
          [
            ['generate', 'Tạo giáo án mới'],
            ['evaluate', 'Đánh giá giáo án & lộ trình'],
            ['next_session', 'Đề xuất buổi tiếp theo'],
            ['progress', 'Tóm tắt tiến bộ'],
            ['saved', `Đề xuất đã lưu (${store.aiSuggestions.length})`],
          ] as [AiToolTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Không thể thực hiện yêu cầu AI</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 1: GENERATE LESSON PLAN */}
      {/* ================================================================= */}
      {tab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleGenerateLesson}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 text-sm"
          >
            <h2 className="text-sm font-bold text-slate-900">Thông tin đầu vào tạo giáo án</h2>
            <div>
              <label htmlFor="ai-gen-topic" className="block text-xs font-semibold text-slate-700 mb-1">
                Tên bài hoặc chủ đề *
              </label>
              <input
                id="ai-gen-topic"
                type="text"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="VD: Shopping & Asking for a Refund / Present Perfect"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="ai-gen-book" className="block text-xs font-medium text-slate-600 mb-1">
                Bộ sách, Unit &amp; Trang (tùy chọn)
              </label>
              <input
                id="ai-gen-book"
                type="text"
                value={genBook}
                onChange={(e) => setGenBook(e.target.value)}
                placeholder="VD: English File Pre-Intermediate · Unit 4B · tr. 30–31"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ai-gen-level" className="block text-xs font-medium text-slate-600 mb-1">
                  Trình độ
                </label>
                <input
                  id="ai-gen-level"
                  type="text"
                  value={genLevel}
                  onChange={(e) => setGenLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="ai-gen-dur" className="block text-xs font-medium text-slate-600 mb-1">
                  Thời lượng (phút)
                </label>
                <input
                  id="ai-gen-dur"
                  type="number"
                  min={15}
                  max={180}
                  value={genDuration}
                  onChange={(e) => setGenDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ai-gen-aud" className="block text-xs font-medium text-slate-600 mb-1">
                Đối tượng học
              </label>
              <input
                id="ai-gen-aud"
                type="text"
                value={genAudience}
                onChange={(e) => setGenAudience(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">Kỹ năng tập trung</span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SKILLS.map((sk) => {
                  const active = genSkills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() =>
                        setGenSkills(
                          active ? genSkills.filter((x) => x !== sk) : [...genSkills, sk]
                        )
                      }
                      className={`px-2 py-1 rounded text-xs border cursor-pointer ${
                        active
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {sk}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label htmlFor="ai-gen-obj" className="block text-xs font-medium text-slate-600 mb-1">
                Mục tiêu mong muốn
              </label>
              <textarea
                id="ai-gen-obj"
                rows={2}
                value={genObjectives}
                onChange={(e) => setGenObjectives(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="ai-gen-lang" className="block text-xs font-medium text-slate-600 mb-1">
                Yêu cầu ngôn ngữ Anh – Việt
              </label>
              <input
                id="ai-gen-lang"
                type="text"
                value={genLangMode}
                onChange={(e) => setGenLangMode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            {readableMaterials.length > 0 && (
              <div>
                <label htmlFor="ai-gen-mat" className="block text-xs font-medium text-slate-600 mb-1">
                  Đính kèm tài liệu văn bản đọc được (.txt/.md)
                </label>
                <select
                  id="ai-gen-mat"
                  value={genMaterialId}
                  onChange={(e) => setGenMaterialId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Không đính kèm</option>
                  {readableMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="ai-gen-notes" className="block text-xs font-medium text-slate-600 mb-1">
                Ghi chú riêng cho giáo viên
              </label>
              <textarea
                id="ai-gen-notes"
                rows={2}
                value={genNotes}
                onChange={(e) => setGenNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{loading ? 'AI đang soạn bản nháp...' : 'Tạo bản nháp giáo án'}</span>
            </button>
          </form>

          {/* Editable Generated Draft Preview */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            {!generatedDraft ? (
              <div className="py-16 text-center space-y-2 text-slate-500">
                <FilePlus2 className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">
                  Bản nháp giáo án sẽ xuất hiện tại đây
                </p>
                <p className="text-xs">
                  Bạn có thể chỉnh sửa trực tiếp tên bài, mục tiêu và các hoạt động trước khi lưu vào Thư viện giáo án.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <span className="font-semibold text-blue-800">
                    Bản nháp AI ({generatedModel}) — Xem &amp; chỉnh sửa trước khi lưu
                  </span>
                  <button
                    type="button"
                    disabled={savingGenerated}
                    onClick={handleSaveGeneratedToLibrary}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{savingGenerated ? 'Đang lưu...' : 'Lưu vào Thư viện giáo án'}</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={generatedDraft.title || ''}
                  onChange={(e) => setGeneratedDraft({ ...generatedDraft, title: e.target.value })}
                  className="w-full px-3 py-2 text-base font-bold text-slate-900 border border-slate-200 rounded-lg"
                />
                <textarea
                  rows={2}
                  value={generatedDraft.learningObjectives || ''}
                  onChange={(e) =>
                    setGeneratedDraft({ ...generatedDraft, learningObjectives: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-900">Từ vựng</p>
                    <p className="mt-1">{generatedDraft.vocabulary}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-900">Ngữ pháp</p>
                    <p className="mt-1">{generatedDraft.grammar}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-slate-900">
                    Các hoạt động ({generatedDraft.activities?.length || 0})
                  </p>
                  {(generatedDraft.activities || []).map((a, idx) => (
                    <div key={a.id} className="p-3 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-900">
                        <span>
                          {idx + 1}. {a.title} ({a.stage})
                        </span>
                        <span className="font-mono tabular-nums">{a.durationMinutes}p</span>
                      </div>
                      <p className="text-slate-600">
                        <strong>GV:</strong> {a.teacherInstructions}
                      </p>
                      <p className="text-slate-600">
                        <strong>HV:</strong> {a.studentTask}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-slate-700">
                  <strong>Bài tập về nhà:</strong> {generatedDraft.homework}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: EVALUATE LESSON OR CURRICULUM */}
      {/* ================================================================= */}
      {tab === 'evaluate' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <label htmlFor="eval-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Đối tượng đánh giá
              </label>
              <select
                id="eval-type"
                value={evalType}
                onChange={(e) => {
                  const next = e.target.value as 'lesson' | 'curriculum';
                  setEvalType(next);
                  setEvalTargetId(
                    next === 'lesson'
                      ? store.lessonTemplates[0]?.id || ''
                      : store.curriculumTemplates[0]?.id || ''
                  );
                }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="lesson">Giáo án mẫu</option>
                <option value="curriculum">Lộ trình học mẫu</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="eval-target" className="block text-xs font-semibold text-slate-700 mb-1">
                Chọn mục cần phân tích
              </label>
              <select
                id="eval-target"
                value={evalTargetId}
                onChange={(e) => setEvalTargetId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {evalType === 'lesson'
                  ? store.lessonTemplates.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} ({l.level})
                      </option>
                    ))
                  : store.curriculumTemplates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.estimatedSessions} buổi)
                      </option>
                    ))}
              </select>
            </div>
            <button
              type="button"
              disabled={loading || !evalTargetId}
              onClick={handleRunEvaluate}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{loading ? 'Đang đánh giá...' : 'Phân tích bằng AI'}</span>
            </button>
          </div>

          {evalResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-blue-800">
                  Kết quả đánh giá từ AI ({evalResult.model})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onSaveSuggestion({
                      type: evalType === 'lesson' ? 'lesson_evaluation' : 'curriculum_evaluation',
                      title: `Đánh giá AI: ${
                        evalType === 'lesson'
                          ? store.lessonTemplates.find((l) => l.id === evalTargetId)?.title
                          : store.curriculumTemplates.find((c) => c.id === evalTargetId)?.title
                      }`,
                      lessonTemplateId: evalType === 'lesson' ? evalTargetId : undefined,
                      curriculumTemplateId: evalType === 'curriculum' ? evalTargetId : undefined,
                      content: evalResult.result,
                      modelUsed: evalResult.model,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span>Lưu nhận xét này</span>
                </button>
              </div>

              <p className="text-sm text-slate-800 leading-relaxed">
                {String(evalResult.result.overallSummary || '')}
              </p>

              {Array.isArray(evalResult.result.criteria) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Nhận xét chi tiết theo từng tiêu chí
                  </h3>
                  {(
                    evalResult.result.criteria as {
                      name: string;
                      assessment: string;
                      suggestedEdit: string;
                    }[]
                  ).map((c, i) => (
                    <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-slate-700">{c.assessment}</p>
                      <p className="text-blue-800">
                        <strong>Đề xuất sửa:</strong> {c.suggestedEdit}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(evalResult.result.missingInformation) &&
                (evalResult.result.missingInformation as string[]).length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <p className="font-bold">Thông tin còn thiếu để đánh giá sâu hơn:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {(evalResult.result.missingInformation as string[]).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: NEXT SESSION PROPOSAL */}
      {/* ================================================================= */}
      {tab === 'next_session' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label htmlFor="ai-next-learner" className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn học viên hoặc nhóm
                </label>
                <select
                  id="ai-next-learner"
                  value={nextLearnerId}
                  onChange={(e) => setNextLearnerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.displayName} ({l.entityType === 'group' ? 'Nhóm' : '1–1'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-next-extra" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú bổ sung (tùy chọn)
                </label>
                <input
                  id="ai-next-extra"
                  type="text"
                  value={nextExtra}
                  onChange={(e) => setNextExtra(e.target.value)}
                  placeholder="VD: Buổi tới chỉ có 45 phút, cần tập trung nói..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="button"
                disabled={loading || !nextLearnerId}
                onClick={handleRunNextSession}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{loading ? 'Đang phân tích...' : 'Đề xuất buổi học tiếp theo'}</span>
              </button>
            </div>
          </div>

          {nextResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <span className="font-bold text-blue-800">
                  Bản nháp đề xuất buổi tiếp theo ({nextResult.model})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const learner = learners.find((l) => l.id === nextLearnerId);
                    onSaveSuggestion({
                      type: 'next_session',
                      title: `Đề xuất buổi tiếp theo — ${learner?.displayName || 'Học viên'}`,
                      learnerId: nextLearnerId,
                      content: nextResult.result,
                      modelUsed: nextResult.model,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium cursor-pointer"
                >
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span>Lưu vào danh sách đề xuất</span>
                </button>
              </div>
              <p className="text-sm text-slate-800">
                <strong>Lý do đề xuất:</strong> {String(nextResult.result.reason || '')}
              </p>
              {Array.isArray(nextResult.result.carryOverAndReview) && (
                <div>
                  <p className="font-bold text-slate-900">Nội dung tiếp tục / ôn tập:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-700">
                    {(nextResult.result.carryOverAndReview as string[]).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(nextResult.result.nextObjectives) && (
                <div>
                  <p className="font-bold text-slate-900">Mục tiêu buổi tiếp theo:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-700">
                    {(nextResult.result.nextObjectives as string[]).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(nextResult.result.missingInfoToConfirm) &&
                (nextResult.result.missingInfoToConfirm as string[]).length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <p className="font-bold">Thông tin còn thiếu cần giáo viên xác nhận:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {(nextResult.result.missingInfoToConfirm as string[]).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: PROGRESS SUMMARY (FACT vs AI OBSERVATION SEPARATION) */}
      {/* ================================================================= */}
      {tab === 'progress' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label htmlFor="ai-prog-learner" className="block text-xs font-semibold text-slate-700 mb-1">
                Chọn học viên hoặc nhóm cần tổng hợp tiến bộ
              </label>
              <select
                id="ai-prog-learner"
                value={progLearnerId}
                onChange={(e) => setProgLearnerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.displayName} ({l.entityType === 'group' ? 'Nhóm' : '1–1'})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={loading || !progLearnerId}
              onClick={handleRunProgress}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{loading ? 'Đang tổng hợp...' : 'Tóm tắt tiến bộ'}</span>
            </button>
          </div>

          {progResult && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              {/* Column 1: Strictly Recorded Facts */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
                  1. Thông tin đã được giáo viên ghi nhận
                </h3>
                {(() => {
                  const facts = (progResult.result.recordedFacts || {}) as Record<string, string[]>;
                  return (
                    <div className="space-y-3 text-slate-700">
                      <div>
                        <p className="font-semibold text-emerald-800">Nội dung đã học / hoàn thành:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {(facts.completedContent || []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-800">Nội dung còn thiếu / dạy dở / cần ôn:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {(facts.incompleteOrReviewContent || []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Điểm mạnh đã ghi nhận:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {(facts.recordedStrengths || []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-rose-800">Khó khăn / lỗi đã ghi nhận:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {(facts.recordedDifficulties || []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* Column 2: Clearly Labeled AI Observations & Suggestions */}
              <section className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-blue-900 pb-2 border-b border-blue-100">
                  2. Nhận xét &amp; Đề xuất của AI ({progResult.model})
                </h3>
                {(() => {
                  const obs = (progResult.result.aiObservationsAndSuggestions || {}) as {
                    overallObservation?: string;
                    recommendedNextSteps?: string[];
                  };
                  const missing = (progResult.result.missingDataNotes || []) as string[];
                  return (
                    <div className="space-y-3 text-slate-700">
                      <p className="leading-relaxed">{obs.overallObservation}</p>
                      <div>
                        <p className="font-semibold text-blue-900">Gợi ý bước tiếp theo (Bản nháp):</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {(obs.recommendedNextSteps || []).map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      {missing.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                          <p className="font-semibold">Dữ liệu còn thiếu:</p>
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                            {missing.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 5: SAVED AI DRAFTS ARCHIVE */}
      {/* ================================================================= */}
      {tab === 'saved' && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
          {store.aiSuggestions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Chưa có đề xuất AI nào được lưu.
            </p>
          ) : (
            store.aiSuggestions.map((s) => (
              <div key={s.id} className="p-5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{s.title}</p>
                    <p className="text-slate-500 mt-0.5">
                      Trạng thái:{' '}
                      <strong
                        className={
                          s.status === 'accepted'
                            ? 'text-emerald-700'
                            : s.status === 'dismissed'
                            ? 'text-slate-400'
                            : 'text-amber-700'
                        }
                      >
                        {s.status === 'accepted'
                          ? 'Đã chấp nhận'
                          : s.status === 'dismissed'
                          ? 'Đã bỏ qua'
                          : 'Bản nháp chờ duyệt'}
                      </strong>{' '}
                      · {s.modelUsed} · {formatDateShortVi(s.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUpdateSuggestionStatus(s.id, 'accepted')}
                          className="px-2.5 py-1 rounded-md bg-emerald-700 text-white font-medium cursor-pointer"
                        >
                          Xác nhận dùng
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSuggestionStatus(s.id, 'dismissed')}
                          className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 cursor-pointer"
                        >
                          Bỏ qua
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteSuggestion(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label={`Xóa đề xuất ${s.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {typeof s.content.reason === 'string' && (
                  <p className="text-slate-700 leading-relaxed">{s.content.reason}</p>
                )}
                {typeof s.content.overallSummary === 'string' && (
                  <p className="text-slate-700 leading-relaxed">{s.content.overallSummary}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
