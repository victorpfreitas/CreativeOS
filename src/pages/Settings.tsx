import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Check, Sparkles, Zap, AlertCircle } from 'lucide-react';
import * as db from '../lib/database';
import { invalidateAiSettings } from '../lib/aiSettings';

const MODEL_ID_PATTERN = /^[A-Za-z0-9._/-]+(:free)?$/;
const MAX_MODELS = 4;

export default function Settings() {
  const [models, setModels] = useState<string[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [settings, catalog] = await Promise.all([
        db.getAiSettings(),
        fetch('/api/ai').then((r) => (r.ok ? r.json() : { models: [] })).catch(() => ({ models: [] })),
      ]);
      setModels(settings.openRouterModels);
      setPresets(Array.isArray(catalog.models) ? catalog.models : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addModel(id: string) {
    const trimmed = id.trim();
    setError('');
    if (!trimmed) return;
    if (!MODEL_ID_PATTERN.test(trimmed)) {
      setError(`ID inválido: "${trimmed}". Use o formato vendor/nome ou vendor/nome:free.`);
      return;
    }
    if (models.includes(trimmed)) {
      setError('Esse modelo já está na lista.');
      return;
    }
    if (models.length >= MAX_MODELS) {
      setError(`Máximo de ${MAX_MODELS} modelos na cascata.`);
      return;
    }
    setModels([...models, trimmed]);
    setInput('');
  }

  function removeModel(id: string) {
    setModels(models.filter((m) => m !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...models];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setModels(next);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await db.saveAiSettings(models);
      invalidateAiSettings(models);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError('Não consegui salvar. Verifique as permissões do Firestore e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Responda apenas com a palavra OK.', models }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.text) {
        setTestResult({ ok: true, message: `Funcionou! Resposta: ${String(data.text).slice(0, 80)}` });
      } else {
        setTestResult({ ok: false, message: data.error || `Falha (HTTP ${response.status}).` });
      }
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Falha ao testar.' });
    } finally {
      setTesting(false);
    }
  }

  const availablePresets = presets.filter((p) => !models.includes(p));

  if (loading) {
    return <div className="space-y-6"><div className="h-10 w-48 bg-slate-200/10 rounded-lg animate-pulse" /></div>;
  }

  return (
    <div className="space-y-8 py-4 max-w-3xl">
      <header>
        <h1 className="text-4xl font-bold text-white tracking-tight">Configurações</h1>
        <p className="text-slate-400 mt-2 text-lg">Modelos de IA e fallback de geração.</p>
      </header>

      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Modelos do OpenRouter</h2>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              O <span className="text-slate-200 font-medium">Gemini</span> é o provedor primário (quando há chave).
              Se ele falhar, o sistema tenta os modelos abaixo <span className="text-slate-200 font-medium">em ordem</span>,
              até um responder. Ordene do mais confiável para o de reserva. Máximo de {MAX_MODELS}.
            </p>
          </div>
        </div>

        {/* Current cascade */}
        <div className="space-y-2">
          {models.length === 0 && (
            <div className="text-sm text-slate-500 border border-dashed border-white/10 rounded-xl px-4 py-6 text-center">
              Nenhum modelo configurado — usando o padrão do servidor. Adicione modelos para controlar a cascata.
            </div>
          )}
          {models.map((model, index) => (
            <div key={model} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-xs font-mono text-slate-500 w-5">{index + 1}</span>
              <span className="flex-1 font-mono text-sm text-slate-200 truncate">{model}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(index, -1)} disabled={index === 0}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button onClick={() => move(index, 1)} disabled={index === models.length - 1}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => removeModel(model)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add by id */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addModel(input); }}
            placeholder="vendor/modelo:free"
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <button onClick={() => addModel(input)} disabled={models.length >= MAX_MODELS}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4" /> {error}</p>
        )}

        {/* Preset suggestions */}
        {availablePresets.length > 0 && models.length < MAX_MODELS && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Sugestões
            </p>
            <div className="flex flex-wrap gap-2">
              {availablePresets.map((preset) => (
                <button key={preset} onClick={() => addModel(preset)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/40 text-xs font-mono text-slate-300">
                  + {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/10">
          <button onClick={handleSave} disabled={saving}
            className="premium-button-primary flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Salvo' : 'Salvar'}
          </button>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-medium disabled:opacity-60">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Testar geração
          </button>
        </div>

        {testResult && (
          <p className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.message}
          </p>
        )}
      </section>
    </div>
  );
}
