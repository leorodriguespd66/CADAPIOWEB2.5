import React, { useState } from 'react';
import { Download, Smartphone, Monitor, Share, PlusSquare, CheckCircle, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'hero' | 'floating' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already installed and running in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowGuideModal(true);
      return;
    }

    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      } else if (outcome === 'manual_guide') {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Variant: Navbar button */}
      {variant === 'navbar' && (
        <button
          onClick={handleInstallClick}
          id="btn-pwa-install-navbar"
          className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer active:scale-95 ${className}`}
          title="Instalar aplicativo no celular ou computador"
        >
          <Download size={14} className="text-orange-400 shrink-0" />
          <span>Instalar App</span>
        </button>
      )}

      {/* Variant: Hero banner button */}
      {variant === 'hero' && (
        <button
          onClick={handleInstallClick}
          id="btn-pwa-install-hero"
          className={`w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl shadow-md text-xs sm:text-sm text-center transition cursor-pointer flex items-center justify-center gap-2 ${className}`}
        >
          <Download size={18} className="text-orange-400" />
          <span>Instalar no Celular ou PC</span>
        </button>
      )}

      {/* Variant: Card button inside menus */}
      {variant === 'card' && (
        <button
          onClick={handleInstallClick}
          id="btn-pwa-install-card"
          className={`w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 ${className}`}
        >
          <Download size={14} className="text-orange-400" />
          <span>Instalar Cardápio no Celular / PC</span>
        </button>
      )}

      {/* Variant: Floating pill on bottom */}
      {variant === 'floating' && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={handleInstallClick}
            id="btn-pwa-install-floating"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-xl border border-slate-700/50 cursor-pointer active:scale-95 transition"
          >
            <Download size={15} className="text-orange-400 animate-bounce" />
            <span>Instalar App</span>
          </button>
        </div>
      )}

      {/* Success Notification Toast */}
      {installSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle size={20} />
          <div>
            <p className="font-bold text-xs">Aplicativo Instalado com Sucesso!</p>
            <p className="text-[11px] opacity-90">Você já pode abrir o Cardápio Web direto da sua área de trabalho ou tela de início.</p>
          </div>
        </div>
      )}

      {/* Installation Guide Modal (for iOS or Desktop browsers needing instructions) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Fechar"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <Download size={24} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Instalar Cardápio Web
                </h3>
                <p className="text-xs text-slate-500">
                  Acesse instantaneamente sem precisar digitar o link
                </p>
              </div>
            </div>

            {isIOS ? (
              /* iOS Safari Guide */
              <div className="space-y-3.5 my-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-slate-700 text-xs">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone size={16} className="text-orange-500" />
                  <span>Como instalar no iPhone ou iPad:</span>
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <p className="leading-snug">
                    No Safari, toque no botão <strong>Compartilhar</strong> (<Share size={13} className="inline mx-0.5 text-blue-600" /> na barra inferior).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <p className="leading-snug">
                    Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> (<PlusSquare size={13} className="inline mx-0.5 text-slate-700" />).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                  <p className="leading-snug">
                    Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! O ícone ficará disponível no seu celular.
                  </p>
                </div>
              </div>
            ) : (
              /* Android / Desktop Chrome & Edge Guide */
              <div className="space-y-3.5 my-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-slate-700 text-xs">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Monitor size={16} className="text-orange-500" />
                  <span>Como instalar no Celular ou Computador:</span>
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <p className="leading-snug">
                    <strong>No Computador (Chrome/Edge):</strong> Clique no ícone de <strong>Instalar</strong> que aparece à direita na barra de endereços do navegador (ou vá em Menu ⋮ &gt; "Instalar aplicativo").
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <p className="leading-snug">
                    <strong>No Celular Android:</strong> Abra pelo Google Chrome, toque nos 3 pontinhos ⋮ no topo e escolha <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition cursor-pointer text-center"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
