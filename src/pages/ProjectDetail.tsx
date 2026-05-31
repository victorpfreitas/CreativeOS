import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart2, Calendar, Check, FileText, Loader2, Save, Sparkles, Wand2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BrandDNA, ContentDraft, ExpertVoicePost, Project } from '../lib/types';
import * as db from '../lib/database';
import { compileBrandDNA } from '../services/geminiService';
import MagicDNAModal from '../components/project/MagicDNAModal';
import { EmptyState, ExpertHealthCard, PageHeader, StatusBadge } from '../components/ui/AppPrimitives';
import { buildVoiceProfile, splitVoiceSamples, uniqueVoiceSamples, voiceMemoryHealth } from '../lib/voiceMemory';

const EMPTY_DNA: BrandDNA = {
  bio: '',
  bio_link: '',
  market: '',
  content_pillars: '',
  target_audience: '',
  tone_of_voice: '',
  key_messages: '',
  brand_colors: '',
  visual_references: '',
  competitors: '',
  core_promise: '',
  unique_mechanism: '',
  beliefs: '',
  common_enemy: '',
  offer: '',
  proof_points: '',
  content_angles: '',
};

const inputCls = 'w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
type Tab = 'overview' | 'memory' | 'create' | 'board' | 'agenda';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [voicePosts, setVoicePosts] = useState<ExpertVoicePost[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [name, setName] = useState('');
  const [dna, setDna] = useState<BrandDNA>(EMPTY_DNA);
  const [voicePaste, setVoicePaste] = useState('');
  const [voiceProfile, setVoiceProfile] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [magicModalOpen, setMagicModalOpen] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await db.getProject(id!);
      if (!data) {
        navigate('/projects');
        return;
      }
      const [posts, allDrafts] = await Promise.all([
        db.getExpertVoicePosts(data.id),
        db.getContentDrafts(),
      ]);
      setProject(data);
      setName(data.name);
      setDna({ ...EMPTY_DNA, ...(data.brand_dna ?? {}) });
      setVoiceProfile(data.voice_profile || '');
      setVoicePosts(posts);
      setDrafts(allDrafts.filter((draft) => draft.project_id === data.id));
    } catch {
      setError('Não consegui carregar este expert.');
    } finally {
      setLoading(false);
    }
  }

  const health = useMemo(() => voiceMemoryHealth(voicePosts, project?.voice_samples || []), [project?.voice_samples, voicePosts]);
  const reviewDrafts = drafts.filter((draft) => draft.status === 'review');
  const scheduledDrafts = drafts.filter((draft) => draft.status === 'scheduled');
  const approvedDrafts = drafts.filter((draft) => draft.status === 'approved');

  function set(field: keyof BrandDNA, value: string) {
    setDna((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!project || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const compiled = compileBrandDNA(dna);
      const samples = uniqueVoiceSamples(voicePosts, project.voice_samples || []);
      const profile = voiceProfile.trim() || buildVoiceProfile(samples);
      const updated = await db.updateProject(project.id, {
        name: name.trim(),
        brand_dna: dna,
        knowledge_base: compiled,
        voice_samples: samples.slice(-50),
        voice_profile: profile,
      });
      setProject(updated);
      setVoiceProfile(profile);
      setNotice('Expert salvo. A memória consolidada já entra nas próximas gerações.');
    } catch {
      setError('Não consegui salvar este expert.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVoicePosts() {
    if (!project) return;
    const samples = splitVoiceSamples(voicePaste);
    if (!samples.length) {
      setError('Cole posts reais separados por uma linha em branco.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await db.createExpertVoicePosts(samples.map((text) => ({
        project_id: project.id,
        text,
        source_type: 'manual',
        memory_kind: 'real_post',
        tags: ['real-post'],
        quality: 85,
        is_reference: true,
      })));
      setVoicePaste('');
      await load();
      setNotice(`${samples.length} posts reais adicionados à memória.`);
    } catch {
      setError('Não consegui adicionar esses posts à memória.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshProfile() {
    if (!project) return;
    const profile = buildVoiceProfile(health.samples);
    setVoiceProfile(profile);
    const updated = await db.updateProject(project.id, {
      voice_samples: health.samples.slice(-50),
      voice_profile: profile,
    });
    setProject(updated);
    setNotice('Perfil de voz atualizado a partir dos posts únicos da memória.');
  }

  function handleApplyMagicDNA(generatedDna: BrandDNA) {
    setDna((prev) => ({ ...prev, ...generatedDna }));
    setTab('overview');
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Expert Workspace"
        title={name || project.name}
        description="Memória, posicionamento, criação, board e agenda conectados ao mesmo expert."
        icon={Sparkles}
        actions={
          <>
            <Link to="/projects" className="premium-button-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Experts
            </Link>
            <button onClick={() => setMagicModalOpen(true)} className="premium-button-secondary inline-flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Gerar DNA
            </button>
            <button onClick={handleSave} disabled={saving} className="premium-button-primary inline-flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar expert
            </button>
          </>
        }
      />

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{notice}</div>}

      <div className="premium-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ['overview', 'Visão geral'],
            ['memory', 'Memória'],
            ['create', 'Criar'],
            ['board', 'Board'],
            ['agenda', 'Agenda'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <ExpertHealthCard title="Saúde da memória" score={health.score} detail={health.detail} tone={health.tone} />
            <div className="premium-card space-y-3 p-5">
              <Metric label="Posts reais" value={health.realPosts} />
              <Metric label="Drafts aprovados" value={health.approvedDrafts} />
              <Metric label="Rejeições de voz" value={health.rejected} />
              <Metric label="Aberturas únicas" value={health.variety} />
            </div>
          </aside>
          <section className="premium-card space-y-5 p-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Nome do expert">
                <input value={name} onChange={(event) => setName(event.target.value)} className={inputCls} />
              </Field>
              <Field label="Mercado / nicho">
                <input value={dna.market} onChange={(event) => set('market', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Promessa central">
                <textarea rows={3} value={dna.core_promise || ''} onChange={(event) => set('core_promise', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Mecanismo único">
                <textarea rows={3} value={dna.unique_mechanism || ''} onChange={(event) => set('unique_mechanism', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Crenças fortes">
                <textarea rows={4} value={dna.beliefs || ''} onChange={(event) => set('beliefs', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Provas e credenciais">
                <textarea rows={4} value={dna.proof_points || ''} onChange={(event) => set('proof_points', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Pilares de conteúdo">
                <textarea rows={4} value={dna.content_pillars || ''} onChange={(event) => set('content_pillars', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Tom de voz declarado">
                <textarea rows={4} value={dna.tone_of_voice || ''} onChange={(event) => set('tone_of_voice', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Bio">
                <textarea rows={3} value={dna.bio || ''} onChange={(event) => set('bio', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Público-alvo">
                <textarea rows={3} value={dna.target_audience || ''} onChange={(event) => set('target_audience', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Oferta">
                <textarea rows={3} value={dna.offer || ''} onChange={(event) => set('offer', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Ângulos recorrentes">
                <textarea rows={3} value={dna.content_angles || ''} onChange={(event) => set('content_angles', event.target.value)} className={inputCls} />
              </Field>
            </div>
          </section>
        </div>
      )}

      {tab === 'memory' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <section className="premium-card space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="premium-label">Biblioteca de voz</p>
                <h2 className="text-xl font-black text-white">Posts reais e referências aprovadas</h2>
                <p className="mt-1 text-sm text-slate-500">Esta é a fonte principal para o jeito de escrita do expert.</p>
              </div>
              <StatusBadge tone={health.tone}>{health.label}</StatusBadge>
            </div>
            <textarea
              rows={8}
              value={voicePaste}
              onChange={(event) => setVoicePaste(event.target.value)}
              placeholder={'Cole posts reais separados por linha em branco.\n\nQuanto mais exemplos reais, menos a IA inventa uma voz genérica.'}
              className={inputCls}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={handleAddVoicePosts} disabled={saving} className="premium-button-primary inline-flex items-center gap-2 disabled:opacity-50">
                <FileText className="h-4 w-4" /> Adicionar posts reais
              </button>
              <button onClick={handleRefreshProfile} disabled={!health.samples.length} className="premium-button-secondary inline-flex items-center gap-2 disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> Atualizar perfil de voz
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {voicePosts.length === 0 ? (
                <div className="lg:col-span-2">
                  <EmptyState title="Nenhum post real na memória" description="Cole posts reais do expert para calibrar ritmo, vocabulário e jeito de pensar." />
                </div>
              ) : voicePosts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <StatusBadge tone={(post.memory_kind || 'real_post') === 'real_post' ? 'emerald' : post.memory_kind === 'approved_draft' ? 'indigo' : 'amber'}>
                      {post.memory_kind === 'approved_draft' ? 'draft aprovado' : post.memory_kind === 'rejected_or_ai_only' ? 'não usar' : 'post real'}
                    </StatusBadge>
                    <StatusBadge tone={post.is_reference ? 'emerald' : 'red'}>{post.is_reference ? 'referência' : 'fora'}</StatusBadge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{post.text}</p>
                </article>
              ))}
            </div>
          </section>
          <aside className="premium-card space-y-3 p-5">
            <p className="premium-label">Perfil consolidado</p>
            <textarea rows={18} value={voiceProfile} onChange={(event) => setVoiceProfile(event.target.value)} className={inputCls} />
          </aside>
        </div>
      )}

      {tab === 'create' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActionLink to={`/batch?project=${project.id}`} title="Criar posts para X" detail="Fonte, ideias, voz, rascunho e revisão final no Content Machine." />
          <ActionLink to={`/create?project=${project.id}`} title="Criar carrossel" detail="Use o fluxo individual para carrosséis e drafts visuais." />
        </div>
      )}

      {tab === 'board' && (
        <section className="premium-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="premium-label">Board deste expert</p>
              <h2 className="text-xl font-black text-white">{drafts.length} drafts textuais</h2>
            </div>
            <Link to="/queue" className="premium-button-secondary">Abrir Board completo</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Metric label="Para revisar" value={reviewDrafts.length} />
            <Metric label="Aprovados" value={approvedDrafts.length} />
            <Metric label="Agendados" value={scheduledDrafts.length} />
          </div>
          <div className="space-y-3">
            {drafts.slice(0, 6).map((draft) => (
              <Link key={draft.id} to={`/content/${draft.id}`} className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.04]">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={draft.status === 'scheduled' ? 'emerald' : draft.status === 'approved' ? 'indigo' : 'amber'}>{draft.status}</StatusBadge>
                  <StatusBadge>{draft.format === 'x_thread' ? 'thread' : 'post'}</StatusBadge>
                </div>
                <h3 className="mt-3 font-black text-white">{draft.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{draft.format === 'x_thread' ? draft.thread_items.join('\n\n') : draft.body}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === 'agenda' && (
        <section className="premium-card p-6">
          <p className="premium-label">Agenda deste expert</p>
          <h2 className="text-xl font-black text-white">{scheduledDrafts.length} posts agendados</h2>
          <div className="mt-4 space-y-3">
            {scheduledDrafts.length === 0 ? (
              <EmptyState icon={Calendar} title="Nada agendado para este expert" description="Quando um draft for marcado como agendado, ele aparece aqui." />
            ) : scheduledDrafts.map((draft) => (
              <Link key={draft.id} to={`/content/${draft.id}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.04]">
                <div>
                  <p className="font-black text-white">{draft.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{draft.scheduled_for ? new Date(draft.scheduled_for).toLocaleString('pt-BR') : 'Sem data'}</p>
                </div>
                <Check className="h-5 w-5 text-emerald-300" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <MagicDNAModal open={magicModalOpen} onClose={() => setMagicModalOpen(false)} onApply={handleApplyMagicDNA} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="premium-label">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="premium-label">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function ActionLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link to={to} className="premium-card block p-6 transition hover:border-indigo-400/30 hover:bg-white/[0.03]">
      <p className="text-xl font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{detail}</p>
    </Link>
  );
}
