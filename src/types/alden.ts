export type LearnerEntityType = 'student' | 'group';

export interface TutorFlowLearner {
  id: string;
  entityType: LearnerEntityType;
  displayName: string;
  englishName?: string;
  memberNames?: string[];
  levelNote: string;
  goalNote: string;
  scheduleSummary: string;
  status: 'active' | 'paused';
  source: 'sample_tutorflow' | 'live_tutorflow';
}

export type TutorFlowSessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface TutorFlowSession {
  id: string;
  learnerId: string;
  learnerType: LearnerEntityType;
  learnerName: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMinutes: number;
  tutorFlowStatus: TutorFlowSessionStatus;
  meetingFormat: 'online' | 'in_person';
  tutorFlowNote?: string;
  source: 'sample_tutorflow' | 'live_tutorflow';
}

export interface TutorFlowConnectionStatus {
  connected: boolean;
  mode: 'sample' | 'live';
  label: string;
  readOnlyEnforced: boolean;
  lastSyncedAt: string;
  storageDescription: string;
  storageLocation: string;
  storageLimitations: string;
  requiredInfoChecklist: string[];
}

export interface LessonActivity {
  id: string;
  title: string;
  titleEn?: string;
  stage: string; // Warm-up, Presentation, Practice, Production, Review, etc.
  durationMinutes: number;
  objective: string;
  teacherInstructions: string;
  studentTask: string;
  guidingQuestions: string;
  answerKey: string;
  sourceBankActivityId?: string;
}

export type LessonStatus = 'draft' | 'published';
export type LessonType = 'textbook' | 'standalone';

export interface LessonTemplate {
  id: string;
  title: string;
  titleEn?: string;
  status: LessonStatus;
  lessonType: LessonType;
  bookSeries?: string;
  unit?: string;
  lessonNumber?: string;
  pages?: string;
  topic?: string;
  level: string;
  targetAudience: string;
  skills: string[];
  learningObjectives: string;
  keyKnowledge: string;
  durationMinutes: number;
  vocabulary: string;
  grammar: string;
  pronunciation: string;
  preparationNotes: string;
  materialIds: string[];
  activities: LessonActivity[];
  homework: string;
  assessmentMethod: string;
  additionalNotes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export interface ReusableActivity {
  id: string;
  title: string;
  titleEn?: string;
  stage: string;
  skill: string;
  level: string;
  durationMinutes: number;
  objective: string;
  teacherInstructions: string;
  studentTask: string;
  guidingQuestions: string;
  answerKey: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export type MaterialCategory =
  | 'worksheet'
  | 'answer_key'
  | 'slides'
  | 'audio'
  | 'reading'
  | 'other';

export interface MaterialItem {
  id: string;
  title: string;
  type: 'link' | 'file';
  category: MaterialCategory;
  url?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploadId?: string;
  textReadable: boolean;
  readabilityNote: string;
  extractedTextPreview?: string;
  linkedLessonIds: string[];
  notes?: string;
  createdAt: string;
  isSampleData?: boolean;
}

export interface CurriculumLessonItem {
  id: string;
  lessonTemplateId?: string;
  customTitle: string;
  topic?: string;
  estimatedSessions: number;
  keyMaterialsNote?: string;
  keyActivitiesNote?: string;
  notes?: string;
}

export interface CurriculumStage {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  items: CurriculumLessonItem[];
}

export interface CurriculumTemplate {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  targetAudience: string;
  entryLevel: string;
  exitGoal: string;
  estimatedSessions: number;
  estimatedHours?: number;
  stages: CurriculumStage[];
  keyMaterialsSummary?: string;
  keyActivitiesSummary?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export type RoadmapItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'needs_review';

export interface StudentRoadmapItem {
  id: string;
  sourceItemId?: string;
  lessonTemplateId?: string;
  lessonTemplateVersionSnapshot?: number;
  customTitle: string;
  topic?: string;
  estimatedSessions: number;
  status: RoadmapItemStatus;
  personalNotes?: string;
  lastTaughtSessionId?: string;
  isCustomized: boolean;
}

export interface StudentRoadmapStage {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  items: StudentRoadmapItem[];
}

export interface StudentRoadmap {
  id: string;
  learnerId: string;
  learnerType: LearnerEntityType;
  learnerNameSnapshot: string;
  sourceTemplateId?: string;
  sourceTemplateTitleSnapshot?: string;
  sourceTemplateVersionSnapshot?: number;
  title: string;
  customGoals: string;
  entryLevel: string;
  targetGoal: string;
  estimatedSessions: number;
  stages: StudentRoadmapStage[];
  teacherNotes?: string;
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export interface SessionPlan {
  id: string;
  tutorFlowSessionId: string;
  learnerId: string;
  roadmapId?: string;
  roadmapItemId?: string;
  sourceLessonTemplateId?: string;
  sourceLessonVersionSnapshot?: number;
  title: string;
  objectives: string;
  preparationNotes: string;
  materialIds: string[];
  activities: LessonActivity[];
  homeworkPlan: string;
  teacherNotes: string;
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export type ActivityExecutionStatus = 'completed' | 'partial' | 'not_done';

export interface ActivityOutcome {
  activityId: string;
  activityTitle: string;
  status: ActivityExecutionStatus;
  actualMinutes?: number;
  note?: string;
}

export type ComprehensionLevel =
  | 'high'
  | 'moderate'
  | 'needs_support'
  | 'not_rated';

export interface PostSessionLog {
  id: string;
  tutorFlowSessionId: string;
  sessionPlanId?: string;
  learnerId: string;
  activityOutcomes: ActivityOutcome[];
  taughtSummary: string;
  actualDurationMinutes?: number;
  missingContent: string;
  comprehensionLevel: ComprehensionLevel;
  strengths: string;
  weaknesses: string;
  commonErrors: string;
  homeworkAssigned: string;
  homeworkResult: string;
  freeformNotes: string;
  organizedNotesByAi?: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export type AiSuggestionType =
  | 'lesson_evaluation'
  | 'curriculum_evaluation'
  | 'next_session'
  | 'progress_summary'
  | 'generated_lesson';

export type AiSuggestionStatus = 'draft' | 'accepted' | 'dismissed';

export interface AiSuggestionRecord {
  id: string;
  type: AiSuggestionType;
  title: string;
  learnerId?: string;
  sessionId?: string;
  lessonTemplateId?: string;
  curriculumTemplateId?: string;
  status: AiSuggestionStatus;
  content: Record<string, unknown>;
  modelUsed: string;
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export interface AldenStoreData {
  lessonTemplates: LessonTemplate[];
  activityBank: ReusableActivity[];
  materials: MaterialItem[];
  curriculumTemplates: CurriculumTemplate[];
  studentRoadmaps: StudentRoadmap[];
  sessionPlans: SessionPlan[];
  postSessionLogs: PostSessionLog[];
  aiSuggestions: AiSuggestionRecord[];
}

export interface AiServiceStatus {
  configured: boolean;
  provider: string;
  model: string;
  message: string;
}

export type ActiveNavSection =
  | 'dashboard'
  | 'lessons'
  | 'curricula'
  | 'learners'
  | 'sessions'
  | 'ai';
