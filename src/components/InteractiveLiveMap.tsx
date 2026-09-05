import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Navigation, MapPin, Store as StoreIcon, ExternalLink, Plus, Minus, Compass } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface InteractiveLiveMapProps {
  storeCoords?: Coordinates;
  customerCoords?: Coordinates;
  driverCoords?: Coordinates;
  storeName?: string;
  customerAddress?: string;
  driverName?: string;
  orderStatus?: string;
  height?: string;
}

// Convert lat/lng to tile coordinates at given zoom level
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

// Calculate distance in kilometers using Haversine formula
export function calculateDistanceKm(c1: Coordinates, c2: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function InteractiveLiveMap({
  storeCoords = { lat: -23.5615, lng: -46.656 },
  customerCoords = { lat: -23.5535, lng: -46.662 },
  driverCoords,
  storeName = 'Restaurante',
  customerAddress,
  driverName = 'Entregador em trânsito',
  orderStatus = 'delivering',
  height = '340px'
}: InteractiveLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(14);
  const [center, setCenter] = useState<Coordinates>(() => {
    // Center between store and customer or driver
    const target = driverCoords || customerCoords;
    return {
      lat: (storeCoords.lat + target.lat) / 2,
      lng: (storeCoords.lng + target.lng) / 2
    };
  });

  // Calculate distances and ETA
  const remainingDistanceKm = useMemo(() => {
    const from = driverCoords || storeCoords;
    return calculateDistanceKm(from, customerCoords);
  }, [driverCoords, storeCoords, customerCoords]);

  const etaMinutes = useMemo(() => {
    // Average urban motorcycle speed: ~25 km/h + 3 min buffer
    const minutes = Math.ceil((remainingDistanceKm / 25) * 60) + 3;
    return Math.max(3, minutes);
  }, [remainingDistanceKm]);

  // Recenter when driver moves significantly or on mount
  useEffect(() => {
    const target = driverCoords || customerCoords;
    setCenter({
      lat: (storeCoords.lat + target.lat) / 2,
      lng: (storeCoords.lng + target.lng) / 2
    });
  }, [storeCoords.lat, storeCoords.lng, customerCoords.lat, customerCoords.lng, driverCoords?.lat, driverCoords?.lng]);

  // Project lat/lng to container pixel coordinates relative to center
  const projectToPixels = (coords: Coordinates, width: number, h: number) => {
    const scale = (256 * Math.pow(2, zoom)) / (2 * Math.PI);
    const centerLatRad = (center.lat * Math.PI) / 180;
    const targetLatRad = (coords.lat * Math.PI) / 180;

    const x = width / 2 + (coords.lng - center.lng) * ((Math.PI / 180) * scale);
    const y =
      h / 2 -
      (Math.log(Math.tan(Math.PI / 4 + targetLatRad / 2)) -
        Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2))) *
        scale;

    return { x, y };
  };

  const [dims, setDims] = useState({ w: 500, h: 340 });

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.clientWidth || 500,
          h: containerRef.current.clientHeight || 340
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const storePx = projectToPixels(storeCoords, dims.w, dims.h);
  const custPx = projectToPixels(customerCoords, dims.w, dims.h);
  const driverPx = driverCoords ? projectToPixels(driverCoords, dims.w, dims.h) : null;

  // Open in official Google Maps Directions
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${storeCoords.lat},${storeCoords.lng}&destination=${customerCoords.lat},${customerCoords.lng}`;
  const customerDirectMapUrl = `https://www.google.com/maps?q=${customerCoords.lat},${customerCoords.lng}`;

  // Get visible tiles
  const tiles = useMemo(() => {
    const centerTile = latLngToTile(center.lat, center.lng, zoom);
    const tileList = [];
    const span = 2; // load nearby 5x5 tile grid
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        tileList.push({
          x: centerTile.x + dx,
          y: centerTile.y + dy,
          z: zoom,
          key: `${zoom}/${centerTile.x + dx}/${centerTile.y + dy}`
        });
      }
    }
    return tileList;
  }, [center.lat, center.lng, zoom]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner select-none"
    >
      {/* Tile Background Layer (OpenStreetMap) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-90">
        <div className="absolute inset-0 bg-[#e8ecef]" />
        {/* Subtle grid lines for stylized modern map backdrop */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #e2e8f0 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 20px 20px'
          }}
        />
      </div>

      {/* SVG Vector Route Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Route Connecting Line */}
        {driverPx ? (
          <>
            {/* Store to Driver (already completed path) */}
            <path
              d={`M ${storePx.x} ${storePx.y} L ${driverPx.x} ${driverPx.y}`}
              stroke="#94a3b8"
              strokeWidth="4"
              strokeDasharray="6 4"
              fill="none"
              opacity="0.7"
            />
            {/* Driver to Customer (active remaining path) */}
            <path
              d={`M ${driverPx.x} ${driverPx.y} L ${custPx.x} ${custPx.y}`}
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              filter="url(#glow)"
            />
          </>
        ) : (
          <path
            d={`M ${storePx.x} ${storePx.y} L ${custPx.x} ${custPx.y}`}
            stroke="url(#routeGradient)"
            strokeWidth="5"
            strokeDasharray="8 6"
            strokeLinecap="round"
            fill="none"
            filter="url(#glow)"
          />
        )}
      </svg>

      {/* Store Marker */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-full transition-all duration-300 pointer-events-auto group cursor-pointer"
        style={{ left: `${storePx.x}px`, top: `${storePx.y}px` }}
        title={storeName}
      >
        <div className="flex flex-col items-center">
          <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap mb-1 flex items-center gap-1 border border-slate-700">
            <StoreIcon size={10} className="text-amber-400" />
            <span>{storeName}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center shadow-lg border-2 border-white">
            <StoreIcon size={16} />
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
        </div>
      </div>

      {/* Customer Marker (Destination) */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-full transition-all duration-300 pointer-events-auto group cursor-pointer"
        style={{ left: `${custPx.x}px`, top: `${custPx.y}px` }}
        title={customerAddress || 'Local de Entrega'}
      >
        <div className="flex flex-col items-center">
          <div className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap mb-1 flex items-center gap-1 border border-emerald-500 animate-bounce">
            <MapPin size={10} className="fill-white" />
            <span>Seu Endereço</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-emerald-400/30">
            <MapPin size={16} />
          </div>
          <div className="w-2 h-2 bg-emerald-600 rotate-45 -mt-1" />
        </div>
      </div>

      {/* Motoboy / Delivery Driver Marker */}
      {driverPx && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 pointer-events-auto z-20"
          style={{ left: `${driverPx.x}px`, top: `${driverPx.y}px` }}
        >
          <div className="relative flex flex-col items-center">
            {/* Pulse Wave Animation */}
            <div className="absolute w-14 h-14 -top-2 rounded-full bg-orange-500/25 animate-ping" />
            <div className="absolute w-10 h-10 top-0 rounded-full bg-orange-500/40 animate-pulse" />

            {/* Motoboy Avatar/Badge */}
            <div className="relative bg-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap -top-7 border border-orange-400 flex items-center gap-1">
              <span>🛵 {driverName}</span>
            </div>

            <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white ring-2 ring-orange-400/50">
              <span className="text-lg">🛵</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Info Bar: Distance & ETA */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-2.5 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">
              {orderStatus === 'delivering' ? 'Motoboy a Caminho' : 'Rota de Entrega'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-slate-800">
                {remainingDistanceKm < 1
                  ? `${Math.round(remainingDistanceKm * 1000)} metros`
                  : `${remainingDistanceKm.toFixed(1)} km`}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-orange-600">
                Aprox. {etaMinutes} min
              </span>
            </div>
          </div>
        </div>

        {/* Action button: Open direct in Google Maps */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 transition pointer-events-auto cursor-pointer"
          title="Abrir no Google Maps"
        >
          <Navigation size={13} className="text-blue-600" />
          <span className="hidden sm:inline">Ver no Google Maps</span>
          <ExternalLink size={11} className="text-slate-400" />
        </a>
      </div>

      {/* Bottom Zoom & Recenter Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => setZoom(z => Math.min(18, z + 1))}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200 flex items-center justify-center transition cursor-pointer"
          title="Aumentar Zoom"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(11, z - 1))}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200 flex items-center justify-center transition cursor-pointer"
          title="Diminuir Zoom"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            const target = driverCoords || customerCoords;
            setCenter({
              lat: (storeCoords.lat + target.lat) / 2,
              lng: (storeCoords.lng + target.lng) / 2
            });
            setZoom(14);
          }}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200 flex items-center justify-center transition cursor-pointer"
          title="Centralizar Rota"
        >
          <Compass size={14} />
        </button>
      </div>

      {/* Bottom Left GPS Link Info */}
      <div className="absolute bottom-3 left-3 pointer-events-auto">
        <a
          href={customerDirectMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-500 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-md shadow-xs border border-slate-200 hover:text-blue-600 flex items-center gap-1"
        >
          <MapPin size={10} className="text-emerald-600" />
          <span>Localização Exata do Cliente</span>
          <ExternalLink size={8} />
        </a>
      </div>
    </div>
  );
}
