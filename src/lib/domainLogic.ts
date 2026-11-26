import type {
  ActivityOutcome,
  AldenStoreData,
  CurriculumTemplate,
  LessonActivity,
  LessonTemplate,
  PostSessionLog,
  SessionPlan,
  StudentRoadmap,
  TutorFlowLearner,
  TutorFlowSession,
} from '../types/alden';

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function validateSafeUrl(rawUrl: string): { valid: boolean; normalized?: string; reason?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Đường dẫn không được để trống.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: 'Chỉ chấp nhận đường dẫn bắt đầu bằng http:// hoặc https://.',
      };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return {
      valid: false,
      reason: 'Đường dẫn không đúng định dạng URL (ví dụ: https://drive.google.com/...).',
    };
  }
}

/**
 * Deep-clones a CurriculumTemplate into an isolated StudentRoadmap.
 * Subsequent edits to the returned roadmap never mutate the template,
 * and later edits to the template never overwrite the student's roadmap.
 */
export function forkCurriculumForLearner(
  template: CurriculumTemplate,
  learner: TutorFlowLearner,
  lessonTemplates: LessonTemplate[],
  nowIso: string = new Date().toISOString()
): StudentRoadmap {
  const lessonVersionMap = new Map(lessonTemplates.map((l) => [l.id, l.version]));

  return {
    id: generateId('rm'),
    learnerId: learner.id,
    learnerType: learner.entityType,
    learnerNameSnapshot: learner.displayName,
    sourceTemplateId: template.id,
    sourceTemplateTitleSnapshot: template.title,
    sourceTemplateVersionSnapshot: template.version,
    title: `${template.title} — ${learner.displayName}`,
    customGoals: template.exitGoal,
    entryLevel: learner.levelNote || template.entryLevel,
    targetGoal: template.exitGoal,
    estimatedSessions: template.estimatedSessions,
    teacherNotes: `Bản lộ trình riêng tạo từ mẫu "${template.title}". Có thể điều chỉnh thoải mái mà không ảnh hưởng lộ trình gốc.`,
    stages: template.stages.map((stage) => ({
      id: generateId('rm_stage'),
      title: stage.title,
      titleEn: stage.titleEn,
      description: stage.description,
      items: stage.items.map((item) => ({
        id: generateId('rm_item'),
        sourceItemId: item.id,
        lessonTemplateId: item.lessonTemplateId,
        lessonTemplateVersionSnapshot: item.lessonTemplateId
          ? lessonVersionMap.get(item.lessonTemplateId)
          : undefined,
        customTitle: item.customTitle,
        topic: item.topic,
        estimatedSessions: item.estimatedSessions,
        status: 'not_started',
        personalNotes: item.notes || '',
        isCustomized: false,
      })),
    })),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Checks whether a student roadmap's source template or referenced lesson templates
 * have newer versions available, without mutating the student's personalized roadmap.
 */
export interface TemplateDriftItem {
  kind: 'curriculum_template' | 'lesson_template';
  targetId: string;
  title: string;
  snapshotVersion: number;
  currentVersion: number;
  roadmapItemId?: string;
}

export function detectTemplateDrift(
  roadmap: StudentRoadmap,
  curriculumTemplates: CurriculumTemplate[],
  lessonTemplates: LessonTemplate[]
): TemplateDriftItem[] {
  const drifts: TemplateDriftItem[] = [];

  if (roadmap.sourceTemplateId && roadmap.sourceTemplateVersionSnapshot !== undefined) {
    const sourceTemplate = curriculumTemplates.find((c) => c.id === roadmap.sourceTemplateId);
    if (sourceTemplate && sourceTemplate.version > roadmap.sourceTemplateVersionSnapshot) {
      drifts.push({
        kind: 'curriculum_template',
        targetId: sourceTemplate.id,
        title: sourceTemplate.title,
        snapshotVersion: roadmap.sourceTemplateVersionSnapshot,
        currentVersion: sourceTemplate.version,
      });
    }
  }

  const lessonMap = new Map(lessonTemplates.map((l) => [l.id, l]));
  for (const stage of roadmap.stages) {
    for (const item of stage.items) {
      if (item.lessonTemplateId && item.lessonTemplateVersionSnapshot !== undefined) {
        const master = lessonMap.get(item.lessonTemplateId);
        if (master && master.version > item.lessonTemplateVersionSnapshot) {
          drifts.push({
            kind: 'lesson_template',
            targetId: master.id,
            title: master.title,
            snapshotVersion: item.lessonTemplateVersionSnapshot,
            currentVersion: master.version,
            roadmapItemId: item.id,
          });
        }
      }
    }
  }

  return drifts;
}

/**
 * Deep-clones a master LessonTemplate into a session-specific SessionPlan.
 * Editing activities/notes in the SessionPlan will never affect the master lesson.
 */
export function createSessionPlanFromLesson(
  lesson: LessonTemplate,
  session: TutorFlowSession,
  roadmapId?: string,
  roadmapItemId?: string,
  nowIso: string = new Date().toISOString()
): SessionPlan {
  const clonedActivities: LessonActivity[] = lesson.activities.map((act) => ({
    ...act,
    id: generateId('sact'),
  }));

  return {
    id: generateId('sp'),
    tutorFlowSessionId: session.id,
    learnerId: session.learnerId,
    roadmapId,
    roadmapItemId,
    sourceLessonTemplateId: lesson.id,
    sourceLessonVersionSnapshot: lesson.version,
    title: lesson.title,
    objectives: lesson.learningObjectives,
    preparationNotes: lesson.preparationNotes,
    materialIds: [...lesson.materialIds],
    activities: clonedActivities,
    homeworkPlan: lesson.homework,
    teacherNotes: lesson.additionalNotes,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface LessonFilters {
  query: string;
  bookSeries: string;
  level: string;
  skill: string;
  lessonType: 'all' | 'textbook' | 'standalone';
  durationBucket: 'all' | 'short' | 'medium' | 'long';
}

export function filterLessons(
  lessons: LessonTemplate[],
  filters: LessonFilters
): LessonTemplate[] {
  const q = filters.query.trim().toLowerCase();

  return lessons.filter((lesson) => {
    if (filters.lessonType !== 'all' && lesson.lessonType !== filters.lessonType) {
      return false;
    }
    if (filters.bookSeries && filters.bookSeries !== 'all') {
      if ((lesson.bookSeries || 'Độc lập') !== filters.bookSeries) {
        return false;
      }
    }
    if (filters.level && filters.level !== 'all' && lesson.level !== filters.level) {
      return false;
    }
    if (filters.skill && filters.skill !== 'all') {
      const hasSkill = lesson.skills.some(
        (s) => s.toLowerCase() === filters.skill.toLowerCase()
      );
      if (!hasSkill) return false;
    }
    if (filters.durationBucket !== 'all') {
      const d = lesson.durationMinutes || 0;
      if (filters.durationBucket === 'short' && d > 45) return false;
      if (filters.durationBucket === 'medium' && (d <= 45 || d > 75)) return false;
      if (filters.durationBucket === 'long' && d <= 75) return false;
    }
    if (q) {
      const searchable = [
        lesson.title,
        lesson.titleEn,
        lesson.bookSeries,
        lesson.unit,
        lesson.lessonNumber,
        lesson.topic,
        lesson.level,
        lesson.targetAudience,
        lesson.skills.join(' '),
        lesson.keyKnowledge,
        lesson.vocabulary,
        lesson.grammar,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

export interface LessonTreeGroup {
  bookSeries: string;
  units: {
    unit: string;
    skills: {
      skill: string;
      lessons: LessonTemplate[];
    }[];
  }[];
}

export function groupLessonsIntoTree(lessons: LessonTemplate[]): LessonTreeGroup[] {
  const bookMap = new Map<string, Map<string, Map<string, LessonTemplate[]>>>();

  for (const lesson of lessons) {
    const book =
      lesson.lessonType === 'standalone' || !lesson.bookSeries?.trim()
        ? 'Giáo án độc lập (Không theo bộ sách)'
        : lesson.bookSeries.trim();
    const unit = lesson.unit?.trim() || lesson.topic?.trim() || 'Chủ đề chung';
    const primarySkill = lesson.skills[0]?.trim() || 'Tổng hợp';

    if (!bookMap.has(book)) bookMap.set(book, new Map());
    const unitMap = bookMap.get(book)!;
    if (!unitMap.has(unit)) unitMap.set(unit, new Map());
    const skillMap = unitMap.get(unit)!;
    if (!skillMap.has(primarySkill)) skillMap.set(primarySkill, []);
    skillMap.get(primarySkill)!.push(lesson);
  }

  return Array.from(bookMap.entries()).map(([bookSeries, unitMap]) => ({
    bookSeries,
    units: Array.from(unitMap.entries()).map(([unit, skillMap]) => ({
      unit,
      skills: Array.from(skillMap.entries()).map(([skill, groupedLessons]) => ({
        skill,
        lessons: groupedLessons,
      })),
    })),
  }));
}

export interface DashboardSummary {
  upcomingSessions: TutorFlowSession[];
  upcomingWithPlanCount: number;
  upcomingWithoutPlanCount: number;
  completedMissingLogSessions: TutorFlowSession[];
  unfinishedItems: {
    sessionId: string;
    learnerId: string;
    learnerName: string;
    sessionDate: string;
    outcome: ActivityOutcome;
  }[];
  reviewRoadmapItems: {
    roadmapId: string;
    learnerId: string;
    learnerName: string;
    itemId: string;
    title: string;
    status: 'in_progress' | 'needs_review';
  }[];
}

export function computeDashboardSummary(
  sessions: TutorFlowSession[],
  store: AldenStoreData
): DashboardSummary {
  const planBySessionId = new Map(store.sessionPlans.map((p) => [p.tutorFlowSessionId, p]));
  const logBySessionId = new Map(store.postSessionLogs.map((l) => [l.tutorFlowSessionId, l]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const upcomingSessions = sessions
    .filter((s) => s.tutorFlowStatus === 'scheduled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  let upcomingWithPlanCount = 0;
  let upcomingWithoutPlanCount = 0;
  for (const s of upcomingSessions) {
    if (planBySessionId.has(s.id)) upcomingWithPlanCount += 1;
    else upcomingWithoutPlanCount += 1;
  }

  const completedMissingLogSessions = sessions
    .filter((s) => s.tutorFlowStatus === 'completed' && !logBySessionId.has(s.id))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const unfinishedItems: DashboardSummary['unfinishedItems'] = [];
  for (const log of store.postSessionLogs) {
    const sess = sessionById.get(log.tutorFlowSessionId);
    for (const outcome of log.activityOutcomes) {
      if (outcome.status === 'partial' || outcome.status === 'not_done') {
        unfinishedItems.push({
          sessionId: log.tutorFlowSessionId,
          learnerId: log.learnerId,
          learnerName: sess?.learnerName || 'Học viên',
          sessionDate: sess?.startTime || log.updatedAt,
          outcome,
        });
      }
    }
  }

  const reviewRoadmapItems: DashboardSummary['reviewRoadmapItems'] = [];
  for (const rm of store.studentRoadmaps) {
    for (const stage of rm.stages) {
      for (const item of stage.items) {
        if (item.status === 'needs_review' || item.status === 'in_progress') {
          reviewRoadmapItems.push({
            roadmapId: rm.id,
            learnerId: rm.learnerId,
            learnerName: rm.learnerNameSnapshot,
            itemId: item.id,
            title: item.customTitle,
            status: item.status,
          });
        }
      }
    }
  }

  return {
    upcomingSessions,
    upcomingWithPlanCount,
    upcomingWithoutPlanCount,
    completedMissingLogSessions,
    unfinishedItems,
    reviewRoadmapItems,
  };
}

export interface LearnerProgressStats {
  totalRoadmapItems: number;
  completedCount: number;
  inProgressCount: number;
  needsReviewCount: number;
  notStartedCount: number;
  completionPercent: number;
  unfinishedActivities: {
    sessionId: string;
    activityTitle: string;
    status: 'partial' | 'not_done';
    note?: string;
    updatedAt: string;
  }[];
  loggedSessionsCount: number;
}

export function computeLearnerProgress(
  learnerId: string,
  roadmaps: StudentRoadmap[],
  logs: PostSessionLog[]
): LearnerProgressStats {
  const learnerRoadmaps = roadmaps.filter((r) => r.learnerId === learnerId);
  let totalRoadmapItems = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let needsReviewCount = 0;
  let notStartedCount = 0;

  for (const rm of learnerRoadmaps) {
    for (const stage of rm.stages) {
      for (const item of stage.items) {
        totalRoadmapItems += 1;
        if (item.status === 'completed') completedCount += 1;
        else if (item.status === 'in_progress') inProgressCount += 1;
        else if (item.status === 'needs_review') needsReviewCount += 1;
        else notStartedCount += 1;
      }
    }
  }

  const learnerLogs = logs.filter((l) => l.learnerId === learnerId);
  const unfinishedActivities: LearnerProgressStats['unfinishedActivities'] = [];
  for (const log of learnerLogs) {
    for (const outcome of log.activityOutcomes) {
      if (outcome.status === 'partial' || outcome.status === 'not_done') {
        unfinishedActivities.push({
          sessionId: log.tutorFlowSessionId,
          activityTitle: outcome.activityTitle,
          status: outcome.status,
          note: outcome.note,
          updatedAt: log.updatedAt,
        });
      }
    }
  }

  const completionPercent =
    totalRoadmapItems > 0 ? Math.round((completedCount / totalRoadmapItems) * 100) : 0;

  return {
    totalRoadmapItems,
    completedCount,
    inProgressCount,
    needsReviewCount,
    notStartedCount,
    completionPercent,
    unfinishedActivities,
    loggedSessionsCount: learnerLogs.length,
  };
}

export function getTotalActivityMinutes(activities: LessonActivity[]): number {
  return activities.reduce((sum, act) => sum + (Number(act.durationMinutes) || 0), 0);
}
