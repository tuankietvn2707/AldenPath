import React, { useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Database,
  LayoutDashboard,
  Map,
  Menu,
  Plus,
  Sparkles,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import type {
  ActiveNavSection,
  AiServiceStatus,
  TutorFlowConnectionStatus,
} from '../types/alden';

interface LayoutShellProps {
  activeSection: ActiveNavSection;
  onSelectSection: (section: ActiveNavSection) => void;
  tutorFlowStatus: TutorFlowConnectionStatus | null;
  aiStatus: AiServiceStatus | null;
  onOpenConnectionModal: () => void;
  onQuickCreateLesson: () => void;
  toast: { type: 'success' | 'error'; message: string } | null;
  onDismissToast: () => void;
  pendingLogCount: number;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: ActiveNavSection;
  label: string;
  subtitleEn: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Tổng quan', subtitleEn: 'Dashboard', icon: LayoutDashboard },
  { id: 'lessons', label: 'Giáo án', subtitleEn: 'Lesson Library', icon: BookOpen },
  { id: 'curricula', label: 'Lộ trình', subtitleEn: 'Curricula', icon: Map },
  { id: 'learners', label: 'Học viên', subtitleEn: 'Students & Groups', icon: Users },
  { id: 'sessions', label: 'Buổi học', subtitleEn: 'Sessions', icon: CalendarClock },
  { id: 'ai', label: 'Trợ lý AI', subtitleEn: 'AI Studio', icon: Sparkles },
];

const SECTION_BREADCRUMB: Record<ActiveNavSection, { vi: string; en: string }> = {
  dashboard: { vi: 'Tổng quan giảng dạy', en: 'Dashboard' },
  lessons: { vi: 'Thư viện giáo án & Tài liệu', en: 'Lessons & Materials' },
  curricula: { vi: 'Lộ trình học mẫu', en: 'Curriculum Templates' },
  learners: { vi: 'Học viên & Lộ trình riêng', en: 'Learners & Roadmaps' },
  sessions: { vi: 'Buổi học & Cập nhật tiến độ', en: 'Sessions & Logs' },
  ai: { vi: 'Trợ lý AI sư phạm', en: 'AI Assistant' },
};

export function LayoutShell({
  activeSection,
  onSelectSection,
  tutorFlowStatus,
  aiStatus,
  onOpenConnectionModal,
  onQuickCreateLesson,
  toast,
  onDismissToast,
  pendingLogCount,
  children,
}: LayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (section: ActiveNavSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex h-14 items-center justify-between px-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white"
              aria-hidden="true"
            >
              AP
            </span>
            <span className="text-[15px] font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Alden Path
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
            aria-label="Đóng thanh điều hướng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'sessions' && pendingLogCount > 0 ? (
                  <span
                    className="text-xs font-mono tabular-nums text-amber-700 font-semibold"
                    title="Buổi đã hoàn thành chưa cập nhật tiến độ"
                  >
                    {pendingLogCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal hidden xl:inline">
                    {item.subtitleEn}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Honest TutorFlow Read-Only & Storage Status Entry */}
      <div className="p-3 border-t border-slate-200 space-y-2">
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            onOpenConnectionModal();
          }}
          className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
        >
          <div className="flex items-start gap-2 text-xs font-semibold text-slate-800 leading-snug">
            <Database className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {tutorFlowStatus?.connected
                ? 'Đã kết nối TutorFlow (Chỉ đọc)'
                : 'Dữ liệu mẫu – chưa kết nối TutorFlow'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Chế độ chỉ đọc TutorFlow · Lưu cục bộ máy chủ ·{' '}
            {aiStatus?.configured ? 'AI sẵn sàng' : 'AI chưa cấu hình'}
          </p>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-xl">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: clean single-row bar (<=56px, well within mobile 15% cap) */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-900 truncate">
                {SECTION_BREADCRUMB[activeSection].vi}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="hidden sm:inline text-xs text-slate-500 truncate">
                {SECTION_BREADCRUMB[activeSection].en}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onQuickCreateLesson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Tạo giáo án</span>
            </button>
          </div>
        </header>

        {/* Subtle Toast Banner */}
        {toast && (
          <div className="px-4 lg:px-8 pt-4">
            <div
              role="status"
              className={`max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-sm ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={onDismissToast}
                className="p-1 rounded hover:bg-black/5"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
