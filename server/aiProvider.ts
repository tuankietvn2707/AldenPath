import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AiServiceStatus } from '../src/types/alden';

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

function formatFriendlyAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'Dịch vụ Gemini AI đang tạm thời quá tải (503). Vui lòng thử lại sau ít giây — hệ thống không tạo nội dung AI giả thay thế.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Đã chạm giới hạn lượt gọi Gemini AI (429). Vui lòng đợi một lát hoặc kiểm tra hạn mức khóa API.';
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return 'Khóa GEMINI_API_KEY không hợp lệ hoặc không đủ quyền. Vui lòng kiểm tra lại cấu hình biến môi trường trên máy chủ.';
  }
  return raw;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AiProvider {
  getStatus(): AiServiceStatus;
  evaluatePlan(input: {
    targetType: 'lesson' | 'curriculum';
    payload: Record<string, unknown>;
  }): Promise<{ result: Record<string, unknown>; model: string }>;
  suggestNextSession(input: {
    learnerName: string;
    learnerType: string;
    roadmapSummary: Record<string, unknown> | null;
    recentSessions: Record<string, unknown>[];
    extraContext?: string;
  }): Promise<{ result: Record<string, unknown>; model: string }>;
  summarizeProgress(input: {
    learnerName: string;
    learnerType: string;
    roadmapStats: Record<string, unknown>;
    recordedLogs: Record<string, unknown>[];
  }): Promise<{ result: Record<string, unknown>; model: string }>;
  generateLessonDraft(input: {
    titleOrTopic: string;
    bookInfo?: string;
    targetAudience?: string;
    level?: string;
    objectives?: string;
    durationMinutes?: number;
    skills?: string[];
    languageMode?: string;
    notes?: string;
    readableMaterialExcerpt?: string;
  }): Promise<{ result: Record<string, unknown>; model: string }>;
  organizePostSessionNotes(input: {
    freeformNotes: string;
    activityOutcomesSummary: string;
  }): Promise<{ result: Record<string, unknown>; model: string }>;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim() || '';
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
}

