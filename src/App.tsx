import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldAlert, MessageCircle } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { getLocalStorageData, saveLocalStorageData } from './initialData';
import { Store, Category, Product, AdminSettings, Order, CashTransaction, Motoboy } from './types';
import LandingPage from './components/LandingPage';
import MenuPage from './components/MenuPage';
import AdminPanel from './components/AdminPanel';
import { realtimeOrderManager, requestNotificationPermission } from './utils/realtimeSync';
import { getStoreBlockStatus, getAdminWhatsAppLink } from './utils/storePlan';

type ViewRoute = 'landing' | 'store' | 'admin';

export default function App() {
  // Database States
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    adminLogin: 'admin',
    adminPass: 'admin'
  });

  // Routing States
  const [currentView, setCurrentView] = useState<ViewRoute>('landing');
  const [activeStoreSlug, setActiveStoreSlug] = useState<string | null>(null);

  // Initialize and load persistent data from Local Storage + Server Sync + Real-time listeners
  useEffect(() => {
    const data = getLocalStorageData();
    setStores(data.stores);
    setCategories(data.categories);
    setProducts(data.products);
    setAdminSettings(data.adminSettings);
    const initialOrders = data.orders || [];
    setOrders(initialOrders);
    setCashTransactions(data.cashTransactions || []);
    setMotoboys(data.motoboys || []);

    // Set initial orders in the real-time manager
    realtimeOrderManager.setInitialOrders(initialOrders);

    // Subscribe to multi-tab BroadcastChannel, SSE, and storage events for orders
    const unsubscribeOrders = realtimeOrderManager.subscribe((incomingOrders) => {
      setOrders(incomingOrders);
    });

    // Subscribe to cross-device data updates (products, prices, motoboys, stores)
    const unsubscribeData = realtimeOrderManager.subscribeData((payload) => {
      if (payload.products) setProducts(payload.products);
      if (payload.stores) setStores(payload.stores);
      if (payload.categories) setCategories(payload.categories);
      if (payload.motoboys) setMotoboys(payload.motoboys);
      if (payload.adminSettings) setAdminSettings(payload.adminSettings);
      if (payload.orders) setOrders(payload.orders);
    });

    // Request native browser desktop notifications
    requestNotificationPermission();

    // Check backend server for any new data or cross-device orders
    fetch('/api/data')
      .then(res => res.json())
      .then(serverData => {
        if (serverData) {
          if (Array.isArray(serverData.orders) && serverData.orders.length > 0) {
            setOrders(serverData.orders);
            realtimeOrderManager.setInitialOrders(serverData.orders);
          }
          if (Array.isArray(serverData.products) && serverData.products.length > 0) {
            setProducts(serverData.products);
          }
          if (Array.isArray(serverData.stores) && serverData.stores.length > 0) {
            setStores(serverData.stores);
          }
          if (Array.isArray(serverData.categories) && serverData.categories.length > 0) {
            setCategories(serverData.categories);
          }
          if (Array.isArray(serverData.motoboys) && serverData.motoboys.length > 0) {
            setMotoboys(serverData.motoboys);
          }
        }
      })
      .catch(() => {
        // Dev server or offline fallback handled seamlessly
      });

    // Initial Routing Parse
    const parseUrlRoute = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const storeParam = searchParams.get('store');
      const adminParam = searchParams.get('admin');

      const hash = window.location.hash.substring(1);

      if (storeParam) {
        setCurrentView('store');
        setActiveStoreSlug(storeParam);
      } else if (adminParam === 'true') {
        setCurrentView('admin');
      } else if (hash === 'admin') {
        setCurrentView('admin');
      } else if (hash) {
        // Assume hash is the store slug if it doesn't match 'admin'
        setCurrentView('store');
        setActiveStoreSlug(hash);
      } else {
        setCurrentView('landing');
        setActiveStoreSlug(null);
      }
    };

    parseUrlRoute();

    // Listen to hash changes (e.g. going back in browser history)
    const handleHashChange = () => {
      parseUrlRoute();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribeOrders();
      unsubscribeData();
    };
  }, []);

  // Save changes back to Local Storage and sync with server & other tabs/devices
  const handleUpdateData = (
    updatedStores: Store[],
    updatedCategories: Category[],
    updatedProducts: Product[],
    updatedAdminSettings: AdminSettings,
    updatedMotoboys?: Motoboy[]
  ) => {
    setStores(updatedStores);
    setCategories(updatedCategories);
    setProducts(updatedProducts);
    setAdminSettings(updatedAdminSettings);
    if (updatedMotoboys) setMotoboys(updatedMotoboys);

    const mbs = updatedMotoboys || motoboys;
    saveLocalStorageData(updatedStores, updatedCategories, updatedProducts, updatedAdminSettings, orders, cashTransactions, mbs);

    // Broadcast across devices instantly
    realtimeOrderManager.broadcastUpdatedData({
      stores: updatedStores,
      categories: updatedCategories,
      products: updatedProducts,
      adminSettings: updatedAdminSettings,
      motoboys: mbs,
      orders
    });
  };

  const handleUpdateMotoboys = (updatedMotoboys: Motoboy[]) => {
    setMotoboys(updatedMotoboys);
    saveLocalStorageData(stores, categories, products, adminSettings, orders, cashTransactions, updatedMotoboys);
    realtimeOrderManager.broadcastUpdatedData({
      stores,
      categories,
      products,
      adminSettings,
      motoboys: updatedMotoboys,
      orders
    });
  };

  const handleUpdateOrders = (updatedOrders: Order[]) => {
    setOrders(updatedOrders);
    realtimeOrderManager.broadcastUpdatedOrders(updatedOrders);
    saveLocalStorageData(stores, categories, products, adminSettings, updatedOrders, cashTransactions, motoboys);
  };

  const handleUpdateCashTransactions = (updatedCash: CashTransaction[]) => {
    setCashTransactions(updatedCash);
    saveLocalStorageData(stores, categories, products, adminSettings, orders, updatedCash, motoboys);
  };

  const handlePlaceOrder = (newOrder: Order) => {
    realtimeOrderManager.broadcastNewOrder(newOrder).then(updated => {
      setOrders(updated);
      saveLocalStorageData(stores, categories, products, adminSettings, updated, cashTransactions, motoboys);
    });
  };

  // Safe navigation helpers (updates route states + URL hash)
  const navigateToLanding = () => {
    window.location.hash = '';
    // Clean up query params if present
    if (window.location.search) {
      window.history.pushState({}, '', window.location.pathname);
    }
    setCurrentView('landing');
    setActiveStoreSlug(null);
  };

  const navigateToStore = (slug: string) => {
    window.location.hash = slug;
    setCurrentView('store');
    setActiveStoreSlug(slug);
  };

  const navigateToAdmin = () => {
    window.location.hash = 'admin';
    setCurrentView('admin');
    setActiveStoreSlug(null);
  };

  const handleRegisterStore = (newStore: Store) => {
    const updatedStores = [...stores, newStore];
    handleUpdateData(updatedStores, categories, products, adminSettings);
  };

  // Find active store for digital menu view
  const activeStore = stores.find(s => s.slug === activeStoreSlug);

  // Check block and expiration status of active store
  const storeBlockStatus = activeStore ? getStoreBlockStatus(activeStore) : { isBlocked: false, reason: null };

  return (
    <div className="min-h-screen bg-slate-50 relative" id="cardapio-web-app">
      <SpeedInsights />
      {currentView === 'landing' && (
        <LandingPage
          stores={stores}
          orders={orders}
          products={products}
          adminSettings={adminSettings}
          onSelectStore={navigateToStore}
          onGoToAdmin={navigateToAdmin}
          onRegisterStore={handleRegisterStore}
        />
      )}

      {currentView === 'store' && activeStore ? (
        !storeBlockStatus.isBlocked ? (
          <MenuPage
            store={activeStore}
            categories={categories}
            products={products}
            orders={orders}
            onBackToLanding={navigateToLanding}
            onPlaceOrder={handlePlaceOrder}
          />
        ) : storeBlockStatus.reason === 'expired' ? (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center animate-fadeIn" id="store-expired-screen">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-200 shadow-md shadow-red-500/10">
              <AlertTriangle size={36} className="animate-pulse" />
            </div>
            <h2 className="text-2xl font-sans font-extrabold text-slate-800 tracking-tight">Cardápio Temporariamente Fora do Ar</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md leading-relaxed">
              O período de funcionamento online do estabelecimento <strong className="text-slate-900 font-bold">{activeStore.name}</strong> encerrou. O acesso ao cardápio e envio de novos pedidos está suspenso temporariamente.
            </p>
            <div className="text-xs text-slate-600 mt-6 bg-red-50/70 border border-red-200/80 p-4 rounded-xl max-w-md leading-relaxed text-left">
              <p className="font-bold text-red-800 mb-1">📢 Aviso ao Responsável:</p>
              Caso você seja o dono deste estabelecimento, entre em contato imediatamente com o Administrador Geral para renovar seus dias online e reativar a sua página de vendas.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-md justify-center">
              <button
                onClick={navigateToLanding}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-xs hover:bg-slate-50 cursor-pointer transition"
              >
                Página Inicial
              </button>
              <a
                href={getAdminWhatsAppLink(adminSettings.superAdminWhatsapp, `Olá! Sou o responsável por ${activeStore.name} e gostaria de renovar os dias online do meu cardápio.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                <span>Falar com Adm no WhatsApp</span>
              </a>
              <button
                onClick={navigateToAdmin}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs cursor-pointer transition"
              >
                Painel
              </button>
            </div>
          </div>
        ) : storeBlockStatus.reason === 'manual' ? (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center animate-fadeIn" id="store-blocked-screen">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-200 shadow-md shadow-red-500/10">
              <ShieldAlert size={36} />
            </div>
            <h2 className="text-2xl font-sans font-extrabold text-slate-800 tracking-tight">Página de Vendas Bloqueada</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md leading-relaxed">
              O link do cardápio de <strong className="text-slate-900 font-bold">{activeStore.name}</strong> foi bloqueado temporariamente pela administração do sistema.
            </p>
            <div className="text-xs text-slate-600 mt-6 bg-slate-50 border border-slate-200 p-4 rounded-xl max-w-md leading-relaxed text-left">
              <p className="font-bold text-slate-800 mb-1">ℹ️ Informação:</p>
              Entre em contato com o suporte ou administrador geral para solicitar o desbloqueio da sua página de vendas.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-md justify-center">
              <button
                onClick={navigateToLanding}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-xs hover:bg-slate-50 cursor-pointer transition"
              >
                Página Inicial
              </button>
              <a
                href={getAdminWhatsAppLink(adminSettings.superAdminWhatsapp, `Olá! Sou o responsável por ${activeStore.name} e gostaria de falar sobre o desbloqueio do meu cardápio.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={15} />
                <span>Suporte no WhatsApp</span>
              </a>
              <button
                onClick={navigateToAdmin}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs cursor-pointer transition"
              >
                Painel
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center animate-fadeIn" id="store-pending-screen">
            <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-6 border border-amber-100 shadow-md shadow-amber-500/5">
              <Clock size={36} className="animate-pulse" />
            </div>
            <h2 className="text-2xl font-sans font-extrabold text-slate-800 tracking-tight">Cardápio em Análise</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md leading-relaxed">
              O cardápio de <strong className="text-slate-850 font-bold">{activeStore.name}</strong> foi criado com sucesso e está aguardando a liberação do administrador para ser publicado e receber pedidos online.
            </p>
            <div className="text-xs text-slate-500 mt-6 bg-amber-50/50 border border-amber-100/60 p-4 rounded-xl max-w-md leading-relaxed text-left">
              <p className="font-bold text-amber-850 mb-1">💡 Dica para o Lojista:</p>
              Você já pode gerenciar seu estabelecimento! Acesse o painel administrativo usando suas credenciais criadas para começar a cadastrar seus produtos, categorias e opções de entrega.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-xs justify-center">
              <button
                onClick={navigateToLanding}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-xs hover:bg-slate-50 cursor-pointer transition"
              >
                Ir para a Página Inicial
              </button>
              <button
                onClick={navigateToAdmin}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-xs shadow-md shadow-orange-500/10 cursor-pointer transition"
              >
                Acessar Painel Lojista
              </button>
            </div>
          </div>
        )
      ) : currentView === 'store' ? (
        // fallback if store is not found or deleted
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold text-slate-800">Cardápio não encontrado</h2>
          <p className="text-slate-500 text-sm mt-1">Este estabelecimento pode ter sido desativado ou removido.</p>
          <button
            onClick={navigateToLanding}
            className="mt-6 px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-xl text-xs shadow-md"
          >
            Voltar para o Início
          </button>
        </div>
      ) : null}

      {currentView === 'admin' && (
        <AdminPanel
          stores={stores}
          categories={categories}
          products={products}
          orders={orders}
          cashTransactions={cashTransactions}
          adminSettings={adminSettings}
          motoboys={motoboys}
          onUpdateData={handleUpdateData}
          onUpdateOrders={handleUpdateOrders}
          onUpdateCashTransactions={handleUpdateCashTransactions}
          onUpdateMotoboys={handleUpdateMotoboys}
          onBackToLanding={navigateToLanding}
          onGoToStore={navigateToStore}
        />
      )}
    </div>
  );
}
