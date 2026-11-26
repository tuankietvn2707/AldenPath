import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AldenStoreData } from '../src/types/alden';
import { createInitialSeedData } from './seedData';

/**
 * Storage repository interface designed to be Firebase/Firestore-ready.
 * Swapping LocalJsonRepository for FirestoreRepository later requires
 * implementing these methods without changing API or UI layers.
 */
export interface AldenPathRepository {
  loadAll(): Promise<AldenStoreData>;
  saveAll(data: AldenStoreData): Promise<AldenStoreData>;
  resetToSeed(): Promise<AldenStoreData>;
  saveUploadedFile(params: {
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<{ uploadId: string; safeFileName: string; fileSize: number }>;
  getUploadedFilePath(uploadId: string): { filePath: string; exists: boolean };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'alden-path-store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export class LocalJsonRepository implements AldenPathRepository {
  private cache: AldenStoreData | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    ensureDirectories();
  }

  async loadAll(): Promise<AldenStoreData> {
    if (this.cache) {
      return structuredClone(this.cache);
    }
    ensureDirectories();
    if (!fs.existsSync(STORE_PATH)) {
      const seed = createInitialSeedData();
      await this.saveAll(seed);
      return structuredClone(seed);
    }
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AldenStoreData>;
      const seed = createInitialSeedData();
      const merged: AldenStoreData = {
        lessonTemplates: Array.isArray(parsed.lessonTemplates)
          ? parsed.lessonTemplates
          : seed.lessonTemplates,
        activityBank: Array.isArray(parsed.activityBank)
          ? parsed.activityBank
          : seed.activityBank,
        materials: Array.isArray(parsed.materials) ? parsed.materials : seed.materials,
        curriculumTemplates: Array.isArray(parsed.curriculumTemplates)
          ? parsed.curriculumTemplates
          : seed.curriculumTemplates,
        studentRoadmaps: Array.isArray(parsed.studentRoadmaps)
          ? parsed.studentRoadmaps
          : seed.studentRoadmaps,
        sessionPlans: Array.isArray(parsed.sessionPlans)
          ? parsed.sessionPlans
          : seed.sessionPlans,
        postSessionLogs: Array.isArray(parsed.postSessionLogs)
          ? parsed.postSessionLogs
          : seed.postSessionLogs,
        aiSuggestions: Array.isArray(parsed.aiSuggestions)
          ? parsed.aiSuggestions
          : seed.aiSuggestions,
      };
      this.cache = merged;
      return structuredClone(merged);
    } catch {
      const seed = createInitialSeedData();
      await this.saveAll(seed);
      return structuredClone(seed);
    }
  }

  async saveAll(data: AldenStoreData): Promise<AldenStoreData> {
    ensureDirectories();
    const snapshot = structuredClone(data);
    this.cache = snapshot;

    const persist = async () => {
      const tmpPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      await fs.promises.rename(tmpPath, STORE_PATH);
    };

    this.writeQueue = this.writeQueue.then(persist, persist);
    await this.writeQueue;
    return structuredClone(snapshot);
  }

  async resetToSeed(): Promise<AldenStoreData> {
    const seed = createInitialSeedData();
    return this.saveAll(seed);
  }

  async saveUploadedFile(params: {
    originalName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<{ uploadId: string; safeFileName: string; fileSize: number }> {
    ensureDirectories();
    const rawExt = path.extname(params.originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = rawExt && rawExt.length <= 8 ? rawExt : '.bin';
    const uploadId = `${crypto.randomUUID()}${safeExt}`;

    const resolvedTarget = path.resolve(UPLOADS_DIR, uploadId);
    if (!resolvedTarget.startsWith(UPLOADS_DIR + path.sep)) {
      throw new Error('Invalid upload target path');
    }

    await fs.promises.writeFile(resolvedTarget, params.buffer);
    return {
      uploadId,
      safeFileName: path.basename(params.originalName).slice(0, 140),
      fileSize: params.buffer.length,
    };
  }

  getUploadedFilePath(uploadId: string): { filePath: string; exists: boolean } {
    ensureDirectories();
    if (!/^[a-zA-Z0-9._-]+$/.test(uploadId)) {
      return { filePath: '', exists: false };
    }
    const resolvedTarget = path.resolve(UPLOADS_DIR, uploadId);
    if (!resolvedTarget.startsWith(UPLOADS_DIR + path.sep)) {
      return { filePath: '', exists: false };
    }
    return { filePath: resolvedTarget, exists: fs.existsSync(resolvedTarget) };
  }
}

export const aldenRepository: AldenPathRepository = new LocalJsonRepository();