class GeminiAiProvider implements AiProvider {
  private createClient(): GoogleGenAI {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error(
        'AI chưa được cấu hình (thiếu GEMINI_API_KEY trên máy chủ). Vui lòng thiết lập khóa API trong phần cấu hình môi trường.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  getStatus(): AiServiceStatus {
    const configured = Boolean(getApiKey());
    return {
      configured,
      provider: 'Google Gemini (Server-side)',
      model: DEFAULT_GEMINI_MODEL,
      message: configured
        ? `AI đã sẵn sàng trên máy chủ (${DEFAULT_GEMINI_MODEL}). Mọi đề xuất AI đều là bản nháp cần giáo viên xác nhận.`
        : 'AI chưa được cấu hình khóa API trên máy chủ. Ứng dụng sẽ báo lỗi rõ ràng thay vì tạo nội dung giả.',
    };
  }

  private async generateStructuredJson(params: {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, unknown>;
  }): Promise<{ result: Record<string, unknown>; model: string }> {
    const ai = this.createClient();
    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.schema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        const text = (response.text ?? '').trim();
        if (!text) {
          throw new Error('Mô hình AI không trả về nội dung. Vui lòng thử lại.');
        }
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          return { result: parsed, model: DEFAULT_GEMINI_MODEL };
        } catch {
          throw new Error('Phản hồi từ AI không đúng định dạng JSON chuẩn. Vui lòng thử lại.');
        }
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE');
        if (isTransient && attempt < maxAttempts) {
          await sleep(1200 * attempt);
          continue;
        }
        break;
      }
    }

    throw new Error(formatFriendlyAiError(lastError));
  }

  async evaluatePlan(input: {
    targetType: 'lesson' | 'curriculum';
    payload: Record<string, unknown>;
  }) {
    const label = input.targetType === 'lesson' ? 'giáo án' : 'lộ trình học';
    const systemInstruction = `Bạn là cố vấn sư phạm tiếng Anh chuyên nghiệp hỗ trợ giáo viên Alden.
Hãy đánh giá ${label} được cung cấp bằng tiếng Việt rõ ràng, có thể giữ thuật ngữ tiếng Anh chuyên ngành.
Nguyên tắc bắt buộc:
- Chỉ nhận xét dựa trên dữ liệu thực tế được gửi; tuyệt đối không tự bịa thông tin.
- Nếu thiếu thông tin để đánh giá một tiêu chí, nêu rõ cần bổ sung gì vào trường missingInformation.
- Đưa ra đề xuất chỉnh sửa cụ thể, thực tế cho lớp học 1-1 hoặc nhóm nhỏ.`;

    const prompt = `Hãy đánh giá ${label} sau đây theo 5 tiêu chí: (1) Mục tiêu rõ ràng & phù hợp trình độ, (2) Sự liên kết giữa hoạt động và mục tiêu, (3) Phân bổ thời lượng, (4) Cân bằng giải thích – thực hành – phản hồi – ôn tập, (5) Điểm còn thiếu hoặc nên cải thiện.\n\nDữ liệu:\n${JSON.stringify(
      input.payload,
      null,
      2
    )}`;

    return this.generateStructuredJson({
      systemInstruction,
      prompt,
      schema: {
        type: Type.OBJECT,
        properties: {
          overallSummary: { type: Type.STRING, description: 'Tóm tắt nhận xét tổng quan.' },
          criteria: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                assessment: { type: Type.STRING },
                suggestedEdit: { type: Type.STRING },
              },
              required: ['name', 'assessment', 'suggestedEdit'],
            },
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gapsAndImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInformation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Thông tin giáo án/lộ trình còn thiếu để đánh giá chính xác hơn.',
          },
        },
        required: [
          'overallSummary',
          'criteria',
          'strengths',
          'gapsAndImprovements',
          'missingInformation',
        ],
      },
    });
  }

  async suggestNextSession(input: {
    learnerName: string;
    learnerType: string;
    roadmapSummary: Record<string, unknown> | null;
    recentSessions: Record<string, unknown>[];
    extraContext?: string;
  }) {
    const systemInstruction = `Bạn là trợ lý sư phạm tiếng Anh cho giáo viên Alden.
Hãy đề xuất BẢN NHÁP kế hoạch cho buổi học tiếp theo bằng tiếng Việt (kèm thuật ngữ tiếng Anh phù hợp).
Nguyên tắc nghiêm ngặt:
- Đây chỉ là BẢN NHÁP chờ giáo viên duyệt.
- Không tự suy diễn học viên đã hoàn thành bài nào hoặc đã đạt trình độ nào nếu dữ liệu không ghi nhận.
- Ưu tiên xử lý các hoạt động chưa hoàn thành / mới làm một phần từ buổi trước.
- Luôn liệt kê rõ thông tin còn thiếu cần giáo viên xác nhận vào missingInfoToConfirm.`;

    const prompt = `Tạo đề xuất buổi học tiếp theo dựa trên dữ liệu tối giản sau:\n${JSON.stringify(
      input,
      null,
      2
    )}`;

    return this.generateStructuredJson({
      systemInstruction,
      prompt,
      schema: {
        type: Type.OBJECT,
        properties: {
          reason: { type: Type.STRING, description: 'Lý do đề xuất kế hoạch này.' },
          carryOverAndReview: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Nội dung cần tiếp tục từ buổi trước hoặc cần ôn tập/rút gọn.',
          },
          nextObjectives: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Mục tiêu cụ thể của buổi tiếp theo.',
          },
          suggestedActivities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                stage: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                notes: { type: Type.STRING },
              },
              required: ['title', 'stage', 'durationMinutes', 'notes'],
            },
          },
          prepMaterials: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Tài liệu hoặc bài tập giáo viên nên chuẩn bị.',
          },
          missingInfoToConfirm: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Những thông tin còn thiếu cần giáo viên xác nhận trước khi chốt.',
          },
        },
        required: [
          'reason',
          'carryOverAndReview',
          'nextObjectives',
          'suggestedActivities',
          'prepMaterials',
          'missingInfoToConfirm',
        ],
      },
    });
  }

  async summarizeProgress(input: {
    learnerName: string;
    learnerType: string;
    roadmapStats: Record<string, unknown>;
    recordedLogs: Record<string, unknown>[];
  }) {
    const systemInstruction = `Bạn là trợ lý sư phạm tiếng Anh cho giáo viên Alden.
Hãy tổng hợp tiến bộ học viên bằng tiếng Việt rõ ràng.
Yêu cầu QUAN TRỌNG NHẤT:
- Phân tách rạch ròi giữa "recordedFacts" (chỉ tổng hợp đúng những gì đã được giáo viên ghi nhận trong dữ liệu) và "aiObservationsAndSuggestions" (nhận xét, phân tích và gợi ý của AI).
- Nếu thiếu dữ liệu ghi nhận, nêu rõ trong missingDataNotes, tuyệt đối không bịa tiến bộ.`;

    const prompt = `Tổng hợp tiến bộ học viên từ dữ liệu thực tế sau:\n${JSON.stringify(
      input,
      null,
      2
    )}`;

    return this.generateStructuredJson({
      systemInstruction,
      prompt,
      schema: {
        type: Type.OBJECT,
        properties: {
          recordedFacts: {
            type: Type.OBJECT,
            properties: {
              completedContent: { type: Type.ARRAY, items: { type: Type.STRING } },
              incompleteOrReviewContent: { type: Type.ARRAY, items: { type: Type.STRING } },
              recordedStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              recordedDifficulties: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'completedContent',
              'incompleteOrReviewContent',
              'recordedStrengths',
              'recordedDifficulties',
            ],
          },
          aiObservationsAndSuggestions: {
            type: Type.OBJECT,
            properties: {
              overallObservation: { type: Type.STRING },
              recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['overallObservation', 'recommendedNextSteps'],
          },
          missingDataNotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['recordedFacts', 'aiObservationsAndSuggestions', 'missingDataNotes'],
      },
    });
  }

  async generateLessonDraft(input: {
    titleOrTopic: string;
    bookInfo?: string;
    targetAudience?: string;
    level?: string;
    objectives?: string;
    durationMinutes?: number;
    skills?: string[];
    languageMode?: string;
    notes?: string;
    readableMaterialExcerpt?: string;
  }) {
    const systemInstruction = `Bạn là chuyên gia thiết kế giáo án tiếng Anh cho giáo viên Alden.
Hãy tạo BẢN NHÁP giáo án có cấu trúc chuẩn, thực tế, dễ triển khai ngay trên lớp.
Hỗ trợ song ngữ Anh–Việt đúng theo yêu cầu languageMode của giáo viên.
Tổng thời lượng các hoạt động phải khớp gần sát với durationMinutes được yêu cầu.`;

    const prompt = `Tạo bản nháp giáo án chi tiết theo yêu cầu sau:\n${JSON.stringify(
      input,
      null,
      2
    )}`;

    return this.generateStructuredJson({
      systemInstruction,
      prompt,
      schema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          titleEn: { type: Type.STRING },
          lessonType: { type: Type.STRING, description: 'textbook hoặc standalone' },
          bookSeries: { type: Type.STRING },
          unit: { type: Type.STRING },
          lessonNumber: { type: Type.STRING },
          pages: { type: Type.STRING },
          topic: { type: Type.STRING },
          level: { type: Type.STRING },
          targetAudience: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          learningObjectives: { type: Type.STRING },
          keyKnowledge: { type: Type.STRING },
          durationMinutes: { type: Type.INTEGER },
          vocabulary: { type: Type.STRING },
          grammar: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          preparationNotes: { type: Type.STRING },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                titleEn: { type: Type.STRING },
                stage: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                objective: { type: Type.STRING },
                teacherInstructions: { type: Type.STRING },
                studentTask: { type: Type.STRING },
                guidingQuestions: { type: Type.STRING },
                answerKey: { type: Type.STRING },
              },
              required: [
                'title',
                'stage',
                'durationMinutes',
                'objective',
                'teacherInstructions',
                'studentTask',
                'guidingQuestions',
                'answerKey',
              ],
            },
          },
          homework: { type: Type.STRING },
          assessmentMethod: { type: Type.STRING },
          additionalNotes: { type: Type.STRING },
        },
        required: [
          'title',
          'level',
          'targetAudience',
          'skills',
          'learningObjectives',
          'keyKnowledge',
          'durationMinutes',
          'vocabulary',
          'grammar',
          'pronunciation',
          'preparationNotes',
          'activities',
          'homework',
          'assessmentMethod',
        ],
      },
    });
  }

  async organizePostSessionNotes(input: {
    freeformNotes: string;
    activityOutcomesSummary: string;
  }) {
    const systemInstruction = `Bạn giúp giáo viên Alden sắp xếp lại ghi chú tự do sau buổi học thành các mục rõ ràng, ngắn gọn bằng tiếng Việt.
Chỉ sắp xếp từ nội dung giáo viên đã viết, không thêm đánh giá bịa đặt.`;

    const prompt = `Sắp xếp ghi chú tự do sau thành các trường cấu trúc rõ ràng.\nGhi chú tự do:\n${input.freeformNotes}\n\nTrạng thái hoạt động:\n${input.activityOutcomesSummary}`;

    return this.generateStructuredJson({
      systemInstruction,
      prompt,
      schema: {
        type: Type.OBJECT,
        properties: {
          taughtSummary: { type: Type.STRING },
          missingContent: { type: Type.STRING },
          strengths: { type: Type.STRING },
          weaknesses: { type: Type.STRING },
          commonErrors: { type: Type.STRING },
          homeworkAssigned: { type: Type.STRING },
          organizedSummaryText: { type: Type.STRING },
        },
        required: [
          'taughtSummary',
          'missingContent',
          'strengths',
          'weaknesses',
          'commonErrors',
          'homeworkAssigned',
          'organizedSummaryText',
        ],
      },
    });
  }
}

export const aiProvider: AiProvider = new GeminiAiProvider();
