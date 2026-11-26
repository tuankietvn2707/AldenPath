import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { aldenRepository } from './server/storage';
import { tutorFlowAdapter } from './server/tutorflowAdapter';
import { aiProvider } from './server/aiProvider';
import { generateId, validateSafeUrl } from './src/lib/domainLogic';
import type {
  AiSuggestionRecord,
  CurriculumTemplate,
  LessonTemplate,
  MaterialItem,
  PostSessionLog,
  ReusableActivity,
  SessionPlan,
  StudentRoadmap,
} from './src/types/alden';

const PORT = 3000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'text/plain',
  'text/markdown',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  // =========================================================================
  // 1. TUTORFLOW READ-ONLY ENDPOINTS
  // Strictly read-only: any write attempt is rejected with 405 Method Not Allowed.
  // =========================================================================
  app.all('/api/tutorflow/*', (req, res, next) => {
    if (req.method !== 'GET') {
      res.status(405).json({
        error:
          'Alden Path chỉ được phép đọc dữ liệu từ TutorFlow. Thao tác tạo, sửa hoặc xóa trên nguồn TutorFlow bị chặn tuyệt đối.',
      });
      return;
    }
    next();
  });

  app.get('/api/tutorflow/status', async (_req, res) => {
    try {
      const status = await tutorFlowAdapter.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/tutorflow/learners', async (_req, res) => {
    try {
      const learners = await tutorFlowAdapter.listLearners();
      res.json({ learners, mode: 'sample', readOnly: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/tutorflow/sessions', async (_req, res) => {
    try {
      const sessions = await tutorFlowAdapter.listSessions();
      res.json({ sessions, mode: 'sample', readOnly: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // =========================================================================
  // 2. ALDEN PATH DATA STORE ENDPOINTS
  // =========================================================================
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const [store, tutorFlowStatus, learners, sessions] = await Promise.all([
        aldenRepository.loadAll(),
        tutorFlowAdapter.getStatus(),
        tutorFlowAdapter.listLearners(),
        tutorFlowAdapter.listSessions(),
      ]);
      const aiStatus = aiProvider.getStatus();
      res.json({
        store,
        tutorFlowStatus,
        learners,
        sessions,
        aiStatus,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/export', async (_req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alden-path-backup.json"');
      res.send(JSON.stringify({ exportedAt: new Date().toISOString(), store }, null, 2));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Lesson Templates ---
  app.post('/api/lessons', async (req, res) => {
    try {
      const body = req.body as Partial<LessonTemplate>;
      if (!body.title || !body.title.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tên giáo án.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const created: LessonTemplate = {
        id: generateId('les'),
        title: body.title.trim(),
        titleEn: body.titleEn?.trim() || '',
        status: body.status === 'published' ? 'published' : 'draft',
        lessonType: body.lessonType === 'textbook' ? 'textbook' : 'standalone',
        bookSeries: body.bookSeries?.trim() || '',
        unit: body.unit?.trim() || '',
        lessonNumber: body.lessonNumber?.trim() || '',
        pages: body.pages?.trim() || '',
        topic: body.topic?.trim() || '',
        level: body.level?.trim() || '',
        targetAudience: body.targetAudience?.trim() || '',
        skills: Array.isArray(body.skills) ? body.skills.filter(Boolean) : [],
        learningObjectives: body.learningObjectives || '',
        keyKnowledge: body.keyKnowledge || '',
        durationMinutes: Number(body.durationMinutes) || 60,
        vocabulary: body.vocabulary || '',
        grammar: body.grammar || '',
        pronunciation: body.pronunciation || '',
        preparationNotes: body.preparationNotes || '',
        materialIds: Array.isArray(body.materialIds) ? body.materialIds : [],
        activities: Array.isArray(body.activities) ? body.activities : [],
        homework: body.homework || '',
        assessmentMethod: body.assessmentMethod || '',
        additionalNotes: body.additionalNotes || '',
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      store.lessonTemplates.unshift(created);
      await aldenRepository.saveAll(store);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/lessons/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as Partial<LessonTemplate>;
      if (!body.title || !body.title.trim()) {
        res.status(400).json({ error: 'Tên giáo án không được để trống.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const idx = store.lessonTemplates.findIndex((l) => l.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Không tìm thấy giáo án.' });
        return;
      }
      const existing = store.lessonTemplates[idx];
      const updated: LessonTemplate = {
        ...existing,
        ...body,
        id: existing.id,
        title: body.title.trim(),
        version: (existing.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        isSampleData: false,
      };
      store.lessonTemplates[idx] = updated;
      await aldenRepository.saveAll(store);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/lessons/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.lessonTemplates = store.lessonTemplates.filter((l) => l.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Reusable Activity Bank ---
  app.post('/api/activities', async (req, res) => {
    try {
      const body = req.body as Partial<ReusableActivity>;
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tên hoạt động.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const item: ReusableActivity = {
        id: generateId('bank'),
        title: body.title.trim(),
        titleEn: body.titleEn?.trim() || '',
        stage: body.stage?.trim() || 'Practice',
        skill: body.skill?.trim() || 'Speaking',
        level: body.level?.trim() || 'A2 – B1',
        durationMinutes: Number(body.durationMinutes) || 10,
        objective: body.objective || '',
        teacherInstructions: body.teacherInstructions || '',
        studentTask: body.studentTask || '',
        guidingQuestions: body.guidingQuestions || '',
        answerKey: body.answerKey || '',
        tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
        createdAt: now,
        updatedAt: now,
      };
      store.activityBank.unshift(item);
      await aldenRepository.saveAll(store);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/activities/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      const idx = store.activityBank.findIndex((a) => a.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Không tìm thấy hoạt động.' });
        return;
      }
      store.activityBank[idx] = {
        ...store.activityBank[idx],
        ...req.body,
        id: store.activityBank[idx].id,
        updatedAt: new Date().toISOString(),
        isSampleData: false,
      };
      await aldenRepository.saveAll(store);
      res.json(store.activityBank[idx]);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/activities/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.activityBank = store.activityBank.filter((a) => a.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Materials & File Uploads ---
  app.post('/api/materials', async (req, res) => {
    try {
      const body = req.body as Partial<MaterialItem> & {
        fileBase64?: string;
        originalFileName?: string;
      };
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tên tài liệu.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();

      if (body.type === 'file' && body.fileBase64 && body.originalFileName) {
        const mimeType = (body.mimeType || 'application/octet-stream').toLowerCase();
        if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
          res.status(400).json({
            error:
              'Định dạng tệp chưa được hỗ trợ tải lên. Hỗ trợ: PDF, Word (.doc/.docx), Hình ảnh (PNG/JPG/WEBP), Audio (MP3/WAV/M4A) và Văn bản (.txt/.md).',
          });
          return;
        }
        const buffer = Buffer.from(body.fileBase64, 'base64');
        if (buffer.length > MAX_UPLOAD_BYTES) {
          res.status(400).json({ error: 'Tệp vượt quá giới hạn 10 MB.' });
          return;
        }
        const saved = await aldenRepository.saveUploadedFile({
          originalName: body.originalFileName,
          mimeType,
          buffer,
        });
        const isPlainText = mimeType === 'text/plain' || mimeType === 'text/markdown';
        const extractedTextPreview = isPlainText
          ? buffer.toString('utf-8').slice(0, 2000)
          : undefined;
        const item: MaterialItem = {
          id: generateId('mat'),
          title: body.title.trim(),
          type: 'file',
          category: body.category || 'other',
          fileName: saved.safeFileName,
          mimeType,
          fileSize: saved.fileSize,
          uploadId: saved.uploadId,
          textReadable: isPlainText,
          readabilityNote: isPlainText
            ? 'Tệp văn bản thuần — hệ thống có thể đọc trích đoạn để xem trước hoặc gửi AI hỗ trợ.'
            : 'Đã lưu tệp đính kèm an toàn — hệ thống chưa tự động đọc hay phân tích nội dung bên trong tệp PDF/Word/Ảnh/Audio này.',
          extractedTextPreview,
          linkedLessonIds: Array.isArray(body.linkedLessonIds) ? body.linkedLessonIds : [],
          notes: body.notes || '',
          createdAt: now,
        };
        store.materials.unshift(item);
        await aldenRepository.saveAll(store);
        res.status(201).json(item);
        return;
      }

      // Link material
      const check = validateSafeUrl(body.url || '');
      if (!check.valid) {
        res.status(400).json({ error: check.reason });
        return;
      }
      const item: MaterialItem = {
        id: generateId('mat'),
        title: body.title.trim(),
        type: 'link',
        category: body.category || 'other',
        url: check.normalized,
        textReadable: false,
        readabilityNote:
          'Đường dẫn tài liệu ngoài — hệ thống chỉ lưu liên kết mở nhanh, không tự động đọc nội dung trang đích.',
        linkedLessonIds: Array.isArray(body.linkedLessonIds) ? body.linkedLessonIds : [],
        notes: body.notes || '',
        createdAt: now,
      };
      store.materials.unshift(item);
      await aldenRepository.saveAll(store);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/uploads/:uploadId', async (req, res) => {
    const { uploadId } = req.params;
    const { filePath, exists } = aldenRepository.getUploadedFilePath(uploadId);
    if (!exists) {
      res.status(404).json({ error: 'Không tìm thấy tệp đính kèm.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(uploadId)}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  app.delete('/api/materials/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.materials = store.materials.filter((m) => m.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Curriculum Templates ---
  app.post('/api/curricula', async (req, res) => {
    try {
      const body = req.body as Partial<CurriculumTemplate>;
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tên lộ trình mẫu.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const created: CurriculumTemplate = {
        id: generateId('cur'),
        title: body.title.trim(),
        titleEn: body.titleEn?.trim() || '',
        description: body.description || '',
        targetAudience: body.targetAudience || '',
        entryLevel: body.entryLevel || '',
        exitGoal: body.exitGoal || '',
        estimatedSessions: Number(body.estimatedSessions) || 8,
        estimatedHours: body.estimatedHours ? Number(body.estimatedHours) : undefined,
        stages: Array.isArray(body.stages) ? body.stages : [],
        keyMaterialsSummary: body.keyMaterialsSummary || '',
        keyActivitiesSummary: body.keyActivitiesSummary || '',
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      store.curriculumTemplates.unshift(created);
      await aldenRepository.saveAll(store);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/curricula/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      const idx = store.curriculumTemplates.findIndex((c) => c.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Không tìm thấy lộ trình mẫu.' });
        return;
      }
      const existing = store.curriculumTemplates[idx];
      const updated: CurriculumTemplate = {
        ...existing,
        ...req.body,
        id: existing.id,
        version: (existing.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        isSampleData: false,
      };
      store.curriculumTemplates[idx] = updated;
      await aldenRepository.saveAll(store);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/curricula/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.curriculumTemplates = store.curriculumTemplates.filter((c) => c.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Personalized Student Roadmaps ---
  app.post('/api/roadmaps', async (req, res) => {
    try {
      const body = req.body as StudentRoadmap;
      if (!body.learnerId || !body.title?.trim()) {
        res.status(400).json({ error: 'Thiếu thông tin học viên hoặc tên lộ trình riêng.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const created: StudentRoadmap = {
        ...body,
        id: body.id || generateId('rm'),
        createdAt: now,
        updatedAt: now,
        isSampleData: false,
      };
      store.studentRoadmaps.unshift(created);
      await aldenRepository.saveAll(store);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/roadmaps/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      const idx = store.studentRoadmaps.findIndex((r) => r.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Không tìm thấy lộ trình riêng.' });
        return;
      }
      const updated: StudentRoadmap = {
        ...store.studentRoadmaps[idx],
        ...req.body,
        id: store.studentRoadmaps[idx].id,
        updatedAt: new Date().toISOString(),
        isSampleData: false,
      };
      store.studentRoadmaps[idx] = updated;
      await aldenRepository.saveAll(store);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/roadmaps/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.studentRoadmaps = store.studentRoadmaps.filter((r) => r.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Session Plans (Upsert by tutorFlowSessionId) ---
  app.put('/api/session-plans/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const body = req.body as Partial<SessionPlan>;
      if (!body.title?.trim() || !body.learnerId) {
        res.status(400).json({ error: 'Vui lòng nhập tiêu đề kế hoạch bài dạy.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const idx = store.sessionPlans.findIndex((p) => p.tutorFlowSessionId === sessionId);

      if (idx >= 0) {
        const updated: SessionPlan = {
          ...store.sessionPlans[idx],
          ...body,
          id: store.sessionPlans[idx].id,
          tutorFlowSessionId: sessionId,
          updatedAt: now,
          isSampleData: false,
        };
        store.sessionPlans[idx] = updated;
        await aldenRepository.saveAll(store);
        res.json(updated);
        return;
      }

      const created: SessionPlan = {
        id: generateId('sp'),
        tutorFlowSessionId: sessionId,
        learnerId: body.learnerId,
        roadmapId: body.roadmapId,
        roadmapItemId: body.roadmapItemId,
        sourceLessonTemplateId: body.sourceLessonTemplateId,
        sourceLessonVersionSnapshot: body.sourceLessonVersionSnapshot,
        title: body.title.trim(),
        objectives: body.objectives || '',
        preparationNotes: body.preparationNotes || '',
        materialIds: Array.isArray(body.materialIds) ? body.materialIds : [],
        activities: Array.isArray(body.activities) ? body.activities : [],
        homeworkPlan: body.homeworkPlan || '',
        teacherNotes: body.teacherNotes || '',
        createdAt: now,
        updatedAt: now,
        isSampleData: false,
      };
      store.sessionPlans.unshift(created);
      await aldenRepository.saveAll(store);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Post-Session Logs (Upsert by tutorFlowSessionId) ---
  app.put('/api/post-session-logs/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const body = req.body as Partial<PostSessionLog>;
      if (!body.learnerId) {
        res.status(400).json({ error: 'Thiếu mã học viên cho ghi nhận sau buổi học.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const idx = store.postSessionLogs.findIndex((l) => l.tutorFlowSessionId === sessionId);

      if (idx >= 0) {
        const updated: PostSessionLog = {
          ...store.postSessionLogs[idx],
          ...body,
          id: store.postSessionLogs[idx].id,
          tutorFlowSessionId: sessionId,
          updatedAt: now,
          isSampleData: false,
        };
        store.postSessionLogs[idx] = updated;
        await aldenRepository.saveAll(store);
        res.json(updated);
        return;
      }

      const created: PostSessionLog = {
        id: generateId('log'),
        tutorFlowSessionId: sessionId,
        sessionPlanId: body.sessionPlanId,
        learnerId: body.learnerId,
        activityOutcomes: Array.isArray(body.activityOutcomes) ? body.activityOutcomes : [],
        taughtSummary: body.taughtSummary || '',
        actualDurationMinutes: body.actualDurationMinutes,
        missingContent: body.missingContent || '',
        comprehensionLevel: body.comprehensionLevel || 'not_rated',
        strengths: body.strengths || '',
        weaknesses: body.weaknesses || '',
        commonErrors: body.commonErrors || '',
        homeworkAssigned: body.homeworkAssigned || '',
        homeworkResult: body.homeworkResult || '',
        freeformNotes: body.freeformNotes || '',
        organizedNotesByAi: body.organizedNotesByAi,
        updatedAt: now,
        isSampleData: false,
      };
      store.postSessionLogs.unshift(created);
      await aldenRepository.saveAll(store);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Saved AI Suggestions (Draft / Accepted / Dismissed) ---
  app.post('/api/ai-suggestions', async (req, res) => {
    try {
      const body = req.body as Partial<AiSuggestionRecord>;
      if (!body.type || !body.title || !body.content) {
        res.status(400).json({ error: 'Dữ liệu đề xuất AI không đầy đủ.' });
        return;
      }
      const store = await aldenRepository.loadAll();
      const now = new Date().toISOString();
      const item: AiSuggestionRecord = {
        id: generateId('ais'),
        type: body.type,
        title: body.title,
        learnerId: body.learnerId,
        sessionId: body.sessionId,
        lessonTemplateId: body.lessonTemplateId,
        curriculumTemplateId: body.curriculumTemplateId,
        status: 'draft',
        content: body.content,
        modelUsed: body.modelUsed || 'gemini-4-hydrogen',
        createdAt: now,
        updatedAt: now,
      };
      store.aiSuggestions.unshift(item);
      await aldenRepository.saveAll(store);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/ai-suggestions/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      const idx = store.aiSuggestions.findIndex((s) => s.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Không tìm thấy đề xuất AI.' });
        return;
      }
      store.aiSuggestions[idx] = {
        ...store.aiSuggestions[idx],
        ...req.body,
        id: store.aiSuggestions[idx].id,
        updatedAt: new Date().toISOString(),
      };
      await aldenRepository.saveAll(store);
      res.json(store.aiSuggestions[idx]);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/ai-suggestions/:id', async (req, res) => {
    try {
      const store = await aldenRepository.loadAll();
      store.aiSuggestions = store.aiSuggestions.filter((s) => s.id !== req.params.id);
      await aldenRepository.saveAll(store);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // =========================================================================
  // 3. SERVER-SIDE AI ENDPOINTS (No client keys, no fake responses on failure)
  // =========================================================================
  app.get('/api/ai/status', (_req, res) => {
    res.json(aiProvider.getStatus());
  });

  app.post('/api/ai/evaluate', async (req, res) => {
    try {
      const { targetType, targetId } = req.body as {
        targetType: 'lesson' | 'curriculum';
        targetId: string;
      };
      const store = await aldenRepository.loadAll();
      let payload: Record<string, unknown> | null = null;

      if (targetType === 'lesson') {
        const lesson = store.lessonTemplates.find((l) => l.id === targetId);
        if (!lesson) {
          res.status(404).json({ error: 'Không tìm thấy giáo án để đánh giá.' });
          return;
        }
        // Data minimization: send only instructional fields
        payload = {
          title: lesson.title,
          level: lesson.level,
          targetAudience: lesson.targetAudience,
          skills: lesson.skills,
          durationMinutes: lesson.durationMinutes,
          learningObjectives: lesson.learningObjectives,
          keyKnowledge: lesson.keyKnowledge,
          vocabulary: lesson.vocabulary,
          grammar: lesson.grammar,
          pronunciation: lesson.pronunciation,
          activities: lesson.activities.map((a) => ({
            stage: a.stage,
            title: a.title,
            durationMinutes: a.durationMinutes,
            objective: a.objective,
            teacherInstructions: a.teacherInstructions,
            studentTask: a.studentTask,
          })),
          homework: lesson.homework,
          assessmentMethod: lesson.assessmentMethod,
        };
      } else {
        const cur = store.curriculumTemplates.find((c) => c.id === targetId);
        if (!cur) {
          res.status(404).json({ error: 'Không tìm thấy lộ trình mẫu để đánh giá.' });
          return;
        }
        payload = {
          title: cur.title,
          description: cur.description,
          targetAudience: cur.targetAudience,
          entryLevel: cur.entryLevel,
          exitGoal: cur.exitGoal,
          estimatedSessions: cur.estimatedSessions,
          stages: cur.stages,
          keyMaterialsSummary: cur.keyMaterialsSummary,
          keyActivitiesSummary: cur.keyActivitiesSummary,
        };
      }

      const data = await aiProvider.evaluatePlan({ targetType, payload });
      res.json(data);
    } catch (err) {
      const status = aiProvider.getStatus().configured ? 502 : 503;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.post('/api/ai/next-session', async (req, res) => {
    try {
      const { learnerId, extraContext } = req.body as {
        learnerId: string;
        extraContext?: string;
      };
      const [store, learners, sessions] = await Promise.all([
        aldenRepository.loadAll(),
        tutorFlowAdapter.listLearners(),
        tutorFlowAdapter.listSessions(),
      ]);
      const learner = learners.find((l) => l.id === learnerId);
      if (!learner) {
        res.status(404).json({ error: 'Không tìm thấy học viên/nhóm.' });
        return;
      }
      const roadmap = store.studentRoadmaps.find((r) => r.learnerId === learnerId) || null;
      const learnerSessions = sessions
        .filter((s) => s.learnerId === learnerId)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 4);

      const recentSessions = learnerSessions.map((s) => {
        const plan = store.sessionPlans.find((p) => p.tutorFlowSessionId === s.id);
        const log = store.postSessionLogs.find((l) => l.tutorFlowSessionId === s.id);
        return {
          sessionDate: s.startTime,
          status: s.tutorFlowStatus,
          durationMinutes: s.durationMinutes,
          planTitle: plan?.title || null,
          postSessionLog: log
            ? {
                activityOutcomes: log.activityOutcomes,
                taughtSummary: log.taughtSummary,
                missingContent: log.missingContent,
                comprehensionLevel: log.comprehensionLevel,
                strengths: log.strengths,
                weaknesses: log.weaknesses,
                commonErrors: log.commonErrors,
                homeworkAssigned: log.homeworkAssigned,
                homeworkResult: log.homeworkResult,
              }
            : null,
        };
      });

      const roadmapSummary = roadmap
        ? {
            title: roadmap.title,
            customGoals: roadmap.customGoals,
            entryLevel: roadmap.entryLevel,
            targetGoal: roadmap.targetGoal,
            stages: roadmap.stages.map((st) => ({
              title: st.title,
              items: st.items.map((it) => ({
                title: it.customTitle,
                status: it.status,
                personalNotes: it.personalNotes,
              })),
            })),
          }
        : null;

      const data = await aiProvider.suggestNextSession({
        learnerName: learner.displayName,
        learnerType: learner.entityType,
        roadmapSummary,
        recentSessions,
        extraContext,
      });
      res.json(data);
    } catch (err) {
      const status = aiProvider.getStatus().configured ? 502 : 503;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.post('/api/ai/progress-summary', async (req, res) => {
    try {
      const { learnerId } = req.body as { learnerId: string };
      const [store, learners] = await Promise.all([
        aldenRepository.loadAll(),
        tutorFlowAdapter.listLearners(),
      ]);
      const learner = learners.find((l) => l.id === learnerId);
      if (!learner) {
        res.status(404).json({ error: 'Không tìm thấy học viên/nhóm.' });
        return;
      }
      const roadmaps = store.studentRoadmaps.filter((r) => r.learnerId === learnerId);
      const logs = store.postSessionLogs.filter((l) => l.learnerId === learnerId);

      const roadmapStats = {
        roadmaps: roadmaps.map((r) => ({
          title: r.title,
          targetGoal: r.targetGoal,
          items: r.stages.flatMap((s) =>
            s.items.map((i) => ({
              title: i.customTitle,
              status: i.status,
              personalNotes: i.personalNotes,
            }))
          ),
        })),
      };

      const recordedLogs = logs.map((l) => ({
        updatedAt: l.updatedAt,
        taughtSummary: l.taughtSummary,
        missingContent: l.missingContent,
        comprehensionLevel: l.comprehensionLevel,
        strengths: l.strengths,
        weaknesses: l.weaknesses,
        commonErrors: l.commonErrors,
        homeworkAssigned: l.homeworkAssigned,
        homeworkResult: l.homeworkResult,
        activityOutcomes: l.activityOutcomes,
      }));

      const data = await aiProvider.summarizeProgress({
        learnerName: learner.displayName,
        learnerType: learner.entityType,
        roadmapStats,
        recordedLogs,
      });
      res.json(data);
    } catch (err) {
      const status = aiProvider.getStatus().configured ? 502 : 503;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.post('/api/ai/generate-lesson', async (req, res) => {
    try {
      const body = req.body as {
        titleOrTopic: string;
        bookInfo?: string;
        targetAudience?: string;
        level?: string;
        objectives?: string;
        durationMinutes?: number;
        skills?: string[];
        languageMode?: string;
        notes?: string;
        materialId?: string;
      };
      if (!body.titleOrTopic?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tên bài hoặc chủ đề giáo án.' });
        return;
      }

      let readableMaterialExcerpt: string | undefined;
      if (body.materialId) {
        const store = await aldenRepository.loadAll();
        const mat = store.materials.find((m) => m.id === body.materialId);
        if (mat?.textReadable && mat.extractedTextPreview) {
          readableMaterialExcerpt = mat.extractedTextPreview.slice(0, 1500);
        }
      }

      const data = await aiProvider.generateLessonDraft({
        ...body,
        readableMaterialExcerpt,
      });
      res.json(data);
    } catch (err) {
      const status = aiProvider.getStatus().configured ? 502 : 503;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  app.post('/api/ai/organize-notes', async (req, res) => {
    try {
      const { freeformNotes, activityOutcomesSummary } = req.body as {
        freeformNotes: string;
        activityOutcomesSummary?: string;
      };
      if (!freeformNotes?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập ghi chú tự do trước khi nhờ AI sắp xếp.' });
        return;
      }
      const data = await aiProvider.organizePostSessionNotes({
        freeformNotes,
        activityOutcomesSummary: activityOutcomesSummary || '',
      });
      res.json(data);
    } catch (err) {
      const status = aiProvider.getStatus().configured ? 502 : 503;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  // =========================================================================
  // 4. VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alden Path server listening on http://localhost:${PORT}`);
  });
}

startServer();
