import React from 'react';
import { Download, Lock, ShieldCheck, X } from 'lucide-react';
import type { AiServiceStatus, TutorFlowConnectionStatus } from '../types/alden';

interface ConnectionStatusModalProps {
  open: boolean;
  onClose: () => void;
  tutorFlowStatus: TutorFlowConnectionStatus | null;
  aiStatus: AiServiceStatus | null;
}

export function ConnectionStatusModal({
  open,
  onClose,
  tutorFlowStatus,
  aiStatus,
}: ConnectionStatusModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="connection-modal-title" className="text-base font-bold text-slate-900">
              Trạng thái kết nối TutorFlow, Lưu trữ &amp; AI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Minh bạch nguồn dữ liệu và ranh giới chỉ đọc giữa Alden Path và Ken&apos;s TutorFlow
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Đóng hộp thoại trạng thái"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* TutorFlow Read-Only Boundary */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Lock className="h-4 w-4 text-amber-600" />
              <h3>1. Kết nối Ken&apos;s TutorFlow (Chế độ chỉ đọc)</h3>
            </div>
            <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 text-slate-800 space-y-1.5">
              <p className="font-semibold text-amber-900">
                {tutorFlowStatus?.label || 'Dữ liệu mẫu – chưa kết nối TutorFlow'}
              </p>
              <p className="text-xs leading-relaxed text-slate-700">
                Hiện tại toàn bộ danh sách học viên, nhóm và lịch buổi học đang dùng dữ liệu mẫu thông qua lớp đọc riêng
                (<code className="font-mono text-[11px]">TutorFlowReadOnlyAdapter</code>). Alden Path chặn mọi thao tác tạo, sửa,
                xóa đối với dữ liệu TutorFlow ở cả giao diện lẫn máy chủ (<code className="font-mono text-[11px]">HTTP 405</code>).
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Thông tin cần cung cấp trước khi triển khai kết nối chỉ đọc thực tế:
              </p>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-5">
                {(tutorFlowStatus?.requiredInfoChecklist || []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* Alden Path Storage */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <h3>2. Lưu trữ dữ liệu riêng của Alden Path</h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>Nơi lưu hiện tại:</strong> {tutorFlowStatus?.storageDescription} tại{' '}
              <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                {tutorFlowStatus?.storageLocation}
              </code>
              .
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Giới hạn hiện tại:</strong> {tutorFlowStatus?.storageLimitations}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cấu trúc dữ liệu được tách rõ 8 nhóm độc lập (giáo án mẫu, hoạt động, tài liệu, lộ trình mẫu, lộ trình riêng,
              kế hoạch buổi học, ghi nhận sau buổi học, đề xuất AI) qua lớp <code className="font-mono text-[11px]">AldenPathRepository</code>{' '}
              để dễ chuyển sang Firebase Firestore về sau mà không ảnh hưởng dự án TutorFlow hiện có.
            </p>
            <div className="pt-1">
              <a
                href="/api/export"
                download="alden-path-backup.json"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải bản sao lưu dữ liệu (JSON)</span>
              </a>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* AI Server Status */}
          <section className="space-y-1.5">
            <h3 className="font-semibold text-slate-900">3. Trạng thái AI phía máy chủ</h3>
            <p className="text-xs text-slate-700">
              <strong>Nhà cung cấp:</strong> {aiStatus?.provider || 'Google Gemini'} ·{' '}
              <strong>Mô hình:</strong> <code className="font-mono text-[11px]">{aiStatus?.model || 'gemini-4-hydrogen'}</code>
            </p>
            <p className="text-xs text-slate-600">{aiStatus?.message}</p>
          </section>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
