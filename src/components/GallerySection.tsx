import React, { useState } from 'react';
import { Camera, Sparkles, X, ChevronRight } from 'lucide-react';

interface GalleryItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: string;
}

export const GallerySection: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);

  const galleryItems: GalleryItem[] = [
    {
      id: 'chair-poster',
      title: 'Ambiente & Tradição',
      subtitle: 'Cadeira clássica de couro e iluminação premium',
      imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.19.02_2143161f.jpeg',
      category: 'Estrutura',
    },
    {
      id: 'greek-fade',
      title: 'Freestyle Grego Navalhado',
      subtitle: 'Precisão milimétrica e geometria na navalha',
      imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-12_at_15.44.43_30bb7746.jpeg',
      category: 'Arte & Freestyle',
    },
    {
      id: 'kids-curl-1',
      title: 'Cachos Definidos & Risquinho',
      subtitle: 'Degradê limpo com finalização profissional de cachos',
      imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.57_3c2b7564.jpeg',
      category: 'Corte & Textura',
    },
    {
      id: 'kids-curl-2',
      title: 'Perfil & Acabamento Infantil',
      subtitle: 'Atenção e carinho para os pequenos clientes',
      imageUrl: '/assets/aistudio/WhatsApp_Image_2026-10-24_at_16.18.59__2__e1070cd6.jpeg',
      category: 'Infantil',
    },
  ];

  return (
    <section id="galeria" className="py-16 sm:py-24 bg-[#0a0a0a] border-t border-neutral-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 mb-2">
              <Camera className="w-3.5 h-3.5" />
              <span>Nossos Trabalhos</span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white uppercase tracking-wider">
              Galeria de <span className="text-gold-gradient">Estilos</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Fotos reais dos nossos clientes e do espaço da barbearia.
            </p>
          </div>
          <p className="text-xs text-amber-400/90 font-medium">
            Seu estilo, nossa arte.
          </p>
        </div>

        {/* Grid de Fotos com Aspect Ratios Elegantes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedImage(item)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60 aspect-[4/5] shadow-lg transition-all duration-300 hover:border-amber-500/40 hover:-translate-y-1"
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-108"
                loading="lazy"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">
                  {item.category}
                </span>
                <h3 className="font-display text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-neutral-300 line-clamp-1 mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Lightbox */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] rounded-2xl border border-amber-500/40 bg-[#121212] overflow-hidden shadow-2xl"
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-amber-500 hover:text-black transition-colors"
              aria-label="Fechar foto"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.title}
              className="w-full max-h-[70vh] object-contain bg-black"
            />

            <div className="p-4 sm:p-6 bg-neutral-900/90 border-t border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {selectedImage.category}
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  {selectedImage.title}
                </h3>
                <p className="text-xs text-neutral-400">{selectedImage.subtitle}</p>
              </div>

              <a
                href="#servicos"
                onClick={() => setSelectedImage(null)}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-black uppercase tracking-wider shadow-md hover:brightness-110"
              >
                Quero esse corte
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
