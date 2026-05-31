import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Check, Copy, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ContentDraft } from '../lib/types';
import * as db from '../lib/database';
import { generateVoiceLearningNotes, generateXContentDraft } from '../services/geminiService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

function draftText(draft: Pick<ContentDraft, 'format' | 'body' | 'thread_items'>) {
  return draft.format === 'x_thread'
    ? draft.thread_items.map((item, index) => `${index + 1}/${draft.thread_items.length}\n${item}`).join('\n\n')
    : draft.body;
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function TextDraftEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [threadItems, setThreadItems] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await db.getContentDraft(id!);
        if (!data) {
          setError('Draft nao encontrado.');
          return;
        }
        setDraft(data);
        setTitle(data.title);
        setBody(data.body);
        setThreadItems(data.thread_items.length ? data.thread_items : ['']);
        setScheduledFor(toDatetimeLocal(data.scheduled_for));
      } catch (err) {
        console.error(err);
        setError('Nao consegui carregar este draft.');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const currentText = useMemo(() => {
    if (!draft) return '';
    return draftText({ ...draft, body, thread_items: threadItems });
  }, [body, draft, threadItems]);

  async function copyText(text = currentText) {
    await navigator.clipboard.writeText(text);
    setNotice('Texto copiado.');
  }

  async function saveDraft(nextStatus?: ContentDraft['status']) {
    if (!draft) return null;
    setSaving(true);
    setError('');
    try {
      const before = draftText(draft);
      const updated = await db.updateContentDraft(draft.id, {
        title,
        body,
        thread_items: threadItems,
        status: nextStatus || draft.status,
        scheduled_for: nextStatus === 'scheduled' ? fromDatetimeLocal(scheduledFor) : draft.scheduled_for,
      });
      setDraft({ ...updated, project: draft.project });
      if (before.trim() !== currentText.trim()) {
        await recordLearning('edited', before, currentText, 'O usuario editou manualmente o texto antes de salvar.');
      }
      setNotice('Draft salvo.');
      return updated;
    } catch (err) {
      console.error(err);
      setError('Nao consegui salvar este draft.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function recordLearning(
    eventType: 'approved' | 'edited' | 'regenerated' | 'scheduled',
    beforeText?: string,
    afterText?: string,
    instruction?: string
  ) {
    if (!draft) return;
    let learningNote = '';
    try {
      learningNote = await generateVoiceLearningNotes({
        existingNotes: draft.project?.voice_learning_notes,
        eventType,
        beforeText,
        afterText,
        instruction,
      });
      await db.updateProjectVoiceLearningNotes(draft.project_id, learningNote);
      setDraft((current) => current
        ? { ...current, project: current.project ? { ...current.project, voice_learning_notes: learningNote } : current.project }
        : current);
    } catch (err) {
      console.error('Voice learning update failed:', err);
    }

    await db.createVoiceLearningEvent({
      project_id: draft.project_id,
      draft_id: draft.id,
      event_type: eventType,
      format: draft.format,
      before_text: beforeText || '',
      after_text: afterText || '',
      instruction: instruction || '',
      learning_note: learningNote,
    });
  }

  async function approveDraft() {
    if (!draft) return;
    const updated = await saveDraft('approved');
    if (updated) {
      await recordLearning('approved', draftText(draft), currentText, 'O usuario aprovou este texto para postar.');
      await db.createExpertVoicePost({
        project_id: draft.project_id,
        text: currentText,
        source_type: draft.source_type || 'manual',
        source_url: draft.source_url,
        memory_kind: 'approved_draft',
        tags: ['approved-draft'],
        quality: 85,
        is_reference: true,
      });
      navigate('/queue');
    }
  }

  async function scheduleDraft() {
    if (!draft || !scheduledFor) {
      setError('Escolha data e hora antes de agendar.');
      return;
    }
    const updated = await saveDraft('scheduled');
    if (updated) {
      await recordLearning('scheduled', draftText(draft), currentText, 'O usuario agendou este texto no Content Machine.');
      navigate('/queue');
    }
  }

  async function refineDraft(instruction: string) {
    if (!draft) return;
    setRefining(instruction);
    setError('');
    try {
      const before = currentText;
      const result = await generateXContentDraft({
        format: draft.format,
        topic: draft.topic,
        goal: draft.objective,
        sourceNotes: draft.source_notes,
        brandDNA: draft.project?.brand_dna,
        knowledgeBase: draft.project?.knowledge_base,
        voiceSamples: draft.project?.voice_samples,
        voiceLearningNotes: draft.project?.voice_learning_notes,
        voiceProfile: draft.project?.voice_profile,
        refinementInstruction: instruction,
        currentDraft: { ...draft, body, thread_items: threadItems },
      });
      setTitle(result.title);
      setBody(result.body);
      setThreadItems(result.thread_items.length ? result.thread_items : ['']);
      await recordLearning('regenerated', before, draft.format === 'x_thread' ? result.thread_items.join('\n\n') : result.body, instruction);
      setNotice('Nova versao gerada.');
    } catch (err) {
      console.error(err);
      setError('Nao consegui gerar uma nova versao.');
    } finally {
      setRefining(null);
    }
  }

  function updateThreadItem(index: number, value: string) {
    setThreadItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="premium-card p-8 text-center">
        <p className="font-bold text-white">{error || 'Draft nao encontrado.'}</p>
        <Link to="/queue" className="mt-4 inline-flex text-sm font-bold text-indigo-300 hover:text-white">Voltar para o board</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Link to="/queue" className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
              <Sparkles className="h-4 w-4" /> Content Machine
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Editor para X</h1>
            <p className="mt-1 text-sm text-slate-500">{draft.project?.name || 'Expert'} · {draft.format === 'x_thread' ? 'Thread' : 'Post unico'}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-300">
          {draft.status === 'review' ? 'Para revisar' : draft.status === 'approved' ? 'Aprovado' : 'Agendado'}
        </span>
      </header>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="premium-card p-6 space-y-5">
          <div className="space-y-2">
            <label className="premium-label">Titulo interno</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputCls} />
          </div>

          {draft.format === 'x_thread' ? (
            <div className="space-y-4">
              {threadItems.map((item, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="premium-label">Post {index + 1}</label>
                    <button type="button" onClick={() => copyText(item)} className="text-xs font-bold uppercase tracking-widest text-indigo-300 hover:text-white">Copiar bloco</button>
                  </div>
                  <textarea rows={5} value={item} onChange={(event) => updateThreadItem(index, event.target.value)} className={`${inputCls} resize-none`} />
                  <p className={`text-xs ${item.length > 280 ? 'text-red-300' : 'text-slate-500'}`}>{item.length}/280</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="premium-label">Post</label>
              <textarea rows={8} value={body} onChange={(event) => setBody(event.target.value)} className={`${inputCls} resize-none`} />
              <p className={`text-xs ${body.length > 280 ? 'text-red-300' : 'text-slate-500'}`}>{body.length}/280</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => saveDraft()} disabled={saving} className="premium-button-secondary flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
            <button onClick={() => copyText()} className="premium-button-secondary flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copiar tudo
            </button>
            <button onClick={approveDraft} disabled={saving} className="premium-button-primary flex items-center gap-2">
              <Check className="h-4 w-4" />
              Aprovar
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="premium-card p-5 space-y-4">
            <div>
              <p className="premium-label">Refinar voz</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Cada ajuste tambem alimenta o aprendizado do expert.</p>
            </div>
            {[
              'Deixe mais forte, com uma tese mais clara.',
              'Deixe mais direto e menos explicativo.',
              'Deixe mais provocativo sem perder autoridade.',
              'Aproxime mais do tom de voz do expert.',
            ].map((instruction) => (
              <button
                key={instruction}
                type="button"
                onClick={() => refineDraft(instruction)}
                disabled={!!refining}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-bold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                {refining === instruction ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Gerando...</span> : instruction}
              </button>
            ))}
          </div>

          <div className="premium-card p-5 space-y-4">
            <div>
              <p className="premium-label">Agendar internamente</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Buffer fica para a proxima etapa. Aqui o draft entra como pronto para postar.</p>
            </div>
            <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className={inputCls} />
            <button onClick={scheduleDraft} disabled={saving || !scheduledFor} className="premium-button-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              <CalendarClock className="h-4 w-4" />
              Marcar como agendado
            </button>
          </div>

          <div className="premium-card p-5 space-y-3">
            <PreviewFact label="Topico" value={draft.topic} />
            <PreviewFact label="Objetivo" value={draft.objective || 'Autoridade e alcance.'} />
            <PreviewFact label="Voz usada" value={draft.voice_notes_used || 'Brand DNA do expert.'} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="premium-label">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}
