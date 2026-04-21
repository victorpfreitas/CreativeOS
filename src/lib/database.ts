// ============================================================
// Made by Human — Database Operations (Firebase Firestore)
// ============================================================

import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, Timestamp,
} from 'firebase/firestore';
// Sort helper — avoids composite index requirement for compound queries
function sortByCreatedAt<T extends { created_at?: string }>(arr: T[]): T[] {
  return arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
import type {
  Project, Automation, Hook, Slideshow,
  ImageCollection, CollectionImage,
  CreateProjectInput, CreateAutomationInput, CreateCollectionInput,
  Slide,
} from './types';

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
  // Resolve project references
  for (const auto of automations) {
    if (auto.project_id) {
      auto.project = (await getProject(auto.project_id)) || undefined;
    }
  }
  return automations;
}

export async function getAutomationsByProject(projectId: string): Promise<Automation[]> {
  const q = query(collection(db, 'automations'), where('project_id', '==', projectId));
  const snap = await getDocs(q);
  const automations = sortByCreatedAt(snap.docs.map((d) => docToObj<Automation>(d)));
  for (const auto of automations) {
    if (auto.project_id) auto.project = (await getProject(auto.project_id)) || undefined;
  }
  return automations;
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

export async function updateAutomation(id: string, input: Partial<CreateAutomationInput & { status: string }>): Promise<Automation> {
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
  const results: Hook[] = [];
  const now = Timestamp.now().toDate().toISOString();
  for (const hook of hooks) {
    const data = { ...hook, used: false, created_at: now };
    const ref = await addDoc(collection(db, 'hooks'), data);
    results.push({ id: ref.id, ...data } as Hook);
  }
  return results;
}

export async function markHookUsed(id: string): Promise<void> {
  await updateDoc(doc(db, 'hooks', id), { used: true });
}

export async function deleteHook(id: string): Promise<void> {
  await deleteDoc(doc(db, 'hooks', id));
}

// ---- Slideshows ----

export async function getSlideshows(): Promise<Slideshow[]> {
  const q = query(collection(db, 'slideshows'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  const slideshows = snap.docs.map((d) => docToObj<Slideshow>(d));
  for (const show of slideshows) {
    if (show.automation_id) {
      const autoSnap = await getDoc(doc(db, 'automations', show.automation_id));
      if (autoSnap.exists()) show.automation = docToObj<Automation>(autoSnap);
    }
    if (show.hook_id) {
      const hookSnap = await getDoc(doc(db, 'hooks', show.hook_id));
      if (hookSnap.exists()) show.hook = docToObj<Hook>(hookSnap);
    }
  }
  return slideshows;
}

export async function getSlideshowsByAutomation(automationId: string): Promise<Slideshow[]> {
  const q = query(collection(db, 'slideshows'), where('automation_id', '==', automationId));
  const snap = await getDocs(q);
  const slideshows = sortByCreatedAt(snap.docs.map((d) => docToObj<Slideshow>(d)));
  for (const show of slideshows) {
    if (show.hook_id) {
      const hookSnap = await getDoc(doc(db, 'hooks', show.hook_id));
      if (hookSnap.exists()) show.hook = docToObj<Hook>(hookSnap);
    }
  }
  return slideshows;
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  const snap = await getDoc(doc(db, 'slideshows', id));
  if (!snap.exists()) return null;
  const show = docToObj<Slideshow>(snap);
  if (show.automation_id) {
    const auto = await getAutomation(show.automation_id);
    if (auto) show.automation = auto;
  }
  if (show.hook_id) {
    const hookSnap = await getDoc(doc(db, 'hooks', show.hook_id));
    if (hookSnap.exists()) show.hook = docToObj<Hook>(hookSnap);
  }
  return show;
}

export async function createSlideshow(input: {
  automation_id: string;
  hook_id: string;
  slides: Slide[];
  caption: string;
  status?: string;
  scheduled_for?: string | null;
}): Promise<Slideshow> {
  const data = { ...input, status: input.status || 'draft', created_at: Timestamp.now().toDate().toISOString() };
  const ref = await addDoc(collection(db, 'slideshows'), data);
  return { id: ref.id, ...data } as Slideshow;
}

export async function updateSlideshow(id: string, input: Partial<{
  slides: Slide[];
  caption: string;
  status: string;
  scheduled_for: string | null;
}>): Promise<Slideshow> {
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
  for (const col of collections) {
    const imgQ = query(collection(db, 'collection_images'), where('collection_id', '==', col.id));
    const imgSnap = await getDocs(imgQ);
    col.images = imgSnap.docs.map((d) => docToObj<CollectionImage>(d));
  }
  return collections;
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
  // Delete images first
  const imgQ = query(collection(db, 'collection_images'), where('collection_id', '==', id));
  const imgSnap = await getDocs(imgQ);
  for (const imgDoc of imgSnap.docs) await deleteDoc(imgDoc.ref);
  await deleteDoc(doc(db, 'image_collections', id));
}

export async function addImagesToCollection(images: { collection_id: string; url: string; source: string }[]): Promise<CollectionImage[]> {
  const results: CollectionImage[] = [];
  const now = Timestamp.now().toDate().toISOString();
  for (const img of images) {
    const data = { ...img, created_at: now };
    const ref = await addDoc(collection(db, 'collection_images'), data);
    results.push({ id: ref.id, ...data } as CollectionImage);
  }
  return results;
}

export async function removeImageFromCollection(id: string): Promise<void> {
  await deleteDoc(doc(db, 'collection_images', id));
}

export async function uploadImageToStorage(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!apiKey) throw new Error("A chave da API do ImgBB não está configurada no Vercel (VITE_IMGBB_API_KEY).");

  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || "Falha ao fazer upload da imagem.");
  }

  return data.data.url; // ImgBB returns the direct image URL here
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
