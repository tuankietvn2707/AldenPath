import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Copy,
  ExternalLink,
  FileText,
  FolderTree,
  Layers,
  List,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AldenStoreData,
  LessonActivity,
  LessonTemplate,
  MaterialCategory,
  MaterialItem,
  ReusableActivity,
} from '../types/alden';
import {
  filterLessons,
  generateId,
  getTotalActivityMinutes,
  groupLessonsIntoTree,
  validateSafeUrl,
  type LessonFilters,
} from '../lib/domainLogic';
import {
  ACTIVITY_STAGES,
  COMMON_LEVELS,
  COMMON_SKILLS,
  formatDateShortVi,
  formatFileSize,
  MATERIAL_CATEGORY_LABELS,
} from '../utils/formatters';

interface LessonsViewProps {
  store: AldenStoreData;
  initialEditLessonId?: string | null;
  openCreateSignal?: number;
  onSaveLesson: (lesson: Partial<LessonTemplate>, existingId?: string) => Promise<void>;
  onDeleteLesson: (id: string) => Promise<void>;
  onSaveActivity: (activity: Partial<ReusableActivity>, existingId?: string) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
  onCreateMaterial: (
    payload: Partial<MaterialItem> & { fileBase64?: string; originalFileName?: string }
  ) => Promise<void>;
  onDeleteMaterial: (id: string) => Promise<void>;
  onEvaluateLessonWithAi: (lessonId: string) => void;
}

type LessonsSubTab = 'library' | 'activities' | 'materials';

function createEmptyLesson(): Partial<LessonTemplate> {
  return {
    title: '',
    titleEn: '',
    status: 'draft',
    lessonType: 'standalone',
    bookSeries: '',
    unit: '',
    lessonNumber: '',
    pages: '',
    topic: '',
    level: 'A2',
    targetAudience: '',
    skills: ['Speaking'],
    learningObjectives: '',
    keyKnowledge: '',
    durationMinutes: 60,
    vocabulary: '',
    grammar: '',
    pronunciation: '',
    preparationNotes: '',
    materialIds: [],
    activities: [],
    homework: '',
    assessmentMethod: '',
    additionalNotes: '',
  };
}

function createEmptyActivity(): LessonActivity {
  return {
    id: generateId('act'),
    title: '',
    titleEn: '',
    stage: 'Practice',
    durationMinutes: 15,
    objective: '',
    teacherInstructions: '',
    studentTask: '',
    guidingQuestions: '',
    answerKey: '',
  };
}

