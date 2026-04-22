import { useState, useEffect } from 'react';
import { Plus, Images, Search, Loader2, Check, Upload, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import type { ImageCollection } from '../lib/types';
import * as db from '../lib/database';
import { uploadImageToStorage } from '../services/uploadService';
import { searchImages, type PexelsPhoto } from '../services/pexelsService';

export default function Collections() {
  const [collections, setCollections] = useState<ImageCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchModal, setSearchModal] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'hook' | 'body'>('hook');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => { loadCollections(); }, []);

  async function loadCollections() {
    try { setCollections(await db.getCollections()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await db.createCollection({ name: name.trim(), type });
      setModalOpen(false); setName(''); loadCollections();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection?')) return;
    try { await db.deleteCollection(id); loadCollections(); }
    catch (err) { console.error(err); }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try { const res = await searchImages(query); setPhotos(res.photos); }
    catch (err) { console.error(err); }
    finally { setSearching(false); }
  }

  function toggleSelect(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  async function handleAddImages() {
    if (!searchModal || selected.size === 0) return;
    setSaving(true);
    try {
      const images = Array.from(selected).map((url) => ({ collection_id: searchModal, url, source: 'pexels' }));
      await db.addImagesToCollection(images);
      setSearchModal(null); setSelected(new Set()); setPhotos([]); setQuery(''); loadCollections();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, collectionId: string) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(collectionId);
    try {
      const uploads = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageToStorage(files[i]);
        uploads.push({ collection_id: collectionId, url, source: 'upload' });
      }
      await db.addImagesToCollection(uploads);
      loadCollections();
    } catch (err) {
      console.error('Error uploading files:', err);
    } finally {
      setUploading(null);
      e.target.value = ''; // Reset input
    }
  }

  if (loading) return <div className="space-y-6"><div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" /></div>;

  return (
    <div className="space-y-8 py-4">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Biblioteca de Ativos</h1>
          <p className="text-slate-400 mt-2 text-lg">Gerencie suas coleções de imagens para capas e conteúdo.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)} 
          className="premium-button-primary flex items-center gap-3"
        >
          <Plus className="w-5 h-5" /> Nova Coleção
        </button>
      </header>

      {collections.length === 0 ? (
        <div className="premium-card p-20 text-center">
          <Images className="w-16 h-16 text-slate-800 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white">Nenhuma coleção criada</h3>
          <p className="text-slate-500 mt-2 mb-8">Crie coleções para organizar seus fundos de carrossel por nicho ou estilo.</p>
          <button onClick={() => setModalOpen(true)} className="premium-button-secondary">
            Começar agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {collections.map((col) => (
            <div key={col.id} className="premium-card group overflow-hidden flex flex-col">
              {/* Image thumbnails grid */}
              <div className="h-44 bg-black/40 grid grid-cols-4 gap-1 p-1 overflow-hidden relative">
                {(col.images || []).slice(0, 4).map((img) => (
                  <div 
                    key={img.id} 
                    className="bg-cover bg-center rounded-sm transition-transform duration-700 group-hover:scale-110" 
                    style={{ backgroundImage: `url(${img.url})` }} 
                  />
                ))}
                {(!col.images || col.images.length === 0) && (
                  <div className="col-span-4 flex flex-col items-center justify-center text-slate-700 gap-2">
                    <Images className="w-10 h-10 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Galeria Vazia</span>
                  </div>
                )}
                {/* Overlay for better text separation */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-80" />
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors leading-tight">{col.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                        col.type === 'hook' 
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {col.type === 'hook' ? 'Capa / Hook' : 'Conteúdo / Body'}
                      </span>
                      <span className="text-slate-800 text-[8px]">•</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{col.images?.length || 0} IMAGENS</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(col.id)} 
                    className="p-2 hover:bg-red-500/10 rounded-xl text-slate-700 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-auto pt-6 flex gap-3 border-t border-white/5">
                  <button 
                    onClick={() => { setSearchModal(col.id); setSelected(new Set()); setPhotos([]); setQuery(''); }} 
                    className="flex-1 premium-button-secondary !py-2 !px-3 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5" /> Buscar AI
                  </button>
                  <label className="flex-1 premium-button-secondary !py-2 !px-3 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                    {uploading === col.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, col.id)} disabled={uploading === col.id} />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Coleção de Ativos">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="premium-label">Nome da Coleção</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ex: Minimalist Office, Luxury Cars..." 
              className="premium-input w-full"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="premium-label">Tipo de Uso</label>
            <div className="grid grid-cols-2 gap-4">
              {(['hook', 'body'] as const).map((t) => (
                <button 
                  key={t} 
                  onClick={() => setType(t)} 
                  className={`px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border ${
                    type === t 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                      : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'
                  }`}
                >
                  {t === 'hook' ? 'Capas (Hook)' : 'Conteúdo (Body)'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="premium-button-secondary text-sm">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !name.trim()} className="premium-button-primary text-sm">
              {saving ? 'Criando...' : 'Criar Coleção'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Search Modal */}
      <Modal open={!!searchModal} onClose={() => setSearchModal(null)} title="Explorar Imagens (Pexels)" maxWidth="max-w-4xl">
        <div className="space-y-6">
          <div className="flex gap-3">
            <input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
              placeholder="Ex: abstract background, modern architecture..." 
              className="premium-input flex-1" 
            />
            <button 
              onClick={handleSearch} 
              disabled={searching} 
              className="premium-button-primary flex items-center gap-2 !py-2.5"
            >
              {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Buscar
            </button>
          </div>
          
          {photos.length > 0 ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {photos.map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => toggleSelect(p.src.large)} 
                    className={`relative rounded-xl overflow-hidden aspect-[3/4] border-4 transition-all ${
                      selected.has(p.src.large) ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-transparent'
                    }`}
                  >
                    <img src={p.src.medium} alt="" className="w-full h-full object-cover" />
                    {selected.has(p.src.large) && (
                      <div className="absolute inset-0 bg-indigo-500/40 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-xl">
                          <Check className="w-5 h-5 text-indigo-600 font-black" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{selected.size} IMAGENS SELECIONADAS</span>
                <button 
                  onClick={handleAddImages} 
                  disabled={saving || selected.size === 0} 
                  className="premium-button-primary !py-3 !px-8"
                >
                  {saving ? 'Adicionando...' : `Adicionar à Coleção →`}
                </button>
              </div>
            </div>
          ) : (
            !searching && (
              <div className="p-20 text-center">
                <Search className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                <p className="text-slate-600 italic">Digite algo acima para explorar imagens de alta qualidade.</p>
              </div>
            )
          )}
        </div>
      </Modal>
    </div>
  );
}
