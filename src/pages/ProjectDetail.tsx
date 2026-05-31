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
  core_promise: '',
  unique_mechanism: '',
  beliefs: '',
  common_enemy: '',
  offer: '',
  proof_points: '',
  content_angles: '',
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

function splitVoiceSamples(text: string) {
  return text.split(/\n\s*\n/).map((sample) => sample.trim()).filter(Boolean);
}

function buildVoiceProfile(samples: string[]) {
  const cleaned = samples.map((sample) => sample.trim()).filter(Boolean);
  if (!cleaned.length) {
    return 'Cole posts reais do expert para consolidar a voz. Sem exemplos reais, a IA tende a escrever de forma genérica.';
  }

  const starts = cleaned
    .map((sample) => sample.split(/\n/).map((line) => line.trim()).find(Boolean) || '')
    .filter(Boolean)
    .slice(0, 8);
  const avgChars = Math.round(cleaned.reduce((sum, sample) => sum + sample.length, 0) / cleaned.length);
  const firstPerson = cleaned.filter((sample) => /\b(eu|meu|minha|comigo|percebi|acho)\b/i.test(sample)).length;
  const questions = cleaned.filter((sample) => sample.includes('?')).length;
  const lineBreakHeavy = cleaned.filter((sample) => sample.split(/\n/).filter(Boolean).length >= 4).length;
  const hasEllipsis = cleaned.filter((sample) => sample.includes('...')).length;
  const commonWords = Array.from(
    cleaned.join(' ').toLowerCase()
      .replace(/[.,!?;:()"']/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 4 && !['sobre', 'porque', 'quando', 'muito', 'minha', 'mesmo', 'gente', 'coisa'].includes(word))
      .reduce((map, word) => map.set(word, (map.get(word) || 0) + 1), new Map<string, number>())
      .entries()
  ).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word]) => word);

  return [
    `Base analisada: ${cleaned.length} posts reais do expert.`,
    `Tamanho medio dos posts: ${avgChars} caracteres.`,
    '',
    'Como a voz tende a funcionar:',
    firstPerson >= cleaned.length * 0.35 ? '- Usa bastante primeira pessoa e observacao propria. Priorize "eu percebi", "tenho visto", "acho" quando fizer sentido.' : '- Usa menos primeira pessoa. Evite forcar relato pessoal quando nao existir.',
    questions >= cleaned.length * 0.25 ? '- Usa perguntas como recurso de raciocinio. Pode abrir loops com pergunta natural, sem parecer copy.' : '- Nao depende muito de perguntas. Evite fechar tudo com pergunta de engajamento.',
    lineBreakHeavy >= cleaned.length * 0.35 ? '- Gosta de respiro visual e blocos curtos. Nao transformar tudo em paragrafo longo.' : '- Aceita paragrafos mais cheios. Evite quebrar cada frase como post motivacional.',
    hasEllipsis > 0 ? '- Usa pausas e reticencias em alguns textos. Pode usar com moderacao.' : '- Evitar reticencias e dramaticidade artificial.',
    commonWords.length ? `- Vocabulos recorrentes para observar: ${commonWords.join(', ')}.` : '',
    '',
    'Instrucoes para gerar novos posts:',
    '- Escrever como alguem pensando em voz alta, nao como uma aula formatada.',
    '- Evitar conclusoes com cara de frase pronta, tipo "isso muda o jogo", "a real e simples", "parece X, mas e Y" em excesso.',
    '- Usar os posts reais como fonte de ritmo, pontuacao e nivel de informalidade.',
    '- Se a fonte nova for tecnica, traduzir para uma descoberta/opiniao do expert antes de escrever.',
    '',
    'Aberturas reais para se inspirar:',
    ...starts.map((start) => `- ${start.slice(0, 180)}`),
  ].filter(Boolean).join('\n');
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [dna, setDna] = useState<BrandDNA>(EMPTY_DNA);
  const [voiceSamplesText, setVoiceSamplesText] = useState('');
  const [voiceProfile, setVoiceProfile] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSections, setOpenSections] = useState({ memory: true, expert: true, profile: true, content: true, voice: false, visual: false });
  const [magicModalOpen, setMagicModalOpen] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    try {
      const data = await db.getProject(id!);
      if (!data) { navigate('/projects'); return; }
      setProject(data);
      setName(data.name);
      setDna({ ...EMPTY_DNA, ...(data.brand_dna ?? {}) });
      setVoiceSamplesText((data.voice_samples ?? []).join('\n\n'));
      setVoiceProfile(data.voice_profile || '');
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
      const voiceSamples = splitVoiceSamples(voiceSamplesText);
      await db.updateProject(project.id, { name: name.trim(), brand_dna: dna, knowledge_base: compiled, voice_samples: voiceSamples, voice_profile: voiceProfile });
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
    setOpenSections({
      expert: true,
      profile: true,
      content: true,
      voice: true,
      memory: true,
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

  const voiceSamples = splitVoiceSamples(voiceSamplesText);
  const strongVoiceBase = voiceSamples.length >= 12;

  return (
    <div className="space-y-6 pb-12">
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
            <p className="text-sm text-slate-500 mt-0.5">Brand DNA &amp; Sistema de Conteúdo</p>
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

      <div className="grid grid-cols-3 gap-3">
        <Link
          to={`/create?project=${project.id}`}
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Criar Conteúdo</p>
            <p className="text-xs text-slate-500">Brief guiado</p>
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
            <p className="font-semibold text-slate-900 text-sm">Sistema Semanal</p>
            <p className="text-xs text-slate-500">Backlog e rotina</p>
          </div>
        </Link>
      </div>

      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-indigo-800">
            Para experts, o Brand DNA precisa capturar promessa, método, crenças e provas. Esses campos alimentam o novo criador guiado e deixam o carrossel menos genérico.
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

      <Section
        title="Memoria de Voz"
        subtitle="Posts reais, padroes de escrita e repertorio que fazem a IA soar como o expert"
        open={openSections.memory}
        onToggle={() => toggleSection('memory')}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <Field label="Biblioteca de posts reais" hint="Cole posts reais separados por uma linha em branco. Para voz forte, mire em 12 a 50 exemplos.">
            <textarea
              rows={16}
              value={voiceSamplesText}
              onChange={(e) => setVoiceSamplesText(e.target.value)}
              placeholder={'Cole um post real aqui.\n\nCole outro post real aqui.\n\nQuanto mais material real, menos a IA inventa uma voz generica.'}
              className={inputCls}
            />
          </Field>

          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${strongVoiceBase ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-xs font-black uppercase tracking-widest ${strongVoiceBase ? 'text-emerald-700' : 'text-amber-700'}`}>Base atual</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{voiceSamples.length}</p>
              <p className="mt-1 text-sm text-slate-600">
                {strongVoiceBase ? 'Boa base para gerar posts mais parecidos.' : 'Ainda pouco repertorio. Cole mais posts reais antes de cobrar muita precisao.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setVoiceProfile(buildVoiceProfile(splitVoiceSamples(voiceSamplesText)))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"
            >
              Atualizar perfil de voz pela biblioteca
            </button>

            <Field label="Perfil de voz consolidado" hint="Editavel. Este bloco entra nos prompts antes de gerar posts para X.">
              <textarea
                rows={13}
                value={voiceProfile}
                onChange={(e) => setVoiceProfile(e.target.value)}
                placeholder="Clique em atualizar perfil ou escreva manualmente como este expert fala."
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Expert & Oferta"
        subtitle="Promessa, mecanismo, crenças e provas que tornam o conteúdo autoral"
        open={openSections.expert}
        onToggle={() => toggleSection('expert')}
      >
        <Field label="Promessa central" hint="Qual transformação o expert promete entregar?">
          <textarea rows={3} value={dna.core_promise || ''} onChange={(e) => set('core_promise', e.target.value)} placeholder="Ex: Ajudar experts a vender todos os dias com conteúdo estratégico, sem depender de dancinha ou trend." className={inputCls} />
        </Field>
        <Field label="Mecanismo único" hint="Método, framework ou forma própria de resolver o problema">
          <input value={dna.unique_mechanism || ''} onChange={(e) => set('unique_mechanism', e.target.value)} placeholder="Ex: Método Conteúdo-Demanda, diagnóstico 3C, funil invisível..." className={inputCls} />
        </Field>
        <Field label="Crenças fortes" hint="Opiniões que diferenciam o expert do mercado">
          <textarea rows={3} value={dna.beliefs || ''} onChange={(e) => set('beliefs', e.target.value)} placeholder="Ex: Conteúdo que só educa não vende. Autoridade nasce de ponto de vista, não de frequência." className={inputCls} />
        </Field>
        <Field label="Inimigo comum" hint="Mito, hábito ou dor que o expert combate">
          <input value={dna.common_enemy || ''} onChange={(e) => set('common_enemy', e.target.value)} placeholder="Ex: conteúdo genérico, lançamentos cansativos, vender só por indicação..." className={inputCls} />
        </Field>
        <Field label="Oferta principal">
          <textarea rows={2} value={dna.offer || ''} onChange={(e) => set('offer', e.target.value)} placeholder="Ex: mentoria de posicionamento, consultoria, curso, comunidade, imersão..." className={inputCls} />
        </Field>
        <Field label="Provas e credenciais" hint="Resultados, números, cases, experiência e autoridade real">
          <textarea rows={3} value={dna.proof_points || ''} onChange={(e) => set('proof_points', e.target.value)} placeholder="Ex: +300 alunos, cases de faturamento, 12 anos de mercado, clientes relevantes..." className={inputCls} />
        </Field>
        <Field label="Ângulos recorrentes" hint="Temas e enquadramentos que sempre funcionam para esse expert">
          <textarea rows={3} value={dna.content_angles || ''} onChange={(e) => set('content_angles', e.target.value)} placeholder="Ex: erros comuns, bastidores de cliente, antes/depois, mitos do mercado, frameworks práticos..." className={inputCls} />
        </Field>
      </Section>

      <Section title="Perfil &amp; Mercado" subtitle="Bio, link e posicionamento de mercado" open={openSections.profile} onToggle={() => toggleSection('profile')}>
        <Field label="Bio" hint="Cole aqui a bio do perfil (Instagram, LinkedIn, etc.)">
          <textarea rows={3} value={dna.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Ex: Coach de produtividade para líderes. Ajudo executivos a recuperar 2h por dia sem abrir mão de resultados." className={inputCls} />
        </Field>
        <Field label="Link da bio">
          <input type="url" value={dna.bio_link} onChange={(e) => set('bio_link', e.target.value)} placeholder="https://..." className={inputCls} />
        </Field>
        <Field label="Mercado / Nicho" hint="Em que mercado atua? Quem são seus clientes?">
          <input type="text" value={dna.market} onChange={(e) => set('market', e.target.value)} placeholder="Ex: Coaches de carreira para profissionais 30-45 anos, renda média-alta" className={inputCls} />
        </Field>
        <Field label="Concorrentes de referência" hint="Criadores ou marcas com quem compete ou se inspira">
          <input type="text" value={dna.competitors} onChange={(e) => set('competitors', e.target.value)} placeholder="Ex: @fulano, @ciclano — conteúdo similar mas diferencia em X" className={inputCls} />
        </Field>
      </Section>

      <Section title="Estratégia de Conteúdo" subtitle="Pilares, audiência e objetivos" open={openSections.content} onToggle={() => toggleSection('content')}>
        <Field label="Pilares de conteúdo" hint="3 a 5 temas principais dos posts (separados por vírgula)">
          <input type="text" value={dna.content_pillars} onChange={(e) => set('content_pillars', e.target.value)} placeholder="Ex: Produtividade, Liderança, Mentalidade, Carreira, Rotina" className={inputCls} />
        </Field>
        <Field label="Audiência-alvo" hint="Descreva o seguidor/cliente ideal com detalhe">
          <textarea rows={3} value={dna.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="Ex: Executivos entre 35-50 anos, líderes de equipe, sobrecarregados, que buscam performance sem burnout." className={inputCls} />
        </Field>
      </Section>

      <Section title="Tom de Voz &amp; Mensagens" subtitle="Como a marca se comunica" open={openSections.voice} onToggle={() => toggleSection('voice')}>
        <Field label="Tom de voz" hint="Como a marca fala? Quais adjetivos a descrevem?">
          <input type="text" value={dna.tone_of_voice} onChange={(e) => set('tone_of_voice', e.target.value)} placeholder="Ex: Direto, provocador, inteligente. Evita jargões." className={inputCls} />
        </Field>
        <Field label="Mensagens-chave" hint="O que a marca nunca deixa de comunicar?">
          <textarea rows={3} value={dna.key_messages} onChange={(e) => set('key_messages', e.target.value)} placeholder="Ex: Produtividade é sobre clareza, não velocidade. Resultados sustentáveis exigem sistemas." className={inputCls} />
        </Field>
      </Section>

      <Section title="Identidade Visual" subtitle="Cores, referências e estética" open={openSections.visual} onToggle={() => toggleSection('visual')}>
        <Field label="Cores da marca">
          <input type="text" value={dna.brand_colors} onChange={(e) => set('brand_colors', e.target.value)} placeholder="Ex: Azul petróleo (#1B4F72), dourado (#D4AC0D), branco" className={inputCls} />
        </Field>
        <Field label="Referências visuais" hint="Marcas ou criadores com estética que admira">
          <input type="text" value={dna.visual_references} onChange={(e) => set('visual_references', e.target.value)} placeholder="Ex: Apple, Harvard Business Review, estética editorial sóbria" className={inputCls} />
        </Field>
      </Section>

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Brand DNA'}
        </button>
      </div>

      <MagicDNAModal open={magicModalOpen} onClose={() => setMagicModalOpen(false)} onApply={handleApplyMagicDNA} />
    </div>
  );
}
