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
  core_promise?: string;
  unique_mechanism?: string;
  beliefs?: string;
  common_enemy?: string;
  offer?: string;
  proof_points?: string;
  content_angles?: string;
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
  health_status?: 'healthy' | 'missing_inputs' | 'paused' | 'needs_review_capacity';
  last_generated_at?: string | null;
  next_run_at?: string | null;
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
  tagline?: string;
  title?: string;
  body?: string;
  cta?: string;
  accent_text?: string;
}

export interface ContentBrief {
  project_id?: string;
  topic: string;
  goal: string;
  audience: string;
  cta: string;
  preset_id: string;
  template_id: string;
  source_notes?: string;
  source_type?: 'manual' | 'youtube' | 'rss';
  source_url?: string;
  source_title?: string;
  source_image_url?: string;
  source_excerpt?: string;
}

export interface ContentStrategy {
  promise: string;
  angle: string;
  audience: string;
  cta: string;
  slide_outline: string[];
  readiness_score: number;
  improvement_notes: string[];
  slides: Slide[];
  caption: string;
}

export interface Slideshow {
  id: string;
  automation_id?: string;
  hook_id?: string;
  status: 'draft' | 'reviewing' | 'scheduled' | 'published' | 'exported';
  scheduled_for: string | null;
  slides: Slide[];
  caption: string;
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
  review_state?: 'queued' | 'reviewing' | 'approved' | 'rejected' | 'needs_regeneration';
  generated_by?: 'manual' | 'automation' | 'weekly_plan';
  queue_label?: 'ready_for_review' | 'needs_stronger_hook' | 'needs_source_context' | 'needs_cta_cleanup';
  queue_note?: string;
  source_context?: {
    automation_id?: string;
    plan_day?: string;
    trigger_label?: string;
    hook_text?: string;
  };
  exported_at?: string | null;
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

export interface ExpertContentPreset {
  id: string;
  label: string;
  description: string;
  goal: string;
  defaultCta: string;
  narrativePrompt: string;
}

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  theme: 'dark' | 'light' | 'vibrant' | 'minimal' | 'bold_gradient';
  gradient: string;
  accentColor: string;
  textColor: string;
  badge: string;
  layout: 'editorial' | 'image_editorial' | 'authority' | 'proof' | 'launch' | 'minimal';
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
