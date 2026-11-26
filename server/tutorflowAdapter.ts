import type {
  TutorFlowConnectionStatus,
  TutorFlowLearner,
  TutorFlowSession,
} from '../src/types/alden';

/**
 * Strict Read-Only interface for connecting to Ken's TutorFlow.
 * By design, this adapter exposes ONLY read operations (list/get).
 * No create, update, or delete methods are permitted on TutorFlow data.
 */
export interface TutorFlowReadOnlyAdapter {
  getStatus(): Promise<TutorFlowConnectionStatus>;
  listLearners(): Promise<TutorFlowLearner[]>;
  listSessions(): Promise<TutorFlowSession[]>;
}

export const TUTORFLOW_REQUIRED_INFO_CHECKLIST: string[] = [
  'Loại hệ thống dữ liệu hiện tại của TutorFlow (ví dụ: Firebase Firestore, Supabase, hay REST API riêng).',
  'Tên chính xác các collections / bảng và cấu trúc trường dữ liệu cho học viên, nhóm và buổi học (ID ổn định, ngày giờ, trạng thái).',
  'Cơ chế xác thực hiện tại của giáo viên trên TutorFlow và cách cấp quyền chỉ đọc (read-only token, Service Account chỉ đọc, hoặc Firestore Security Rules riêng).',
  'Tài liệu hoặc cấu hình dự án Firebase / API endpoint của TutorFlow để kiểm tra trước khi cấu hình kết nối.',
  'Quy ước xử lý khi buổi học bị đổi giờ hoặc hủy bên TutorFlow (ví dụ trường status, updatedAt, cancelledAt).',
];

const SAMPLE_LEARNERS: TutorFlowLearner[] = [
  {
    id: 'tf_stu_001',
    entityType: 'student',
    displayName: 'Nguyễn Minh Anh',
    englishName: 'Mia',
    levelNote: 'A2 (Pre-Intermediate)',
    goalNote: 'Giao tiếp công việc & chuẩn bị công tác Singapore',
    scheduleSummary: 'Thứ 3 & Thứ 5 · 19:30 – 20:30 (1–1 Online)',
    status: 'active',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_grp_001',
    entityType: 'group',
    displayName: 'Nhóm IELTS Speaking Tối T4–T6',
    memberNames: ['Trần Phương Lan', 'Lê Quốc Huy', 'Phạm Thu Thảo'],
    levelNote: 'B1 (Band ~5.5)',
    goalNote: 'Nâng band Speaking lên 6.5+ trước kỳ thi tháng 1',
    scheduleSummary: 'Thứ 4 & Thứ 6 · 20:00 – 21:15 (Nhóm 3 học viên)',
    status: 'active',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_stu_002',
    entityType: 'student',
    displayName: 'Đặng Hoàng Nam',
    englishName: 'Liam',
    levelNote: 'A2+',
    goalNote: 'Củng cố ngữ pháp giao tiếp & nghe hiểu tự nhiên',
    scheduleSummary: 'Thứ 2 & Thứ 6 · 18:00 – 19:00 (1–1 Online)',
    status: 'active',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_stu_003',
    entityType: 'student',
    displayName: 'Vũ Khánh Linh',
    englishName: 'Chloe',
    levelNote: 'B1+',
    goalNote: 'Phỏng vấn tiếng Anh ngành Marketing & viết email chuyên nghiệp',
    scheduleSummary: 'Thứ 7 · 09:30 – 10:45 (1–1 Trực tiếp)',
    status: 'active',
    source: 'sample_tutorflow',
  },
];

