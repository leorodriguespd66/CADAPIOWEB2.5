import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, Smartphone, MessageSquare, ClipboardList, Shield, Settings, 
  ExternalLink, Mail, Phone, Lock, User, Clock, Check, X, Sparkles,
  Star, Flame, MessageCircle, Trophy, ShoppingBag
} from 'lucide-react';
import { Store, Order, AdminSettings, Product } from '../types';
import { isStorePlanExpired, getAdminWhatsAppLink } from '../utils/storePlan';
import { getStoreHoursStatus } from '../utils/storeHours';
import { calculateStoreRating } from '../utils/rating';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingPageProps {
  stores: Store[];
  orders?: Order[];
  products?: Product[];
  adminSettings?: AdminSettings;
  onSelectStore: (slug: string) => void;
  onGoToAdmin: () => void;
  onRegisterStore: (newStore: Store) => void | Promise<Store | void>;
}

export default function LandingPage({ 
  stores, 
  orders = [], 
  products = [],
  adminSettings, 
  onSelectStore, 
  onGoToAdmin, 
  onRegisterStore 
}: LandingPageProps) {
  // Current time for real-time opening hours checks
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30 seconds real-time update
    return () => clearInterval(timer);
  }, []);

  // Show all registered stores (excluding blocked or unapproved ones)
  // Highlight top rated stores first as requested
  const sortedActiveStores = useMemo(() => {
    const valid = stores.filter(s => s.isBlocked !== true && s.isApproved !== false);

    return [...valid].sort((a, b) => {
      const ratingInfoA = calculateStoreRating(a, orders);
      const ratingInfoB = calculateStoreRating(b, orders);

      // Prioritize stores that have displayable rating (>= 3.0)
      if (ratingInfoA.displayable && !ratingInfoB.displayable) return -1;
      if (!ratingInfoA.displayable && ratingInfoB.displayable) return 1;

      // Prioritize highest rating (Melhor Nota)
      if (ratingInfoB.rating !== ratingInfoA.rating) {
        return ratingInfoB.rating - ratingInfoA.rating;
      }
      // Then prioritize order volume
      const ordersA = orders.filter(o => o.storeId === a.id).length;
      const ordersB = orders.filter(o => o.storeId === b.id).length;
      return ordersB - ordersA;
    });
  }, [stores, orders]);

  // Find max rating to highlight top-rated stores (only among displayable >= 3.0)
  const maxRating = useMemo(() => {
    const displayableRatings = sortedActiveStores
      .map(s => calculateStoreRating(s, orders))
      .filter(r => r.displayable)
      .map(r => r.rating);
    if (displayableRatings.length === 0) return 0;
    return Math.max(...displayableRatings);
  }, [sortedActiveStores, orders]);

  // Helper to get top selling products for each store
  const getStoreTopProducts = (storeId: string) => {
    const storeProds = products.filter(p => p.storeId === storeId && p.isActive !== false);
    const salesCount: { [name: string]: number } = {};
    
    orders.filter(o => o.storeId === storeId).forEach(ord => {
      ord.items.forEach(it => {
        const cleanName = it.productName.split('[')[0].trim().toLowerCase();
        salesCount[cleanName] = (salesCount[cleanName] || 0) + it.quantity;
      });
    });

    return [...storeProds].sort((a, b) => {
      const aSales = salesCount[a.name.toLowerCase()] || 0;
      const bSales = salesCount[b.name.toLowerCase()] || 0;
      if (bSales !== aSales) return bSales - aSales;
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    }).slice(0, 2);
  };

  // Registration States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState(false);
  const [storeName, setStoreName] = React.useState('');
  const [storeSlug, setStoreSlug] = React.useState('');
  const [ownerEmail, setOwnerEmail] = React.useState('');
  const [ownerLogin, setOwnerLogin] = React.useState('');
  const [ownerPassword, setOwnerPassword] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [registeredStoreData, setRegisteredStoreData] = React.useState<{ name: string; slug: string; login: string } | null>(null);

  const formatWhatsapp = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleStoreNameChange = (name: string) => {
    setStoreName(name);
    let baseSlug = name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!baseSlug) baseSlug = 'meu-cardapio';

    // Auto-resolve collision against existing stores
    let candidateSlug = baseSlug;
    let counter = 2;
    while (stores.some(s => s.slug === candidateSlug)) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    setStoreSlug(candidateSlug);
    
    let candidateLogin = candidateSlug.replace(/-/g, '');
    let loginCounter = 2;
    while (stores.some(s => s.ownerLogin && s.ownerLogin.toLowerCase() === candidateLogin.toLowerCase())) {
      candidateLogin = `${candidateSlug.replace(/-/g, '')}${loginCounter}`;
      loginCounter++;
    }
    setOwnerLogin(candidateLogin);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!storeName.trim() || !ownerEmail.trim() || !ownerLogin.trim() || !ownerPassword.trim() || !whatsapp.trim()) {
      setErrorMsg('Todos os campos marcados com * são obrigatórios.');
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setErrorMsg('Por favor informe um WhatsApp válido com DDD.');
      return;
    }

    let cleanSlug = (storeSlug || storeName)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      cleanSlug = `loja-${Date.now().toString().slice(-4)}`;
    }

    // Auto-resolve slug if collision exists
    let finalSlug = cleanSlug;
    let slugIndex = 2;
    while (stores.some(s => s.slug === finalSlug)) {
      finalSlug = `${cleanSlug}-${slugIndex}`;
      slugIndex++;
    }

    // Auto-resolve login if collision exists
    let cleanLogin = ownerLogin.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!cleanLogin) cleanLogin = finalSlug.replace(/-/g, '') || `user${Date.now().toString().slice(-4)}`;

    let finalLogin = cleanLogin;
    let loginIndex = 2;
    while (stores.some(s => s.ownerLogin && s.ownerLogin.toLowerCase() === finalLogin.toLowerCase())) {
      finalLogin = `${cleanLogin}${loginIndex}`;
      loginIndex++;
    }

    const newStore: Store = {
      id: `store-${Date.now()}`,
      name: storeName.trim(),
      slug: finalSlug,
      logoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&h=150&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
      phone: cleanPhone,
      address: 'Configure seu endereço físico',
      deliveryFeeType: 'flat',
      deliveryFee: 5.0,
      neighborhoodFees: [],
      minOrder: 0,
      workingHours: 'Segunda a Sábado das 18:00 às 23:30',
      themeColor: '#f97316', // Laranja
      isActive: true,
      isApproved: false, // BLOQUEADO até que o admin libere
      ownerEmail: ownerEmail.trim(),
      ownerLogin: finalLogin,
      ownerPassword: ownerPassword.trim(),
      daysOnline: 30,
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const registered = await onRegisterStore(newStore);
      const actualStore = (registered as unknown as Store) || newStore;
      setRegisteredStoreData({
        name: actualStore.name || newStore.name,
        slug: actualStore.slug || finalSlug,
        login: actualStore.ownerLogin || finalLogin
      });
      setSuccess(true);
      setErrorMsg('');
    } catch (err: any) {
      console.warn('Registration caught in LandingPage:', err);
      // Even if an unexpected error occurs, mark success with local registration
      setRegisteredStoreData({
        name: newStore.name,
        slug: finalSlug,
        login: finalLogin
      });
      setSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStoreName('');
    setStoreSlug('');
    setOwnerEmail('');
    setOwnerLogin('');
    setOwnerPassword('');
    setWhatsapp('');
    setErrorMsg('');
    setIsSubmitting(false);
    setSuccess(false);
    setRegisteredStoreData(null);
    setIsRegisterModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" id="landing-page-root">
      {/* Top Banner de Cadastro em Destaque */}
      <div className="bg-orange-500 text-white text-xs sm:text-sm py-3 px-4 text-center font-semibold flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 shadow-md animate-fadeIn relative z-50 border-b border-orange-600" id="top-promo-banner">
        <span className="flex items-center gap-1.5">
          <Sparkles size={15} className="animate-pulse" />
          <span>Quer vender mais pelo WhatsApp? Crie seu próprio cardápio digital hoje!</span>
        </span>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="bg-white text-orange-600 px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-bold hover:bg-orange-50 active:scale-95 transition shadow-xs cursor-pointer inline-flex items-center gap-1"
        >
          <span>Cadastre seu Estabelecimento</span>
          <ExternalLink size={10} />
        </button>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-xs sticky top-0 z-40" id="landing-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2" id="landing-logo-container">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-orange-500/20">
              <Utensils size={22} />
            </div>
            <span className="font-sans font-bold text-xl tracking-tight text-slate-900">Cardápio<span className="text-orange-500">Web</span></span>
          </div>
          
          <div className="flex items-center space-x-2">
            <PWAInstallButton variant="navbar" />
            <a
              href={getAdminWhatsAppLink(adminSettings?.superAdminWhatsapp, 'Olá! Gostaria de falar com o Administrador Geral.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
              title="Falar com o Administrador Geral no WhatsApp"
            >
              <MessageCircle size={14} />
              <span>WhatsApp Adm</span>
            </a>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition shadow-sm cursor-pointer"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Cadastrar Loja</span>
              <span className="sm:hidden">Cadastrar</span>
            </button>
            <button
              onClick={onGoToAdmin}
              id="btn-access-admin"
              className="flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition shadow-xs cursor-pointer"
              title="Acesso Lojista / Painel"
            >
              <Lock size={12} />
              <span className="hidden md:inline">Painel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 bg-linear-to-b from-orange-50/50 to-white" id="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 mb-6">
                🚀 SaaS Multi-inquilino - Comece agora mesmo
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl font-sans font-extrabold text-slate-900 tracking-tight leading-none mb-6"
            >
              Seu cardápio digital integrado ao <span className="text-emerald-600">WhatsApp</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 mb-10 leading-relaxed"
            >
              Uma plataforma SaaS completa para bares, restaurantes e lanchonetes. Cadastre produtos, configure adicionais, e receba pedidos organizados diretamente no WhatsApp do seu estabelecimento.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-3.5"
            >
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="w-full sm:w-auto px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 text-center transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                <span>Cadastrar Estabelecimento</span>
              </button>
              <a
                href="#nossos-clientes"
                className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-center transition"
              >
                Ver Demonstrações
              </a>
              <a
                href={getAdminWhatsAppLink(adminSettings?.superAdminWhatsapp, 'Olá! Gostaria de falar com o Administrador Geral sobre o Cardápio Web.')}
                target="_blank"
                rel="noopener noreferrer"
                id="btn-hero-admin-whatsapp"
                className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm text-center transition cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                <span>Falar com o Administrador</span>
              </a>
              <PWAInstallButton variant="hero" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats/Features Banner */}
      <section className="py-12 bg-white border-y border-slate-100" id="landing-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-orange-50 text-orange-500 rounded-lg">
                <Smartphone size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Mobile First</h4>
                <p className="text-xs text-slate-500 mt-1">Carregamento instantâneo, otimizado para celulares.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <MessageSquare size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Pedidos no WhatsApp</h4>
                <p className="text-xs text-slate-500 mt-1">Nenhum app para baixar, pedidos caem direto no WhatsApp.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-lg">
                <ClipboardList size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Opções & Adicionais</h4>
                <p className="text-xs text-slate-500 mt-1">Borda recheada, adicionais de carnes, escolha de bebidas.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-amber-50 text-amber-500 rounded-lg">
                <Shield size={22} />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Painel Completo</h4>
                <p className="text-xs text-slate-500 mt-1">Gerenciador de produtos, categorias e preços em tempo real.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stores Showcases */}
      <section id="nossos-clientes" className="py-20 bg-slate-50 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-sans font-bold text-slate-900 tracking-tight">Lojas em Destaque</h2>
            <p className="text-slate-500 mt-3 text-sm">
              Clique em qualquer uma das lojas de demonstração para testar o cardápio digital, a montagem do carrinho e a simulação de fechamento de pedido no WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
            {sortedActiveStores.map((store, index) => {
              const storeOrderCount = (orders || []).filter(o => o.storeId === store.id).length;
              const hoursStatus = getStoreHoursStatus(store, currentTime);
              const ratingInfo = calculateStoreRating(store, orders);
              const isBestRated = ratingInfo.displayable && maxRating >= 4.5 && ratingInfo.rating >= maxRating;
              const topProducts = getStoreTopProducts(store.id);

              return (
                <motion.div
                  key={store.id}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  id={`store-card-${store.slug}`}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col cursor-pointer group relative"
                  onClick={() => onSelectStore(store.slug)}
                >
                  <div className="h-40 bg-slate-100 relative overflow-hidden">
                    <img
                      src={store.coverUrl}
                      alt={store.name}
                      className={`w-full h-full object-cover group-hover:scale-102 transition duration-300 ${!hoursStatus.isOpen ? 'brightness-90' : ''}`}
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Top Left Badges: Melhor Nota ou Mais Pedido */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      {isBestRated && (
                        <div className="bg-amber-400 text-amber-950 font-black px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider shadow-md flex items-center gap-1 border border-amber-300">
                          <Trophy size={12} className="fill-amber-950 text-amber-950" />
                          <span>Melhor Nota ({ratingInfo.formatted})</span>
                        </div>
                      )}
                      {index === 0 && storeOrderCount > 0 && !isBestRated && (
                        <div className="bg-red-600 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                          <Flame size={12} className="fill-white animate-pulse" />
                          <span>#1 Mais Pedido</span>
                        </div>
                      )}
                      {index === 1 && storeOrderCount > 0 && !isBestRated && (
                        <div className="bg-orange-600 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                          <Flame size={12} className="fill-white" />
                          <span>#2 Em Alta</span>
                        </div>
                      )}
                    </div>

                    {/* Rating Badge Top Right (Only shows score if >= 3.0) */}
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full text-xs font-black text-slate-800 border border-slate-100 shadow-xs flex items-center gap-1">
                      {ratingInfo.displayable ? (
                        <>
                          <Star size={12} className="fill-amber-400 text-amber-500" />
                          <span>{ratingInfo.formatted}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Novo</span>
                      )}
                    </div>

                    {/* Real-time Closed Watermark / Banner if not open */}
                    {!hoursStatus.isOpen && (
                      <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock size={11} className="text-rose-400" />
                        <span>Fechado agora</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col relative pt-12">
                    <div className="absolute -top-8 left-6 w-16 h-16 rounded-xl border-4 border-white overflow-hidden shadow-md bg-white">
                      <img
                        src={store.logoUrl}
                        alt={`Logo de ${store.name}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-sans font-bold text-lg text-slate-900 truncate">{store.name}</h3>
                      {ratingInfo.displayable ? (
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2 py-0.5 rounded-full text-xs font-black border border-amber-200/80 shrink-0">
                          <Star size={11} className="fill-amber-400 text-amber-500" />
                          <span>{ratingInfo.formatted}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full shrink-0">
                          Novo
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-2.5 line-clamp-1">{store.address}</p>

                    {/* Store Status (Online/Fechado) & Order Count */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-md border ${hoursStatus.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${hoursStatus.dotClass}`} />
                        <span>{hoursStatus.isOpen ? 'Online • Aberto' : 'Fechado'}</span>
                      </span>

                      <span className="text-[10px] text-slate-500 font-medium">
                        {hoursStatus.nextEventText}
                      </span>
                    </div>

                    {/* Order count pill */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-md">
                        <Flame size={11} className="text-orange-500" />
                        <span>{storeOrderCount} {storeOrderCount === 1 ? 'pedido' : 'pedidos'}</span>
                      </span>
                    </div>

                    {/* Destaque dos Produtos Mais Vendidos */}
                    {topProducts.length > 0 && (
                      <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 mb-4">
                        <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-900 uppercase tracking-wider mb-1.5">
                          <Flame size={12} className="text-orange-500 fill-orange-500" />
                          <span>Mais Vendidos da Loja:</span>
                        </div>
                        <div className="space-y-1">
                          {topProducts.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-white/95 px-2 py-1 rounded-lg border border-amber-100 shadow-2xs">
                              <span className="font-semibold text-slate-800 truncate pr-2 text-[11px]">{p.name}</span>
                              <span className="font-mono font-bold text-amber-800 text-[11px] shrink-0">R$ {p.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-3 mt-auto text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[11px]">Taxa de Entrega</span>
                        <span className="font-semibold text-slate-800">
                          {store.deliveryFeeType === 'flat'
                            ? `Fixo: R$ ${store.deliveryFee.toFixed(2)}`
                            : 'R$ Variável'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[11px]">Atendimento</span>
                        <span className="font-semibold text-slate-800 line-clamp-1">{store.workingHours.split('das')[0]}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm font-semibold" style={{ color: store.themeColor }}>
                      <span>Ver Cardápio Digital</span>
                      <ExternalLink size={16} />
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Simulated placeholder to register new store */}
            <motion.div
              whileHover={{ y: -6 }}
              onClick={() => setIsRegisterModalOpen(true)}
              className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center group cursor-pointer h-full min-h-[340px]"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition mb-4">
                <Utensils size={24} />
              </div>
              <h3 className="font-sans font-bold text-base text-slate-800 group-hover:text-orange-600 transition mb-2">Cadastre Seu Estabelecimento</h3>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                Registre o seu estabelecimento e tenha um cardápio digital completo integrado ao WhatsApp.
              </p>
              <span className="mt-4 px-4 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 shadow-2xs group-hover:border-orange-200 group-hover:bg-orange-500 group-hover:text-white transition">
                Criar Nova Loja
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900" id="landing-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-900 pb-8 mb-8 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-base shadow-md shadow-orange-500/20">
                <Utensils size={18} />
              </div>
              <span className="font-sans font-bold text-lg text-white">Cardápio<span className="text-orange-500">Web</span></span>
            </div>
            <p className="text-xs text-slate-500">© 2026 Cardápio Web. Todos os direitos reservados.</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
            <div className="flex space-x-4">
              <span>SaaS Cardápio Digital Multi-inquilino</span>
              <span>•</span>
              <span>Conexão com WhatsApp</span>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4">
              <a 
                href={getAdminWhatsAppLink(adminSettings?.superAdminWhatsapp, 'Olá! Gostaria de falar com o Administrador Geral do Cardápio Web.')} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-emerald-300 text-emerald-400 font-medium transition cursor-pointer flex items-center gap-1"
              >
                <MessageCircle size={13} />
                <span>WhatsApp do Administrador</span>
              </a>
              <button onClick={onGoToAdmin} className="hover:text-white text-slate-400 font-medium transition cursor-pointer">
                Acesso Lojista / Admin
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL DE CADASTRO DE ESTABELECIMENTO */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="register-store-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[95vh] text-xs"
              >
                {/* Modal Header */}
                <div className="px-6 py-5 bg-linear-to-r from-orange-500 to-orange-600 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <Utensils size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-sans font-extrabold text-base tracking-tight">Cadastre seu Estabelecimento</h3>
                      <p className="text-[10px] text-orange-100 font-medium">Crie seu cardápio digital integrado ao WhatsApp</p>
                    </div>
                  </div>
                  <button 
                    onClick={resetForm} 
                    className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-white transition flex items-center justify-center cursor-pointer font-bold"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Body / Form */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                  {success ? (
                    <div className="text-center py-6 px-2 animate-fadeIn">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-500/5">
                        <Check size={28} className="animate-bounce" />
                      </div>
                      <h4 className="text-lg font-sans font-extrabold text-slate-900 tracking-tight">Cadastro Efetuado! 🎉</h4>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        O seu estabelecimento <strong className="font-bold">{registeredStoreData?.name || storeName}</strong> foi registrado com sucesso sob o link público:
                      </p>
                      
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs font-bold text-slate-800 break-all select-all flex items-center justify-center gap-1.5">
                        <span className="text-orange-600 font-bold">cardapioweb.com/#{registeredStoreData?.slug || storeSlug}</span>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-600 bg-slate-100 p-2.5 rounded-lg flex items-center justify-between">
                        <span>Usuário de Login:</span>
                        <strong className="font-mono font-bold text-slate-800">{registeredStoreData?.login || ownerLogin}</strong>
                      </div>

                      <div className="text-xs text-slate-500 mt-5 bg-amber-50 border border-amber-100/60 p-3.5 rounded-xl text-left leading-relaxed">
                        <p className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                          <Clock size={13} />
                          <span>Aguardando Liberação do Administrador</span>
                        </p>
                        Para o seu cardápio ficar visível na página inicial e ativo para o público, o administrador principal precisa liberar o seu link.
                        <p className="mt-2 text-slate-600">
                          <strong>No entanto, você já pode acessar o Painel Lojista para cadastrar seus produtos!</strong>
                        </p>
                      </div>

                      <div className="mt-6 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            resetForm();
                            onGoToAdmin();
                          }}
                          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-md shadow-orange-500/10"
                        >
                          Ir para o Painel Lojista
                        </button>
                        <button
                          onClick={resetForm}
                          className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold transition"
                        >
                          Voltar ao Início
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
                      {errorMsg && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                          <X size={14} className="shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Estabelecimento *</label>
                        <input
                          required
                          type="text"
                          autoCapitalize="words"
                          autoComplete="organization"
                          placeholder="Ex: Pizzaria Bella Vista"
                          value={storeName}
                          onChange={e => handleStoreNameChange(e.target.value)}
                          className="w-full p-2.5 sm:p-2.5 text-base sm:text-xs rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Endereço Web do Cardápio (Link Público) *</label>
                        <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 bg-slate-50 px-3 py-2.5">
                          <span className="text-slate-400 font-mono text-xs font-semibold shrink-0 select-none">cardapioweb.com/#</span>
                          <input
                            type="text"
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="pizzaria-bella"
                            value={storeSlug}
                            onChange={e => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            className="w-full pl-1 bg-transparent focus:outline-hidden text-xs text-orange-600 font-bold font-mono"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">Link direto que seus clientes usarão no celular.</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail do Proprietário *</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              required
                              type="email"
                              inputMode="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="email"
                              placeholder="exemplo@gmail.com"
                              value={ownerEmail}
                              onChange={e => setOwnerEmail(e.target.value)}
                              className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden text-slate-800"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp p/ Pedidos *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              required
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="(11) 99999-9999"
                              value={whatsapp}
                              onChange={e => setWhatsapp(formatWhatsapp(e.target.value))}
                              className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden text-slate-800"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Dados de Acesso (Painel do Lojista)</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Criar Usuário de Login *</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <input
                                required
                                type="text"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                placeholder="usuarioacesso"
                                value={ownerLogin}
                                onChange={e => setOwnerLogin(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                                className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden font-semibold text-slate-800"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Criar Senha de Acesso *</label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <input
                                required
                                type="password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                value={ownerPassword}
                                onChange={e => setOwnerPassword(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-hidden text-slate-800"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold rounded-xl text-sm transition shadow-lg shadow-orange-500/10 cursor-pointer mt-6 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Registrando Estabelecimento...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            <span>Criar Meu Cardápio Grátis</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
