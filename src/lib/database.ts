// ============================================================
// Made by Human — Database Operations (Firebase Firestore)
// ============================================================

import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, Timestamp,
} from 'firebase/firestore';
import type {
  Project, Automation, Hook, Slideshow,
  ImageCollection, CollectionImage,
  CreateProjectInput, CreateAutomationInput, CreateCollectionInput,
  Slide, ContentAnalysis, ContentPlan, ContentBrief,
} from './types';

type CreateSlideshowInput = {
  automation_id?: string;
  hook_id?: string;
  slides: Slide[];
  caption: string;
  status?: string;
  theme?: 'dark' | 'light' | 'vibrant' | 'minimal' | 'bold_gradient';
  watermark?: string;
  logo_url?: string;
  brief?: ContentBrief;
  content_angle?: string;
  template_id?: string;
  font_preset_id?: string;
  color_palette_id?: string;
  accent_color?: string;
  readiness_score?: number;
  review_state?: Slideshow['review_state'];
  generated_by?: Slideshow['generated_by'];
  queue_label?: Slideshow['queue_label'];
  queue_note?: string;
  source_context?: Slideshow['source_context'];
  source_capture_type?: Slideshow['source_capture_type'];
  source_capture_url?: string;
  source_capture_status?: Slideshow['source_capture_status'];
  source_capture_note?: string;
  source_transcript?: string;
  source_transcript_language?: string;
  source_transcript_source?: Slideshow['source_transcript_source'];
  source_transcript_status?: Slideshow['source_transcript_status'];
  source_transcript_note?: string;
  scheduled_for?: string | null;
};

type UpdateSlideshowInput = Partial<{
  slides: Slide[];
  caption: string;
  status: string;
  theme: 'dark' | 'light' | 'vibrant' | 'minimal' | 'bold_gradient';
  watermark: string;
  logo_url?: string;
  brief: ContentBrief;
  content_angle: string;
  template_id: string;
  font_preset_id: string;
  color_palette_id: string;
  accent_color: string;
  readiness_score: number;
  review_state: Slideshow['review_state'];
  generated_by: Slideshow['generated_by'];
  queue_label: Slideshow['queue_label'];
  queue_note: string;
  source_context: Slideshow['source_context'];
  source_capture_type: Slideshow['source_capture_type'];
  source_capture_url: string;
  source_capture_status: Slideshow['source_capture_status'];
  source_capture_note: string;
  source_transcript: string;
  source_transcript_language: string;
  source_transcript_source: Slideshow['source_transcript_source'];
  source_transcript_status: Slideshow['source_transcript_status'];
  source_transcript_note: string;
  exported_at: string | null;
  scheduled_for: string | null;
}>;

// Sort helper — avoids composite index requirement for compound queries
function sortByCreatedAt<T extends { created_at?: string }>(arr: T[]): T[] {
  return arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

// Helper to convert Firestore doc to typed object
function docToObj<T>(snap: any): T {
  return { id: snap.id, ...snap.data() } as T;
}

// ---- Projects ----

export async function getProjects(): Promise<Project[]> {
  const q = query(collection(db, 'projects'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToObj<Project>(d));
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, 'projects', id));
  return snap.exists() ? docToObj<Project>(snap) : null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const data = { ...input, created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'projects'), data);
  return { id: ref.id, ...data } as Project;
}

export async function updateProject(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
  const ref = doc(db, 'projects', id);
  await updateDoc(ref, input);
  const snap = await getDoc(ref);
  return docToObj<Project>(snap);
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', id));
}

// ---- Automations ----

export async function getAutomations(): Promise<Automation[]> {
  const q = query(collection(db, 'automations'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  const automations = snap.docs.map((d) => docToObj<Automation>(d));

  const uniqueProjectIds = [...new Set(automations.map((a) => a.project_id))];
  const projects = await Promise.all(uniqueProjectIds.map((id) => getProject(id)));
  const projectMap = new Map<string, Project>();
  for (const p of projects) {
    if (p) projectMap.set(p.id, p);
  }

  return automations.map((a) => ({ ...a, project: projectMap.get(a.project_id) }) as Automation);
}

export async function getAutomationsByProject(projectId: string): Promise<Automation[]> {
  const q = query(collection(db, 'automations'), where('project_id', '==', projectId));
  const snap = await getDocs(q);
  const automations = sortByCreatedAt(snap.docs.map((d) => docToObj<Automation>(d)));

  const project = await getProject(projectId);
  return automations.map((a) => ({ ...a, project: project || undefined }) as Automation);
}

export async function getAutomation(id: string): Promise<Automation | null> {
  const snap = await getDoc(doc(db, 'automations', id));
  if (!snap.exists()) return null;
  const auto = docToObj<Automation>(snap);
  if (auto.project_id) auto.project = (await getProject(auto.project_id)) || undefined;
  return auto;
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  const data = { ...input, status: 'active', created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'automations'), data);
  return { id: ref.id, ...data } as Automation;
}

export async function updateAutomation(
  id: string,
  input: Partial<CreateAutomationInput & {
    status: string;
    health_status: NonNullable<Automation['health_status']>;
    last_generated_at: string | null;
    next_run_at: string | null;
  }>
): Promise<Automation> {
  const ref = doc(db, 'automations', id);
  await updateDoc(ref, input);
  const snap = await getDoc(ref);
  return docToObj<Automation>(snap);
}

export async function deleteAutomation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'automations', id));
}