const SAMPLE_SESSIONS: TutorFlowSession[] = [
  {
    id: 'tf_ses_101',
    learnerId: 'tf_stu_001',
    learnerType: 'student',
    learnerName: 'Nguyễn Minh Anh',
    startTime: '2026-11-26T12:30:00.000Z', // 19:30 ICT
    endTime: '2026-11-26T13:30:00.000Z',
    durationMinutes: 60,
    tutorFlowStatus: 'scheduled',
    meetingFormat: 'online',
    tutorFlowNote: 'Học viên nhắn có thể vào trễ 5 phút do họp dự án.',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_ses_102',
    learnerId: 'tf_grp_001',
    learnerType: 'group',
    learnerName: 'Nhóm IELTS Speaking Tối T4–T6',
    startTime: '2026-11-27T13:00:00.000Z', // 20:00 ICT
    endTime: '2026-11-27T14:15:00.000Z',
    durationMinutes: 75,
    tutorFlowStatus: 'scheduled',
    meetingFormat: 'online',
    tutorFlowNote: 'Đủ 3 học viên xác nhận tham gia.',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_ses_103',
    learnerId: 'tf_stu_002',
    learnerType: 'student',
    learnerName: 'Đặng Hoàng Nam',
    startTime: '2026-11-28T11:00:00.000Z', // 18:00 ICT
    endTime: '2026-11-28T12:00:00.000Z',
    durationMinutes: 60,
    tutorFlowStatus: 'scheduled',
    meetingFormat: 'online',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_ses_202',
    learnerId: 'tf_grp_001',
    learnerType: 'group',
    learnerName: 'Nhóm IELTS Speaking Tối T4–T6',
    startTime: '2026-11-22T13:00:00.000Z',
    endTime: '2026-11-22T14:15:00.000Z',
    durationMinutes: 75,
    tutorFlowStatus: 'completed',
    meetingFormat: 'online',
    tutorFlowNote: 'Đã điểm danh đủ trên TutorFlow (mẫu).',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_ses_201',
    learnerId: 'tf_stu_001',
    learnerType: 'student',
    learnerName: 'Nguyễn Minh Anh',
    startTime: '2026-11-21T12:30:00.000Z',
    endTime: '2026-11-21T13:30:00.000Z',
    durationMinutes: 60,
    tutorFlowStatus: 'completed',
    meetingFormat: 'online',
    tutorFlowNote: 'Hoàn thành đúng giờ.',
    source: 'sample_tutorflow',
  },
  {
    id: 'tf_ses_203',
    learnerId: 'tf_stu_003',
    learnerType: 'student',
    learnerName: 'Vũ Khánh Linh',
    startTime: '2026-11-21T02:30:00.000Z',
    endTime: '2026-11-21T03:45:00.000Z',
    durationMinutes: 75,
    tutorFlowStatus: 'completed',
    meetingFormat: 'in_person',
    tutorFlowNote: 'Buổi đánh giá đầu vào & làm quen.',
    source: 'sample_tutorflow',
  },
];

export class SampleTutorFlowAdapter implements TutorFlowReadOnlyAdapter {
  async getStatus(): Promise<TutorFlowConnectionStatus> {
    return {
      connected: false,
      mode: 'sample',
      label: 'Dữ liệu mẫu – chưa kết nối TutorFlow',
      readOnlyEnforced: true,
      lastSyncedAt: new Date().toISOString(),
      storageDescription: 'Lưu trữ cục bộ phía máy chủ ứng dụng (JSON file)',
      storageLocation: 'data/alden-path-store.json (tệp đính kèm tại data/uploads/)',
      storageLimitations:
        'Phù hợp để trải nghiệm và kiểm thử thực tế; dữ liệu được giữ bền vững khi khởi động lại server hiện tại, nhưng chưa đồng bộ đa thiết bị hay sao lưu đám mây như Firebase Firestore.',
      requiredInfoChecklist: TUTORFLOW_REQUIRED_INFO_CHECKLIST,
    };
  }

  async listLearners(): Promise<TutorFlowLearner[]> {
    return SAMPLE_LEARNERS.map((learner) => ({
      ...learner,
      memberNames: learner.memberNames ? [...learner.memberNames] : undefined,
    }));
  }

  async listSessions(): Promise<TutorFlowSession[]> {
    return SAMPLE_SESSIONS.map((session) => ({ ...session }));
  }
}

export const tutorFlowAdapter: TutorFlowReadOnlyAdapter = new SampleTutorFlowAdapter();
