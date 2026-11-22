import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, ImagePlus, Upload } from 'lucide-react';
import { api, GalleryPhoto } from '../services/api';

/**
 * Painel do barbeiro: fotos da "Galeria de Estilos".
 * Tem um limite de fotos (definido no servidor). Para colocar uma nova, é preciso apagar uma antes.
 * A foto é reduzida e comprimida NO CELULAR antes de enviar (fica com ~200 KB), o que economiza internet e banco.
 */

const MAX_W = 1200;
const MAX_H = 1600;

// Lê a foto escolhida, reduz para no máximo 1200x1600 e gera um JPEG. Também remove os dados de GPS da foto.
async function compressImage(file: File): Promise<{ base64: string; mime: string; preview: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
  } catch {
    throw new Error('Não consegui abrir essa foto. Se for do iPhone (HEIC), tire um print dela ou envie como JPG.');
  }
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a foto.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 1_000_000 && quality > 0.5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return { base64: dataUrl.split(',')[1], mime: 'image/jpeg', preview: dataUrl };
}

const input = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500';

export const GalleryManager: React.FC = () => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [picked, setPicked] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    api.getGallery()
      .then((g) => { setPhotos(g.photos); setMax(g.max); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const full = max > 0 && photos.length >= max;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setOk('');
    try { setPicked(await compressImage(file)); } catch (err: any) { setError(err.message); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    setBusy(true); setError(''); setOk('');
    try {
      const g = await api.adminAddGalleryPhoto({ title, subtitle, category, mime: picked.mime, imageBase64: picked.base64 });
      setPhotos(g.photos); setMax(g.max);
      setPicked(null); setTitle(''); setSubtitle(''); setCategory('');
      setOk('Foto publicada na galeria!');
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (p: GalleryPhoto) => {
    if (!window.confirm(`Apagar a foto "${p.title}" da galeria?`)) return;
    setBusy(true); setError(''); setOk('');
    try {
      const g = await api.adminDeleteGalleryPhoto(p.id);
      setPhotos(g.photos); setMax(g.max);
      setOk('Foto apagada. Agora você pode colocar outra.');
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-white">Galeria de Estilos</h4>
        <span className={`text-[11px] font-bold ${full ? 'text-amber-400' : 'text-neutral-400'}`}>{photos.length}/{max} fotos</span>
      </div>

      {error && <div className="rounded-lg bg-rose-950/40 border border-rose-800/50 p-2.5 text-[11px] text-rose-300">{error}</div>}
      {ok && <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-2.5 text-[11px] text-emerald-300">{ok}</div>}

      {loading ? (
        <p className="text-center text-xs text-neutral-400"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando fotos...</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-lg overflow-hidden border border-neutral-800 aspect-[4/5] bg-neutral-950">
              <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-1 text-[9px] text-white truncate">{p.title}</div>
              <button type="button" title="Apagar foto" disabled={busy} onClick={() => void handleDelete(p)}
                className="absolute top-1 right-1 rounded-md bg-black/70 p-1.5 text-rose-400 hover:bg-rose-600 hover:text-white disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-neutral-800 pt-4">
        {full ? (
          <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-200">
            A galeria está cheia ({max} fotos). Para colocar uma foto nova, apague uma das fotos acima (ícone da lixeira).
          </p>
        ) : !picked ? (
          <label className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/60 bg-amber-500/5 py-4 text-xs font-bold text-amber-300 hover:bg-amber-500/10">
            <ImagePlus className="w-4 h-4" /> Escolher foto do corte
            <input type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => void handleFile(e)} />
          </label>
        ) : (
          <form onSubmit={handleUpload} className="space-y-2.5">
            <img src={picked.preview} alt="Prévia" className="mx-auto max-h-48 rounded-lg border border-neutral-800" />
            <input required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Skin Fade & Barba)" className={input} />
            <input maxLength={120} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Descrição curta (opcional)" className={input} />
            <input maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria (ex.: Degradê, Infantil)" className={input} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setPicked(null)} className="flex-1 rounded-lg border border-neutral-700 py-2.5 text-xs font-bold text-neutral-400 hover:text-white">Cancelar</button>
              <button type="submit" disabled={busy || !title.trim()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-black hover:bg-amber-400 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Publicar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
