// ============================================================
// Made by Human — Core Types
// ============================================================

export interface Project {
  id: string;
  name: string;
  knowledge_base: string;
  created_at: string;
}

export interface Automation {
  id: string;
  project_id: string;
  name: string;
  niche: string;
  narrative_prompt: string;
  format_prompt: string;
  soft_cta: string;
  schedule_days: string[];
  schedule_time: string;
  schedule_timezone: string;
  status: 'active' | 'paused';
  hook_collection_id: string | null;
  body_collection_id: string | null;
  created_at: string;
  // Joined fields
  project?: Project;
  hook_collection?: ImageCollection;
  body_collection?: ImageCollection;
}

export interface Hook {
  id: string;
  automation_id: string;
  text: string;
  used: boolean;
  created_at: string;
}

export interface Slide {
  type: 'hook' | 'body';
  text: string;
  image_url: string;
}

export interface Slideshow {
  id: string;
  automation_id: string;
  hook_id: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_for: string | null;
  slides: Slide[];
  caption: string;
  created_at: string;
  // Joined fields
  automation?: Automation;
  hook?: Hook;
}

export interface ImageCollection {
  id: string;
  name: string;
  type: 'hook' | 'body';
  created_at: string;
  // Joined
  images?: CollectionImage[];
}

export interface CollectionImage {
  id: string;
  collection_id: string;
  url: string;
  source: 'pexels' | 'unsplash' | 'upload';
  created_at: string;
}

// ============================================================
// Form types (for creating/updating)
// ============================================================

export interface CreateProjectInput {
  name: string;
  knowledge_base: string;
}

export interface CreateAutomationInput {
  project_id: string;
  name: string;
  niche: string;
  narrative_prompt: string;
  format_prompt: string;
  soft_cta: string;
  schedule_days: string[];
  schedule_time: string;
  schedule_timezone: string;
  hook_collection_id?: string | null;
  body_collection_id?: string | null;
}

export interface CreateCollectionInput {
  name: string;
  type: 'hook' | 'body';
}
