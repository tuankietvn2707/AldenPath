import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardSummary,
  computeLearnerProgress,
  createSessionPlanFromLesson,
  detectTemplateDrift,
  filterLessons,
  forkCurriculumForLearner,
  groupLessonsIntoTree,
  validateSafeUrl,
} from './domainLogic';
import type {
  AldenStoreData,
  CurriculumTemplate,
  LessonTemplate,
  TutorFlowLearner,
  TutorFlowSession,
} from '../types/alden';

const sampleLesson: LessonTemplate = {
  id: 'les_1',
  title: 'Past Simple — Storytelling',
  titleEn: 'Past Simple Storytelling',
  status: 'published',
  lessonType: 'standalone',
  topic: 'Past Simple',
  level: 'A2',
  targetAudience: 'Người đi làm',
  skills: ['Speaking', 'Grammar'],
  learningObjectives: 'Kể lại trải nghiệm cuối tuần bằng thì quá khứ đơn.',
  keyKnowledge: 'Regular & irregular verbs',
  durationMinutes: 60,
  vocabulary: 'weekend, travel, memorable',
  grammar: 'V-ed / V2, did + V0',
  pronunciation: '-ed endings /t/, /d/, /ɪd/',
  preparationNotes: 'Chuẩn bị bảng động từ bất quy tắc.',
  materialIds: ['mat_1'],
  activities: [
    {
      id: 'act_1',
      title: 'Khởi động: Last Weekend',
      stage: 'Warm-up',
      durationMinutes: 10,
      objective: 'Gợi mở ngữ cảnh quá khứ',
      teacherInstructions: 'Hỏi 3 câu ngắn về cuối tuần trước',
      studentTask: 'Trả lời theo mẫu',
      guidingQuestions: 'What did you do last Sunday?',
      answerKey: 'I visited my parents.',
    },
    {
      id: 'act_2',
      title: 'Thực hành kể chuyện',
      stage: 'Production',
      durationMinutes: 25,
      objective: 'Tự kể câu chuyện 2 phút',
      teacherInstructions: 'Ghi chú lỗi phát âm -ed',
      studentTask: 'Kể 1 kỷ niệm đáng nhớ',
      guidingQuestions: 'Where did you go?',
      answerKey: 'N/A',
    },
  ],
  homework: 'Viết đoạn văn 80 từ về chuyến đi gần nhất.',
  assessmentMethod: 'Quan sát phát âm và chia động từ.',
  additionalNotes: '',
  version: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const sampleTemplate: CurriculumTemplate = {
  id: 'cur_1',
  title: 'Giao tiếp căn bản A2',
  description: 'Lộ trình cho người mất gốc',
  targetAudience: 'Người đi làm',
  entryLevel: 'A1+',
  exitGoal: 'Giao tiếp tình huống hàng ngày tự tin',
  estimatedSessions: 12,
  stages: [
    {
      id: 'st_1',
      title: 'Giai đoạn 1: Kể chuyện & Quá khứ',
      items: [
        {
          id: 'ci_1',
          lessonTemplateId: 'les_1',
          customTitle: 'Past Simple — Storytelling',
          topic: 'Past Simple',
          estimatedSessions: 1,
        },
      ],
    },
  ],
  version: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const sampleLearner: TutorFlowLearner = {
  id: 'tf_stu_001',
  entityType: 'student',
  displayName: 'Nguyễn Minh Anh',
  levelNote: 'A2-',
  goalNote: 'Giao tiếp công việc',
  scheduleSummary: 'Thứ 3 & Thứ 5, 19:30',
  status: 'active',
  source: 'sample_tutorflow',
};

test('forkCurriculumForLearner creates an isolated student roadmap without mutating template', () => {
  const forked = forkCurriculumForLearner(sampleTemplate, sampleLearner, [sampleLesson]);

  assert.equal(forked.learnerId, sampleLearner.id);
  assert.equal(forked.sourceTemplateId, sampleTemplate.id);
  assert.equal(forked.stages[0].items[0].status, 'not_started');

  // Mutate forked copy
  forked.title = 'Lộ trình tùy chỉnh riêng';
  forked.stages[0].items[0].customTitle = 'Past Simple (Rút gọn cho Minh Anh)';
  forked.stages[0].items[0].status = 'completed';

  // Original template must remain completely unchanged
  assert.equal(sampleTemplate.title, 'Giao tiếp căn bản A2');
  assert.equal(sampleTemplate.stages[0].items[0].customTitle, 'Past Simple — Storytelling');
});

test('detectTemplateDrift flags template updates without overwriting personalized roadmap', () => {
  const forked = forkCurriculumForLearner(sampleTemplate, sampleLearner, [sampleLesson]);
  assert.equal(detectTemplateDrift(forked, [sampleTemplate], [sampleLesson]).length, 0);

  const updatedTemplate: CurriculumTemplate = { ...sampleTemplate, version: 2 };
  const updatedLesson: LessonTemplate = { ...sampleLesson, version: 3 };

  const drifts = detectTemplateDrift(forked, [updatedTemplate], [updatedLesson]);
  assert.equal(drifts.length, 2);
  assert.equal(drifts[0].kind, 'curriculum_template');
  assert.equal(drifts[1].kind, 'lesson_template');
  // Forked snapshot version stays untouched until teacher explicitly opts in
  assert.equal(forked.sourceTemplateVersionSnapshot, 1);
});

test('createSessionPlanFromLesson clones activities so edits never mutate master lesson', () => {
  const session: TutorFlowSession = {
    id: 'tf_ses_101',
    learnerId: sampleLearner.id,
    learnerType: 'student',
    learnerName: sampleLearner.displayName,
    startTime: '2026-11-26T12:30:00.000Z',
    endTime: '2026-11-26T13:30:00.000Z',
    durationMinutes: 60,
    tutorFlowStatus: 'scheduled',
    meetingFormat: 'online',
    source: 'sample_tutorflow',
  };

  const plan = createSessionPlanFromLesson(sampleLesson, session);
  plan.activities[0].title = 'Warm-up rút gọn 5 phút';
  plan.activities[0].durationMinutes = 5;

  assert.equal(sampleLesson.activities[0].title, 'Khởi động: Last Weekend');
  assert.equal(sampleLesson.activities[0].durationMinutes, 10);
});

test('filterLessons and groupLessonsIntoTree work for textbook and standalone lessons', () => {
  const textbookLesson: LessonTemplate = {
    ...sampleLesson,
    id: 'les_2',
    title: 'Unit 3A — Shopping Habits',
    lessonType: 'textbook',
    bookSeries: 'English File Pre-Intermediate',
    unit: 'Unit 3',
    skills: ['Listening', 'Vocabulary'],
    durationMinutes: 90,
  };

  const filtered = filterLessons([sampleLesson, textbookLesson], {
    query: 'shopping',
    bookSeries: 'all',
    level: 'all',
    skill: 'Listening',
    lessonType: 'textbook',
    durationBucket: 'long',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'les_2');

  const tree = groupLessonsIntoTree([sampleLesson, textbookLesson]);
  assert.equal(tree.length, 2);
});

test('computeDashboardSummary and computeLearnerProgress accurately detect missing logs and unfinished work', () => {
  const sessions: TutorFlowSession[] = [
    {
      id: 'tf_ses_1',
      learnerId: 'tf_stu_001',
      learnerType: 'student',
      learnerName: 'Nguyễn Minh Anh',
      startTime: '2026-11-27T12:30:00.000Z',
      endTime: '2026-11-27T13:30:00.000Z',
      durationMinutes: 60,
      tutorFlowStatus: 'scheduled',
      meetingFormat: 'online',
      source: 'sample_tutorflow',
    },
    {
      id: 'tf_ses_2',
      learnerId: 'tf_stu_001',
      learnerType: 'student',
      learnerName: 'Nguyễn Minh Anh',
      startTime: '2026-11-24T12:30:00.000Z',
      endTime: '2026-11-24T13:30:00.000Z',
      durationMinutes: 60,
      tutorFlowStatus: 'completed',
      meetingFormat: 'online',
      source: 'sample_tutorflow',
    },
    {
      id: 'tf_ses_3',
      learnerId: 'tf_stu_001',
      learnerType: 'student',
      learnerName: 'Nguyễn Minh Anh',
      startTime: '2026-11-22T12:30:00.000Z',
      endTime: '2026-11-22T13:30:00.000Z',
      durationMinutes: 60,
      tutorFlowStatus: 'completed',
      meetingFormat: 'online',
      source: 'sample_tutorflow',
    },
  ];

  const roadmap = forkCurriculumForLearner(sampleTemplate, sampleLearner, [sampleLesson]);
  roadmap.stages[0].items[0].status = 'needs_review';

  const store: AldenStoreData = {
    lessonTemplates: [sampleLesson],
    activityBank: [],
    materials: [],
    curriculumTemplates: [sampleTemplate],
    studentRoadmaps: [roadmap],
    sessionPlans: [],
    postSessionLogs: [
      {
        id: 'log_1',
        tutorFlowSessionId: 'tf_ses_3',
        learnerId: 'tf_stu_001',
        activityOutcomes: [
          { activityId: 'a1', activityTitle: 'Warm-up', status: 'completed' },
          { activityId: 'a2', activityTitle: 'Storytelling', status: 'not_done', note: 'Hết giờ' },
        ],
        taughtSummary: 'Đã xong phần lý thuyết.',
        missingContent: 'Chưa kịp thực hành kể chuyện',
        comprehensionLevel: 'moderate',
        strengths: 'Tự tin',
        weaknesses: 'Phát âm -ed',
        commonErrors: 'Quên chia did + V0',
        homeworkAssigned: 'Viết 5 câu',
        homeworkResult: '',
        freeformNotes: '',
        updatedAt: '2026-11-22T14:00:00.000Z',
      },
    ],
    aiSuggestions: [],
  };

  const dash = computeDashboardSummary(sessions, store);
  assert.equal(dash.upcomingSessions.length, 1);
  assert.equal(dash.upcomingWithoutPlanCount, 1);
  assert.equal(dash.completedMissingLogSessions.length, 1);
  assert.equal(dash.completedMissingLogSessions[0].id, 'tf_ses_2');
  assert.equal(dash.unfinishedItems.length, 1);
  assert.equal(dash.reviewRoadmapItems.length, 1);

  const progress = computeLearnerProgress('tf_stu_001', [roadmap], store.postSessionLogs);
  assert.equal(progress.needsReviewCount, 1);
  assert.equal(progress.unfinishedActivities.length, 1);
});

test('validateSafeUrl allows http/https and rejects javascript/data URLs', () => {
  assert.equal(validateSafeUrl('https://docs.google.com/file/1').valid, true);
  assert.equal(validateSafeUrl('http://example.com/audio.mp3').valid, true);
  assert.equal(validateSafeUrl('javascript:alert(1)').valid, false);
  assert.equal(validateSafeUrl('data:text/html,<script>alert(1)</script>').valid, false);
  assert.equal(validateSafeUrl('').valid, false);
});