// ---- Hooks ----

export async function getHooksByAutomation(automationId: string): Promise<Hook[]> {
  const q = query(collection(db, 'hooks'), where('automation_id', '==', automationId));
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map((d) => docToObj<Hook>(d)));
}

export async function createHooks(hooks: { automation_id: string; text: string }[]): Promise<Hook[]> {
  const now = Timestamp.now().toDate().toISOString();
  return Promise.all(
    hooks.map(async (hook) => {
      const data = { ...hook, used: false, created_at: now };
      const ref = await addDoc(collection(db, 'hooks'), data);
      return { id: ref.id, ...data } as Hook;
    })
  );
}

export async function markHookUsed(id: string): Promise<void> {
  await updateDoc(doc(db, 'hooks', id), { used: true });
}

export async function updateHook(id: string, text: string): Promise<void> {
  await updateDoc(doc(db, 'hooks', id), { text });
}

export async function deleteHook(id: string): Promise<void> {
  await deleteDoc(doc(db, 'hooks', id));
}

// ---- Slideshows ----

export async function getSlideshows(): Promise<Slideshow[]> {
  const q = query(collection(db, 'slideshows'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  const slideshows = snap.docs.map((d) => docToObj<Slideshow>(d));

  const automationIds = [...new Set(slideshows.map((s) => s.automation_id).filter((id): id is string => !!id))];
  const hookIds = [...new Set(slideshows.map((s) => s.hook_id).filter((id): id is string => !!id))];

  const [automations, hookSnaps] = await Promise.all([
    Promise.all(automationIds.map((id) => getAutomation(id))),
    Promise.all(hookIds.map((id) => getDoc(doc(db, 'hooks', id)))),
  ]);

  const autoMap = new Map<string, Automation>(
    automations.filter((automation): automation is Automation => !!automation).map((automation) => [automation.id, automation])
  );
  const hookMap = new Map<string, Hook>(
    hookSnaps.filter((s) => s.exists()).map((s) => [s.id, docToObj<Hook>(s)])
  );

  return slideshows.map((show) => ({
    ...show,
    automation: show.automation_id ? autoMap.get(show.automation_id) : undefined,
    hook: show.hook_id ? hookMap.get(show.hook_id) : undefined,
  }) as Slideshow);
}

export async function getSlideshowsByAutomation(automationId: string): Promise<Slideshow[]> {
  const q = query(collection(db, 'slideshows'), where('automation_id', '==', automationId));
  const snap = await getDocs(q);
  const slideshows = sortByCreatedAt(snap.docs.map((d) => docToObj<Slideshow>(d)));

  const hookIds = [...new Set(slideshows.map((s) => s.hook_id).filter((id): id is string => !!id))];
  const [hookSnaps, automation] = await Promise.all([
    Promise.all(hookIds.map((id) => getDoc(doc(db, 'hooks', id)))),
    getAutomation(automationId),
  ]);
  const hookMap = new Map<string, Hook>(
    hookSnaps.filter((s) => s.exists()).map((s) => [s.id, docToObj<Hook>(s)])
  );

  return slideshows.map((show) => ({
    ...show,
    automation: automation || undefined,
    hook: show.hook_id ? hookMap.get(show.hook_id) : undefined,
  }) as Slideshow);
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  const snap = await getDoc(doc(db, 'slideshows', id));
  if (!snap.exists()) return null;
  const show = docToObj<Slideshow>(snap);

  const [auto, hookSnap] = await Promise.all([
    show.automation_id ? getAutomation(show.automation_id) : Promise.resolve(null),
    show.hook_id ? getDoc(doc(db, 'hooks', show.hook_id)) : Promise.resolve(null),
  ]);

  if (auto) show.automation = auto;
  if (hookSnap?.exists()) show.hook = docToObj<Hook>(hookSnap);
  return show;
}

export async function createSlideshow(input: CreateSlideshowInput): Promise<Slideshow> {
  const data = { ...input, status: input.status || 'draft', created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'slideshows'), data);
  return { id: ref.id, ...data } as Slideshow;
}

export async function updateSlideshow(id: string, input: UpdateSlideshowInput): Promise<Slideshow> {
  const ref = doc(db, 'slideshows', id);
  await updateDoc(ref, input);
  const snap = await getDoc(ref);
  return docToObj<Slideshow>(snap);
}

export async function deleteSlideshow(id: string): Promise<void> {
  await deleteDoc(doc(db, 'slideshows', id));
}

// ---- Image Collections ----

export async function getCollections(): Promise<ImageCollection[]> {
  const q = query(collection(db, 'image_collections'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  const collections = snap.docs.map((d) => docToObj<ImageCollection>(d));

  const imageSnaps = await Promise.all(
    collections.map((col) =>
      getDocs(query(collection(db, 'collection_images'), where('collection_id', '==', col.id)))
    )
  );

  return collections.map((col, i) => ({
    ...col,
    images: imageSnaps[i].docs.map((d) => docToObj<CollectionImage>(d)),
  }));
}

export async function getCollection(id: string): Promise<ImageCollection | null> {
  const snap = await getDoc(doc(db, 'image_collections', id));
  if (!snap.exists()) return null;
  const col = docToObj<ImageCollection>(snap);
  const imgQ = query(collection(db, 'collection_images'), where('collection_id', '==', id));
  const imgSnap = await getDocs(imgQ);
  col.images = imgSnap.docs.map((d) => docToObj<CollectionImage>(d));
  return col;
}

export async function createCollection(input: CreateCollectionInput): Promise<ImageCollection> {
  const data = { ...input, created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'image_collections'), data);
  return { id: ref.id, ...data } as ImageCollection;
}

export async function deleteCollection(id: string): Promise<void> {
  const imgQ = query(collection(db, 'collection_images'), where('collection_id', '==', id));
  const imgSnap = await getDocs(imgQ);
  await Promise.all(imgSnap.docs.map((imgDoc) => deleteDoc(imgDoc.ref)));
  await deleteDoc(doc(db, 'image_collections', id));
}

export async function addImagesToCollection(images: { collection_id: string; url: string; source: string }[]): Promise<CollectionImage[]> {
  const now = Timestamp.now().toDate().toISOString();
  return Promise.all(
    images.map(async (img) => {
      const data = { ...img, created_at: now };
      const ref = await addDoc(collection(db, 'collection_images'), data);
      return { id: ref.id, ...data } as CollectionImage;
    })
  );
}

export async function removeImageFromCollection(id: string): Promise<void> {
  await deleteDoc(doc(db, 'collection_images', id));
}

// ---- Content Analysis ----

export async function getContentAnalyses(projectId: string): Promise<ContentAnalysis[]> {
  const q = query(collection(db, 'content_analyses'), where('project_id', '==', projectId));
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map((d) => docToObj<ContentAnalysis>(d)));
}

export async function createContentAnalysis(input: Omit<ContentAnalysis, 'id' | 'created_at'>): Promise<ContentAnalysis> {
  const data = { ...input, created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'content_analyses'), data);
  return { id: ref.id, ...data } as ContentAnalysis;
}

