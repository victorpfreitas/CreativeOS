import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Upload, AlertCircle, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { generateBrandDNA } from '../../services/geminiService';
import type { BrandDNA } from '../../lib/types';

interface MagicDNAModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (dna: BrandDNA) => void;
}

export default function MagicDNAModal({ open, onClose, onApply }: MagicDNAModalProps) {
  const [rawData, setRawData] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<BrandDNA | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    if (!rawData.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const generated = await generateBrandDNA({ rawData });
      setPreview(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar DNA. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError('Por favor, selecione um arquivo .txt ou .md');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawData(text);
      setError('');
    };
    reader.readAsText(file);
  }

  function handleApply() {
    if (preview) {
      onApply(preview);
      onClose();
      // Reset state for next use
      setRawData('');
      setPreview(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar DNA com IA"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {!preview ? (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-indigo-900">Como funciona?</p>
                  <p className="text-xs text-indigo-700 mt-1">
                    Cole informações brutas sobre a marca, biografia, notas de reuniões ou um documento de estratégia. 
                    A IA vai extrair automaticamente os pilares, público, tom de voz e muito mais.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Informações brutos</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Subir arquivo (.txt, .md)
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.md"
                    className="hidden"
                  />
                </div>
                <textarea
                  rows={8}
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  placeholder="Cole aqui textos, notas, bios, ou qualquer material sobre a marca..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !rawData.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Analisando...' : 'Gerar DNA'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  DNA Sugerido pela IA
                </h4>
                <button
                  onClick={() => setPreview(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1">
                <PreviewField label="Bio" value={preview.bio} />
                <PreviewField label="Mercado" value={preview.market} />
                <PreviewField label="Público-alvo" value={preview.target_audience} />
                <PreviewField label="Tom de Voz" value={preview.tone_of_voice} />
                <PreviewField label="Pilares" value={preview.content_pillars} />
                <PreviewField label="Mensagens" value={preview.key_messages} />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Dica:</strong> Ao aplicar, estes valores preencherão o formulário. Você poderá editá-los antes de salvar definitivamente.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleApply}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                Aplicar ao Projeto
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PreviewField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1">
      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
      <p className="text-xs text-slate-700 line-clamp-3">{value}</p>
    </div>
  );
}
