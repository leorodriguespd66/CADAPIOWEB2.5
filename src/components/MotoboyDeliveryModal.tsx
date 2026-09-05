import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X, Navigation, MapPin, Phone, CheckCircle2, Play, Pause,
  Compass, Radio, ExternalLink, ArrowRight, Store as StoreIcon
} from 'lucide-react';
import { Order, Store } from '../types';
import InteractiveLiveMap, { calculateDistanceKm } from './InteractiveLiveMap';

interface MotoboyDeliveryModalProps {
  order: Order;
  store: Store;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: Order) => void;
}

export default function MotoboyDeliveryModal({
  order,
  store,
  onClose,
  onUpdateOrder
}: MotoboyDeliveryModalProps) {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [isBroadcastingGps, setIsBroadcastingGps] = useState(false);
  const [isSimulatingRoute, setIsSimulatingRoute] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);

  // Store & Customer geographic coordinates
  const storeCoords = {
    lat: store.latitude || -23.5615,
    lng: store.longitude || -46.6560
  };

  const customerCoords = currentOrder.customerCoordinates || {
    lat: -23.5535,
    lng: -46.6620
  };

  // Driver coordinates
  const driverCoords = currentOrder.driverCoordinates || {
    lat: storeCoords.lat,
    lng: storeCoords.lng
  };

  // Update order helper
  const updateDriverPosition = (lat: number, lng: number) => {
    const updated: Order = {
      ...currentOrder,
      driverCoordinates: {
        lat,
        lng,
        updatedAt: new Date().toISOString()
      },
      status: currentOrder.status === 'pending' || currentOrder.status === 'preparing'
        ? 'delivering'
        : currentOrder.status
    };

    setCurrentOrder(updated);
    onUpdateOrder(updated);

    // Save to localStorage & notify other tabs/components
    try {
      const raw = localStorage.getItem('cardapio_orders');
      if (raw) {
        const all: Order[] = JSON.parse(raw);
        const mapped = all.map(o => o.id === updated.id ? updated : o);
        localStorage.setItem('cardapio_orders', JSON.stringify(mapped));
        window.dispatchEvent(new Event('order_updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Real GPS watchPosition
  useEffect(() => {
    if (isBroadcastingGps) {
      if (!('geolocation' in navigator)) {
        alert('Geolocalização não é suportada neste navegador.');
        setIsBroadcastingGps(false);
        return;
      }

      watchPositionIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          updateDriverPosition(pos.coords.latitude, pos.coords.longitude);
        },
        err => {
          console.warn('Geolocation watch error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    } else {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
    }

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }
    };
  }, [isBroadcastingGps]);

  // Route Simulation (Smooth Demo of Motoboy advancing towards customer)
  useEffect(() => {
    if (isSimulatingRoute) {
      const steps = 20;
      let currentStep = Math.floor(simulationProgress * steps);

      simulationIntervalRef.current = setInterval(() => {
        currentStep++;
        const prog = Math.min(1, currentStep / steps);
        setSimulationProgress(prog);

        // Interpolate position between store and customer
        const currentLat = storeCoords.lat + (customerCoords.lat - storeCoords.lat) * prog;
        const currentLng = storeCoords.lng + (customerCoords.lng - storeCoords.lng) * prog;

        updateDriverPosition(currentLat, currentLng);

        if (prog >= 1) {
          setIsSimulatingRoute(false);
          if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        }
      }, 1200);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    }

    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, [isSimulatingRoute]);

  const handleMarkAsDelivered = () => {
    const updated: Order = {
      ...currentOrder,
      status: 'completed'
    };
    setCurrentOrder(updated);
    onUpdateOrder(updated);

    try {
      const raw = localStorage.getItem('cardapio_orders');
      if (raw) {
        const all: Order[] = JSON.parse(raw);
        const mapped = all.map(o => o.id === updated.id ? updated : o);
        localStorage.setItem('cardapio_orders', JSON.stringify(mapped));
        window.dispatchEvent(new Event('order_updated'));
      }
    } catch (e) {
      console.error(e);
    }

    alert(`Pedido ${currentOrder.code} marcado como entregue!`);
    onClose();
  };

  const remainingDist = calculateDistanceKm(driverCoords, customerCoords);

  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${customerCoords.lat},${customerCoords.lng}`;
  const wazeNavUrl = `https://waze.com/ul?ll=${customerCoords.lat},${customerCoords.lng}&navigate=yes`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-4 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-black text-2xl border border-white/20">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">Painel de Rota do Motoboy</h3>
                <span className="bg-white/20 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-md">
                  {currentOrder.code}
                </span>
              </div>
              <p className="text-xs text-orange-100 mt-0.5">
                Localização em tempo real do entregador e do cliente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Customer Location & Address Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <MapPin className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Destino do Cliente</span>
                  <h4 className="font-bold text-sm text-slate-900">{currentOrder.customerName}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {currentOrder.addressStreet
                      ? `${currentOrder.addressStreet}, ${currentOrder.addressNumber || 'S/N'} - ${currentOrder.addressNeighborhood || ''}`
                      : 'Endereço registrado via GPS'}
                  </p>
                  {currentOrder.addressComplement && (
                    <span className="text-[11px] text-slate-500 italic block">
                      Comp: {currentOrder.addressComplement}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${currentOrder.customerPhone}`}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Phone size={13} className="text-emerald-600" />
                  <span>Ligar</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${currentOrder.customerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Direct Navigation Buttons (Google Maps & Waze) */}
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Navigation size={15} />
                <span>Navegar no Google Maps</span>
                <ExternalLink size={12} />
              </a>

              <a
                href={wazeNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Compass size={15} />
                <span>Navegar via Waze</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Interactive Live Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Radio size={14} className="text-orange-500 animate-pulse" />
                <span>Mapa ao Vivo: Posição do Motoboy e do Cliente</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Distância Restante: {remainingDist < 1 ? `${Math.round(remainingDist * 1000)}m` : `${remainingDist.toFixed(1)} km`}
              </span>
            </div>

            <InteractiveLiveMap
              storeCoords={storeCoords}
              customerCoords={customerCoords}
              driverCoords={driverCoords}
              storeName={store.name}
              customerAddress={currentOrder.addressStreet}
              driverName="Você (Motoboy)"
              orderStatus="delivering"
              height="300px"
            />
          </div>

          {/* Real-time GPS & Simulation Control Bar */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-amber-950 block">
                  📡 Transmissão de Localização ao Vivo para o Cliente
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Ao ativar, as coordenadas do entregador são atualizadas e o cliente vê o motoboy se movendo no mapa.
                </p>
              </div>

              {/* Real GPS Toggle */}
              <button
                type="button"
                onClick={() => setIsBroadcastingGps(!isBroadcastingGps)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  isBroadcastingGps
                    ? 'bg-emerald-600 text-white shadow-md animate-pulse'
                    : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Radio size={14} />
                <span>{isBroadcastingGps ? 'GPS Ativo Transmitindo' : 'Ligar GPS do Celular'}</span>
              </button>
            </div>

            {/* Test Simulation Button */}
            <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimulatingRoute(!isSimulatingRoute)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSimulatingRoute
                      ? 'bg-orange-500 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  {isSimulatingRoute ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isSimulatingRoute ? 'Pausar Simulação' : '🎮 Simular Trajeto do Motoboy (Demo)'}</span>
                </button>
                {simulationProgress > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSimulatingRoute(false);
                      setSimulationProgress(0);
                      updateDriverPosition(storeCoords.lat, storeCoords.lng);
                    }}
                    className="text-[10px] text-slate-500 hover:underline cursor-pointer"
                  >
                    Resetar
                  </button>
                )}
              </div>

              <span className="text-[11px] text-amber-900 font-mono font-semibold">
                Progresso: {Math.round(simulationProgress * 100)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-amber-200/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-orange-500 h-full transition-all duration-300"
                style={{ width: `${Math.round(simulationProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Fechar
          </button>

          <button
            onClick={handleMarkAsDelivered}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>Confirmar Entrega Concluída</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
