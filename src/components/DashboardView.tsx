import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckSquare,
  ClipboardEdit,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react';
import type {
  ActiveNavSection,
  AldenStoreData,
  TutorFlowConnectionStatus,
  TutorFlowSession,
} from '../types/alden';
import { computeDashboardSummary } from '../lib/domainLogic';
import {
  ACTIVITY_OUTCOME_META,
  formatDateShortVi,
  formatDateTimeVi,
  ROADMAP_STATUS_META,
} from '../utils/formatters';

interface DashboardViewProps {
  store: AldenStoreData;
  sessions: TutorFlowSession[];
  tutorFlowStatus: TutorFlowConnectionStatus | null;
  onNavigate: (section: ActiveNavSection) => void;
  onOpenCreateLesson: () => void;
  onOpenCreateCurriculum: () => void;
  onOpenSession: (sessionId: string, tab: 'plan' | 'post') => void;
  onOpenLearner: (learnerId: string) => void;
  onOpenLesson: (lessonId: string) => void;
  onOpenConnectionModal: () => void;
}

export function DashboardView({
  store,
  sessions,
  tutorFlowStatus,
  onNavigate,
  onOpenCreateLesson,
  onOpenCreateCurriculum,
  onOpenSession,
  onOpenLearner,
  onOpenLesson,
  onOpenConnectionModal,
}: DashboardViewProps) {
  const summary = computeDashboardSummary(sessions, store);
  const planBySessionId = new Map(store.sessionPlans.map((p) => [p.tutorFlowSessionId, p]));

  const recentLessons = [...store.lessonTemplates]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const recentRoadmaps = [...store.studentRoadmaps]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const savedDraftSuggestions = store.aiSuggestions.filter((s) => s.status !== 'dismissed').slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header & Honest Mode Line */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Chào buổi dạy, Alden
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi nhanh lịch dạy, kế hoạch bài học còn thiếu và tiến độ cần cập nhật.{' '}
            <button
              type="button"
              onClick={onOpenConnectionModal}
              className="text-amber-700 hover:text-amber-800 underline underline-offset-2 font-medium cursor-pointer"
            >
              {tutorFlowStatus?.label || 'Dữ liệu mẫu – chưa kết nối TutorFlow'}
            </button>
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreateLesson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-700" />
            <span>Tạo giáo án</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateCurriculum}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 whitespace-nowrap cursor-pointer"
          >
            <MapIcon className="h-3.5 w-3.5 text-blue-700" />
            <span>Tạo lộ trình mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('sessions')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 whitespace-nowrap cursor-pointer"
          >
            <CalendarClock className="h-3.5 w-3.5 text-blue-700" />
            <span>Buổi dạy sắp tới</span>
          </button>
          {summary.completedMissingLogSessions[0] && (
            <button
              type="button"
              onClick={() => onOpenSession(summary.completedMissingLogSessions[0].id, 'post')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100/70 text-xs font-medium text-amber-900 whitespace-nowrap cursor-pointer"
            >
              <ClipboardEdit className="h-3.5 w-3.5 text-amber-700" />
              <span>Cập nhật buổi đã dạy</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100/70 text-xs font-medium text-blue-800 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-700" />
            <span>Nhờ AI hỗ trợ</span>
          </button>
        </div>
      </div>

      {/* 4-Column Tabular Summary Strip (Single Elevation) */}
      <section
        aria-label="Tóm tắt nhanh"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Buổi học sắp tới</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.upcomingSessions.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.upcomingWithPlanCount} đã có kế hoạch · {summary.upcomingWithoutPlanCount} chưa có
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Chưa có kế hoạch bài dạy</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.upcomingWithoutPlanCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {summary.upcomingWithoutPlanCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Ưu tiên chuẩn bị trước giờ dạy</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Đã dạy — chờ cập nhật tiến độ</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.completedMissingLogSessions.length > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {summary.completedMissingLogSessions.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Cần đánh dấu hoạt động sau buổi</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Nội dung dạy dở / cần ôn</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.unfinishedItems.length + summary.reviewRoadmapItems.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.unfinishedItems.length} hoạt động chưa xong · {summary.reviewRoadmapItems.length} mục lộ trình
          </p>
        </div>
      </section>

      {/* Main 2-Column Operational Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Upcoming Sessions + Missing Post-Session Updates */}
        <div className="lg:col-span-7 space-y-6">
          {/* Upcoming Sessions */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Các buổi học sắp tới</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đọc từ TutorFlow (Dữ liệu mẫu · Chỉ đọc)
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('sessions')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {summary.upcomingSessions.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Hiện chưa có buổi học sắp tới nào trong lịch.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.upcomingSessions.map((session) => {
                  const plan = planBySessionId.get(session.id);
                  return (
                    <div
                      key={session.id}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="truncate">{session.learnerName}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                          <span>{formatDateTimeVi(session.startTime)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{session.durationMinutes} phút</span>
                          <span aria-hidden="true">·</span>
                          <span>{session.learnerType === 'group' ? 'Nhóm' : 'Lớp 1–1'}</span>
                        </div>
                        <div className="text-xs">
                          {plan ? (
                            <span className="text-emerald-700 font-medium">
                              Đã có kế hoạch: {plan.title}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Chưa có kế hoạch bài dạy
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSession(session.id, 'plan')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          plan
                            ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            : 'bg-blue-700 text-white hover:bg-blue-800'
                        }`}
                      >
                        {plan ? 'Mở kế hoạch' : 'Chuẩn bị bài'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Completed Sessions Missing Progress Update */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Buổi đã hoàn thành — chưa cập nhật tiến độ
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đánh dấu hoạt động đã xong để hệ thống theo dõi phần còn thiếu
                </p>
              </div>
            </div>

            {summary.completedMissingLogSessions.length === 0 ? (
              <div className="p-5 flex items-center gap-2 text-xs text-emerald-700">
                <CheckSquare className="h-4 w-4" />
                <span>Tất cả các buổi đã dạy đều đã được cập nhật tiến độ.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.completedMissingLogSessions.map((session) => {
                  const plan = planBySessionId.get(session.id);
                  return (
                    <div
                      key={session.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {session.learnerName}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {formatDateTimeVi(session.startTime)} ·{' '}
                          {plan ? plan.title : 'Chưa gắn giáo án'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSession(session.id, 'post')}
                        className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Cập nhật ngay
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 cols: Unfinished/Review Items + Saved AI Suggestions + Recent Materials */}
        <div className="lg:col-span-5 space-y-6">
          {/* Unfinished / Needs Review */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                Nội dung đang dạy dở &amp; Cần ôn tập
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {summary.unfinishedItems.length === 0 && summary.reviewRoadmapItems.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">
                  Chưa có hoạt động dạy dở hoặc mục lộ trình cần ôn tập.
                </p>
              ) : (
                <>
                  {summary.unfinishedItems.slice(0, 4).map((item, idx) => (
                    <div key={`${item.sessionId}_${idx}`} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {item.outcome.activityTitle}
                        </p>
                        <span
                          className={`text-[11px] whitespace-nowrap shrink-0 ${
                            ACTIVITY_OUTCOME_META[item.outcome.status].textClass
                          }`}
                        >
                          {ACTIVITY_OUTCOME_META[item.outcome.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.learnerName} · {formatDateShortVi(item.sessionDate)}
                      </p>
                      {item.outcome.note && (
                        <p className="text-xs text-slate-600">{item.outcome.note}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenSession(item.sessionId, 'post')}
                        className="text-xs text-blue-700 hover:underline font-medium"
                      >
                        Xem ghi nhận buổi học
                      </button>
                    </div>
                  ))}
                  {summary.reviewRoadmapItems.slice(0, 3).map((item) => (
                    <div key={item.itemId} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {item.title}
                        </p>
                        <span
                          className={`text-[11px] whitespace-nowrap shrink-0 ${
                            ROADMAP_STATUS_META[item.status].textClass
                          }`}
                        >
                          {ROADMAP_STATUS_META[item.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Lộ trình: {item.learnerName}</p>
                      <button
                        type="button"
                        onClick={() => onOpenLearner(item.learnerId)}
                        className="text-xs text-blue-700 hover:underline font-medium"
                      >
                        Mở lộ trình riêng
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Saved AI Suggestions */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Đề xuất tiếp theo đã lưu</h2>
              <button
                type="button"
                onClick={() => onNavigate('ai')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Mở Trợ lý AI
              </button>
            </div>
            {savedDraftSuggestions.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                Chưa có đề xuất AI nào được lưu. Bạn có thể tạo đề xuất từ mục Buổi học hoặc Trợ lý AI.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {savedDraftSuggestions.map((s) => (
                  <div key={s.id} className="px-5 py-3.5 space-y-1">
                    <p className="text-xs font-semibold text-slate-900">{s.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.status === 'draft' ? 'Bản nháp chờ duyệt' : 'Đã chấp nhận'} · {s.modelUsed} ·{' '}
                      {formatDateShortVi(s.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Recently Used Lessons & Roadmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Giáo án cập nhật gần đây</h2>
            <button
              type="button"
              onClick={() => onNavigate('lessons')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Thư viện giáo án
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => onOpenLesson(lesson.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{lesson.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {lesson.bookSeries || lesson.topic || 'Độc lập'} · {lesson.level || 'Chưa rõ trình độ'} ·{' '}
                    <span className="tabular-nums">{lesson.durationMinutes} phút</span>
                  </p>
                </div>
                <span
                  className={`text-xs whitespace-nowrap shrink-0 ${
                    lesson.status === 'draft' ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {lesson.status === 'draft' ? 'Bản nháp' : 'Đã lưu'}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Lộ trình riêng đang theo dõi</h2>
            <button
              type="button"
              onClick={() => onNavigate('learners')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Xem học viên
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentRoadmaps.map((rm) => {
              const allItems = rm.stages.flatMap((s) => s.items);
              const done = allItems.filter((i) => i.status === 'completed').length;
              return (
                <button
                  key={rm.id}
                  type="button"
                  onClick={() => onOpenLearner(rm.learnerId)}
                  className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{rm.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {rm.learnerNameSnapshot} · Mẫu gốc: {rm.sourceTemplateTitleSnapshot || 'Tự tạo'}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                    {done}/{allItems.length} bài
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
