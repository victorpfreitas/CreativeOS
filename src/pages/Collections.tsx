import { useState, useEffect } from 'react';
import { Plus, Images, Search, Loader2, Check, Upload } from 'lucide-react';
import Modal from '../components/ui/Modal';
import type { ImageCollection } from '../lib/types';
import * as db from '../lib/database';
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
        const url = await db.uploadImageToStorage(files[i]);
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
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Collections</h1>
          <p className="text-slate-500 mt-1">Reusable image libraries for your carousels.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> New Collection
        </button>
      </header>

      {collections.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Images className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No collections yet</h3>
          <p className="text-slate-500 mt-1">Create image collections to use as backgrounds in your slideshows.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div key={col.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Image thumbnails */}
              <div className="h-32 bg-slate-100 grid grid-cols-4 gap-0.5 overflow-hidden">
                {(col.images || []).slice(0, 4).map((img) => (
                  <div key={img.id} className="bg-cover bg-center" style={{ backgroundImage: `url(${img.url})` }} />
                ))}
                {(!col.images || col.images.length === 0) && (
                  <div className="col-span-4 flex items-center justify-center text-slate-300"><Images className="w-8 h-8" /></div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-900">{col.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${col.type === 'hook' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>{col.type}</span>
                </div>
                <p className="text-sm text-slate-500 mb-3">{col.images?.length || 0} images</p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setSearchModal(col.id); setSelected(new Set()); setPhotos([]); setQuery(''); }} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Search Pexels</button>
                    <label className="text-sm text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer flex items-center gap-1">
                      {uploading === col.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                      <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, col.id)} disabled={uploading === col.id} />
                    </label>
                  </div>
                  <button onClick={() => handleDelete(col.id)} className="text-sm text-red-500 hover:text-red-600 font-medium self-end">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Collection">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Luxury Real Estate" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <div className="flex gap-3">
              {(['hook', 'body'] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t === 'hook' ? 'Hook Cover' : 'Body Slides'}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !name.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Search Modal */}
      <Modal open={!!searchModal} onClose={() => setSearchModal(null)} title="Search Images (Pexels)" maxWidth="max-w-3xl">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search for images..." className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleSearch} disabled={searching} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
            </button>
          </div>
          {photos.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
                {photos.map((p) => (
                  <button key={p.id} onClick={() => toggleSelect(p.src.large)} className={`relative rounded-lg overflow-hidden aspect-[3/4] border-2 transition-colors ${selected.has(p.src.large) ? 'border-indigo-500' : 'border-transparent'}`}>
                    <img src={p.src.medium} alt="" className="w-full h-full object-cover" />
                    {selected.has(p.src.large) && <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center"><Check className="w-6 h-6 text-white" /></div>}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-slate-500">{selected.size} selected</span>
                <button onClick={handleAddImages} disabled={saving || selected.size === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium">{saving ? 'Adding...' : `Add ${selected.size} Images`}</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
