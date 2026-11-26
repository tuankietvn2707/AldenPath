import type {
  ActivityExecutionStatus,
  ComprehensionLevel,
  MaterialCategory,
  RoadmapItemStatus,
  TutorFlowSessionStatus,
} from '../types/alden';

export function formatDateTimeVi(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatDateShortVi(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatTimeVi(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ROADMAP_STATUS_META: Record<
  RoadmapItemStatus,
  { label: string; textClass: string }
> = {
  not_started: { label: 'Chưa bắt đầu', textClass: 'text-slate-500' },
  in_progress: { label: 'Đang học', textClass: 'text-blue-700 font-medium' },
  completed: { label: 'Hoàn thành', textClass: 'text-emerald-700 font-medium' },
  needs_review: { label: 'Cần ôn tập', textClass: 'text-amber-700 font-medium' },
};

export const ACTIVITY_OUTCOME_META: Record<
  ActivityExecutionStatus,
  { label: string; textClass: string }
> = {
  completed: { label: 'Đã hoàn thành', textClass: 'text-emerald-700 font-medium' },
  partial: { label: 'Làm một phần', textClass: 'text-amber-700 font-medium' },
  not_done: { label: 'Chưa thực hiện', textClass: 'text-rose-700 font-medium' },
};

export const TUTORFLOW_SESSION_STATUS_META: Record<
  TutorFlowSessionStatus,
  { label: string; textClass: string }
> = {
  scheduled: { label: 'Sắp diễn ra', textClass: 'text-blue-700 font-medium' },
  completed: { label: 'Đã hoàn thành', textClass: 'text-emerald-700 font-medium' },
  cancelled: { label: 'Đã hủy', textClass: 'text-slate-500 line-through' },
};

export const COMPREHENSION_META: Record<ComprehensionLevel, string> = {
  not_rated: 'Chưa đánh giá',
  high: 'Tiếp thu tốt — sẵn sàng mở rộng',
  moderate: 'Tiếp thu khá — cần củng cố thêm',
  needs_support: 'Còn gặp khó khăn — cần ôn kỹ lại',
};

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  worksheet: 'Bài tập / Worksheet',
  answer_key: 'Đáp án / Answer key',
  slides: 'Slide bài giảng',
  audio: 'File nghe / Audio',
  reading: 'Bài đọc / Câu hỏi mẫu',
  other: 'Tài liệu khác',
};

export const COMMON_SKILLS = [
  'Speaking',
  'Listening',
  'Reading',
  'Writing',
  'Grammar',
  'Vocabulary',
  'Pronunciation',
];

export const COMMON_LEVELS = [
  'A1 (Beginner)',
  'A2',
  'A2 – B1',
  'B1',
  'B1 – B2',
  'B2',
  'C1',
];

export const ACTIVITY_STAGES = [
  'Warm-up',
  'Lead-in',
  'Presentation',
  'Practice',
  'Production',
  'Review',
  'Wrap-up',
];
