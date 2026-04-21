// ============================================================
// Made by Human — Database Operations (Supabase)
// ============================================================

import { supabase } from './supabase';
import type {
  Project, Automation, Hook, Slideshow,
  ImageCollection, CollectionImage,
  CreateProjectInput, CreateAutomationInput, CreateCollectionInput,
  Slide,
} from './types';

// ---- Projects ----

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ---- Automations ----

export async function getAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*, project:projects(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAutomationsByProject(projectId: string): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*, project:projects(*)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAutomation(id: string): Promise<Automation | null> {
  const { data, error } = await supabase
    .from('automations')
    .select('*, project:projects(*), hook_collection:image_collections!hook_collection_id(*), body_collection:image_collections!body_collection_id(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  const { data, error } = await supabase
    .from('automations')
    .insert({ ...input, status: 'active' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAutomation(id: string, input: Partial<CreateAutomationInput & { status: string }>): Promise<Automation> {
  const { data, error } = await supabase
    .from('automations')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  if (error) throw error;
}

// ---- Hooks ----

export async function getHooksByAutomation(automationId: string): Promise<Hook[]> {
  const { data, error } = await supabase
    .from('hooks')
    .select('*')
    .eq('automation_id', automationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createHooks(hooks: { automation_id: string; text: string }[]): Promise<Hook[]> {
  const { data, error } = await supabase
    .from('hooks')
    .insert(hooks)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function markHookUsed(id: string): Promise<void> {
  const { error } = await supabase
    .from('hooks')
    .update({ used: true })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteHook(id: string): Promise<void> {
  const { error } = await supabase.from('hooks').delete().eq('id', id);
  if (error) throw error;
}

// ---- Slideshows ----

export async function getSlideshows(): Promise<Slideshow[]> {
  const { data, error } = await supabase
    .from('slideshows')
    .select('*, automation:automations(id, name, niche), hook:hooks(id, text)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSlideshowsByAutomation(automationId: string): Promise<Slideshow[]> {
  const { data, error } = await supabase
    .from('slideshows')
    .select('*, hook:hooks(id, text)')
    .eq('automation_id', automationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  const { data, error } = await supabase
    .from('slideshows')
    .select('*, automation:automations(*, project:projects(*)), hook:hooks(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSlideshow(input: {
  automation_id: string;
  hook_id: string;
  slides: Slide[];
  caption: string;
  status?: string;
  scheduled_for?: string | null;
}): Promise<Slideshow> {
  const { data, error } = await supabase
    .from('slideshows')
    .insert({ ...input, status: input.status || 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSlideshow(id: string, input: Partial<{
  slides: Slide[];
  caption: string;
  status: string;
  scheduled_for: string | null;
}>): Promise<Slideshow> {
  const { data, error } = await supabase
    .from('slideshows')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSlideshow(id: string): Promise<void> {
  const { error } = await supabase.from('slideshows').delete().eq('id', id);
  if (error) throw error;
}

// ---- Image Collections ----

export async function getCollections(): Promise<ImageCollection[]> {
  const { data, error } = await supabase
    .from('image_collections')
    .select('*, images:collection_images(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCollection(id: string): Promise<ImageCollection | null> {
  const { data, error } = await supabase
    .from('image_collections')
    .select('*, images:collection_images(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCollection(input: CreateCollectionInput): Promise<ImageCollection> {
  const { data, error } = await supabase
    .from('image_collections')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('image_collections').delete().eq('id', id);
  if (error) throw error;
}

export async function addImagesToCollection(images: { collection_id: string; url: string; source: string }[]): Promise<CollectionImage[]> {
  const { data, error } = await supabase
    .from('collection_images')
    .insert(images)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function removeImageFromCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collection_images').delete().eq('id', id);
  if (error) throw error;
}

// ---- Dashboard Stats ----

export async function getDashboardStats(): Promise<{
  totalAutomations: number;
  totalSlideshows: number;
  totalHooks: number;
  scheduledToday: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  const [automations, slideshows, hooks, scheduled] = await Promise.all([
    supabase.from('automations').select('id', { count: 'exact', head: true }),
    supabase.from('slideshows').select('id', { count: 'exact', head: true }),
    supabase.from('hooks').select('id', { count: 'exact', head: true }).eq('used', false),
    supabase.from('slideshows').select('id', { count: 'exact', head: true })
      .gte('scheduled_for', `${today}T00:00:00`)
      .lte('scheduled_for', `${today}T23:59:59`),
  ]);

  return {
    totalAutomations: automations.count ?? 0,
    totalSlideshows: slideshows.count ?? 0,
    totalHooks: hooks.count ?? 0,
    scheduledToday: scheduled.count ?? 0,
  };
}
