import { useState, useEffect } from 'react';
import { ArrowLeft, BarChart2, Loader2, Sparkles, Trash2, ChevronDown, ChevronUp, Upload, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Project, ContentAnalysis as ContentAnalysisType } from '../lib/types';
import * as db from '../lib/database';
import { analyzeContent } from '../services/geminiService';

const WINDSOR_HINT = `Cole aqui os dados dos seus posts. Pode ser:
• Exportação CSV do Windsor.ai (campos: data, título, curtidas, comentários, salvamentos, alcance, impressões)
• Exportação do Meta Business Suite
• Lista manual: "Post sobre X — 500 curtidas, 200 salvamentos, 50 comentários"
• Qualquer formato — a IA vai interpretar`;

export default function ContentAnalysis() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<ContentAnalysisType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    try {
      const [proj, list] = await Promise.all([
        db.getProject(id!),
        db.getContentAnalyses(id!),
      ]);
      setProject(proj);
      setAnalyses(list);
      if (list.length > 0) setExpandedId(list[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!rawData.trim() || !project) return;
    setAnalyzing(true);
    setError('');
    try {
      const insights = await analyzeContent({
        rawData,
        knowledgeBase: project.knowledge_base,
      });
      const analysis = await db.createContentAnalysis({
        project_id: project.id,
        raw_data: rawData,
        insights,
      });
      setAnalyses((prev) => [analysis, ...prev]);
      setExpandedId(analysis.id);
      setRawData('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar. Tente novamente.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(analysisId: string) {
    if (!confirm('Remover essa análise?')) return;
    await db.deleteContentAnalysis(analysisId);
    setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center gap-3">
        <Link to={`/projects/${id}`} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-emerald-500" />
            Análise de Conteúdo
          </h1>
          <p className="text-sm text-slate-500">{project?.name}</p>
        </div>
      </header>

      {/* Input */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Upload className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-slate-900">Cole seus dados de performance</h2>
            <p className="text-sm text-slate-500 mt-0.5">Windsor.ai, Meta Business Suite, ou lista manual</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 whitespace-pre-line border border-slate-200">
          {WINDSOR_HINT}
        </div>

        <textarea
          rows={10}
          value={rawData}
          onChange={(e) => setRawData(e.target.value)}
          placeholder="Cole aqui os dados dos seus posts..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono text-slate-800 resize-none"
        />

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !rawData.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Analisando...' : 'Analisar com IA'}
        </button>
      </div>

      {/* Results */}
      {analyses.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Análises anteriores</h2>
          {analyses.map((analysis) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              expanded={expandedId === analysis.id}
              onToggle={() => setExpandedId(expandedId === analysis.id ? null : analysis.id)}
              onDelete={() => handleDelete(analysis.id)}
            />
          ))}
        </div>
      )}

      {analyses.length === 0 && !analyzing && (
        <div className="text-center py-16 text-slate-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma análise ainda</p>
          <p className="text-sm mt-1">Cole os dados dos seus posts acima e deixe a IA trabalhar</p>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({
  analysis,
  expanded,
  onToggle,
  onDelete,
}: {
  analysis: ContentAnalysisType;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const date = new Date(analysis.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="font-semibold text-slate-900">Análise de {date}</p>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{analysis.insights.summary}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-5">
          {/* Summary */}
          <p className="text-slate-700 text-sm leading-relaxed">{analysis.insights.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightGroup
              title="Melhores performers"
              color="emerald"
              items={analysis.insights.best_performers}
            />
            <InsightGroup
              title="Piores performers"
              color="red"
              items={analysis.insights.worst_performers}
            />
          </div>

          <InsightGroup
            title="Padrões identificados"
            color="indigo"
            items={analysis.insights.patterns}
          />

          <InsightGroup
            title="Recomendações"
            color="amber"
            items={analysis.insights.recommendations}
          />

          <InsightGroup
            title="Ideias de conteúdo"
            color="purple"
            items={analysis.insights.content_ideas}
          />
        </div>
      )}
    </div>
  );
}

const colorMap = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
};

const dotMap = {
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
};

function InsightGroup({ title, color, items }: { title: string; color: keyof typeof colorMap; items: string[] }) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <h4 className="font-semibold text-sm mb-3">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotMap[color]}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
