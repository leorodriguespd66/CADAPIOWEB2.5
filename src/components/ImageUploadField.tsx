import React, { useState, useRef } from 'react';
import { Upload, Camera, Image as ImageIcon, Trash2, Link as LinkIcon, Check, RefreshCw } from 'lucide-react';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: 'square' | 'banner' | 'product';
  helperText?: string;
  maxDimension?: number;
  id?: string;
}

/**
 * Resizes and compresses an image file into an efficient base64 data URL
 * so it can be stored and rendered smoothly without exceeding storage limits.
 */
function compressImage(file: File, maxDimension = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Fill background with white for transparency fallback
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as optimized JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUploadField({
  label,
  value,
  onChange,
  aspectRatio = 'square',
  helperText,
  maxDimension = 800,
  id
}: ImageUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    try {
      setIsProcessing(true);
      const optimizedUrl = await compressImage(file, maxDimension);
      onChange(optimizedUrl);
      setShowUrlInput(false);
    } catch (err) {
      console.error('Erro ao processar imagem do dispositivo:', err);
      alert('Não foi possível carregar a imagem. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlDraft.trim()) {
      onChange(urlDraft.trim());
      setUrlDraft('');
      setShowUrlInput(false);
    }
  };

  // Aspect ratio styles
  const aspectClass =
    aspectRatio === 'banner'
      ? 'aspect-[21/9] sm:aspect-[16/7]'
      : aspectRatio === 'product'
      ? 'aspect-[4/3]'
      : 'aspect-square';

  const isDeviceImage = value?.startsWith('data:image/');

  return (
    <div className="space-y-1.5" id={id || `upload-field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <button
          type="button"
          onClick={() => {
            setShowUrlInput(!showUrlInput);
            if (!showUrlInput) setUrlDraft(value && !isDeviceImage ? value : '');
          }}
          className="text-[10px] text-orange-600 hover:text-orange-700 font-semibold flex items-center space-x-1 cursor-pointer"
        >
          <LinkIcon size={11} />
          <span>{showUrlInput ? 'Ocultar URL' : 'Inserir Link Web'}</span>
        </button>
      </div>

      {/* URL Input Bar (Collapsible) */}
      {showUrlInput && (
        <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 animate-fadeIn">
          <input
            type="url"
            placeholder="https://exemplo.com/foto.jpg"
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            className="flex-1 text-xs p-2 rounded-lg border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Aplicar
          </button>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
          }
          // Reset input value so re-selecting same file works
          e.target.value = '';
        }}
      />

      {/* Main Image Upload Box / Preview */}
      {value ? (
        <div
          className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden border-2 ${
            isDragging ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-slate-100'
          } group shadow-2xs transition`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <img
            src={value}
            alt={label}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />

          {/* Overlay actions on hover or click */}
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
            >
              {isProcessing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Camera size={13} />
              )}
              <span>Trocar Foto do Dispositivo</span>
            </button>

            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Remover Foto</span>
            </button>

            <span className="text-[10px] text-slate-300">
              Ou arraste um novo arquivo aqui
            </span>
          </div>

          {/* Quick status badge in corner */}
          <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
            {isDeviceImage ? (
              <>
                <Camera size={10} className="text-orange-400" />
                <span>Do Dispositivo</span>
              </>
            ) : (
              <>
                <LinkIcon size={10} className="text-blue-400" />
                <span>Link Web</span>
              </>
            )}
          </div>

          {/* Quick change button always visible on mobile/touch */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="sm:hidden absolute bottom-2 right-2 bg-orange-500 text-white p-2 rounded-xl shadow-lg cursor-pointer"
            title="Trocar Foto"
          >
            <Camera size={14} />
          </button>
        </div>
      ) : (
        /* Empty Upload State */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full ${aspectClass} rounded-2xl border-2 border-dashed ${
            isDragging
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-slate-300 hover:border-orange-500 bg-slate-50/70 hover:bg-orange-50/40'
          } transition flex flex-col items-center justify-center p-4 cursor-pointer text-center group`}
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 group-hover:scale-105 group-hover:bg-orange-500 group-hover:text-white transition flex items-center justify-center shadow-xs mb-2.5">
            {isProcessing ? (
              <RefreshCw size={22} className="animate-spin" />
            ) : (
              <Upload size={22} />
            )}
          </div>

          <span className="font-bold text-xs text-slate-800 group-hover:text-orange-600 transition">
            Escolher Foto do Dispositivo
          </span>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-tight">
            Clique aqui ou arraste a imagem do seu computador ou celular
          </p>
          <span className="text-[9px] text-slate-400 mt-2 font-mono uppercase">
            JPG, PNG ou WEBP
          </span>
        </div>
      )}

      {helperText && (
        <p className="text-[10px] text-slate-400 leading-normal">{helperText}</p>
      )}
    </div>
  );
}
