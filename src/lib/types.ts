// ============================================================
// Made by Human — Core Types
// ============================================================

export interface BrandDNA {
  bio: string;
  bio_link: string;
  market: string;
  content_pillars: string;
  target_audience: string;
  tone_of_voice: string;
  key_messages: string;
  brand_colors: string;
  visual_references: string;
  competitors: string;
}

export interface Project {
  id: string;
  name: string;
  knowledge_base: string;
  brand_dna?: BrandDNA;
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
  automation_id?: string;
  hook_id?: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_for: string | null;
  slides: Slide[];
  caption: string;
  theme?: 'dark' | 'light' | 'vibrant' | 'minimal' | 'bold_gradient';
  watermark?: string;
  logo_url?: string;
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

export interface ContentAnalysis {
  id: string;
  project_id: string;
  raw_data: string;
  insights: {
    summary: string;
    best_performers: string[];
    worst_performers: string[];
    patterns: string[];
    recommendations: string[];
    content_ideas: string[];
  };
  created_at: string;
}

export interface ContentPlanItem {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  topic: string;
  hook_suggestion: string;
  automation_id?: string;
  slideshow_id?: string;
  status: 'planned' | 'generated' | 'published';
}

export interface ContentPlan {
  id: string;
  project_id: string;
  week_start: string;
  items: ContentPlanItem[];
  created_at: string;
}

// ============================================================
// Form types (for creating/updating)
// ============================================================

export interface CreateProjectInput {
  name: string;
  knowledge_base: string;
  brand_dna?: BrandDNA;
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