export async function deleteContentAnalysis(id: string): Promise<void> {
  await deleteDoc(doc(db, 'content_analyses', id));
}

// ---- Content Plans ----

export async function getContentPlan(projectId: string, weekStart: string): Promise<ContentPlan | null> {
  const q = query(
    collection(db, 'content_plans'),
    where('project_id', '==', projectId),
    where('week_start', '==', weekStart)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToObj<ContentPlan>(snap.docs[0]);
}

export async function upsertContentPlan(input: Omit<ContentPlan, 'id' | 'created_at'>): Promise<ContentPlan> {
  const existing = await getContentPlan(input.project_id, input.week_start);
  if (existing) {
    await updateDoc(doc(db, 'content_plans', existing.id), { items: input.items });
    return { ...existing, items: input.items };
  }
  const data = { ...input, created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'content_plans'), data);
  return { id: ref.id, ...data } as ContentPlan;
}

// ---- Dashboard Stats ----

export async function getDashboardStats(): Promise<{
  totalAutomations: number;
  totalSlideshows: number;
  totalHooks: number;
  scheduledToday: number;
}> {
  const [autoSnap, showSnap, hookSnap] = await Promise.all([
    getDocs(collection(db, 'automations')),
    getDocs(collection(db, 'slideshows')),
    getDocs(query(collection(db, 'hooks'), where('used', '==', false))),
  ]);

  const today = new Date().toISOString().split('T')[0];
  let scheduledToday = 0;
  showSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.scheduled_for && data.scheduled_for.startsWith(today)) scheduledToday++;
  });

  return {
    totalAutomations: autoSnap.size,
    totalSlideshows: showSnap.size,
    totalHooks: hookSnap.size,
    scheduledToday,
  };
}