export function LessonsView({
  store,
  initialEditLessonId,
  openCreateSignal,
  onSaveLesson,
  onDeleteLesson,
  onSaveActivity,
  onDeleteActivity,
  onCreateMaterial,
  onDeleteMaterial,
  onEvaluateLessonWithAi,
}: LessonsViewProps) {
  const [subTab, setSubTab] = useState<LessonsSubTab>('library');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [filters, setFilters] = useState<LessonFilters>({
    query: '',
    bookSeries: 'all',
    level: 'all',
    skill: 'all',
    lessonType: 'all',
    durationBucket: 'all',
  });

  // Lesson editor state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonDraft, setLessonDraft] = useState<Partial<LessonTemplate> | null>(null);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Activity bank modal state
  const [bankDraft, setBankDraft] = useState<Partial<ReusableActivity> | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [savingBank, setSavingBank] = useState(false);

  // Material modal state
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [matType, setMatType] = useState<'link' | 'file'>('link');
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState<MaterialCategory>('worksheet');
  const [matUrl, setMatUrl] = useState('');
  const [matNotes, setMatNotes] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matError, setMatError] = useState<string | null>(null);
  const [savingMat, setSavingMat] = useState(false);

  // Open specific lesson when navigated from Dashboard
  React.useEffect(() => {
    if (initialEditLessonId) {
      const found = store.lessonTemplates.find((l) => l.id === initialEditLessonId);
      if (found) {
        setSubTab('library');
        setEditingLessonId(found.id);
        setLessonDraft(structuredClone(found));
      }
    }
  }, [initialEditLessonId]);

  React.useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      setSubTab('library');
      setEditingLessonId(null);
      setLessonDraft(createEmptyLesson());
      setLessonFormError(null);
    }
  }, [openCreateSignal]);

  const bookOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of store.lessonTemplates) {
      if (l.bookSeries?.trim()) set.add(l.bookSeries.trim());
    }
    return Array.from(set);
  }, [store.lessonTemplates]);

  const filteredLessons = useMemo(
    () => filterLessons(store.lessonTemplates, filters),
    [store.lessonTemplates, filters]
  );

  const treeGroups = useMemo(() => groupLessonsIntoTree(filteredLessons), [filteredLessons]);

  const openNewLesson = () => {
    setEditingLessonId(null);
    setLessonDraft(createEmptyLesson());
    setLessonFormError(null);
  };

  const openEditLesson = (lesson: LessonTemplate) => {
    setEditingLessonId(lesson.id);
    setLessonDraft(structuredClone(lesson));
    setLessonFormError(null);
  };

  const handleDuplicateLesson = async (lesson: LessonTemplate) => {
    const copy: Partial<LessonTemplate> = {
      ...structuredClone(lesson),
      id: undefined,
      title: `${lesson.title} (Bản sao)`,
      status: 'draft',
    };
    await onSaveLesson(copy);
  };

  const handleSaveLessonSubmit = async (targetStatus: 'draft' | 'published') => {
    if (!lessonDraft) return;
    if (!lessonDraft.title?.trim()) {
      setLessonFormError('Vui lòng nhập tên giáo án trước khi lưu.');
      return;
    }
    setLessonFormError(null);
    setSavingLesson(true);
    try {
      await onSaveLesson(
        { ...lessonDraft, status: targetStatus },
        editingLessonId || undefined
      );
      setLessonDraft(null);
      setEditingLessonId(null);
    } catch (err) {
      setLessonFormError((err as Error).message);
    } finally {
      setSavingLesson(false);
    }
  };

  const toggleSkill = (skill: string) => {
    if (!lessonDraft) return;
    const current = lessonDraft.skills || [];
    const next = current.includes(skill)
      ? current.filter((s) => s !== skill)
      : [...current, skill];
    setLessonDraft({ ...lessonDraft, skills: next });
  };

  const addActivityFromBank = (bankItem: ReusableActivity) => {
    if (!lessonDraft) return;
    const cloned: LessonActivity = {
      id: generateId('act'),
      title: bankItem.title,
      titleEn: bankItem.titleEn,
      stage: bankItem.stage,
      durationMinutes: bankItem.durationMinutes,
      objective: bankItem.objective,
      teacherInstructions: bankItem.teacherInstructions,
      studentTask: bankItem.studentTask,
      guidingQuestions: bankItem.guidingQuestions,
      answerKey: bankItem.answerKey,
      sourceBankActivityId: bankItem.id,
    };
    setLessonDraft({
      ...lessonDraft,
      activities: [...(lessonDraft.activities || []), cloned],
    });
    setShowBankPicker(false);
  };

  const updateActivityAt = (idx: number, patch: Partial<LessonActivity>) => {
    if (!lessonDraft) return;
    const list = [...(lessonDraft.activities || [])];
    list[idx] = { ...list[idx], ...patch };
    setLessonDraft({ ...lessonDraft, activities: list });
  };

  const moveActivity = (idx: number, dir: -1 | 1) => {
    if (!lessonDraft) return;
    const list = [...(lessonDraft.activities || [])];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    setLessonDraft({ ...lessonDraft, activities: list });
  };

  const removeActivityAt = (idx: number) => {
    if (!lessonDraft) return;
    const list = (lessonDraft.activities || []).filter((_, i) => i !== idx);
    setLessonDraft({ ...lessonDraft, activities: list });
  };

  const handleSaveBankActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankDraft?.title?.trim()) return;
    setSavingBank(true);
    try {
      await onSaveActivity(bankDraft, editingBankId || undefined);
      setBankDraft(null);
      setEditingBankId(null);
    } finally {
      setSavingBank(false);
    }
  };

  const handleCreateMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatError(null);
    if (!matTitle.trim()) {
      setMatError('Vui lòng nhập tên tài liệu.');
      return;
    }
    if (matType === 'link') {
      const check = validateSafeUrl(matUrl);
      if (!check.valid) {
        setMatError(check.reason || 'URL không hợp lệ.');
        return;
      }
      setSavingMat(true);
      try {
        await onCreateMaterial({
          title: matTitle.trim(),
          type: 'link',
          category: matCategory,
          url: check.normalized,
          notes: matNotes.trim(),
          linkedLessonIds: [],
        });
        setShowMaterialForm(false);
        setMatTitle('');
        setMatUrl('');
        setMatNotes('');
      } catch (err) {
        setMatError((err as Error).message);
      } finally {
        setSavingMat(false);
      }
      return;
    }

    // File upload
    if (!matFile) {
      setMatError('Vui lòng chọn tệp đính kèm.');
      return;
    }
    if (matFile.size > 10 * 1024 * 1024) {
      setMatError('Tệp vượt quá giới hạn 10 MB.');
      return;
    }
    setSavingMat(true);
    try {
      const arrayBuf = await matFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await onCreateMaterial({
        title: matTitle.trim(),
        type: 'file',
        category: matCategory,
        mimeType: matFile.type || 'application/octet-stream',
        originalFileName: matFile.name,
        fileBase64: base64,
        notes: matNotes.trim(),
        linkedLessonIds: [],
      });
      setShowMaterialForm(false);
      setMatTitle('');
      setMatFile(null);
      setMatNotes('');
    } catch (err) {
      setMatError((err as Error).message);
    } finally {
      setSavingMat(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-tab Segmented Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Thư viện giáo án &amp; Tài nguyên
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Soạn một lần, tái sử dụng cho nhiều lộ trình và buổi dạy mà không ảnh hưởng bản gốc.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Phân mục thư viện"
          className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'library'}
            onClick={() => setSubTab('library')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'library'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Giáo án ({store.lessonTemplates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'activities'}
            onClick={() => setSubTab('activities')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'activities'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ngân hàng hoạt động ({store.activityBank.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'materials'}
            onClick={() => setSubTab('materials')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'materials'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tài liệu ({store.materials.length})
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: LESSON LIBRARY */}
      {/* ================================================================= */}
      {subTab === 'library' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  placeholder="Tìm theo tên bài, bộ sách, unit, chủ đề, kỹ năng, từ khóa..."
                  aria-label="Tìm kiếm giáo án"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="Xem dạng danh sách"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>Danh sách</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('tree')}
                    aria-label="Xem dạng cây thư mục"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                      viewMode === 'tree'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FolderTree className="h-3.5 w-3.5" />
                    <span>Bộ sách → Unit</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openNewLesson}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Soạn giáo án mới</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <select
                aria-label="Lọc theo loại bài"
                value={filters.lessonType}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    lessonType: e.target.value as LessonFilters['lessonType'],
                  })
                }
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="all">Tất cả loại bài</option>
                <option value="textbook">Theo bộ sách</option>
                <option value="standalone">Giáo án độc lập</option>
              </select>

              <select
                aria-label="Lọc theo bộ sách"
                value={filters.bookSeries}
                onChange={(e) => setFilters({ ...filters, bookSeries: e.target.value })}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="all">Tất cả bộ sách</option>
                {bookOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                aria-label="Lọc theo trình độ"
                value={filters.level}
                onChange={(e) => setFilters({ ...filters, level: e.target.value })}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="all">Tất cả trình độ</option>
                {COMMON_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>

              <select
                aria-label="Lọc theo kỹ năng"
                value={filters.skill}
                onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="all">Tất cả kỹ năng</option>
                {COMMON_SKILLS.map((sk) => (
                  <option key={sk} value={sk}>
                    {sk}
                  </option>
                ))}
              </select>

              <select
                aria-label="Lọc theo thời lượng"
                value={filters.durationBucket}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    durationBucket: e.target.value as LessonFilters['durationBucket'],
                  })
                }
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="all">Mọi thời lượng</option>
                <option value="short">≤ 45 phút</option>
                <option value="medium">46 – 75 phút</option>
                <option value="long">&gt; 75 phút</option>
              </select>
            </div>
          </div>

          {/* Empty State */}
          {filteredLessons.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                Không tìm thấy giáo án phù hợp
              </p>
              <p className="text-xs text-slate-500">
                Thử thay đổi bộ lọc hoặc tạo nhanh một giáo án mới (chỉ cần nhập tên để lưu nháp).
              </p>
              <button
                type="button"
                onClick={openNewLesson}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo giáo án đầu tiên</span>
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
              {filteredLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span>
                        {lesson.lessonType === 'textbook'
                          ? [lesson.bookSeries, lesson.unit, lesson.lessonNumber, lesson.pages]
                              .filter(Boolean)
                              .join(' · ')
                          : `Giáo án độc lập · ${lesson.topic || 'Chủ đề riêng'}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          lesson.status === 'draft'
                            ? 'text-amber-700 font-medium'
                            : 'text-emerald-700 font-medium'
                        }
                      >
                        {lesson.status === 'draft' ? 'Bản nháp' : 'Đã hoàn thiện'}
                      </span>
                      {lesson.isSampleData && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">Dữ liệu mẫu</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditLesson(lesson)}
                      className="text-left text-base font-bold text-slate-900 hover:text-blue-700 transition-colors block"
                    >
                      {lesson.title}
                    </button>

                    {lesson.titleEn && (
                      <p className="text-xs text-slate-500 italic">{lesson.titleEn}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 tabular-nums">
                      <span>Trình độ: {lesson.level || 'Chưa rõ'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Kỹ năng: {lesson.skills.join(', ') || 'Tổng hợp'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{lesson.durationMinutes} phút</span>
                      <span aria-hidden="true">·</span>
                      <span>{lesson.activities.length} hoạt động</span>
                      <span aria-hidden="true">·</span>
                      <span>Cập nhật {formatDateShortVi(lesson.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditLesson(lesson)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Mở &amp; Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateLesson(lesson)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                      aria-label={`Sao chép giáo án ${lesson.title}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Sao chép</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEvaluateLessonWithAi(lesson.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-xs font-medium text-blue-800 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI đánh giá</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLesson(lesson.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      aria-label={`Xóa giáo án ${lesson.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Tree View: Bộ sách → Unit → Kỹ năng → Giáo án */
            <div className="space-y-4">
              {treeGroups.map((book) => (
                <section
                  key={book.bookSeries}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-900">
                    {book.bookSeries}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {book.units.map((u) => (
                      <div key={u.unit} className="p-5 space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {u.unit}
                        </h3>
                        <div className="space-y-3 pl-3 border-l border-slate-200">
                          {u.skills.map((sk) => (
                            <div key={sk.skill} className="space-y-2">
                              <p className="text-xs font-semibold text-blue-800">{sk.skill}</p>
                              <div className="space-y-2">
                                {sk.lessons.map((lesson) => (
                                  <div
                                    key={lesson.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100/80"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => openEditLesson(lesson)}
                                      className="text-left text-sm font-medium text-slate-900 hover:text-blue-700"
                                    >
                                      {lesson.title}
                                      <span className="ml-2 text-xs text-slate-500 tabular-nums">
                                        ({lesson.durationMinutes} phút · {lesson.level})
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditLesson(lesson)}
                                      className="text-xs font-medium text-blue-700 hover:underline self-start sm:self-auto"
                                    >
                                      Mở giáo án
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: REUSABLE ACTIVITY BANK */}
      {/* ================================================================= */}
      {subTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Lưu các hoạt động hiệu quả để chèn nhanh vào bất kỳ giáo án nào và tùy chỉnh riêng.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingBankId(null);
                setBankDraft({
                  title: '',
                  titleEn: '',
                  stage: 'Warm-up',
                  skill: 'Speaking',
                  level: 'A2 – B1',
                  durationMinutes: 10,
                  objective: '',
                  teacherInstructions: '',
                  studentTask: '',
                  guidingQuestions: '',
                  answerKey: '',
                  tags: [],
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm hoạt động mẫu</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {store.activityBank.map((act) => (
              <div
                key={act.id}
                className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="text-xs text-slate-500 tabular-nums">
                    {act.stage} · {act.skill} · {act.level} · {act.durationMinutes} phút
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{act.title}</h3>
                  {act.objective && (
                    <p className="text-xs text-slate-600">
                      <strong>Mục tiêu:</strong> {act.objective}
                    </p>
                  )}
                  {act.teacherInstructions && (
                    <p className="text-xs text-slate-600">
                      <strong>Hướng dẫn GV:</strong> {act.teacherInstructions}
                    </p>
                  )}
                  {act.studentTask && (
                    <p className="text-xs text-slate-600">
                      <strong>Học viên thực hiện:</strong> {act.studentTask}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBankId(act.id);
                      setBankDraft(structuredClone(act));
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteActivity(act.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    aria-label={`Xóa hoạt động ${act.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: MATERIALS & ATTACHMENTS */}
      {/* ================================================================= */}
      {subTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Lưu đường dẫn hoặc tải tệp đính kèm (PDF, Word, Ảnh, Audio, TXT). Hệ thống nêu rõ định dạng nào đọc được văn bản.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowMaterialForm(true);
                setMatError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium whitespace-nowrap cursor-pointer self-start sm:self-auto"
            >
              <Upload className="h-4 w-4" />
              <span>Thêm tài liệu / Tệp</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {store.materials.map((mat) => (
              <div
                key={mat.id}
                className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="text-xs text-slate-500">
                    {MATERIAL_CATEGORY_LABELS[mat.category]} ·{' '}
                    {mat.type === 'file' ? `Tệp tải lên (${formatFileSize(mat.fileSize)})` : 'Đường dẫn ngoài'}
                    {mat.isSampleData && ' · Dữ liệu mẫu'}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{mat.title}</h3>
                  {mat.notes && <p className="text-xs text-slate-600">{mat.notes}</p>}
                  <p
                    className={`text-xs ${
                      mat.textReadable ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {mat.readabilityNote}
                  </p>
                  {mat.extractedTextPreview && (
                    <pre className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans">
                      {mat.extractedTextPreview}
                    </pre>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {mat.type === 'link' && mat.url && (
                    <a
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-blue-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Mở liên kết</span>
                    </a>
                  )}
                  {mat.type === 'file' && mat.uploadId && (
                    <a
                      href={`/api/uploads/${encodeURIComponent(mat.uploadId)}`}
                      download={mat.fileName || mat.title}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Tải xuống</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteMaterial(mat.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    aria-label={`Xóa tài liệu ${mat.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FULL 13-FIELD LESSON EDITOR MODAL */}
      {/* ================================================================= */}
      {lessonDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lesson-editor-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 id="lesson-editor-title" className="text-base font-bold text-slate-900">
                  {editingLessonId ? 'Chỉnh sửa giáo án mẫu' : 'Soạn giáo án mới'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hỗ trợ song ngữ Anh – Việt. Các trường không bắt buộc có thể để trống khi lưu nháp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLessonDraft(null);
                  setEditingLessonId(null);
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Đóng trình soạn giáo án"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {lessonFormError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {lessonFormError}
                </div>
              )}

              {/* Section 1: Identity & Categorization */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Thông tin chung &amp; Phân loại
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="lesson-title-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên giáo án (bắt buộc)
                    </label>
                    <input
                      id="lesson-title-input"
                      type="text"
                      value={lessonDraft.title || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })}
                      placeholder="VD: Unit 3A: Kế hoạch & Hẹn lịch / Shopping Vocabulary"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-title-en" className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên tiếng Anh bổ sung (tùy chọn)
                    </label>
                    <input
                      id="lesson-title-en"
                      type="text"
                      value={lessonDraft.titleEn || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, titleEn: e.target.value })}
                      placeholder="VD: Plans and Arrangements"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-type" className="block text-xs font-semibold text-slate-700 mb-1">
                      Loại giáo án
                    </label>
                    <select
                      id="lesson-type"
                      value={lessonDraft.lessonType || 'standalone'}
                      onChange={(e) =>
                        setLessonDraft({
                          ...lessonDraft,
                          lessonType: e.target.value as 'textbook' | 'standalone',
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="standalone">Giáo án độc lập (Kỹ năng / Chủ đề / Ngữ pháp)</option>
                      <option value="textbook">Theo bộ sách (Bộ sách → Unit → Bài)</option>
                    </select>
                  </div>
                </div>

                {lessonDraft.lessonType === 'textbook' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label htmlFor="lesson-book" className="block text-xs font-medium text-slate-600 mb-1">
                        Bộ sách
                      </label>
                      <input
                        id="lesson-book"
                        type="text"
                        value={lessonDraft.bookSeries || ''}
                        onChange={(e) => setLessonDraft({ ...lessonDraft, bookSeries: e.target.value })}
                        placeholder="VD: English File Pre-Intermediate"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="lesson-unit" className="block text-xs font-medium text-slate-600 mb-1">
                        Unit / Phần
                      </label>
                      <input
                        id="lesson-unit"
                        type="text"
                        value={lessonDraft.unit || ''}
                        onChange={(e) => setLessonDraft({ ...lessonDraft, unit: e.target.value })}
                        placeholder="VD: Unit 3"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="lesson-pages" className="block text-xs font-medium text-slate-600 mb-1">
                        Bài &amp; Trang
                      </label>
                      <input
                        id="lesson-pages"
                        type="text"
                        value={lessonDraft.pages || ''}
                        onChange={(e) => setLessonDraft({ ...lessonDraft, pages: e.target.value })}
                        placeholder="VD: 3A · tr. 22–23"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="lesson-topic" className="block text-xs font-medium text-slate-600 mb-1">
                      Chủ đề / Điểm ngữ pháp / Kỹ năng độc lập
                    </label>
                    <input
                      id="lesson-topic"
                      type="text"
                      value={lessonDraft.topic || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, topic: e.target.value })}
                      placeholder="VD: Shopping, Past Simple, IELTS Speaking Part 1"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="lesson-level" className="block text-xs font-medium text-slate-600 mb-1">
                      Trình độ
                    </label>
                    <input
                      id="lesson-level"
                      type="text"
                      value={lessonDraft.level || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, level: e.target.value })}
                      placeholder="VD: A2, B1–B2"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-audience" className="block text-xs font-medium text-slate-600 mb-1">
                      Đối tượng học
                    </label>
                    <input
                      id="lesson-audience"
                      type="text"
                      value={lessonDraft.targetAudience || ''}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, targetAudience: e.target.value })
                      }
                      placeholder="VD: Người đi làm 1–1 / Nhóm IELTS"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-duration" className="block text-xs font-medium text-slate-600 mb-1">
                      Thời lượng dự kiến (phút)
                    </label>
                    <input
                      id="lesson-duration"
                      type="number"
                      min={10}
                      max={240}
                      value={lessonDraft.durationMinutes || 60}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, durationMinutes: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">
                    Kỹ năng trọng tâm
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SKILLS.map((sk) => {
                      const active = (lessonDraft.skills || []).includes(sk);
                      return (
                        <button
                          key={sk}
                          type="button"
                          onClick={() => toggleSkill(sk)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {sk}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Section 2: Objectives & Language Focus */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Mục tiêu đầu ra &amp; Ngôn ngữ trọng tâm
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lesson-obj" className="block text-xs font-medium text-slate-600 mb-1">
                      Mục tiêu đầu ra (Learning Objectives)
                    </label>
                    <textarea
                      id="lesson-obj"
                      rows={2}
                      value={lessonDraft.learningObjectives || ''}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, learningObjectives: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-key" className="block text-xs font-medium text-slate-600 mb-1">
                      Kiến thức trọng tâm (Key Knowledge)
                    </label>
                    <textarea
                      id="lesson-key"
                      rows={2}
                      value={lessonDraft.keyKnowledge || ''}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, keyKnowledge: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-vocab" className="block text-xs font-medium text-slate-600 mb-1">
                      Từ vựng (Vocabulary)
                    </label>
                    <textarea
                      id="lesson-vocab"
                      rows={2}
                      value={lessonDraft.vocabulary || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, vocabulary: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-grammar" className="block text-xs font-medium text-slate-600 mb-1">
                      Ngữ pháp (Grammar)
                    </label>
                    <textarea
                      id="lesson-grammar"
                      rows={2}
                      value={lessonDraft.grammar || ''}
                      onChange={(e) => setLessonDraft({ ...lessonDraft, grammar: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-pron" className="block text-xs font-medium text-slate-600 mb-1">
                      Phát âm (Pronunciation)
                    </label>
                    <input
                      id="lesson-pron"
                      type="text"
                      value={lessonDraft.pronunciation || ''}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, pronunciation: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesson-prep" className="block text-xs font-medium text-slate-600 mb-1">
                      Chuẩn bị trước buổi học
                    </label>
                    <input
                      id="lesson-prep"
                      type="text"
                      value={lessonDraft.preparationNotes || ''}
                      onChange={(e) =>
                        setLessonDraft({ ...lessonDraft, preparationNotes: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* Linked Materials Picker */}
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Tài liệu &amp; File đính kèm
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {store.materials.map((m) => {
                      const selected = (lessonDraft.materialIds || []).includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const curr = lessonDraft.materialIds || [];
                            setLessonDraft({
                              ...lessonDraft,
                              materialIds: selected
                                ? curr.filter((x) => x !== m.id)
                                : [...curr, m.id],
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                            selected
                              ? 'bg-blue-50 border-blue-300 text-blue-800 font-medium'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {m.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Section 3: Ordered Activities */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Các giai đoạn &amp; Hoạt động theo thứ tự
                    </h3>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      Tổng thời lượng hoạt động:{' '}
                      <strong>{getTotalActivityMinutes(lessonDraft.activities || [])} phút</strong> /{' '}
                      {lessonDraft.durationMinutes || 60} phút dự kiến
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBankPicker((v) => !v)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>Chèn từ ngân hàng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLessonDraft({
                          ...lessonDraft,
                          activities: [...(lessonDraft.activities || []), createEmptyActivity()],
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm hoạt động</span>
                    </button>
                  </div>
                </div>

                {showBankPicker && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Chọn hoạt động tái sử dụng để sao chép vào giáo án:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {store.activityBank.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => addActivityFromBank(b)}
                          className="text-left p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 transition-colors cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-slate-900">{b.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {b.stage} · {b.skill} · {b.durationMinutes} phút
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {(lessonDraft.activities || []).map((act, idx) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 tabular-nums">
                          Hoạt động {idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveActivity(idx, -1)}
                            disabled={idx === 0}
                            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 cursor-pointer"
                          >
                            Lên
                          </button>
                          <button
                            type="button"
                            onClick={() => moveActivity(idx, 1)}
                            disabled={idx === (lessonDraft.activities || []).length - 1}
                            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 cursor-pointer"
                          >
                            Xuống
                          </button>
                          <button
                            type="button"
                            onClick={() => removeActivityAt(idx)}
                            className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                        <input
                          type="text"
                          value={act.title}
                          onChange={(e) => updateActivityAt(idx, { title: e.target.value })}
                          placeholder="Tên hoạt động..."
                          aria-label={`Tên hoạt động ${idx + 1}`}
                          className="sm:col-span-3 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                        />
                        <select
                          value={act.stage}
                          onChange={(e) => updateActivityAt(idx, { stage: e.target.value })}
                          aria-label={`Giai đoạn hoạt động ${idx + 1}`}
                          className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
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
                          onChange={(e) =>
                            updateActivityAt(idx, { durationMinutes: Number(e.target.value) })
                          }
                          aria-label={`Thời lượng hoạt động ${idx + 1}`}
                          className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={act.objective}
                          onChange={(e) => updateActivityAt(idx, { objective: e.target.value })}
                          placeholder="Mục tiêu hoạt động"
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={act.teacherInstructions}
                          onChange={(e) =>
                            updateActivityAt(idx, { teacherInstructions: e.target.value })
                          }
                          placeholder="Hướng dẫn giáo viên"
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={act.studentTask}
                          onChange={(e) => updateActivityAt(idx, { studentTask: e.target.value })}
                          placeholder="Việc học viên thực hiện"
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={act.guidingQuestions}
                          onChange={(e) =>
                            updateActivityAt(idx, { guidingQuestions: e.target.value })
                          }
                          placeholder="Câu hỏi gợi ý (Guiding questions)"
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={act.answerKey}
                          onChange={(e) => updateActivityAt(idx, { answerKey: e.target.value })}
                          placeholder="Đáp án / Tiêu chí mẫu (Answer key)"
                          className="sm:col-span-2 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Section 4: Homework, Assessment & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="lesson-hw" className="block text-xs font-medium text-slate-600 mb-1">
                    Bài tập về nhà (Homework)
                  </label>
                  <textarea
                    id="lesson-hw"
                    rows={2}
                    value={lessonDraft.homework || ''}
                    onChange={(e) => setLessonDraft({ ...lessonDraft, homework: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="lesson-assess" className="block text-xs font-medium text-slate-600 mb-1">
                    Cách đánh giá kết quả buổi học
                  </label>
                  <textarea
                    id="lesson-assess"
                    rows={2}
                    value={lessonDraft.assessmentMethod || ''}
                    onChange={(e) =>
                      setLessonDraft({ ...lessonDraft, assessmentMethod: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="lesson-notes" className="block text-xs font-medium text-slate-600 mb-1">
                    Ghi chú bổ sung
                  </label>
                  <textarea
                    id="lesson-notes"
                    rows={2}
                    value={lessonDraft.additionalNotes || ''}
                    onChange={(e) =>
                      setLessonDraft({ ...lessonDraft, additionalNotes: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setLessonDraft(null);
                  setEditingLessonId(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingLesson}
                  onClick={() => handleSaveLessonSubmit('draft')}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  Lưu nháp
                </button>
                <button
                  type="button"
                  disabled={savingLesson}
                  onClick={() => handleSaveLessonSubmit('published')}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {savingLesson ? 'Đang lưu...' : 'Lưu giáo án'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY BANK MODAL */}
      {bankDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-modal-title"
        >
          <form
            onSubmit={handleSaveBankActivity}
            className="bg-white rounded-xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="bank-modal-title" className="text-sm font-bold text-slate-900">
                {editingBankId ? 'Sửa hoạt động tái sử dụng' : 'Thêm hoạt động vào ngân hàng'}
              </h2>
              <button
                type="button"
                onClick={() => setBankDraft(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-sm">
              <input
                type="text"
                required
                value={bankDraft.title || ''}
                onChange={(e) => setBankDraft({ ...bankDraft, title: e.target.value })}
                placeholder="Tên hoạt động *"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-3 gap-2.5">
                <select
                  value={bankDraft.stage || 'Warm-up'}
                  onChange={(e) => setBankDraft({ ...bankDraft, stage: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {ACTIVITY_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <select
                  value={bankDraft.skill || 'Speaking'}
                  onChange={(e) => setBankDraft({ ...bankDraft, skill: e.target.value })}
                  className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {COMMON_SKILLS.map((sk) => (
                    <option key={sk} value={sk}>
                      {sk}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={2}
                  value={bankDraft.durationMinutes || 10}
                  onChange={(e) =>
                    setBankDraft({ ...bankDraft, durationMinutes: Number(e.target.value) })
                  }
                  className="px-2.5 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <textarea
                rows={2}
                value={bankDraft.objective || ''}
                onChange={(e) => setBankDraft({ ...bankDraft, objective: e.target.value })}
                placeholder="Mục tiêu hoạt động"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <textarea
                rows={2}
                value={bankDraft.teacherInstructions || ''}
                onChange={(e) =>
                  setBankDraft({ ...bankDraft, teacherInstructions: e.target.value })
                }
                placeholder="Hướng dẫn giáo viên"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <textarea
                rows={2}
                value={bankDraft.studentTask || ''}
                onChange={(e) => setBankDraft({ ...bankDraft, studentTask: e.target.value })}
                placeholder="Nhiệm vụ học viên"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={bankDraft.guidingQuestions || ''}
                onChange={(e) => setBankDraft({ ...bankDraft, guidingQuestions: e.target.value })}
                placeholder="Câu hỏi gợi ý"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={bankDraft.answerKey || ''}
                onChange={(e) => setBankDraft({ ...bankDraft, answerKey: e.target.value })}
                placeholder="Đáp án / Gợi ý chấm"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBankDraft(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingBank}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800"
              >
                {savingBank ? 'Đang lưu...' : 'Lưu hoạt động'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MATERIAL UPLOAD / LINK MODAL */}
      {showMaterialForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mat-modal-title"
        >
          <form
            onSubmit={handleCreateMaterialSubmit}
            className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="mat-modal-title" className="text-sm font-bold text-slate-900">
                Thêm tài liệu hoặc tệp đính kèm
              </h2>
              <button
                type="button"
                onClick={() => setShowMaterialForm(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {matError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {matError}
                </div>
              )}

              <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMatType('link')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    matType === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Đường dẫn ngoài (URL)
                </button>
                <button
                  type="button"
                  onClick={() => setMatType('file')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    matType === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Tải tệp lên máy chủ
                </button>
              </div>

              <div>
                <label htmlFor="mat-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên tài liệu *
                </label>
                <input
                  id="mat-title"
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="VD: Phiếu bài tập Unit 3A"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="mat-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                  Phân loại
                </label>
                <select
                  id="mat-cat"
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value as MaterialCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {matType === 'link' ? (
                <div>
                  <label htmlFor="mat-url" className="block text-xs font-semibold text-slate-700 mb-1">
                    Đường dẫn (https://...)
                  </label>
                  <input
                    id="mat-url"
                    type="url"
                    value={matUrl}
                    onChange={(e) => setMatUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="mat-file" className="block text-xs font-semibold text-slate-700">
                    Chọn tệp (PDF, Word, Ảnh, Audio, TXT — tối đa 10 MB)
                  </label>
                  <input
                    id="mat-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.txt,.md"
                    onChange={(e) => setMatFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700"
                  />
                  <p className="text-[11px] text-amber-700">
                    Lưu ý minh bạch: Tệp .txt/.md được hỗ trợ đọc trích đoạn văn bản. Các định dạng PDF, Word,
                    Ảnh, Audio sẽ được lưu đính kèm an toàn nhưng hệ thống chưa tự động trích xuất nội dung.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="mat-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú thêm
                </label>
                <textarea
                  id="mat-notes"
                  rows={2}
                  value={matNotes}
                  onChange={(e) => setMatNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMaterialForm(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingMat}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800"
              >
                {savingMat ? 'Đang lưu...' : 'Lưu tài liệu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
