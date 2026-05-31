import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Sparkles, Check, AlertTriangle, Save, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentDraft, Project } from '../lib/types';
import * as db from '../lib/database';
import { generateXContentBatch, type XBatchItem } from '../services/geminiService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

type Mode = 'pillars' | 'topic';
type FormatMix = 'x_post' | 'x_thread' | 'mixed';
type CopyMode = 'voz' | 'provocativo' | 'direto' | 'didatico' | 'autoridade';

function draftPreviewText(item: XBatchItem) {
  return item.format === 'x_thread'
    ? item.thread_items.map((text, index) => `${index + 1}/${item.thread_items.length}  ${text}`).join('\n\n')
    : item.body;
}

function approvedToExamples(drafts: ContentDraft[], projectId: string): string[] {
  return drafts
    .filter((draft) => draft.project_id === projectId && draft.status === 'approved')
    .slice(0, 6)
    .map((draft) => (draft.format === 'x_thread' ? draft.thread_items.join('\n') : draft.body))
    .filter(Boolean);
}

export default function BatchCreate() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [mode, setMode] = useState<Mode>('pillars');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(12);
  const [formatMix, setFormatMix] = useState<FormatMix>('mixed');
  const [copyMode, setCopyMode] = useState<CopyMode>('voz');
  const [copyIntensity, setCopyIntensity] = useState(3);
  const [styleReference, setStyleReference] = useState('');
  const [avoidList, setAvoidList] = useState('frases prontas, tom motivacional, promessas exageradas, hashtags, emojis');
  const [qualityBar, setQualityBar] = useState('Cada post precisa ter uma opiniao clara, um exemplo concreto e uma frase que eu realmente falaria.');
  const [savingVoiceRules, setSavingVoiceRules] = useState(false);

  const [items, setItems] = useState<XBatchItem[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [learningIndex, setLearningIndex] = useState('');

  useEffect(() => {
    db.getProjects()
      .then((data) => {
        setProjects(data);
        if (data[0]) setProjectId(data[0].id);
      })
      .catch(() => setError('Nao consegui carregar os experts.'));
  }, []);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);

  function buildStyleGuidance() {
    const modeLabel: Record<CopyMode, string> = {
      voz: 'Priorizar minha voz real acima de formulas de copy.',
      provocativo: 'Mais provocativo: tese forte, corte de senso comum, sem agressividade gratuita.',
      direto: 'Mais direto: frases curtas, sem introducao longa, ponto de vista logo na primeira linha.',
      didatico: 'Mais didatico: explicar o raciocinio com clareza, mas sem virar tutorial generico.',
      autoridade: 'Mais autoridade: mostrar criterio, experiencia e padroes de decisao, sem autoelogio.',
    };

    return [
      `Modo de copy: ${modeLabel[copyMode]}`,
      `Intensidade: ${copyIntensity}/5. 1 = sutil, 5 = bem afiado.`,
      styleReference ? `Escreva mais parecido com estes exemplos ou notas minhas:\n${styleReference}` : '',
      avoidList ? `Evite explicitamente:\n${avoidList}` : '',
      qualityBar ? `Criterio minimo para aprovar:\n${qualityBar}` : '',
      'Nao tente parecer viral a qualquer custo. Prefira texto que eu teria coragem de postar no meu perfil.',
      'Se a ideia ficar generica, reescreva com mais especificidade antes de responder.',
    ].filter(Boolean).join('\n\n');
  }

  async function handleSaveVoiceRules() {
    if (!selectedProject) return;
    const guidance = buildStyleGuidance();
    setSavingVoiceRules(true);
    setError('');
    try {
      const existing = selectedProject.voice_learning_notes?.trim();
      const nextNotes = [existing, `Diretrizes manuais para lotes de X:\n${guidance}`].filter(Boolean).join('\n\n').slice(0, 2400);
      await db.updateProjectVoiceLearningNotes(selectedProject.id, nextNotes);
      setProjects((current) => current.map((project) => (
        project.id === selectedProject.id ? { ...project, voice_learning_notes: nextNotes } : project
      )));
      setNotice('Diretrizes salvas na voz do expert. Os proximos lotes vao usar essa base.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar as diretrizes de voz.');
    } finally {
      setSavingVoiceRules(false);
    }
  }

  async function handleLearnFromItem(index: number, kind: 'good' | 'bad') {
    if (!selectedProject || !items[index]) return;
    const item = items[index];
    const text = draftPreviewText(item).slice(0, 900);
    const marker = kind === 'good'
      ? `Exemplo aprovado como referencia de voz:\n${text}`
      : `Evitar este tipo de resultado em lotes futuros:\n${text}`;
    setLearningIndex(`${kind}:${index}`);
    setError('');
    try {
      const existing = selectedProject.voice_learning_notes?.trim();
      const nextNotes = [existing, marker].filter(Boolean).join('\n\n').slice(0, 2600);
      await db.updateProjectVoiceLearningNotes(selectedProject.id, nextNotes);
      setProjects((current) => current.map((project) => (
        project.id === selectedProject.id ? { ...project, voice_learning_notes: nextNotes } : project
      )));
      setNotice(kind === 'good'
        ? 'Salvei este post como referencia positiva de voz para os proximos lotes.'
        : 'Salvei este resultado como exemplo do que evitar nos proximos lotes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui atualizar a memoria de voz.');
    } finally {
      setLearningIndex('');
    }
  }

  async function handleGenerate() {
    if (!selectedProject) {
      setError('Escolha um expert.');
      return;
    }
    if (mode === 'topic' && !topic.trim()) {
      setError('Escreva um tema para gerar os angulos.');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    setItems([]);
    setKept(new Set());
    setProgress({ done: 0, total: count });
    try {
      const approvedDrafts = await db.getContentDrafts();
      const result = await generateXContentBatch({
        mode,
        topic: topic.trim(),
        count,
        formatMix,
        styleGuidance: buildStyleGuidance(),
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: selectedProject.voice_samples,
        approvedExamples: approvedToExamples(approvedDrafts, selectedProject.id),
        voiceLearningNotes: selectedProject.voice_learning_notes,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setItems(result.items);
      setKept(new Set(result.items.map((_, index) => index)));
      if (result.items.length === 0) {
        setError('A IA nao retornou nenhum draft. Tente novamente.');
      } else if (result.failedChunks > 0) {
        setNotice(`Geramos ${result.items.length} de ${result.requested}. Alguns lotes falharam — voce pode salvar estes e gerar o resto depois.`);
      } else {
        setNotice(`${result.items.length} drafts gerados. Revise e salve os que quiser.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui gerar o lote agora.');
    } finally {
      setGenerating(false);
    }
  }

  function toggleKeep(index: number) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSaveAll() {
    if (!selectedProject || kept.size === 0) return;
    setSaving(true);
    setError('');
    try {
      const batchId = (globalThis.crypto?.randomUUID?.() || `batch_${Date.now()}`);
      const inputs = items
        .filter((_, index) => kept.has(index))
        .map((item) => ({
          project_id: selectedProject.id,
          format: item.format,
          status: 'review' as const,
          title: item.title,
          topic: mode === 'topic' ? topic.trim() : item.angle || item.title,
          body: item.body,
          thread_items: item.thread_items,
          objective: item.objective,
          hook: item.hook,
          variants: item.variants,
          voice_notes_used: item.voice_notes_used,
          content_angle: item.angle,
          batch_id: batchId,
        }));
      await db.createContentDrafts(inputs);
      navigate('/queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar os drafts.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <header className="flex items-start gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-indigo-300">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="h-4 w-4" /> Content Machine
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Gerar posts para X em lote</h1>
          <p className="mt-1 text-sm text-slate-500">Gere vários drafts de uma vez, revise e aprove no board.</p>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div>}

      <section className="premium-card p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="premium-label">Expert</label>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputCls}>
              {projects.length === 0 && <option value="">Nenhum expert cadastrado</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            {selectedProject && !selectedProject.voice_samples?.length && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300/80">
                <AlertTriangle className="h-3.5 w-3.5" /> Sem posts reais cadastrados — o tom fica mais genérico. Adicione amostras no Expert.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="premium-label">Origem do lote</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('pillars')} className={`rounded-xl border p-3 text-left text-sm font-bold transition ${mode === 'pillars' ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'}`}>
                Pilares + Brand DNA
              </button>
              <button type="button" onClick={() => setMode('topic')} className={`rounded-xl border p-3 text-left text-sm font-bold transition ${mode === 'topic' ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'}`}>
                Tema → N ângulos
              </button>
            </div>
          </div>
        </div>

        {mode === 'topic' && (
          <div className="space-y-2">
            <label className="premium-label">Tema</label>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex: por que a maioria dos experts não vende com conteúdo" className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="premium-label">Quantidade ({count})</label>
            <input type="range" min={1} max={30} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full accent-indigo-500" />
          </div>
          <div className="space-y-2">
            <label className="premium-label">Formato</label>
            <select value={formatMix} onChange={(event) => setFormatMix(event.target.value as FormatMix)} className={inputCls}>
              <option value="mixed">Misto (posts + threads)</option>
              <option value="x_post">Só posts únicos</option>
              <option value="x_thread">Só threads</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <label className="premium-label">Direcao de escrita</label>
              <p className="mt-1 text-sm text-slate-500">Use este bloco para calibrar copy, conteudo e voz antes de gerar o lote.</p>
            </div>
            <button type="button" onClick={handleSaveVoiceRules} disabled={!selectedProject || savingVoiceRules} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50">
              {savingVoiceRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar no expert
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="premium-label">Estilo de copy</label>
              <select value={copyMode} onChange={(event) => setCopyMode(event.target.value as CopyMode)} className={inputCls}>
                <option value="voz">Mais com minha voz</option>
                <option value="provocativo">Mais provocativo</option>
                <option value="direto">Mais direto</option>
                <option value="didatico">Mais didatico</option>
                <option value="autoridade">Mais autoridade</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Intensidade ({copyIntensity}/5)</label>
              <input type="range" min={1} max={5} value={copyIntensity} onChange={(event) => setCopyIntensity(Number(event.target.value))} className="w-full accent-indigo-500" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="premium-label">Parece comigo quando...</label>
              <textarea rows={5} value={styleReference} onChange={(event) => setStyleReference(event.target.value)} placeholder={'Cole 1-3 posts seus ou escreva regras curtas.\nEx: eu escrevo frases curtas, com tese logo no inicio, sem floreio.'} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="premium-label">Nao escrever assim</label>
              <textarea rows={5} value={avoidList} onChange={(event) => setAvoidList(event.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="premium-label">Barra minima de qualidade</label>
            <textarea rows={3} value={qualityBar} onChange={(event) => setQualityBar(event.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generating || !projectId} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {generating ? `Gerando ${progress.done}/${progress.total}...` : 'Gerar lote'}
        </button>
      </section>

      {items.length > 0 && (
        <section className="premium-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="premium-label">Pré-visualização</p>
              <p className="mt-1 text-sm text-slate-500">{kept.size} de {items.length} selecionados para salvar.</p>
            </div>
            <button onClick={handleSaveAll} disabled={saving || kept.size === 0} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar selecionados
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className={`block rounded-2xl border p-4 transition ${kept.has(index) ? 'border-indigo-400/40 bg-indigo-500/[0.06]' : 'border-white/10 bg-black/20 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={kept.has(index)} onChange={() => toggleKeep(index)} className="mt-1 h-4 w-4 accent-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
                      <span>{item.format === 'x_thread' ? 'Thread' : 'Post'}</span>
                      {item.angle && <span className="truncate text-slate-500 normal-case font-medium tracking-normal">· {item.angle}</span>}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{draftPreviewText(item)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleLearnFromItem(index, 'good')} disabled={Boolean(learningIndex)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50">
                        {learningIndex === `good:${index}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Usar como referencia
                      </button>
                      <button type="button" onClick={() => handleLearnFromItem(index, 'bad')} disabled={Boolean(learningIndex)} className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/15 disabled:opacity-50">
                        {learningIndex === `bad:${index}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        Nao e minha voz
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
