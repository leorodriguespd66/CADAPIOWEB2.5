import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, Star, Send, Phone
} from 'lucide-react';
import { Order, Store } from '../types';

interface LiveOrderTrackingModalProps {
  order: Order;
  store: Store;
  onClose: () => void;
  onRateOrder?: (orderId: string, storeRating: number, orderRating: number, feedback?: string) => void;
}

export default function LiveOrderTrackingModal({
  order,
  store,
  onClose,
  onRateOrder
}: LiveOrderTrackingModalProps) {
  // Order state
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  // Sync state if prop updates or if updated in localStorage
  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const rawOrders = localStorage.getItem('cardapio_orders');
        if (rawOrders) {
          const parsed: Order[] = JSON.parse(rawOrders);
          const found = parsed.find(o => o.id === order.id || o.code === order.code);
          if (found) {
            setCurrentOrder(found);
          }
        }
      } catch (err) {
        console.error('Error syncing order:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('order_updated', handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('order_updated', handleStorageChange);
      clearInterval(interval);
    };
  }, [order.id, order.code]);

  // Rating State
  const [storeStars, setStoreStars] = useState<number>(order.storeRating || 5);
  const [hoverStoreStars, setHoverStoreStars] = useState<number>(0);

  const [orderStars, setOrderStars] = useState<number>(order.orderRating || 5);
  const [hoverOrderStars, setHoverOrderStars] = useState<number>(0);

  const [feedbackText, setFeedbackText] = useState<string>(order.ratingFeedback || '');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(Boolean(order.storeRating || order.orderRating));

  const storeRatingLabels = [
    '',
    'Muito Insatisfeito',
    'Poderia Melhorar',
    'Bom Atendimento',
    'Muito Bom!',
    'Excelente Atendimento! 🌟'
  ];

  const orderRatingLabels = [
    '',
    'Abaixo do Esperado',
    'Regular',
    'Gostoso',
    'Muito Saboroso!',
    'Perfeito e Delicioso! 🍕'
  ];

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRating(true);

    setTimeout(() => {
      if (onRateOrder) {
        onRateOrder(currentOrder.id, storeStars, orderStars, feedbackText);
      }

      // Also persist to current order
      setCurrentOrder(prev => ({
        ...prev,
        storeRating: storeStars,
        orderRating: orderStars,
        ratingFeedback: feedbackText,
        ratedAt: new Date().toISOString()
      }));

      setIsSubmittingRating(false);
      setRatingSuccess(true);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-4 max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between relative shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shadow-xs">
              <Star size={22} className="fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">Avaliação do Pedido</h3>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold px-2 py-0.5 rounded-md">
                  {currentOrder.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {store.name} • {currentOrder.items.length} {currentOrder.items.length === 1 ? 'item' : 'itens'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Focus 100% on Rating */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Star size={16} className="fill-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Avalie sua Experiência
                </h4>
                <span className="text-[11px] text-amber-900/80">
                  Sua opinião é fundamental para aprimorar nosso atendimento!
                </span>
              </div>
            </div>

            {ratingSuccess ? (
              <div className="bg-white rounded-xl p-5 border border-amber-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl font-black">
                  ✓
                </div>
                <h5 className="font-extrabold text-slate-900 text-base">Avaliação Registrada com Sucesso!</h5>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Muito obrigado pela avaliação! Suas notas ajudam o restaurante <strong>{store.name}</strong> a oferecer sempre a melhor qualidade e carinho.
                </p>
                <div className="flex justify-center gap-6 pt-3 text-xs">
                  <div className="bg-amber-50/80 px-4 py-2 rounded-xl border border-amber-200/60">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Estabelecimento</span>
                    <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-sm mt-0.5">
                      <Star size={15} className="fill-amber-400" />
                      <span>{storeStars}.0</span>
                    </div>
                  </div>
                  <div className="bg-amber-50/80 px-4 py-2 rounded-xl border border-amber-200/60">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Produtos do Pedido</span>
                    <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-sm mt-0.5">
                      <Star size={15} className="fill-amber-400" />
                      <span>{orderStars}.0</span>
                    </div>
                  </div>
                </div>
                {feedbackText && (
                  <p className="text-xs text-slate-600 italic mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{feedbackText}"
                  </p>
                )}
                <div className="pt-2">
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    Fechar e Voltar ao Cardápio
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitRating} className="space-y-4">
                {/* 1. Nota para o Estabelecimento */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    1. Como você avalia o Estabelecimento ({store.name})?
                  </label>
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    {[1, 2, 3, 4, 5].map(star => {
                      const active = star <= (hoverStoreStars || storeStars);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setStoreStars(star)}
                          onMouseEnter={() => setHoverStoreStars(star)}
                          onMouseLeave={() => setHoverStoreStars(0)}
                          className="p-1 text-slate-300 hover:scale-115 transition cursor-pointer focus:outline-hidden"
                          title={`${star} estrelas`}
                        >
                          <Star
                            size={26}
                            className={active ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold text-amber-700 ml-2">
                      {storeRatingLabels[hoverStoreStars || storeStars]}
                    </span>
                  </div>
                </div>

                {/* 2. Nota para os Produtos */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    2. O que achou dos pratos/produtos do seu pedido?
                  </label>
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    {[1, 2, 3, 4, 5].map(star => {
                      const active = star <= (hoverOrderStars || orderStars);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setOrderStars(star)}
                          onMouseEnter={() => setHoverOrderStars(star)}
                          onMouseLeave={() => setHoverOrderStars(0)}
                          className="p-1 text-slate-300 hover:scale-115 transition cursor-pointer focus:outline-hidden"
                          title={`${star} estrelas`}
                        >
                          <Star
                            size={26}
                            className={active ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold text-amber-700 ml-2">
                      {orderRatingLabels[hoverOrderStars || orderStars]}
                    </span>
                  </div>
                </div>

                {/* Feedback Comment */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Elogios ou comentários para o restaurante (opcional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Conte como foi sua experiência, o que mais gostou, sabor, pontualidade..."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-xl border border-amber-200 text-xs focus:ring-2 focus:ring-amber-300 focus:outline-hidden text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Send size={15} />
                  <span>{isSubmittingRating ? 'Enviando...' : 'Enviar Avaliação do Pedido'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Order Summary Items */}
          <div className="border-t border-slate-100 pt-3">
            <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              Itens do Pedido ({currentOrder.items.length} itens)
            </h5>
            <div className="space-y-1.5 text-xs text-slate-700">
              {currentOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="font-bold text-slate-800">{it.quantity}x {it.productName}</span>
                    {it.choicesText && (
                      <span className="block text-[10px] text-slate-400">{it.choicesText.join(', ')}</span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">R$ {it.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-900">
              <span>Total Pago ({currentOrder.paymentMethod.toUpperCase()})</span>
              <span className="font-mono text-sm text-emerald-600">R$ {currentOrder.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <a
            href={`https://api.whatsapp.com/send?phone=${store.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5"
          >
            <Phone size={14} className="text-emerald-600" />
            <span>Falar com o Restaurante</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            Continuar no Cardápio
          </button>
        </div>
      </motion.div>
    </div>
  );
}
