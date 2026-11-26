import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { AldenStoreData } from '../src/types/alden';

export interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  appId?: string;
  authDomain?: string;
}

export const ALDEN_FIRESTORE_COLLECTIONS: (keyof AldenStoreData)[] = [
  'lessonTemplates',
  'activityBank',
  'materials',
  'curriculumTemplates',
  'studentRoadmaps',
  'sessionPlans',
  'postSessionLogs',
  'aiSuggestions',
];

export function readFirebaseAppletConfig(): FirebaseAppletConfig | null {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    if (!parsed.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildFirebaseConsoleUrl(projectId: string, databaseId?: string): string {
  const dbSegment = databaseId && databaseId !== '(default)' ? databaseId : '-default-';
  return `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/firestore/databases/${encodeURIComponent(dbSegment)}/data`;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export interface MigrationSummary {
  projectId: string;
  databaseId: string;
  perCollectionCounts: Record<keyof AldenStoreData, number>;
  attachmentsNotMigratedCount: number;
}

/**
 * Server-side Firestore Admin SDK adapter for Alden Path's 8 independent collections.
 * Requires a dedicated user-owned Firebase project (with FIREBASE_SERVICE_ACCOUNT_JSON
 * or Cloud Run IAM roles/datastore.user). Never connects to Ken's TutorFlow.
 */
export class FirestoreAdminAdapter {
  private readonly projectId: string;
  private readonly databaseId: string;
  private readonly app: App;
  private readonly db: Firestore;

  constructor(params: { projectId: string; databaseId: string; serviceAccountJson?: string }) {
    this.projectId = params.projectId;
    this.databaseId = params.databaseId || '(default)';

    const appName = `alden-path-admin-${this.projectId}`;
    const existing = getApps().find((a) => a.name === appName);
    if (existing) {
      this.app = existing;
    } else if (params.serviceAccountJson) {
      const parsed = JSON.parse(params.serviceAccountJson);
      this.app = initializeApp(
        {
          credential: cert(parsed),
          projectId: this.projectId,
        },
        appName
      );
    } else {
      this.app = initializeApp({ projectId: this.projectId }, appName);
    }

    this.db =
      this.databaseId && this.databaseId !== '(default)'
        ? getFirestore(this.app, this.databaseId)
        : getFirestore(this.app);
  }

  getInfo(): { projectId: string; databaseId: string; consoleUrl: string } {
    return {
      projectId: this.projectId,
      databaseId: this.databaseId,
      consoleUrl: buildFirebaseConsoleUrl(this.projectId, this.databaseId),
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.db.collection('lessonTemplates').limit(1).get();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async loadAll(): Promise<AldenStoreData> {
    const snapshots = await Promise.all(
      ALDEN_FIRESTORE_COLLECTIONS.map((col) => this.db.collection(col).get())
    );
    const result = {} as Record<keyof AldenStoreData, unknown[]>;
    ALDEN_FIRESTORE_COLLECTIONS.forEach((col, index) => {
      result[col] = snapshots[index].docs.map((doc) => doc.data());
    });
    return result as unknown as AldenStoreData;
  }

  /**
   * Synchronizes all 8 Alden Path collections idempotently, preserving exact document IDs.
   * Deletes removed documents inside each Alden Path collection while never touching any other project.
   */
  async saveAll(data: AldenStoreData): Promise<AldenStoreData> {
    for (const col of ALDEN_FIRESTORE_COLLECTIONS) {
      const items = (data[col] as { id: string }[]) || [];
      const colRef = this.db.collection(col);
      const existingSnap = await colRef.select().get();
      const nextIds = new Set(items.map((it) => it.id));

      const ops: (() => void)[] = [];
      let batch = this.db.batch();
      let opCount = 0;

      const commitIfNeeded = async () => {
        if (opCount >= 400) {
          await batch.commit();
          batch = this.db.batch();
          opCount = 0;
        }
      };

      for (const doc of existingSnap.docs) {
        if (!nextIds.has(doc.id)) {
          batch.delete(doc.ref);
          opCount += 1;
          await commitIfNeeded();
        }
      }

      for (const item of items) {
        batch.set(colRef.doc(item.id), stripUndefinedDeep(item));
        opCount += 1;
        await commitIfNeeded();
      }

      if (opCount > 0) {
        await batch.commit();
      }
      void ops;
    }
    return structuredClone(data);
  }

  /**
   * Idempotent migration helper: upserts all records by their original IDs without deleting existing Firestore records.
   */
  async migrateStoreIdempotently(store: AldenStoreData): Promise<MigrationSummary> {
    const perCollectionCounts = {} as Record<keyof AldenStoreData, number>;

    for (const col of ALDEN_FIRESTORE_COLLECTIONS) {
      const items = (store[col] as { id: string }[]) || [];
      const colRef = this.db.collection(col);
      let batch = this.db.batch();
      let opCount = 0;

      for (const item of items) {
        batch.set(colRef.doc(item.id), stripUndefinedDeep(item), { merge: true });
        opCount += 1;
        if (opCount >= 400) {
          await batch.commit();
          batch = this.db.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) {
        await batch.commit();
      }
      perCollectionCounts[col] = items.length;
    }

    const attachmentsNotMigratedCount = (store.materials || []).filter(
      (m) => m.type === 'file' && Boolean(m.uploadId)
    ).length;

    return {
      projectId: this.projectId,
      databaseId: this.databaseId,
      perCollectionCounts,
      attachmentsNotMigratedCount,
    };
  }
}
