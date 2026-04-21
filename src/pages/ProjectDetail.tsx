import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Zap, BarChart2, Calendar, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import type { Project, BrandDNA } from '../lib/types';
import * as db from '../lib/database';
import { compileBrandDNA } from '../services/geminiService';
import MagicDNAModal from '../components/project/MagicDNAModal';

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
};

interface SectionProps {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, subtitle, open, onToggle, children }: SectionProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [dna, setDna] = useState<BrandDNA>(EMPTY_DNA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSections, setOpenSections] = useState({ profile: true, content: true, voice: false, visual: false });
  const [magicModalOpen, setMagicModalOpen] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    try {
      const data = await db.getProject(id!);
      if (!data) { navigate('/projects'); return; }
      setProject(data);
      setName(data.name);
      setDna(data.brand_dna ?? EMPTY_DNA);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: keyof BrandDNA, value: string) {
    setDna((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!project || !name.trim()) return;
    setSaving(true);
    try {
      const compiled = compileBrandDNA(dna);
      await db.updateProject(project.id, { name: name.trim(), brand_dna: dna, knowledge_base: compiled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleApplyMagicDNA(generatedDna: BrandDNA) {
    setDna((prev) => ({
      ...prev,
      ...generatedDna
    }));
    // Open relevant sections to show the data
    setOpenSections({
      profile: true,
      content: true,
      voice: true,
      visual: true
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/projects" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-bold text-slate-900 bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pr-2"
            />
            <p className="text-sm text-slate-500 mt-0.5">Brand DNA &amp; Estratégia</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar DNA'}
        </button>
      </header>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to={`/automations?project=${project.id}`}
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Automações</p>
            <p className="text-xs text-slate-500">Ver e criar</p>
          </div>
        </Link>
        <Link
          to={`/projects/${project.id}/analysis`}
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Análise</p>
            <p className="text-xs text-slate-500">Melhores posts</p>
          </div>
        </Link>
        <Link
          to={`/projects/${project.id}/planning`}
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-purple-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Planejamento</p>
            <p className="text-xs text-slate-500">Semana de conteúdo</p>
          </div>
        </Link>
      </div>

      {/* Brand DNA hint */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-800">
            Quanto mais completo o Brand DNA, mais precisa é a geração de conteúdo. Essas informações são usadas pela IA em todos os carrosséis deste projeto.
          </p>
        </div>
        <button
          onClick={() => setMagicModalOpen(true)}
          className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gerar com IA
        </button>
      </div>

      {/* Section: Perfil */}
      <Section
        title="Perfil &amp; Mercado"
        subtitle="Bio, link e posicionamento de mercado"
        open={openSections.profile}
        onToggle={() => toggleSection('profile')}
      >
        <Field label="Bio" hint="Cole aqui a bio do perfil (Instagram, LinkedIn, etc.)">
          <textarea
            rows={3}
            value={dna.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="Ex: Coach de produtividade para líderes. Ajudo executivos a recuperar 2h por dia sem abrir mão de resultados."
            className={inputCls}
          />
        </Field>
        <Field label="Link da bio">
          <input
            type="url"
            value={dna.bio_link}
            onChange={(e) => set('bio_link', e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
        <Field label="Mercado / Nicho" hint="Em que mercado atua? Quem são seus clientes?">
          <input
            type="text"
            value={dna.market}
            onChange={(e) => set('market', e.target.value)}
            placeholder="Ex: Coaches de carreira para profissionais 30-45 anos, renda média-alta"
            className={inputCls}
          />
        </Field>
        <Field label="Concorrentes de referência" hint="Criadores ou marcas com quem compete ou se inspira">
          <input
            type="text"
            value={dna.competitors}
            onChange={(e) => set('competitors', e.target.value)}
            placeholder="Ex: @fulano, @ciclano — conteúdo similar mas diferencia em X"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Section: Conteúdo */}
      <Section
        title="Estratégia de Conteúdo"
        subtitle="Pilares, audiência e objetivos"
        open={openSections.content}
        onToggle={() => toggleSection('content')}
      >
        <Field label="Pilares de conteúdo" hint="3 a 5 temas principais dos posts (separados por vírgula)">
          <input
            type="text"
            value={dna.content_pillars}
            onChange={(e) => set('content_pillars', e.target.value)}
            placeholder="Ex: Produtividade, Liderança, Mentalidade, Carreira, Rotina"
            className={inputCls}
          />
        </Field>
        <Field label="Audiência-alvo" hint="Descreva o seguidor/cliente ideal com detalhe">
          <textarea
            rows={3}
            value={dna.target_audience}
            onChange={(e) => set('target_audience', e.target.value)}
            placeholder="Ex: Executivos entre 35-50 anos, líderes de equipe, sobrecarregados, que buscam performance sem burnout. Usam LinkedIn e Instagram. Tomam decisões baseadas em dados."
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Section: Voz */}
      <Section
        title="Tom de Voz &amp; Mensagens"
        subtitle="Como a marca se comunica"
        open={openSections.voice}
        onToggle={() => toggleSection('voice')}
      >
        <Field label="Tom de voz" hint="Como a marca fala? Quais adjetivos a descrevem?">
          <input
            type="text"
            value={dna.tone_of_voice}
            onChange={(e) => set('tone_of_voice', e.target.value)}
            placeholder="Ex: Direto, provocador, inteligente. Evita jargões. Fala como um mentor experiente, não como um guru."
            className={inputCls}
          />
        </Field>
        <Field label="Mensagens-chave" hint="O que a marca nunca deixa de comunicar?">
          <textarea
            rows={3}
            value={dna.key_messages}
            onChange={(e) => set('key_messages', e.target.value)}
            placeholder="Ex: Produtividade é sobre clareza, não velocidade. Líderes que desaceleram tomam melhores decisões. Resultados sustentáveis exigem sistemas, não força de vontade."
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Section: Visual */}
      <Section
        title="Identidade Visual"
        subtitle="Cores, referências e estética"
        open={openSections.visual}
        onToggle={() => toggleSection('visual')}
      >
        <Field label="Cores da marca">
          <input
            type="text"
            value={dna.brand_colors}
            onChange={(e) => set('brand_colors', e.target.value)}
            placeholder="Ex: Azul petróleo (#1B4F72), dourado (#D4AC0D), branco"
            className={inputCls}
          />
        </Field>
        <Field label="Referências visuais" hint="Marcas ou criadores com estética que admira">
          <input
            type="text"
            value={dna.visual_references}
            onChange={(e) => set('visual_references', e.target.value)}
            placeholder="Ex: Apple (minimalismo), @hubermanlab (sóbrio mas engajante), Harvard Business Review"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Save footer */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Brand DNA'}
        </button>
      </div>

      <MagicDNAModal
        open={magicModalOpen}
        onClose={() => setMagicModalOpen(false)}
        onApply={handleApplyMagicDNA}
      />
    </div>
  );
}
