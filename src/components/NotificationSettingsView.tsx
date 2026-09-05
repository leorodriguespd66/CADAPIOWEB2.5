import React, { useState } from 'react';
import { Bot, Save, Sparkles, MessageSquare, Check, RotateCcw, Send, HelpCircle } from 'lucide-react';
import { Store, StoreNotificationSettings } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../initialData';

interface NotificationSettingsViewProps {
  store: Store;
  onUpdateStore: (updatedStore: Store) => void;
  onShowToast: (msg: string) => void;
}

export default function NotificationSettingsView({
  store,
  onUpdateStore,
  onShowToast
}: NotificationSettingsViewProps) {
  const initialSettings = store.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

  const [settings, setSettings] = useState<StoreNotificationSettings>({
    acceptedMessage: initialSettings.acceptedMessage,
    deliveryMessage: initialSettings.deliveryMessage,
    completedMessage: initialSettings.completedMessage || DEFAULT_NOTIFICATION_SETTINGS.completedMessage || '',
    cancelledMessage: initialSettings.cancelledMessage || DEFAULT_NOTIFICATION_SETTINGS.cancelledMessage || '',
    estimatedDeliveryTime: initialSettings.estimatedDeliveryTime || '30 a 45 min'
  });

  const [activePreviewTab, setActivePreviewTab] = useState<'accepted' | 'delivery' | 'completed' | 'cancelled'>('accepted');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedStore: Store = {
      ...store,
      notificationSettings: settings
    };
    onUpdateStore(updatedStore);
    onShowToast('Configurações do Bot de Notificações salvas com sucesso!');
  };

  const handleRestoreDefaults = () => {
    if (confirm('Deseja restaurar as mensagens padrão recomendadas?')) {
      setSettings(DEFAULT_NOTIFICATION_SETTINGS);
      onShowToast('Mensagens padrão restauradas!');
    }
  };

  // Preview formatted text
  const previewFormattedText = () => {
    let rawText = settings.acceptedMessage;
    if (activePreviewTab === 'delivery') rawText = settings.deliveryMessage;
    if (activePreviewTab === 'completed') rawText = settings.completedMessage || '';
    if (activePreviewTab === 'cancelled') rawText = settings.cancelledMessage || '';

    return rawText
      .replace(/{cliente}/g, 'Lucas Ferreira')
      .replace(/{pedido}/g, '#1001')
      .replace(/{tempo}/g, settings.estimatedDeliveryTime)
      .replace(/{total}/g, '75.80')
      .replace(/{endereco}/g, 'Rua Augusta, 1200 - Consolação')
      .replace(/{motivo}/g, 'Ingredientes esgotados no momento');
  };

  return (
    <div className="space-y-6" id="bot-notification-settings">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Bot de Notificações via WhatsApp</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Ativo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Configure as mensagens automáticas enviadas aos seus clientes quando o pedido for <strong>Aceito</strong>, quando estiver <strong>Saindo para Entrega</strong> e finalizado.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Restaurar Padrão</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Save size={14} />
            <span>Salvar Mensagens</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs (Left Column) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Estimated Delivery Time Field */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              ⏱️ Tempo Estimado de Entrega Padrão
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Este valor substitui a tag <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-orange-600 font-bold">{'{tempo}'}</code> na mensagem de pedido aceito.
            </p>
            <input
              type="text"
              value={settings.estimatedDeliveryTime}
              onChange={e => setSettings({ ...settings, estimatedDeliveryTime: e.target.value })}
              placeholder="Ex: 35 a 50 min"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
            />
          </div>

          {/* 1. Mensagem de Pedido Aceito */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>✅ Mensagem: Pedido Aceito & Em Preparo</span>
              </label>
              <button
                type="button"
                onClick={() => setActivePreviewTab('accepted')}
                className="text-[11px] text-orange-600 font-semibold hover:underline"
              >
                Visualizar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Disparada quando você clica em <strong>Aceitar Pedido</strong> no painel PDV.
            </p>
            <textarea
              rows={5}
              value={settings.acceptedMessage}
              onChange={e => setSettings({ ...settings, acceptedMessage: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* 2. Mensagem de Pedido Saindo para Entrega */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛵 Mensagem: Pedido Saindo para Entrega</span>
              </label>
              <button
                type="button"
                onClick={() => setActivePreviewTab('delivery')}
                className="text-[11px] text-orange-600 font-semibold hover:underline"
              >
                Visualizar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Disparada quando o motoboy/entregador sai com o pedido do cliente.
            </p>
            <textarea
              rows={5}
              value={settings.deliveryMessage}
              onChange={e => setSettings({ ...settings, deliveryMessage: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* 3. Mensagem de Pedido Concluído */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>⭐ Mensagem: Pedido Entregue / Concluído (Opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => setActivePreviewTab('completed')}
                className="text-[11px] text-orange-600 font-semibold hover:underline"
              >
                Visualizar
              </button>
            </div>
            <textarea
              rows={3}
              value={settings.completedMessage}
              onChange={e => setSettings({ ...settings, completedMessage: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* 4. Mensagem de Pedido Recusado */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>❌ Mensagem: Pedido Recusado</span>
              </label>
              <button
                type="button"
                onClick={() => setActivePreviewTab('cancelled')}
                className="text-[11px] text-orange-600 font-semibold hover:underline"
              >
                Visualizar
              </button>
            </div>
            <textarea
              rows={3}
              value={settings.cancelledMessage}
              onChange={e => setSettings({ ...settings, cancelledMessage: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-orange-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>
        </div>

        {/* Live Preview & Tags Guide (Right Column) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Tags Helper Card */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles size={14} className="text-amber-600" />
              <span>Variáveis Automáticas (Tags)</span>
            </h4>
            <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
              Insira estas variáveis no seu texto. Na hora de notificar o cliente, elas serão substituídas automaticamente:
            </p>
            <div className="space-y-2 text-xs font-sans">
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{cliente}'}</code>
                <span className="text-slate-600 text-[11px]">Nome do cliente</span>
              </div>
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{pedido}'}</code>
                <span className="text-slate-600 text-[11px]">Código (ex: #1001)</span>
              </div>
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{tempo}'}</code>
                <span className="text-slate-600 text-[11px]">Tempo de entrega</span>
              </div>
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{total}'}</code>
                <span className="text-slate-600 text-[11px]">Valor total do pedido</span>
              </div>
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{endereco}'}</code>
                <span className="text-slate-600 text-[11px]">Endereço de entrega</span>
              </div>
              <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-amber-200/60">
                <code className="font-mono font-bold text-orange-600 text-xs">{'{motivo}'}</code>
                <span className="text-slate-600 text-[11px]">Motivo do cancelamento</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Simulator Preview */}
          <div className="bg-[#EFEAE2] rounded-3xl p-5 border border-slate-300 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#128C7E] text-white flex items-center justify-center font-bold text-xs">
                  {store.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">{store.name}</div>
                  <div className="text-[10px] text-emerald-700 font-medium">online agora</div>
                </div>
              </div>

              {/* Preview selector */}
              <div className="flex bg-white/80 p-0.5 rounded-lg text-[10px]">
                <button
                  onClick={() => setActivePreviewTab('accepted')}
                  className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                    activePreviewTab === 'accepted' ? 'bg-[#128C7E] text-white' : 'text-slate-600'
                  }`}
                >
                  Aceito
                </button>
                <button
                  onClick={() => setActivePreviewTab('delivery')}
                  className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                    activePreviewTab === 'delivery' ? 'bg-[#128C7E] text-white' : 'text-slate-600'
                  }`}
                >
                  Entrega
                </button>
              </div>
            </div>

            {/* Chat Bubble */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl rounded-tl-none p-3.5 shadow-xs max-w-[90%] text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {previewFormattedText()}
                <div className="text-[9px] text-slate-400 text-right mt-1.5">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/10 text-center">
              <span className="text-[10px] text-slate-600 font-medium">
                Simulação da mensagem enviada no WhatsApp do cliente
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
