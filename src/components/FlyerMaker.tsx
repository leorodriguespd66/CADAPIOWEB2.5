import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Download, Copy, Check, Sparkles, Image as ImageIcon, Upload, 
  Flame, Tag, Smartphone, Instagram, Share2, RefreshCw, Eye, MessageCircle, ExternalLink, Palette
} from 'lucide-react';
import { Store, Product } from '../types';

interface FlyerMakerProps {
  stores: Store[];
  currentStore: Store;
  products: Product[];
  onSelectStore?: (storeId: string) => void;
}

// Adjust hex color brightness for elegant gradients
function adjustHex(hex: string, percent: number) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${(g | (b << 8) | (r << 16)).toString(16).padStart(6, '0')}`;
}

export default function FlyerMaker({
  stores,
  currentStore,
  products,
  onSelectStore
}: FlyerMakerProps) {
  // Store selection
  const [selectedStoreId, setSelectedStoreId] = useState(currentStore.id);
  const activeStore = useMemo(() => {
    return stores.find(s => s.id === selectedStoreId) || currentStore;
  }, [stores, selectedStoreId, currentStore]);

  // Products of active store
  const storeProducts = useMemo(() => {
    return products.filter(p => p.storeId === activeStore.id);
  }, [products, activeStore.id]);

  // Format: 'story' (9:16) or 'square' (1:1)
  const [format, setFormat] = useState<'story' | 'square'>('story');

  // Visual Theme: 'blur' (Foto Desfocada) | 'custom' (Cor Escolhida) | 'dark' | 'fire' | 'brand'
  const [theme, setTheme] = useState<'blur' | 'custom' | 'dark' | 'fire' | 'brand'>('blur');

  // Custom Background Color (defaulting to deep rich purple #4c1d95 / QuickPlayer theme)
  const [customBgColor, setCustomBgColor] = useState<string>('#4c1d95');

  // Offer Form Fields
  const [offerBadge, setOfferBadge] = useState('🔥 OFERTA DO DIA');
  const [offerTitle, setOfferTitle] = useState('COMBO BURGER CHEDDAR BACON');
  const [offerDescription, setOfferDescription] = useState('Acompanha Batata Frita Crocante + Refri Lata 350ml geladinho!');
  const [originalPrice, setOriginalPrice] = useState<string>('38.90');
  const [promoPrice, setPromoPrice] = useState<string>('28.90');
  const [validUntil, setValidUntil] = useState('Válido hoje até as 23h ou enquanto durar o estoque');
  const [ctaText, setCtaText] = useState('Peça pelo link do Cardápio Digital!');
  const [imageUrl, setImageUrl] = useState<string>('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&auto=format&fit=crop&q=80');

  // Status feedback
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [isCopiedImage, setIsCopiedImage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Hidden Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');

  // Auto-populate from existing store product
  const handleSelectProduct = (prodId: string) => {
    const prod = storeProducts.find(p => p.id === prodId);
    if (!prod) return;

    setOfferTitle(prod.name.toUpperCase());
    setOfferDescription(prod.description || 'Sabor inconfundível preparado com os melhores ingredientes!');
    setPromoPrice(prod.price.toFixed(2));
    if (prod.originalPrice && prod.originalPrice > prod.price) {
      setOriginalPrice(prod.originalPrice.toFixed(2));
    } else {
      setOriginalPrice((prod.price * 1.25).toFixed(2));
    }
    if (prod.imageUrl) {
      setImageUrl(prod.imageUrl);
    }
    setOfferBadge(prod.featuredTag ? `🔥 ${prod.featuredTag.toUpperCase()}` : '⚡ PROMOÇÃO ESPECIAL');
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Pre-configured badge options
  const badgePresets = [
    '🔥 OFERTA DO DIA',
    '⚡ SÓ HOJE!',
    '💥 PROMOÇÃO RELÂMPAGO',
    '🍕 DIA DA PIZZA',
    '🍔 SEXTA DO BURGER',
    '⭐ MAIS PEDIDO',
    '🎉 COMBO FAMÍLIA'
  ];

  // Base store menu url
  const storeMenuUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/#${activeStore.slug}`;
    }
    return `https://seucardapio.com/${activeStore.slug}`;
  }, [activeStore.slug]);

  // Generate persuasiveness copy / caption
  const generatedCaption = useMemo(() => {
    const parsedOriginal = parseFloat(originalPrice);
    const parsedPromo = parseFloat(promoPrice);

    return `🔥 ${offerBadge} NO ${activeStore.name.toUpperCase()}! 🔥\n\n` +
      `🍔 ${offerTitle}\n` +
      (offerDescription ? `✨ ${offerDescription}\n\n` : '\n') +
      (parsedOriginal && parsedOriginal > parsedPromo
        ? `❌ De: R$ ${parsedOriginal.toFixed(2)}\n✅ Por APENAS: R$ ${parsedPromo.toFixed(2)}!\n\n`
        : `💰 Por APENAS: R$ ${(parsedPromo || 0).toFixed(2)}!\n\n`) +
      `🛵 Entregamos quentinho e rápido no seu endereço!\n` +
      `⏰ ${validUntil}\n\n` +
      `📲 FAÇA SEU PEDIDO PELO NOSSO CARDÁPIO DIGITAL:\n` +
      `👉 ${storeMenuUrl}\n\n` +
      (activeStore.phone ? `💬 Ou chame no WhatsApp: ${activeStore.phone}\n\n` : '') +
      `#${activeStore.slug} #delivery #promocao #oferta #restaurante #delicia`;
  }, [offerBadge, activeStore.name, activeStore.slug, activeStore.phone, offerTitle, offerDescription, originalPrice, promoPrice, validUntil, storeMenuUrl]);

  // Editable caption state so user can customize the copy text freely
  const [editableCaption, setEditableCaption] = useState<string>('');
  const [isCaptionManuallyEdited, setIsCaptionManuallyEdited] = useState<boolean>(false);

  // Sync automatic caption only until user manually customizes it
  useEffect(() => {
    if (!isCaptionManuallyEdited) {
      setEditableCaption(generatedCaption);
    }
  }, [generatedCaption, isCaptionManuallyEdited]);

  // Render canvas with layered drawing
  const renderFlyer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    const drawCompleteFlyer = (loadedImg: HTMLImageElement | null) => {
      // 1. BACKGROUND LAYER
      if (theme === 'blur' && loadedImg) {
        // Blurred Product Photo Background
        ctx.save();
        ctx.filter = 'blur(45px) brightness(0.36) saturate(1.25)';
        const bgAspect = loadedImg.width / loadedImg.height;
        const canvasAspect = width / height;
        let bgW = width * 1.15;
        let bgH = height * 1.15;
        if (bgAspect > canvasAspect) {
          bgW = bgH * bgAspect;
        } else {
          bgH = bgW / bgAspect;
        }
        const bgX = (width - bgW) / 2;
        const bgY = (height - bgH) / 2;
        ctx.drawImage(loadedImg, bgX, bgY, bgW, bgH);
        ctx.filter = 'none';
        ctx.restore();

        // Dark Vignette Gradient Overlay for high text contrast
        ctx.save();
        const vGrad = ctx.createLinearGradient(0, 0, 0, height);
        vGrad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
        vGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.35)');
        vGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.65)');
        vGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (theme === 'custom') {
        // Custom Color chosen by user with rich gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, adjustHex(customBgColor, -25));
        grad.addColorStop(0.4, customBgColor);
        grad.addColorStop(1, adjustHex(customBgColor, -45));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Soft radial glow
        ctx.save();
        const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 60, width * 0.5, height * 0.45, 650);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (theme === 'fire') {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(0.4, '#991b1b');
        grad.addColorStop(1, '#450a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        const glow = ctx.createRadialGradient(width * 0.5, height * 0.4, 100, width * 0.5, height * 0.4, 700);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else if (theme === 'brand') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#18181b');
        grad.addColorStop(0.5, '#27272a');
        grad.addColorStop(1, '#09090b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        const glow = ctx.createRadialGradient(width * 0.5, height * 0.4, 50, width * 0.5, height * 0.4, 550);
        glow.addColorStop(0, 'rgba(234, 88, 12, 0.3)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else {
        // Default / Dark theme
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e293b');
        grad.addColorStop(1, '#090d16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 80, width * 0.5, height * 0.45, 600);
        glow.addColorStop(0, 'rgba(249, 115, 22, 0.28)');
        glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // 2. HEADER: STORE LOGO + NAME
      const topY = format === 'story' ? 100 : 60;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 44px sans-serif';
      ctx.letterSpacing = '1px';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 15;
      ctx.fillText(activeStore.name.toUpperCase(), width / 2, topY + 50);

      ctx.fillStyle = '#f97316';
      ctx.font = '700 22px sans-serif';
      ctx.fillText('CARDÁPIO DIGITAL OFICIAL', width / 2, topY + 90);
      ctx.restore();

      // 3. OFFER BADGE PILL
      const badgeY = format === 'story' ? 240 : 180;
      ctx.save();
      ctx.font = '900 36px sans-serif';
      const badgeMetrics = ctx.measureText(offerBadge);
      const badgePaddingX = 40;
      const badgeW = badgeMetrics.width + badgePaddingX * 2;
      const badgeH = 70;
      const badgeX = (width - badgeW) / 2;

      ctx.shadowColor = 'rgba(234, 88, 12, 0.6)';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#f97316';
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 35);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(offerBadge, width / 2, badgeY + badgeH / 2 + 2);
      ctx.restore();

      // 4. MAIN PRODUCT IMAGE
      const imgSize = format === 'story' ? 620 : 420;
      const imgX = (width - imgSize) / 2;
      const imgY = format === 'story' ? 360 : 270;

      if (loadedImg) {
        // Glow behind image
        ctx.save();
        const imgGlow = ctx.createRadialGradient(
          width / 2,
          imgY + imgSize / 2,
          imgSize * 0.2,
          width / 2,
          imgY + imgSize / 2,
          imgSize * 0.65
        );
        imgGlow.addColorStop(0, 'rgba(249, 115, 22, 0.55)');
        imgGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = imgGlow;
        ctx.fillRect(imgX - 100, imgY - 100, imgSize + 200, imgSize + 200);
        ctx.restore();

        // Rounded image clipping with border
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, imgX, imgY, imgSize, imgSize, 36);
        ctx.clip();

        // Cover scaling
        const aspect = loadedImg.width / loadedImg.height;
        let drawW = imgSize;
        let drawH = imgSize;
        let offX = imgX;
        let offY = imgY;

        if (aspect > 1) {
          drawW = imgSize * aspect;
          offX = imgX - (drawW - imgSize) / 2;
        } else {
          drawH = imgSize / aspect;
          offY = imgY - (drawH - imgSize) / 2;
        }
        ctx.drawImage(loadedImg, offX, offY, drawW, drawH);
        ctx.restore();

        // High quality border
        ctx.save();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 6;
        roundRect(ctx, imgX, imgY, imgSize, imgSize, 36);
        ctx.stroke();
        ctx.restore();
      }

      // 5. TITLE & DESCRIPTION SECTIONS
      const contentStartY = imgY + imgSize;
      const titleY = contentStartY + (format === 'story' ? 70 : 35);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 15;
      
      const words = offerTitle.split(' ');
      let line = '';
      let curY = titleY;
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 920 && i > 0) {
          ctx.fillText(line.trim(), width / 2, curY);
          line = words[i] + ' ';
          curY += 56;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), width / 2, curY);
      ctx.restore();

      if (offerDescription) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 24px sans-serif';
        const descY = curY + (format === 'story' ? 44 : 34);
        ctx.fillText(offerDescription.substring(0, 90), width / 2, descY);
        ctx.restore();
        curY += (format === 'story' ? 55 : 42);
      }

      // 6. PRICE BOX
      const priceBoxY = curY + (format === 'story' ? 50 : 25);
      const parsedOriginal = parseFloat(originalPrice);
      const parsedPromo = parseFloat(promoPrice);

      ctx.save();
      const boxW = 860;
      const boxH = format === 'story' ? 190 : 130;
      const boxX = (width - boxW) / 2;

      const pGrad = ctx.createLinearGradient(boxX, priceBoxY, boxX + boxW, priceBoxY + boxH);
      pGrad.addColorStop(0, '#1e293b');
      pGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = pGrad;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      roundRect(ctx, boxX, priceBoxY, boxW, boxH, 28);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      roundRect(ctx, boxX, priceBoxY, boxW, boxH, 28);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (parsedOriginal && parsedOriginal > parsedPromo) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 28px sans-serif';
        ctx.textAlign = 'center';
        const deText = `DE R$ ${parsedOriginal.toFixed(2)}`;
        const deY = priceBoxY + (format === 'story' ? 45 : 36);
        ctx.fillText(deText, width / 2, deY);

        const deMetrics = ctx.measureText(deText);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(width / 2 - deMetrics.width / 2 - 10, deY - 8);
        ctx.lineTo(width / 2 + deMetrics.width / 2 + 10, deY - 8);
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.font = '900 68px sans-serif';
        ctx.fillText(`R$ ${parsedPromo.toFixed(2)}`, width / 2, deY + (format === 'story' ? 85 : 62));
      } else {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '800 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('POR APENAS', width / 2, priceBoxY + (format === 'story' ? 50 : 38));

        ctx.fillStyle = '#22c55e';
        ctx.font = '900 76px sans-serif';
        ctx.fillText(`R$ ${(parsedPromo || 0).toFixed(2)}`, width / 2, priceBoxY + (format === 'story' ? 130 : 98));
      }
      ctx.restore();

      // 7. VALIDITY CONDITION
      if (validUntil) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 22px sans-serif';
        const valY = priceBoxY + boxH + (format === 'story' ? 45 : 28);
        ctx.fillText(`⏰ ${validUntil}`, width / 2, valY);
        ctx.restore();
      }

      // 8. FOOTER CTA BAR
      const footerY = height - (format === 'story' ? 170 : 100);
      ctx.save();
      const ctaGrad = ctx.createLinearGradient(0, footerY, width, footerY + 90);
      ctaGrad.addColorStop(0, '#f97316');
      ctaGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = ctaGrad;
      roundRect(ctx, 60, footerY, width - 120, format === 'story' ? 100 : 70, 24);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = format === 'story' ? '900 36px sans-serif' : '900 28px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(`👉 ${ctaText.toUpperCase()}`, width / 2, footerY + (format === 'story' ? 50 : 35));
      ctx.restore();

      setPreviewDataUrl(canvas.toDataURL('image/png'));
      setIsGenerating(false);
    };

    img.onload = () => {
      drawCompleteFlyer(img);
    };

    img.onerror = () => {
      drawCompleteFlyer(null);
    };
  };

  // Trigger render on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      renderFlyer();
    }, 150);
    return () => clearTimeout(timer);
  }, [
    format, theme, customBgColor, offerBadge, offerTitle, offerDescription,
    originalPrice, promoPrice, validUntil, ctaText, imageUrl, activeStore
  ]);

  // Download image
  const handleDownload = () => {
    if (!previewDataUrl) return;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    const cleanTitle = offerTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    a.download = `oferta-${activeStore.slug}-${cleanTitle}-${format}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          // Modern Clipboard API for images
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setIsCopiedImage(true);
          setTimeout(() => setIsCopiedImage(false), 3000);
        } catch (err) {
          console.warn('Clipboard write failed, downloading instead:', err);
          handleDownload();
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
    }
  };

  // Copy caption text (uses customized text if edited)
  const handleCopyText = async () => {
    const textToCopy = editableCaption.trim() || generatedCaption;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopiedText(true);
      setTimeout(() => setIsCopiedText(false), 3000);
    } catch (err) {
      console.error('Error copying text:', err);
    }
  };

  // Open WhatsApp with caption (uses customized text if edited)
  const handleShareWhatsApp = () => {
    const textToShare = editableCaption.trim() || generatedCaption;
    const textEncoded = encodeURIComponent(textToShare);
    window.open(`https://api.whatsapp.com/send?text=${textEncoded}`, '_blank');
  };

  // Helper function to draw rounded rectangles on 2D canvas
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  return (
    <div className="space-y-6" id="flyer-maker-module">
      {/* Hidden Canvas for High-Resolution Export */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Module Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
            <Sparkles size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">Criador de Encartes Rápidos</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold uppercase tracking-wider">
                Status & Instagram
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Gere posts e encartes promocionais profissionais em segundos com imagem, preços chamativos e legenda persuasiva pronta para copiar e postar!
            </p>
          </div>
        </div>

        {/* Store Selector if multiple stores exist */}
        {stores.length > 1 && (
          <div className="shrink-0 flex items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-700">
            <span className="text-xs text-slate-400 font-medium pl-2">Loja:</span>
            <select
              value={selectedStoreId}
              onChange={e => {
                setSelectedStoreId(e.target.value);
                if (onSelectStore) onSelectStore(e.target.value);
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-hidden cursor-pointer"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Grid: Left Controls & Form, Right Visual Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Input (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Pull from Menu */}
          {storeProducts.length > 0 && (
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame size={14} />
                  Puxar de um Produto do Cardápio
                </span>
                <span className="text-[11px] text-slate-400">Preenchimento automático</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {storeProducts.slice(0, 8).map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod.id)}
                    className="shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-orange-600/30 hover:border-orange-500/50 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition cursor-pointer flex items-center gap-2"
                  >
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-6 h-6 rounded-lg object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="truncate max-w-[130px]">{prod.name}</span>
                    <span className="text-emerald-400 font-mono text-[11px]">R$ {prod.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Format & Theme Selection */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Formato e Estilo Visual
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('story')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  format === 'story'
                    ? 'bg-orange-500/20 border-orange-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <Smartphone size={20} />
                </div>
                <div>
                  <span className="block font-bold text-xs text-white">Status & Stories (9:16)</span>
                  <span className="text-[11px] text-slate-400">WhatsApp, Instagram & TikTok</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('square')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  format === 'square'
                    ? 'bg-orange-500/20 border-orange-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Instagram size={20} />
                </div>
                <div>
                  <span className="block font-bold text-xs text-white">Feed Quadrado (1:1)</span>
                  <span className="text-[11px] text-slate-400">Post do Instagram e Facebook</span>
                </div>
              </button>
            </div>

            {/* Background Style Selector */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={13} className="text-orange-400" />
                  Estilo e Cor de Fundo do Encarte
                </span>
                {theme === 'blur' && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Foto Desfocada Ativa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('blur')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border text-left ${
                    theme === 'blur'
                      ? 'bg-orange-500/20 text-white border-orange-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">🖼️</span>
                  <div>
                    <span className="block text-white font-bold leading-tight">Foto Desfocada</span>
                    <span className="text-[10px] text-slate-400 block">Blur do Produto</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('custom')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border text-left ${
                    theme === 'custom'
                      ? 'bg-purple-500/20 text-white border-purple-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">🎨</span>
                  <div>
                    <span className="block text-white font-bold leading-tight">Escolher Cor</span>
                    <span className="text-[10px] text-slate-400 block">Qualquer Tom</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border text-left ${
                    theme === 'dark'
                      ? 'bg-slate-700 text-white border-slate-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">🌑</span>
                  <div>
                    <span className="block text-white font-bold leading-tight">Dark Gourmet</span>
                    <span className="text-[10px] text-slate-400 block">Grafite Luxo</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('fire')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border text-left ${
                    theme === 'fire'
                      ? 'bg-red-900/40 text-white border-red-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">🔥</span>
                  <div>
                    <span className="block text-white font-bold leading-tight">Vermelho Fogo</span>
                    <span className="text-[10px] text-slate-400 block">Super Oferta</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('brand')}
                  className={`p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 border text-left ${
                    theme === 'brand'
                      ? 'bg-orange-600/30 text-white border-orange-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">🟧</span>
                  <div>
                    <span className="block text-white font-bold leading-tight">Laranja Marca</span>
                    <span className="text-[10px] text-slate-400 block">Vibrante</span>
                  </div>
                </button>
              </div>

              {/* Custom Color Palette Bar when theme === 'custom' */}
              {theme === 'custom' && (
                <div className="p-3 bg-slate-950/90 border border-purple-500/40 rounded-xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">Escolha a cor de fundo:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customBgColor}
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border border-slate-700 bg-transparent p-0"
                        title="Abrir seletor de cores"
                      />
                      <input
                        type="text"
                        value={customBgColor.toUpperCase()}
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white text-center"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Quick Color Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Paleta Rápida:</span>
                    {[
                      { name: 'Roxo Açaí', hex: '#4c1d95' },
                      { name: 'Vinho', hex: '#831843' },
                      { name: 'Azul Noite', hex: '#0f172a' },
                      { name: 'Azul Royal', hex: '#1e3a8a' },
                      { name: 'Verde Floresta', hex: '#064e3b' },
                      { name: 'Café Dourado', hex: '#78350f' },
                      { name: 'Preto Total', hex: '#09090b' },
                      { name: 'Carmim', hex: '#991b1b' },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setCustomBgColor(c.hex)}
                        className={`w-6 h-6 rounded-full border transition cursor-pointer shrink-0 ${
                          customBgColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'ring-2 ring-white scale-110 border-white'
                            : 'border-slate-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields: Content */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Dados e Informações da Oferta
            </h3>

            {/* Offer Badge Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                Selo de Destaque
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {badgePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOfferBadge(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                      offerBadge === preset
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={offerBadge}
                onChange={e => setOfferBadge(e.target.value)}
                placeholder="Ex: 🔥 OFERTA DO DIA"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-hidden focus:border-orange-500"
              />
            </div>

            {/* Offer Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Título da Oferta / Nome do Prato
              </label>
              <input
                type="text"
                value={offerTitle}
                onChange={e => setOfferTitle(e.target.value)}
                placeholder="Ex: COMBO BURGER DUPLO BACON"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-black focus:outline-hidden focus:border-orange-500"
              />
            </div>

            {/* Image Selector / Upload */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Foto do Prato / Imagem da Oferta
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="URL da imagem (ex: https://...)"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-orange-500 font-mono truncate"
                />
                <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0 transition">
                  <Upload size={14} />
                  <span>Enviar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Preço Original (De:) <span className="text-slate-500 font-normal">Opcional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                  <input
                    type="text"
                    value={originalPrice}
                    onChange={e => setOriginalPrice(e.target.value)}
                    placeholder="39.90"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-bold font-mono focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-400 uppercase mb-1">
                  Preço Promocional (Por:)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-xs font-bold">R$</span>
                  <input
                    type="text"
                    value={promoPrice}
                    onChange={e => setPromoPrice(e.target.value)}
                    placeholder="28.90"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/50 text-emerald-400 text-sm font-black font-mono focus:outline-hidden focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Description & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Descrição / Acompanhamentos
                </label>
                <input
                  type="text"
                  value={offerDescription}
                  onChange={e => setOfferDescription(e.target.value)}
                  placeholder="Ex: Acompanha Batata Frita + Refri Lata!"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Validade / Condição
                </label>
                <input
                  type="text"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  placeholder="Ex: Válido hoje até as 23h"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-orange-500"
                />
              </div>
            </div>

            {/* CTA Button Text on image */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Chamada de Ação (CTA) do Encarte
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                placeholder="Ex: Peça pelo link do Cardápio Digital!"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-hidden focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Visual Preview & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={15} className="text-orange-400" />
                Pré-visualização do Encarte
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                {format === 'story' ? '1080 x 1920 (Status)' : '1080 x 1080 (Feed)'}
              </span>
            </div>

            {/* Visual Canvas Image Preview */}
            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 flex items-center justify-center min-h-[380px] overflow-hidden">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Pré-visualização do Encarte"
                  className={`rounded-xl shadow-2xl object-contain max-h-[460px] border border-slate-800/80 ${
                    format === 'story' ? 'aspect-9/16' : 'aspect-square'
                  }`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 text-xs py-12 gap-2">
                  <RefreshCw size={24} className="animate-spin text-orange-400" />
                  <span>Gerando imagem em alta resolução...</span>
                </div>
              )}
            </div>

            {/* Action Buttons: Download & Copy Image */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download size={16} />
                <span>Baixar Imagem</span>
              </button>

              <button
                type="button"
                onClick={handleCopyImage}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isCopiedImage ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-emerald-400">Imagem Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copiar Imagem</span>
                  </>
                )}
              </button>
            </div>

            {/* Editable Caption Section with 1-Click Copy & WhatsApp */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle size={13} className="text-emerald-400" />
                  Texto da Legenda / Copy (Editável)
                </label>
                <div className="flex items-center gap-2">
                  {isCaptionManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditableCaption(generatedCaption);
                        setIsCaptionManuallyEdited(false);
                      }}
                      className="text-[10px] font-medium text-slate-400 hover:text-amber-400 transition cursor-pointer underline"
                      title="Voltar ao texto automático"
                    >
                      Restaurar padrão
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer transition"
                  >
                    {isCopiedText ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={6}
                  value={editableCaption}
                  onChange={(e) => {
                    setEditableCaption(e.target.value);
                    setIsCaptionManuallyEdited(true);
                  }}
                  placeholder="Escreva ou edite a legenda para suas postagens..."
                  className="w-full p-3 bg-slate-950 rounded-xl border border-slate-700/80 hover:border-slate-600 focus:border-orange-500 text-[11px] text-slate-200 font-mono leading-relaxed focus:outline-hidden transition"
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded pointer-events-none">
                  ✏️ Editável
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {isCopiedText ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{isCopiedText ? 'Texto Copiado!' : 'Copiar Legenda'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 size={14} />
                  <span>Postar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
