import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Settings, Utensils, ExternalLink, LogOut, Check, X,
  Briefcase, FolderPlus, HelpCircle, Save, Key, Lock, User, Eye, EyeOff, ArrowLeft,
  ChevronRight, ToggleLeft, ToggleRight, List, ShoppingCart, DollarSign, Clock,
  Copy, Share2, Send, Sparkles, CheckCircle2, ShieldCheck, Store as StoreIcon,
  Bot, Receipt, Bell, Flame, Star, ShieldAlert, AlertTriangle, MessageCircle, Bike, MapPin
} from 'lucide-react';
import { Store, Category, Product, AdminSettings, ProductOption, OptionChoice, NeighborhoodFee, Order, OrderStatus, CashTransaction, Motoboy } from '../types';
import { ImageUploadField } from './ImageUploadField';
import PDVPanel from './PDVPanel';
import NotificationSettingsView from './NotificationSettingsView';
import MotoboysManager from './MotoboysManager';
import FlyerMaker from './FlyerMaker';
import { startNewOrderAlarm, stopNewOrderAlarm, ensureAudioUnlocked } from '../utils/audioAlert';
import { flashDocumentTitle, stopDocumentTitleFlash, realtimeOrderManager } from '../utils/realtimeSync';
import { getStorePlanDetails, isStorePlanExpired, extendStorePlanDays, getAdminWhatsAppLink, calculatePlanExpiration } from '../utils/storePlan';
import { isSizeOption } from '../utils/productPricing';

interface AdminPanelProps {
  stores: Store[];
  categories: Category[];
  products: Product[];
  orders?: Order[];
  cashTransactions?: CashTransaction[];
  motoboys?: Motoboy[];
  adminSettings: AdminSettings;
  onUpdateData: (stores: Store[], categories: Category[], products: Product[], adminSettings: AdminSettings) => void;
  onUpdateOrders?: (orders: Order[]) => void;
  onUpdateCashTransactions?: (transactions: CashTransaction[]) => void;
  onUpdateMotoboys?: (motoboys: Motoboy[]) => void;
  onBackToLanding: () => void;
  onGoToStore?: (slug: string) => void;
}

export default function AdminPanel({
  stores,
  categories,
  products,
  orders = [],
  cashTransactions = [],
  motoboys = [],
  adminSettings,
  onUpdateData,
  onUpdateOrders,
  onUpdateCashTransactions,
  onUpdateMotoboys,
  onBackToLanding,
  onGoToStore
}: AdminPanelProps) {
  // Login State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Super Admin vs Store Owner (Lojista)
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);

  // Dashboard Tabs: 'pdv' | 'stores' | 'menu-editor' | 'bot-settings' | 'motoboys' | 'flyer-maker' | 'settings'
  const [activeTab, setActiveTab] = useState<'pdv' | 'stores' | 'menu-editor' | 'bot-settings' | 'motoboys' | 'flyer-maker' | 'settings'>('pdv');

  // Multi-Store Editor States
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Motoboy Management States
  const [editingMotoboy, setEditingMotoboy] = useState<Partial<Motoboy> | null>(null);
  const [isCreatingMotoboy, setIsCreatingMotoboy] = useState(false);
  const [viewingMotoboyReceipt, setViewingMotoboyReceipt] = useState<Motoboy | null>(null);
  const [motoboySearchTerm, setMotoboySearchTerm] = useState('');

  // Store Modal/Editor State (Editing / Creating Store)
  const [editingStore, setEditingStore] = useState<Partial<Store> | null>(null);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  // Neighborhood fee helper inside Store editor
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newNeighborhoodFee, setNewNeighborhoodFee] = useState<number>(0);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Newly created client success modal
  const [clientCreatedSuccess, setClientCreatedSuccess] = useState<Store | null>(null);

  // Password visibility toggle per store card
  const [revealPasswordStoreId, setRevealPasswordStoreId] = useState<Record<string, boolean>>({});

  // Category Editor State
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Product Modal/Editor State
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Options builder helpers inside Product editor
  const [isEditingOptions, setIsEditingOptions] = useState(false);
  const [newOption, setNewOption] = useState<Partial<ProductOption>>({
    name: '',
    type: 'single',
    required: false,
    isSize: false,
    choices: []
  });
  const [newChoiceName, setNewChoiceName] = useState('');
  const [newChoicePrice, setNewChoicePrice] = useState<number>(0);
  const [newChoiceOriginalPrice, setNewChoiceOriginalPrice] = useState<number | undefined>(undefined);

  // Direct editing of choices without deleting
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null);
  const [editingChoiceName, setEditingChoiceName] = useState<string>('');
  const [editingChoicePrice, setEditingChoicePrice] = useState<number>(0);

  // Admin account change state
  const [newLogin, setNewLogin] = useState(adminSettings.adminLogin);
  const [newPass, setNewPass] = useState(adminSettings.adminPass);
  const [superAdminWhatsappInput, setSuperAdminWhatsappInput] = useState(adminSettings.superAdminWhatsapp || '5511999999999');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  useEffect(() => {
    setNewLogin(adminSettings.adminLogin);
    setNewPass(adminSettings.adminPass);
    setSuperAdminWhatsappInput(adminSettings.superAdminWhatsapp || '5511999999999');
  }, [adminSettings]);

  // Helpers
  const currentStore = useMemo(() => {
    return stores.find(s => s.id === selectedStoreId);
  }, [stores, selectedStoreId]);

  // Filtered stores list for display (Superadmin sees all, Lojista only their own)
  const filteredStores = useMemo(() => {
    if (isSuperAdmin) return stores;
    return stores.filter(s => s.id === selectedStoreId);
  }, [stores, isSuperAdmin, selectedStoreId]);

  const currentStoreCategories = useMemo(() => {
    if (!selectedStoreId) return [];
    return categories
      .filter(c => c.storeId === selectedStoreId)
      .sort((a, b) => a.order - b.order);
  }, [categories, selectedStoreId]);

  const currentStoreProducts = useMemo(() => {
    if (!selectedStoreId) return [];
    return products.filter(p => p.storeId === selectedStoreId);
  }, [products, selectedStoreId]);

  const currentStoreMotoboys = useMemo(() => {
    if (!selectedStoreId) return [];
    return motoboys.filter(m => m.storeId === selectedStoreId);
  }, [motoboys, selectedStoreId]);

  // Pending orders for the active store
  const storePendingOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    if (selectedStoreId) {
      return orders.filter(o => o.storeId === selectedStoreId && o.status === 'pending');
    }
    return orders.filter(o => o.status === 'pending');
  }, [orders, selectedStoreId]);

  const storePendingCount = storePendingOrders.length;

  // CRITICAL RULE: Notification sound for pending orders
  // The sound plays continuously as long as there is any pending order (storePendingCount > 0).
  // The sound can ONLY stop if the order(s) are accepted or rejected (storePendingCount becomes 0).
  useEffect(() => {
    if (isAuthenticated && storePendingCount > 0) {
      ensureAudioUnlocked();
      startNewOrderAlarm();
      flashDocumentTitle(`🔔 (${storePendingCount}) NOVO PEDIDO!`);
    } else if (storePendingCount === 0) {
      stopNewOrderAlarm();
      stopDocumentTitleFlash();
    }
  }, [isAuthenticated, storePendingCount]);

  // Stop alarm when leaving the admin panel
  useEffect(() => {
    return () => {
      stopNewOrderAlarm();
      stopDocumentTitleFlash();
    };
  }, []);

  // URL Helper functions for sales page & admin link
  const getSalesPageUrl = (slug: string) => {
    if (typeof window === 'undefined') return `#${slug}`;
    const base = window.location.origin + window.location.pathname;
    return `${base}#${slug}`;
  };

  const getAdminLoginUrl = () => {
    if (typeof window === 'undefined') return `#admin`;
    const base = window.location.origin + window.location.pathname;
    return `${base}#admin`;
  };

  const handleCopySalesLink = (slug: string) => {
    const salesUrl = getSalesPageUrl(slug);
    navigator.clipboard.writeText(salesUrl);
    showToast('Link da página de vendas copiado!');
  };

  const handleShareMenuWhatsApp = (store: Store) => {
    const salesUrl = getSalesPageUrl(store.slug);
    const text = `Olá! Conheça nosso cardápio online e faça seu pedido direto pelo WhatsApp com entrega rápida:\n${salesUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyClientCredentials = (store: Store) => {
    const salesUrl = getSalesPageUrl(store.slug);
    const adminUrl = getAdminLoginUrl();
    const text = `🎉 *Acesso ao Cardápio Digital: ${store.name}*\n\n` +
      `Olá! O seu cardápio online já está disponível:\n\n` +
      `🌐 *Sua Página de Vendas:*\n${salesUrl}\n\n` +
      `🔐 *Seu Painel de Gerenciamento do Cardápio:*\n${adminUrl}\n` +
      `👤 *Usuário de Login:* ${store.ownerLogin || store.slug.replace(/[^a-z0-9]/gi, '')}\n` +
      `🔑 *Senha de Acesso:* ${store.ownerPassword || '123'}\n\n` +
      `Você pode acessar agora para editar seus produtos, categorias, fotos, preços e opções de entrega!`;

    navigator.clipboard.writeText(text);
    showToast('Dados de acesso copiados para a área de transferência!');
  };

  const handleSendWhatsAppAccess = (store: Store) => {
    const salesUrl = getSalesPageUrl(store.slug);
    const adminUrl = getAdminLoginUrl();
    const text = `🎉 *Acesso ao Cardápio Digital: ${store.name}*\n\n` +
      `Olá! O seu cardápio online já está disponível:\n\n` +
      `🌐 *Sua Página de Vendas:*\n${salesUrl}\n\n` +
      `🔐 *Seu Painel de Gerenciamento do Cardápio:*\n${adminUrl}\n` +
      `👤 *Usuário de Login:* ${store.ownerLogin || store.slug.replace(/[^a-z0-9]/gi, '')}\n` +
      `🔑 *Senha de Acesso:* ${store.ownerPassword || '123'}\n\n` +
      `Você pode acessar agora para editar seus produtos, categorias, fotos, preços e opções de entrega!`;

    const cleanPhone = (store.phone || '').replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?${cleanPhone ? `phone=${cleanPhone}&` : ''}text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Handle Login (Supports Admin or Store Owner credentials)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputUser = usernameInput.trim();
    const inputPass = passwordInput.trim();

    if (inputUser === adminSettings.adminLogin && inputPass === adminSettings.adminPass) {
      setIsSuperAdmin(true);
      setIsAuthenticated(true);
      setLoginError('');
      if (stores.length > 0) {
        setSelectedStoreId(stores[0].id);
      }
    } else {
      // Find store by owner login and password
      const matchedStore = stores.find(
        s => s.ownerLogin && s.ownerLogin.toLowerCase() === inputUser.toLowerCase() && s.ownerPassword === inputPass
      );

      if (matchedStore) {
        setIsSuperAdmin(false);
        setIsAuthenticated(true);
        setSelectedStoreId(matchedStore.id);
        setActiveTab('pdv'); // Open PDV tab to let them view daily sales & orders immediately
        setLoginError('');
      } else {
        setLoginError('Login ou Senha incorretos. Utilize admin/admin ou suas credenciais de lojista.');
      }
    }
  };

  // Approve pending store link
  const handleApproveStore = (storeId: string) => {
    const updatedStores = stores.map(s => {
      if (s.id === storeId) {
        return { ...s, isApproved: true, isBlocked: false };
      }
      return s;
    });
    onUpdateData(updatedStores, categories, products, adminSettings);
    showToast('Link do estabelecimento liberado para vendas!');
  };

  // Block or Unblock store link
  const handleToggleBlockStore = (storeId: string, block: boolean) => {
    const updatedStores = stores.map(s => {
      if (s.id === storeId) {
        return { ...s, isBlocked: block };
      }
      return s;
    });
    onUpdateData(updatedStores, categories, products, adminSettings);
    showToast(block ? 'Link do estabelecimento bloqueado com sucesso!' : 'Link do estabelecimento desbloqueado com sucesso!');
  };

  // Set store online days / subscription period
  const handleSetStoreDaysOnline = (storeId: string, days: number) => {
    const updatedStores = stores.map(s => {
      if (s.id === storeId) {
        return extendStorePlanDays(s, days);
      }
      return s;
    });
    onUpdateData(updatedStores, categories, products, adminSettings);
    showToast(`Período de ${days} dias online configurado com sucesso!`);
  };

  // Toggle product spotlight (com desconto)
  const handleToggleProductFeatured = (productId: string) => {
    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        const nextFeatured = !p.isFeatured;
        return {
          ...p,
          isFeatured: nextFeatured,
          // If turning on spotlight and no originalPrice, suggest a 20% higher original price
          originalPrice: nextFeatured ? (p.originalPrice || Number((p.price * 1.2).toFixed(2))) : p.originalPrice
        };
      }
      return p;
    });
    onUpdateData(stores, categories, updatedProducts, adminSettings);
    showToast('Status de destaque e promoção atualizado!');
  };

  // ----------------------------------------------------
  // STORE ACTIONS (CRUD)
  // ----------------------------------------------------
  const handleOpenCreateStore = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setEditingStore({
      name: '',
      slug: '',
      logoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&h=150&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
      phone: '5511999999999',
      address: '',
      deliveryFeeType: 'flat',
      deliveryFee: 5,
      neighborhoodFees: [],
      minOrder: 0,
      workingHours: 'Todos os dias das 18:00 às 23:00',
      themeColor: '#ef4444',
      isActive: true,
      isApproved: true, // admin created stores are approved by default
      isBlocked: false,
      daysOnline: 30,
      planExpiresAt: calculatePlanExpiration(30),
      rating: 5.0,
      ownerEmail: '',
      ownerLogin: '',
      ownerPassword: randomPin
    });
    setIsCreatingStore(true);
  };

  const handleOpenEditStore = (store: Store) => {
    setEditingStore({ ...store });
    setIsCreatingStore(false);
  };

  const handleSaveStore = () => {
    if (!editingStore?.name || !editingStore?.slug) {
      alert('Nome e Slug são campos obrigatórios');
      return;
    }

    const slugified = editingStore.slug.toLowerCase().trim().replace(/\s+/g, '-');
    const existingStore = stores.find(s => s.id === editingStore.id);

    // Only Super Admin can change owner login or owner password!
    const ownerLoginClean = isSuperAdmin
      ? (editingStore.ownerLogin || slugified.replace(/[^a-z0-9]/gi, '')).toLowerCase()
      : (existingStore?.ownerLogin || editingStore.ownerLogin || slugified.replace(/[^a-z0-9]/gi, '')).toLowerCase();

    const ownerPasswordClean = isSuperAdmin
      ? (editingStore.ownerPassword || '123')
      : (existingStore?.ownerPassword || editingStore.ownerPassword || '123');

    const targetDays = editingStore.daysOnline ?? existingStore?.daysOnline ?? 30;
    const expiresAt = editingStore.planExpiresAt || (existingStore?.planExpiresAt ? existingStore.planExpiresAt : calculatePlanExpiration(targetDays));

    const preparedStore: Store = {
      id: editingStore.id || `store-${Date.now()}`,
      name: editingStore.name,
      slug: slugified,
      logoUrl: editingStore.logoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&h=150&q=80',
      coverUrl: editingStore.coverUrl || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
      phone: editingStore.phone || '',
      address: editingStore.address || '',
      deliveryFeeType: editingStore.deliveryFeeType || 'flat',
      deliveryFee: editingStore.deliveryFee ?? 0,
      neighborhoodFees: editingStore.neighborhoodFees || [],
      minOrder: editingStore.minOrder ?? 0,
      workingHours: editingStore.workingHours || '',
      themeColor: editingStore.themeColor || '#ef4444',
      isActive: editingStore.isActive ?? true,
      instagramUrl: editingStore.instagramUrl,
      facebookUrl: editingStore.facebookUrl,
      
      // Preserve or set owner credentials & approval status
      isApproved: editingStore.isApproved ?? true,
      isBlocked: editingStore.isBlocked ?? existingStore?.isBlocked ?? false,
      daysOnline: targetDays,
      planExpiresAt: expiresAt,
      rating: editingStore.rating ?? existingStore?.rating ?? 4.9,
      ownerEmail: editingStore.ownerEmail || '',
      ownerLogin: ownerLoginClean,
      ownerPassword: ownerPasswordClean
    };

    let updatedStores = [...stores];
    if (isCreatingStore) {
      // Check if slug is duplicated
      if (stores.some(s => s.slug === slugified)) {
        alert('Este slug já está sendo utilizado por outro estabelecimento!');
        return;
      }
      updatedStores.push(preparedStore);

      // Create default category and product so the store starts with an editable menu
      const defaultCatId = `cat-${Date.now()}`;
      const defaultCat: Category = {
        id: defaultCatId,
        storeId: preparedStore.id,
        name: 'Destaques do Cardápio',
        order: 1
      };
      const defaultProd: Product = {
        id: `prod-${Date.now()}`,
        storeId: preparedStore.id,
        categoryId: defaultCatId,
        name: 'Produto Exemplo',
        description: 'Clique em editar para personalizar o nome, ingredientes e preço.',
        price: 29.9,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        isActive: true,
        isAvailable: true,
        options: []
      };

      const updatedCategories = [...categories, defaultCat];
      const updatedProducts = [...products, defaultProd];
      onUpdateData(updatedStores, updatedCategories, updatedProducts, adminSettings);
      
      // Open success modal for admin
      setClientCreatedSuccess(preparedStore);
    } else {
      updatedStores = stores.map(s => s.id === preparedStore.id ? preparedStore : s);
      onUpdateData(updatedStores, categories, products, adminSettings);
      showToast('Estabelecimento atualizado com sucesso!');
    }

    setEditingStore(null);
    setSelectedStoreId(preparedStore.id);
  };

  const handleDeleteStore = (storeId: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este estabelecimento e TODOS os seus produtos e categorias relacionados?')) return;
    
    const updatedStores = stores.filter(s => s.id !== storeId);
    const updatedCategories = categories.filter(c => c.storeId !== storeId);
    const updatedProducts = products.filter(p => p.storeId !== storeId);
    
    onUpdateData(updatedStores, updatedCategories, updatedProducts, adminSettings);
    if (selectedStoreId === storeId) {
      setSelectedStoreId(updatedStores[0]?.id || '');
    }
  };

  const handleAddNeighborhoodFee = () => {
    if (!newNeighborhoodName.trim()) return;
    const currentFees = editingStore?.neighborhoodFees || [];
    const newFee: NeighborhoodFee = {
      id: `fee-${Date.now()}`,
      name: newNeighborhoodName.trim(),
      fee: newNeighborhoodFee
    };
    
    setEditingStore(prev => prev ? {
      ...prev,
      neighborhoodFees: [...currentFees, newFee]
    } : null);
    
    setNewNeighborhoodName('');
    setNewNeighborhoodFee(0);
  };

  const handleRemoveNeighborhoodFee = (feeId: string) => {
    setEditingStore(prev => prev ? {
      ...prev,
      neighborhoodFees: (prev.neighborhoodFees || []).filter(f => f.id !== feeId)
    } : null);
  };

  // ----------------------------------------------------
  // CATEGORY ACTIONS (CRUD)
  // ----------------------------------------------------
  const handleOpenCreateCategory = () => {
    setEditingCategory({
      name: '',
      storeId: selectedStoreId,
      order: currentStoreCategories.length + 1
    });
    setIsCreatingCategory(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory({ ...cat });
    setIsCreatingCategory(false);
  };

  const handleSaveCategory = () => {
    if (!editingCategory?.name) return;

    const preparedCat: Category = {
      id: editingCategory.id || `cat-${Date.now()}`,
      storeId: selectedStoreId,
      name: editingCategory.name,
      order: editingCategory.order ?? 1
    };

    let updatedCats = [...categories];
    if (isCreatingCategory) {
      updatedCats.push(preparedCat);
    } else {
      updatedCats = categories.map(c => c.id === preparedCat.id ? preparedCat : c);
    }

    onUpdateData(stores, updatedCats, products, adminSettings);
    setEditingCategory(null);
    setSelectedCategoryId(preparedCat.id);
  };

  const handleDeleteCategory = (catId: string) => {
    if (!window.confirm('Excluir esta categoria também excluirá todos os produtos dentro dela. Deseja prosseguir?')) return;
    
    const updatedCats = categories.filter(c => c.id !== catId);
    const updatedProds = products.filter(p => p.categoryId !== catId);
    
    onUpdateData(stores, updatedCats, updatedProds, adminSettings);
    if (selectedCategoryId === catId) {
      setSelectedCategoryId('');
    }
  };

  // ----------------------------------------------------
  // PRODUCT ACTIONS (CRUD)
  // ----------------------------------------------------
  const handleOpenCreateProduct = () => {
    if (!selectedCategoryId) {
      alert('Selecione primeiro uma categoria antes de adicionar produtos!');
      return;
    }
    setEditingProduct({
      storeId: selectedStoreId,
      categoryId: selectedCategoryId,
      name: '',
      description: '',
      price: 15,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      isActive: true,
      isAvailable: true,
      options: []
    });
    setIsCreatingProduct(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod });
    setIsCreatingProduct(false);
  };

  const handleSaveProduct = () => {
    if (!editingProduct?.name || !editingProduct?.price) {
      alert('Nome e Preço do produto são obrigatórios!');
      return;
    }

    // Synchronize featured size and tag if featured is active
    let finalOptions = editingProduct.options || [];
    if (editingProduct.isFeatured && editingProduct.featuredSizeId) {
      finalOptions = finalOptions.map(opt => {
        if (isSizeOption(opt)) {
          return {
            ...opt,
            choices: opt.choices.map(c => {
              if (c.id === editingProduct.featuredSizeId) {
                return {
                  ...c,
                  isFeatured: true,
                  featuredTag: editingProduct.featuredTag || 'Destaque'
                };
              }
              return {
                ...c,
                isFeatured: false,
                featuredTag: undefined
              };
            })
          };
        }
        return opt;
      });
    }

    const preparedProd: Product = {
      id: editingProduct.id || `prod-${Date.now()}`,
      storeId: selectedStoreId,
      categoryId: editingProduct.categoryId || selectedCategoryId,
      name: editingProduct.name,
      description: editingProduct.description || '',
      price: Number(editingProduct.price),
      originalPrice: editingProduct.originalPrice ? Number(editingProduct.originalPrice) : undefined,
      discountTargetSizeId: editingProduct.discountTargetSizeId,
      isFeatured: editingProduct.isFeatured ?? false,
      featuredTag: editingProduct.featuredTag?.trim() || undefined,
      featuredSizeId: editingProduct.featuredSizeId || undefined,
      featuredSizeName: editingProduct.featuredSizeName || undefined,
      imageUrl: editingProduct.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      isActive: editingProduct.isActive ?? true,
      isAvailable: editingProduct.isAvailable ?? true,
      options: finalOptions
    };

    let updatedProds = [...products];
    if (isCreatingProduct) {
      updatedProds.push(preparedProd);
    } else {
      updatedProds = products.map(p => p.id === preparedProd.id ? preparedProd : p);
    }

    onUpdateData(stores, categories, updatedProds, adminSettings);
    // Realtime broadcast to all connected devices immediately!
    realtimeOrderManager.broadcastUpdatedData({
      stores,
      categories,
      products: updatedProds,
      adminSettings
    });
    setEditingProduct(null);
    showToast('⚡ Preço e destaques atualizados em tempo real em todos os dispositivos!');
  };

  const handleDeleteProduct = (prodId: string) => {
    if (!window.confirm('Deseja excluir este produto definitivamente?')) return;
    const updatedProds = products.filter(p => p.id !== prodId);
    onUpdateData(stores, categories, updatedProds, adminSettings);
    realtimeOrderManager.broadcastUpdatedData({
      stores,
      categories,
      products: updatedProds,
      adminSettings
    });
    showToast('Produto excluído.');
  };

  // ----------------------------------------------------
  // MOTOBOY HANDLERS
  // ----------------------------------------------------
  const handleOpenCreateMotoboy = () => {
    setEditingMotoboy({
      storeId: selectedStoreId,
      name: '',
      phone: '',
      vehicle: 'Motocicleta',
      pixKey: '',
      pixKeyType: 'telefone',
      isActive: true
    });
    setIsCreatingMotoboy(true);
  };

  const handleOpenEditMotoboy = (m: Motoboy) => {
    setEditingMotoboy({ ...m });
    setIsCreatingMotoboy(false);
  };

  const handleSaveMotoboy = () => {
    if (!editingMotoboy?.name?.trim() || !editingMotoboy?.phone?.trim()) {
      alert('Preencha o Nome e WhatsApp do motoboy.');
      return;
    }

    const finalMotoboy: Motoboy = {
      id: editingMotoboy.id || `driver-${Date.now()}`,
      storeId: editingMotoboy.storeId || selectedStoreId,
      name: editingMotoboy.name.trim(),
      phone: editingMotoboy.phone.trim(),
      vehicle: editingMotoboy.vehicle?.trim() || 'Motocicleta',
      pixKey: editingMotoboy.pixKey?.trim() || '',
      pixKeyType: editingMotoboy.pixKeyType || 'telefone',
      isActive: editingMotoboy.isActive ?? true,
      createdAt: editingMotoboy.createdAt || new Date().toISOString()
    };

    let updatedMotoboys = [...motoboys];
    if (isCreatingMotoboy) {
      updatedMotoboys.push(finalMotoboy);
    } else {
      updatedMotoboys = updatedMotoboys.map(m => m.id === finalMotoboy.id ? finalMotoboy : m);
    }

    if (onUpdateMotoboys) {
      onUpdateMotoboys(updatedMotoboys);
    }
    setEditingMotoboy(null);
    showToast('✅ Motoboy cadastrado com sucesso!');
  };

  const handleDeleteMotoboy = (driverId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este motoboy?')) return;
    const updated = motoboys.filter(m => m.id !== driverId);
    if (onUpdateMotoboys) {
      onUpdateMotoboys(updated);
    }
    showToast('Motoboy removido com sucesso.');
  };

  const handleToggleMotoboyActive = (driverId: string) => {
    const updated = motoboys.map(m => m.id === driverId ? { ...m, isActive: !m.isActive } : m);
    if (onUpdateMotoboys) {
      onUpdateMotoboys(updated);
    }
    showToast('Status do motoboy atualizado.');
  };

  const handleMarkMotoboyFeePaid = (driverId: string) => {
    if (!onUpdateOrders) return;
    const nowIso = new Date().toISOString();
    const updated = orders.map(o => {
      if (o.driverId === driverId && o.status === 'completed' && !o.driverFeePaid) {
        return {
          ...o,
          driverFeePaid: true,
          driverFeePaidAt: nowIso
        };
      }
      return o;
    });
    onUpdateOrders(updated);
    showToast('💰 Taxas de entrega marcadas como pagas com sucesso!');
  };

  const handleStartEditChoice = (choice: OptionChoice) => {
    setEditingChoiceId(choice.id);
    setEditingChoiceName(choice.name);
    setEditingChoicePrice(choice.price);
  };

  const handleSaveChoiceEdit = () => {
    if (!editingChoiceId) return;
    setNewOption(prev => ({
      ...prev,
      choices: (prev.choices || []).map(c => c.id === editingChoiceId ? {
        ...c,
        name: editingChoiceName.trim() || c.name,
        price: Number(editingChoicePrice) || 0
      } : c)
    }));
    setEditingChoiceId(null);
    showToast('Preço da opção atualizado.');
  };

  const handleQuickUpdateChoicePrice = (choiceId: string, val: number) => {
    setNewOption(prev => ({
      ...prev,
      choices: (prev.choices || []).map(c => c.id === choiceId ? {
        ...c,
        price: val
      } : c)
    }));
  };

  // Product Modifiers / Options Logic
  const handleAddChoiceToOption = () => {
    if (!newChoiceName.trim()) return;
    const currentChoices = newOption.choices || [];
    const newChoice: OptionChoice = {
      id: `choice-${Date.now()}`,
      name: newChoiceName.trim(),
      price: newChoicePrice,
      originalPrice: newChoiceOriginalPrice && newChoiceOriginalPrice > newChoicePrice ? newChoiceOriginalPrice : undefined
    };
    setNewOption(prev => ({
      ...prev,
      choices: [...currentChoices, newChoice]
    }));
    setNewChoiceName('');
    setNewChoicePrice(0);
    setNewChoiceOriginalPrice(undefined);
  };

  const handleRemoveChoiceFromOption = (choiceId: string) => {
    setNewOption(prev => ({
      ...prev,
      choices: (prev.choices || []).filter(c => c.id !== choiceId)
    }));
  };

  const handleSaveNewOption = () => {
    if (!newOption.name || (newOption.choices || []).length === 0) {
      alert('Digite o nome da opção e adicione pelo menos 1 escolha!');
      return;
    }

    const finalOption: ProductOption = {
      id: newOption.id || `opt-${Date.now()}`,
      name: newOption.name,
      type: newOption.type || 'single',
      required: newOption.required || false,
      isSize: newOption.isSize ?? (newOption.type === 'single' && /(tamanho|size|porcao|porção|capacidade|volume)/i.test(newOption.name)),
      choices: newOption.choices || []
    };

    const currentOptions = editingProduct?.options || [];
    let updatedOptions = [...currentOptions];

    if (currentOptions.some(o => o.id === finalOption.id)) {
      updatedOptions = currentOptions.map(o => o.id === finalOption.id ? finalOption : o);
    } else {
      updatedOptions.push(finalOption);
    }

    setEditingProduct(prev => prev ? { ...prev, options: updatedOptions } : null);
    setIsEditingOptions(false);
    
    // Reset option draft
    setNewOption({
      name: '',
      type: 'single',
      required: false,
      choices: []
    });
  };

  const handleRemoveOptionFromProduct = (optionId: string) => {
    setEditingProduct(prev => prev ? {
      ...prev,
      options: (prev.options || []).filter(o => o.id !== optionId)
    } : null);
  };

  // ----------------------------------------------------
  // ADMIN ACCOUNT SETTINGS
  // ----------------------------------------------------
  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogin.trim() || !newPass.trim()) {
      alert('Login e Senha não podem ser em branco!');
      return;
    }

    const updatedSettings: AdminSettings = {
      adminLogin: newLogin.trim(),
      adminPass: newPass.trim(),
      superAdminWhatsapp: superAdminWhatsappInput.trim() || '5511999999999'
    };

    onUpdateData(stores, categories, products, updatedSettings);
    setSettingsSuccess('Configurações administrativas atualizadas com sucesso!');
    setTimeout(() => setSettingsSuccess(''), 4000);
  };

  // Filter products for currently selected category in menu editor
  const categoryProducts = useMemo(() => {
    return currentStoreProducts.filter(p => p.categoryId === selectedCategoryId);
  }, [currentStoreProducts, selectedCategoryId]);

  // LOGIN GATE SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8" id="admin-login-screen">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl border border-slate-700 p-8 shadow-2xl relative overflow-hidden">
          {/* Accent light blur */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl" />

          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-500/10 mb-4">
              <Utensils size={28} />
            </div>
            <h1 className="font-sans font-extrabold text-2xl text-white tracking-tight">Painel de Acesso</h1>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Usuário de Login</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Ex: admin ou burger"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-slate-500 text-white focus:outline-hidden text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-slate-500 text-white focus:outline-hidden text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-red-400 text-xs text-center font-medium bg-red-950/40 border border-red-900/30 p-2.5 rounded-lg">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/10 transition cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>Entrar no Painel</span>
              <ChevronRight size={16} />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center text-xs">
            <button
              onClick={onBackToLanding}
              className="text-slate-400 hover:text-white flex items-center space-x-1 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Voltar ao Site</span>
            </button>
            <span className="text-slate-500 font-mono text-[11px]">v2.5 Multi-Tenant</span>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED-IN ADMINISTRATIVE DASHBOARD
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" id="admin-dashboard-container">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 shadow-md">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-base shadow-md">
              <Utensils size={18} />
            </div>
            <span className="font-sans font-bold text-lg tracking-tight">Cardápio<span className="text-orange-500">Admin</span></span>
          </div>

          <nav className="hidden md:flex space-x-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('pdv')}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'pdv' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Receipt size={16} />
              <span>Painel PDV</span>
              {storePendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-black animate-pulse">
                  {storePendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('menu-editor');
                if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
              }}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'menu-editor' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Utensils size={15} />
              <span>{isSuperAdmin ? 'Editar Cardápios' : 'Cardápio'}</span>
            </button>
            <button
              onClick={() => setActiveTab('bot-settings')}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'bot-settings' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Bot size={15} />
              <span>Bot WhatsApp</span>
            </button>
            <button
              onClick={() => setActiveTab('motoboys')}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'motoboys' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Bike size={15} />
              <span>Motoboys</span>
              {currentStoreMotoboys.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white font-bold">
                  {currentStoreMotoboys.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('flyer-maker')}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'flyer-maker' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <Sparkles size={15} className="text-amber-400" />
              <span>Criador de Encartes</span>
            </button>
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'stores' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              <StoreIcon size={15} />
              <span>{isSuperAdmin ? 'Estabelecimentos' : 'Minha Loja'}</span>
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center space-x-1.5 ${activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                <Key size={15} />
                <span>Conta Admin</span>
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToLanding}
            className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ExternalLink size={12} />
            <span>Ver Site Público</span>
          </button>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <LogOut size={12} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Mobile Nav tab list */}
      <div className="bg-slate-800 text-slate-300 text-xs font-semibold flex md:hidden border-t border-slate-700 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('pdv')}
          className={`flex-1 min-w-[70px] text-center py-2.5 border-b-2 transition flex items-center justify-center space-x-1 ${activeTab === 'pdv' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          <span>PDV</span>
          {storePendingCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('menu-editor');
            if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
          }}
          className={`flex-1 min-w-[75px] text-center py-2.5 border-b-2 transition ${activeTab === 'menu-editor' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          Cardápio
        </button>
        <button
          onClick={() => setActiveTab('bot-settings')}
          className={`flex-1 min-w-[70px] text-center py-2.5 border-b-2 transition ${activeTab === 'bot-settings' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          Bot
        </button>
        <button
          onClick={() => setActiveTab('motoboys')}
          className={`flex-1 min-w-[80px] text-center py-2.5 border-b-2 transition ${activeTab === 'motoboys' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          Motoboys
        </button>
        <button
          onClick={() => setActiveTab('flyer-maker')}
          className={`flex-1 min-w-[85px] text-center py-2.5 border-b-2 transition flex items-center justify-center space-x-1 ${activeTab === 'flyer-maker' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          <Sparkles size={13} className="text-amber-400" />
          <span>Encartes</span>
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex-1 min-w-[75px] text-center py-2.5 border-b-2 transition ${activeTab === 'stores' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
        >
          {isSuperAdmin ? 'Lojas' : 'Loja'}
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[70px] text-center py-2.5 border-b-2 transition ${activeTab === 'settings' ? 'border-orange-500 text-white bg-slate-900/30' : 'border-transparent'}`}
          >
            Admin
          </button>
        )}
      </div>

      {/* 🚨 PERSISTENT ALERT IF PENDING ORDERS EXIST AND ON ANOTHER TAB */}
      {storePendingCount > 0 && activeTab !== 'pdv' && (
        <div 
          onClick={() => setActiveTab('pdv')}
          className="bg-red-600 text-white px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl z-30 cursor-pointer hover:bg-red-700 transition"
        >
          <div className="flex items-center space-x-2.5 text-sm font-bold text-center sm:text-left">
            <Bell className="animate-bounce shrink-0" size={22} />
            <div>
              <span>🚨 Você tem {storePendingCount} pedido(s) pendente(s) aguardando resposta!</span>
              <span className="block text-xs text-red-100 font-normal">O som não para até você aceitar ou recusar.</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {storePendingOrders[0] && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const orderToReject = storePendingOrders[0];
                    const updated = orders.map(o => o.id === orderToReject.id ? {
                      ...o,
                      status: 'cancelled' as OrderStatus,
                      cancellationReason: 'Recusado pelo painel'
                    } : o);
                    onUpdateOrders(updated);
                  }}
                  className="px-3.5 py-1.5 bg-red-800 hover:bg-red-950 text-white font-bold text-xs rounded-xl border border-white/30 shadow-xs cursor-pointer transition flex items-center space-x-1"
                >
                  <X size={14} />
                  <span>Recusar ({storePendingOrders[0].code})</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const orderToAccept = storePendingOrders[0];
                    const updated = orders.map(o => o.id === orderToAccept.id ? {
                      ...o,
                      status: 'preparing' as OrderStatus
                    } : o);
                    onUpdateOrders(updated);
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition flex items-center space-x-1"
                >
                  <Check size={14} />
                  <span>Aceitar ({storePendingOrders[0].code})</span>
                </button>
              </>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('pdv');
              }}
              className="px-4 py-1.5 bg-white text-red-600 hover:bg-red-50 text-xs font-black rounded-xl shadow-md shrink-0 cursor-pointer"
            >
              Abrir no PDV
            </button>
          </div>
        </div>
      )}

      {/* Main Scroller Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {/* NOTIFICAÇÃO DO PLANO E LINK DO ESTABELECIMENTO (5 DIAS RESTANTES OU EXPIRADO) */}
        {currentStore && (!isSuperAdmin || activeTab === 'pdv') && (() => {
          const planDetails = getStorePlanDetails(currentStore);

          if (currentStore.isBlocked) {
            return (
              <div className="mb-6 bg-red-600 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-red-500 animate-fadeIn">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <ShieldAlert size={28} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base">Página de Vendas Bloqueada</h4>
                    <p className="text-xs text-red-100 mt-0.5 max-w-xl">
                      Seu link público de cardápio está temporariamente bloqueado pelo Administrador Geral. Clientes não conseguem visualizar itens nem fazer pedidos.
                    </p>
                  </div>
                </div>
                <a
                  href={getAdminWhatsAppLink(adminSettings.superAdminWhatsapp, `Olá Administrador! O link do meu estabelecimento (${currentStore.name}) está bloqueado. Gostaria de solicitar a liberação.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <MessageCircle size={16} />
                  <span>Falar com o Administrador</span>
                </a>
              </div>
            );
          }

          if (planDetails.isExpired) {
            return (
              <div className="mb-6 bg-red-600 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-red-500 animate-fadeIn">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <AlertTriangle size={28} className="text-white animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base">Plano Expirado - Página Bloqueada!</h4>
                    <p className="text-xs text-red-100 mt-0.5 max-w-xl">
                      O período de dias online do seu estabelecimento terminou. Seu cardápio foi bloqueado automaticamente. Entre em contato com o Administrador Geral para adicionar mais dias e reativar suas vendas.
                    </p>
                  </div>
                </div>
                <a
                  href={getAdminWhatsAppLink(adminSettings.superAdminWhatsapp, `Olá Administrador! O plano do meu estabelecimento (${currentStore.name}) expirou e minha página foi bloqueada. Gostaria de adicionar mais dias online.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <MessageCircle size={16} />
                  <span>Renovar no WhatsApp</span>
                </a>
              </div>
            );
          }

          if (planDetails.isNearExpiration) {
            return (
              <div className="mb-6 bg-amber-500 text-slate-900 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border border-amber-400 animate-fadeIn">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/10 flex items-center justify-center shrink-0">
                    <Clock size={28} className="text-slate-900 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base">
                      Atenção: Restam {planDetails.remainingDays} {planDetails.remainingDays === 1 ? 'dia' : 'dias'} de funcionamento online!
                    </h4>
                    <p className="text-xs text-slate-900/90 font-medium mt-0.5 max-w-xl">
                      Quando o prazo terminar, sua página será bloqueada automaticamente. Entre em contato com o Administrador Geral agora para adicionar mais dias.
                    </p>
                  </div>
                </div>
                <a
                  href={getAdminWhatsAppLink(adminSettings.superAdminWhatsapp, `Olá Administrador! O plano do meu estabelecimento (${currentStore.name}) tem apenas ${planDetails.remainingDays} dias restantes. Gostaria de renovar agora para não bloquear minha página.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <MessageCircle size={16} />
                  <span>Contatar Administrador</span>
                </a>
              </div>
            );
          }

          return null;
        })()}
        
        {/* TAB 1: STORES LIST / LOJISTA DASHBOARD */}
        {activeTab === 'stores' && (
          <div className="space-y-6">
            {isSuperAdmin ? (
              /* SUPER ADMIN VIEW */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Estabelecimentos & Clientes Cadastrados
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Gerencie seus clientes, visualize as páginas de vendas, libere links e controle os acessos de cada lojista.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenCreateStore}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Adicionar Novo Cliente</span>
                  </button>
                </div>

                {/* Stores grid list for Super Admin */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {stores.map(store => {
                    const storeCategoriesCount = categories.filter(c => c.storeId === store.id).length;
                    const storeProductsCount = products.filter(p => p.storeId === store.id).length;
                    const isPassVisible = !!revealPasswordStoreId[store.id];
                    const planDetails = getStorePlanDetails(store);

                    return (
                      <div key={store.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                        <div className="p-5 space-y-4">
                          {/* Store Header */}
                          <div className="flex items-start gap-3.5">
                            <img
                              src={store.logoUrl}
                              alt={store.name}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-100 bg-slate-50 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h3 className="font-bold text-slate-900 text-sm truncate">{store.name}</h3>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${store.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                  {store.isActive ? 'Ativo' : 'Pausado'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">slug: {store.slug}</p>
                              <p className="text-[11px] text-slate-500 truncate mt-1">{store.address || 'Sem endereço informado'}</p>
                            </div>
                          </div>

                          {/* Sales Page URL Box */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span className="flex items-center space-x-1">
                                <StoreIcon size={12} className="text-orange-500" />
                                <span>Página de Vendas (Cardápio)</span>
                              </span>
                              {store.isApproved === false ? (
                                <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm font-semibold border border-amber-200 text-[9px]">
                                  Pendente
                                </span>
                              ) : store.isBlocked ? (
                                <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded-sm font-bold border border-red-200 text-[9px]">
                                  Bloqueado pelo Adm
                                </span>
                              ) : planDetails.isExpired ? (
                                <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded-sm font-bold border border-red-200 text-[9px]">
                                  Plano Expirado
                                </span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm font-semibold border border-emerald-200 text-[9px]">
                                  Liberado ({planDetails.remainingDays}d)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] text-slate-700 truncate select-all">
                                {getSalesPageUrl(store.slug)}
                              </span>
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopySalesLink(store.slug)}
                                  className="p-1 rounded-md hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                  title="Copiar Link de Vendas"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onGoToStore) {
                                      onGoToStore(store.slug);
                                    } else {
                                      window.location.hash = store.slug;
                                    }
                                  }}
                                  className="p-1 rounded-md hover:bg-orange-100 text-orange-600 transition cursor-pointer"
                                  title="Abrir Página de Vendas"
                                >
                                  <ExternalLink size={13} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Online Days / Subscription Management Box */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <span className="flex items-center space-x-1">
                                <Clock size={12} className="text-orange-500" />
                                <span>Dias Online / Validade do Plano</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                                planDetails.isExpired ? 'bg-red-100 text-red-700 border-red-200' :
                                planDetails.isNearExpiration ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse' :
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {planDetails.statusLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-600">
                                Tempo restante: <strong className={planDetails.remainingDays <= 5 ? 'text-amber-600 font-extrabold' : 'text-slate-800'}>{planDetails.remainingDays} dias</strong>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Expira: {new Date(store.planExpiresAt || Date.now()).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="pt-1.5 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60">
                              <span className="text-[9px] text-slate-400 font-bold uppercase w-full">Adicionar dias online:</span>
                              <button
                                type="button"
                                onClick={() => handleSetStoreDaysOnline(store.id, 15)}
                                className="px-2 py-1 bg-white hover:bg-orange-50 hover:border-orange-300 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition cursor-pointer"
                              >
                                +15 dias
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStoreDaysOnline(store.id, 30)}
                                className="px-2 py-1 bg-white hover:bg-orange-50 hover:border-orange-300 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition cursor-pointer"
                              >
                                +30 dias
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStoreDaysOnline(store.id, 60)}
                                className="px-2 py-1 bg-white hover:bg-orange-50 hover:border-orange-300 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition cursor-pointer"
                              >
                                +60 dias
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const customVal = prompt('Defina o número de dias online a partir de hoje:', String(store.daysOnline || 30));
                                  if (customVal && !isNaN(Number(customVal))) {
                                    handleSetStoreDaysOnline(store.id, Math.max(1, parseInt(customVal, 10)));
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[10px] font-bold transition cursor-pointer ml-auto"
                              >
                                Definir Dias
                              </button>
                            </div>
                          </div>

                          {/* Client Login Credentials Box */}
                          <div className="p-3 bg-orange-50/40 rounded-xl border border-orange-200/60 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-orange-800 uppercase tracking-wider">
                              <span className="flex items-center space-x-1">
                                <Key size={12} className="text-orange-600" />
                                <span>Acesso do Lojista (Painel Próprio)</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-white p-2 rounded-lg border border-orange-100">
                                <span className="text-[9px] text-slate-400 font-bold block uppercase">Usuário</span>
                                <span className="font-mono font-bold text-slate-800 truncate block">
                                  {store.ownerLogin || store.slug.replace(/[^a-z0-9]/gi, '')}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-orange-100 relative">
                                <span className="text-[9px] text-slate-400 font-bold block uppercase">Senha</span>
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-slate-800 truncate">
                                    {isPassVisible ? (store.ownerPassword || '123') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setRevealPasswordStoreId(prev => ({ ...prev, [store.id]: !prev[store.id] }))}
                                    className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                                  >
                                    {isPassVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppAccess(store)}
                                className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                              >
                                <Send size={11} />
                                <span>Enviar no WhatsApp</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyClientCredentials(store)}
                                className="py-1.5 px-2.5 bg-white hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                                title="Copiar Mensagem Pronta com Dados de Acesso"
                              >
                                <Copy size={11} />
                                <span>Copiar</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Store Card Footer Actions */}
                        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex justify-between items-center text-xs">
                          <div className="flex items-center space-x-1.5">
                            {store.isApproved === false ? (
                              <button
                                onClick={() => handleApproveStore(store.id)}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                                title="Aprovar e Liberar Link do Cardápio"
                              >
                                <Check size={12} />
                                <span>Liberar Link</span>
                              </button>
                            ) : store.isBlocked ? (
                              <button
                                onClick={() => handleToggleBlockStore(store.id, false)}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                                title="Desbloquear Link do Cardápio"
                              >
                                <Check size={12} />
                                <span>Liberar Link</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleBlockStore(store.id, true)}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                                title="Bloquear Link do Cliente"
                              >
                                <X size={12} />
                                <span>Bloquear Link</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => {
                                setSelectedStoreId(store.id);
                                setActiveTab('menu-editor');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-bold transition cursor-pointer flex items-center space-x-1"
                              title="Editar Cardápio Deste Cliente"
                            >
                              <List size={12} />
                              <span>Cardápio</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditStore(store)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                              title="Editar Informações do Estabelecimento"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition cursor-pointer"
                              title="Excluir Estabelecimento"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* STORE OWNER (LOJISTA) DEDICATED VIEW */
              currentStore && (
                <div className="space-y-6">
                  {/* Hero Header for Lojista */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-center space-x-5">
                        <img
                          src={currentStore.logoUrl}
                          alt={currentStore.name}
                          className="w-20 h-20 rounded-2xl object-cover border border-slate-100 bg-slate-50 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentStore.name}</h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                              Painel do Lojista
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Bem-vindo ao seu painel administrativo. Aqui você gerencia sua página de vendas, produtos, preços e pedidos.
                          </p>
                          <div className="mt-2 flex items-center space-x-2 text-xs">
                            {currentStore.isApproved !== false ? (
                              <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                                <CheckCircle2 size={13} />
                                <span>Página de Vendas Ativa e Liberada</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-semibold border border-amber-200">
                                <Clock size={13} />
                                <span>Aguardando Liberação do Administrador</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleOpenEditStore(currentStore)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer flex items-center space-x-1.5"
                        >
                          <Settings size={14} />
                          <span>Editar Informações da Loja</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('menu-editor');
                            if (currentStoreCategories.length > 0) {
                              setSelectedCategoryId(currentStoreCategories[0].id);
                            }
                          }}
                          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center space-x-1.5"
                        >
                          <Utensils size={14} />
                          <span>Gerenciar Meu Cardápio</span>
                        </button>
                      </div>
                    </div>

                    {/* Sales Page Highlight Banner */}
                    <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-200/80">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-orange-800 uppercase tracking-widest flex items-center space-x-1">
                            <Sparkles size={12} className="text-orange-500" />
                            <span>Link Oficial da sua Página de Vendas</span>
                          </span>
                          <p className="font-mono text-sm font-bold text-slate-800 select-all">
                            {getSalesPageUrl(currentStore.slug)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Divulgue este link no seu Instagram, WhatsApp e redes sociais para seus clientes fazerem pedidos.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              if (onGoToStore) {
                                onGoToStore(currentStore.slug);
                              } else {
                                window.location.hash = currentStore.slug;
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            <span>Ver Como o Cliente Vê</span>
                          </button>
                          <button
                            onClick={() => handleCopySalesLink(currentStore.slug)}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Copy size={13} />
                            <span>Copiar Link</span>
                          </button>
                          <button
                            onClick={() => handleShareMenuWhatsApp(currentStore)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Send size={13} />
                            <span>Divulgar no WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Cockpit (3 Columns) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Meu Cardápio */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                          <List size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-base">Meu Cardápio Online</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Adicione seus produtos, crie categorias, defina preços promocionais e organize seus adicionais.
                        </p>
                        <div className="mt-4 flex items-center space-x-4 text-xs font-semibold text-slate-700">
                          <div>
                            <span className="text-lg font-extrabold text-orange-600 block">{currentStoreCategories.length}</span>
                            <span className="text-slate-400 text-[10px] uppercase">Categorias</span>
                          </div>
                          <div className="h-8 w-px bg-slate-200" />
                          <div>
                            <span className="text-lg font-extrabold text-orange-600 block">{currentStoreProducts.length}</span>
                            <span className="text-slate-400 text-[10px] uppercase">Produtos</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('menu-editor');
                          if (currentStoreCategories.length > 0) {
                            setSelectedCategoryId(currentStoreCategories[0].id);
                          }
                        }}
                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
                      >
                        <span>Editar Produtos e Preços</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Card 2: Detalhes do Estabelecimento */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                          <Settings size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-base">Dados do Estabelecimento</h3>
                        <div className="mt-3 space-y-2 text-xs text-slate-600">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">WhatsApp de Pedidos</span>
                            <span className="font-semibold text-slate-800">{currentStore.phone || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Horário de Funcionamento</span>
                            <span className="font-semibold text-slate-800">{currentStore.workingHours || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Taxa de Entrega</span>
                            <span className="font-semibold text-slate-800">
                              {currentStore.deliveryFeeType === 'flat' 
                                ? `Fixa: R$ ${currentStore.deliveryFee.toFixed(2)}` 
                                : `Por Bairro (${(currentStore.neighborhoodFees || []).length} cadastrados)`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenEditStore(currentStore)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Editar Informações
                      </button>
                    </div>

                    {/* Card 3: Acesso & Segurança (Gerenciada pelo Administrador) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                          <Lock size={20} />
                        </div>
                        <h3 className="font-bold text-slate-900 text-base">Acesso & Segurança</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Credenciais de acesso do seu estabelecimento para login no painel.
                        </p>
                        <div className="mt-3 space-y-3 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Seu Usuário de Login</span>
                            <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block mt-0.5">
                              {currentStore.ownerLogin}
                            </span>
                          </div>
                          
                          <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide flex items-center space-x-1">
                              <ShieldCheck size={12} />
                              <span>Senha Gerenciada pelo Administrador</span>
                            </span>
                            <p className="text-[11px] text-amber-900/80 leading-relaxed">
                              Por regras de segurança, a alteração de senhas é controlada unicamente pelo Administrador do sistema. Caso necessite de redefinição, solicite diretamente ao suporte.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full py-2 px-3 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] rounded-xl text-center font-medium">
                        Status de Segurança: Protegido
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* TAB 2: MENU EDITOR (CATEGORIES & PRODUCTS) */}
        {activeTab === 'menu-editor' && (
          <div className="space-y-6">
            {/* Sales Page Quick Bar for the Current Store */}
            {currentStore && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={currentStore.logoUrl}
                    alt={currentStore.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-100 bg-slate-50 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 text-sm truncate">{currentStore.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700">
                        {isSuperAdmin ? 'Cliente Selecionado' : 'Seu Cardápio'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      Página de Vendas: {getSalesPageUrl(currentStore.slug)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (onGoToStore) {
                        onGoToStore(currentStore.slug);
                      } else {
                        window.location.hash = currentStore.slug;
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>Ver Página de Vendas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySalesLink(currentStore.slug)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    title="Copiar link"
                  >
                    <Copy size={12} />
                    <span className="hidden sm:inline">Copiar Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareMenuWhatsApp(currentStore)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    title="Divulgar cardápio no WhatsApp"
                  >
                    <Send size={12} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Store Selection Drawer & Category List (Left Side) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Estabelecimento Selecionado</label>
                  {isSuperAdmin ? (
                    <select
                      value={selectedStoreId}
                      onChange={e => {
                        setSelectedStoreId(e.target.value);
                        setSelectedCategoryId('');
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-slate-50 font-bold text-slate-800"
                    >
                      <option value="">-- Escolha um Cliente --</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full p-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 font-bold text-slate-800 flex items-center justify-between">
                      <span>{currentStore?.name}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700">Sua Loja</span>
                    </div>
                  )}
                </div>

              {selectedStoreId && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Categorias</h3>
                    <button
                      onClick={handleOpenCreateCategory}
                      className="flex items-center space-x-1 text-orange-600 hover:text-orange-700 text-[10px] font-bold cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Nova</span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                    {currentStoreCategories.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`p-3.5 flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                          selectedCategoryId === cat.id ? 'bg-orange-50 text-orange-950 border-l-4 border-orange-500' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <div className="flex items-center space-x-1.5 opacity-65 hover:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCategory(cat);
                            }}
                            className="p-1 hover:bg-slate-200 rounded-md"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id);
                            }}
                            className="p-1 hover:bg-red-50 text-red-600 rounded-md"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {currentStoreCategories.length === 0 && (
                      <p className="text-center py-8 text-slate-400 text-xs">Nenhuma categoria cadastrada ainda.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Products management panel (Right Side) */}
            <div className="lg:col-span-8 space-y-6">
              {!selectedStoreId ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Utensils size={48} className="text-slate-300 mb-4" />
                  <p className="text-sm font-semibold">Escolha um estabelecimento cliente para começar a editar seu cardápio.</p>
                </div>
              ) : !selectedCategoryId ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center">
                  <FolderPlus size={48} className="text-slate-300 mb-4" />
                  <p className="text-sm font-semibold">Selecione uma categoria ao lado para gerenciar os produtos dela.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Categoria selecionada</span>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {categories.find(c => c.id === selectedCategoryId)?.name}
                      </h3>
                    </div>

                    <button
                      onClick={handleOpenCreateProduct}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Adicionar Produto</span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {categoryProducts.map(prod => (
                      <div key={prod.id} className="p-4 flex gap-4 items-center justify-between text-xs font-semibold">
                        <div className="flex gap-4 items-center min-w-0">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-xs truncate pr-4">{prod.name}</h4>
                            <p className="text-slate-500 text-[11px] line-clamp-1 font-normal mt-0.5">{prod.description}</p>
                            <div className="flex items-center flex-wrap gap-2 mt-1.5">
                              <span className="font-mono text-slate-800 font-bold">R$ {prod.price.toFixed(2)}</span>
                              {prod.originalPrice && prod.originalPrice > prod.price && (
                                <span className="text-[10px] text-slate-400 line-through font-mono">
                                  R$ {prod.originalPrice.toFixed(2)}
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                prod.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {prod.isAvailable ? 'Disponível' : 'Fora de Estoque'}
                              </span>
                              {prod.isFeatured && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                  <Star size={10} className="fill-amber-500 text-amber-500" />
                                  <span>Destaque & Desconto</span>
                                </span>
                              )}
                              {(prod.options || []).length > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                  {(prod.options || []).length} Modificadores
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleProductFeatured(prod.id)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              prod.isFeatured
                                ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                                : 'border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-amber-600'
                            }`}
                            title={prod.isFeatured ? 'Remover Destaque / Desconto' : 'Marcar como Destaque com Desconto'}
                          >
                            <Star size={13} className={prod.isFeatured ? 'fill-amber-500 text-amber-500' : ''} />
                          </button>
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                            title="Editar Produto"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition cursor-pointer"
                            title="Excluir Produto"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {categoryProducts.length === 0 && (
                      <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center">
                        <ShoppingCart size={32} className="text-slate-300 mb-2" />
                        <span>Nenhum produto cadastrado nesta categoria ainda.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* TAB 3: ADMIN ACCOUNT SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-800 mb-1.5 flex items-center space-x-2">
              <Key size={18} className="text-orange-500" />
              <span>Alterar Credenciais Administrativas</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6">Mude o usuário e a senha master que dão acesso a este painel administrativo.</p>

            <form onSubmit={handleSaveAdminSettings} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Novo Usuário Admin</label>
                <input
                  required
                  type="text"
                  placeholder="admin"
                  value={newLogin}
                  onChange={e => setNewLogin(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nova Senha Master</label>
                <input
                  required
                  type="password"
                  placeholder="admin"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp do Administrador Geral</label>
                <input
                  type="text"
                  placeholder="5511999999999"
                  value={superAdminWhatsappInput}
                  onChange={e => setSuperAdminWhatsappInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-hidden text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Número de WhatsApp usado no botão da página inicial e para os lojistas solicitarem renovação de planos online.
                </span>
              </div>

              {settingsSuccess && (
                <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center animate-fadeIn">
                  ✓ {settingsSuccess}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Salvar Configurações
              </button>
            </form>
          </div>
        )}

        {/* TAB: PDV & FLUXO DE CAIXA */}
        {activeTab === 'pdv' && (
          <div className="space-y-6">
            {isSuperAdmin && stores.length > 1 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <StoreIcon size={18} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-700">Selecione o Estabelecimento para o PDV:</span>
                </div>
                <select
                  value={selectedStoreId}
                  onChange={e => setSelectedStoreId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({orders.filter(o => o.storeId === s.id && o.status === 'pending').length} pendentes)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentStore ? (
              <PDVPanel
                store={currentStore}
                orders={orders}
                cashTransactions={cashTransactions}
                motoboys={motoboys}
                isSuperAdmin={isSuperAdmin}
                onUpdateOrders={onUpdateOrders || (() => {})}
                onUpdateCashTransactions={onUpdateCashTransactions || (() => {})}
                onUpdateStore={(updatedStore) => {
                  const updatedStores = stores.map(s => s.id === updatedStore.id ? updatedStore : s);
                  onUpdateData(updatedStores, categories, products, adminSettings);
                }}
              />
            ) : (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                Nenhum estabelecimento selecionado.
              </div>
            )}
          </div>
        )}

        {/* TAB: BOT DE NOTIFICAÇÕES WHATSAPP */}
        {activeTab === 'bot-settings' && (
          <div className="space-y-6">
            {isSuperAdmin && stores.length > 1 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Bot size={18} className="text-emerald-500" />
                  <span className="text-xs font-bold text-slate-700">Configurar Mensagens do Bot da Loja:</span>
                </div>
                <select
                  value={selectedStoreId}
                  onChange={e => setSelectedStoreId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentStore ? (
              <NotificationSettingsView
                store={currentStore}
                onUpdateStore={(updatedStore) => {
                  const updatedStores = stores.map(s => s.id === updatedStore.id ? updatedStore : s);
                  onUpdateData(updatedStores, categories, products, adminSettings);
                }}
                onShowToast={showToast}
              />
            ) : (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                Nenhum estabelecimento selecionado.
              </div>
            )}
          </div>
        )}

        {/* TAB: GESTÃO DE MOTOBOYS & REPASSE POR BAIRRO */}
        {activeTab === 'motoboys' && (
          <div className="space-y-6">
            {isSuperAdmin && stores.length > 1 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Bike size={18} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-700">Estabelecimento Ativo para Motoboys:</span>
                </div>
                <select
                  value={selectedStoreId}
                  onChange={e => setSelectedStoreId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({motoboys.filter(m => m.storeId === s.id).length} motoboys)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentStore ? (
              <MotoboysManager
                store={currentStore}
                motoboys={motoboys}
                orders={orders}
                onUpdateMotoboys={onUpdateMotoboys || (() => {})}
                onUpdateOrders={onUpdateOrders}
                onUpdateStore={(updatedStore) => {
                  const updatedStores = stores.map(s => s.id === updatedStore.id ? updatedStore : s);
                  onUpdateData(updatedStores, categories, products, adminSettings);
                }}
                onShowToast={showToast}
              />
            ) : (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                Nenhum estabelecimento selecionado.
              </div>
            )}
          </div>
        )}

        {/* TAB: CRIADOR DE ENCARTE RÁPIDO PARA REDES SOCIAIS */}
        {activeTab === 'flyer-maker' && currentStore && (
          <div className="space-y-6">
            <FlyerMaker
              stores={isSuperAdmin ? stores : [currentStore]}
              currentStore={currentStore}
              products={products}
              onSelectStore={(id) => setSelectedStoreId(id)}
            />
          </div>
        )}
      </main>

      {/* ----------------------------------------------------
          STORE EDITOR MODAL (POPUP)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {editingStore && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingStore(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    {isCreatingStore ? 'Adicionar Estabelecimento Cliente' : 'Editar Informações'}
                  </h3>
                  <button onClick={() => setEditingStore(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center cursor-pointer">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Estabelecimento *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: Pizzaria Gourmet"
                        value={editingStore.name || ''}
                        onChange={e => setEditingStore({ ...editingStore, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Slug da URL * (apenas letras e traços)</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: pizza-gourmet"
                        value={editingStore.slug || ''}
                        onChange={e => setEditingStore({ ...editingStore, slug: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp Recebimento * (com DDI)</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: 5511999999999"
                        value={editingStore.phone || ''}
                        onChange={e => setEditingStore({ ...editingStore, phone: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horário de Funcionamento</label>
                      <input
                        type="text"
                        placeholder="Ex: Quarta a Domingo das 18h às 23h"
                        value={editingStore.workingHours || ''}
                        onChange={e => setEditingStore({ ...editingStore, workingHours: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Endereço Físico Completo *</label>
                    <input
                      required
                      type="text"
                      placeholder="Rua, Número, Bairro, Cidade..."
                      value={editingStore.address || ''}
                      onChange={e => setEditingStore({ ...editingStore, address: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ImageUploadField
                      label="Logo do Estabelecimento"
                      value={editingStore.logoUrl || ''}
                      onChange={url => setEditingStore({ ...editingStore, logoUrl: url })}
                      aspectRatio="square"
                      maxDimension={400}
                      helperText="Escolha do seu dispositivo ou cole um link web. Formato quadrado (1:1)."
                    />
                    <ImageUploadField
                      label="Foto de Capa do Cardápio"
                      value={editingStore.coverUrl || ''}
                      onChange={url => setEditingStore({ ...editingStore, coverUrl: url })}
                      aspectRatio="banner"
                      maxDimension={1200}
                      helperText="Escolha do seu dispositivo ou cole um link web. Formato panorâmico (16:9)."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Taxa de Entrega</label>
                      <select
                        value={editingStore.deliveryFeeType || 'flat'}
                        onChange={e => setEditingStore({ ...editingStore, deliveryFeeType: e.target.value as 'flat' | 'neighborhood' })}
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="flat">Taxa Única / Fixa</option>
                        <option value="neighborhood">Configurável por Bairro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Taxa de Entrega Padrão (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingStore.deliveryFee ?? 0}
                        onChange={e => setEditingStore({ ...editingStore, deliveryFee: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Mínimo do Pedido (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingStore.minOrder ?? 0}
                        onChange={e => setEditingStore({ ...editingStore, minOrder: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  {/* Neighborhood configured fees (Conditional on 'neighborhood' selected) */}
                  {editingStore.deliveryFeeType === 'neighborhood' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <h4 className="font-bold text-[10px] text-slate-600 uppercase tracking-wider">Taxas por Bairros</h4>
                      
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Nome do Bairro</label>
                          <input
                            type="text"
                            placeholder="Ex: Copacabana"
                            value={newNeighborhoodName}
                            onChange={e => setNewNeighborhoodName(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-[9px] text-slate-400 uppercase mb-0.5">Taxa (R$)</label>
                          <input
                            type="number"
                            step="0.10"
                            value={newNeighborhoodFee}
                            onChange={e => setNewNeighborhoodFee(Number(e.target.value))}
                            className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddNeighborhoodFee}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2">
                        {(editingStore.neighborhoodFees || []).map(f => (
                          <div key={f.id} className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded-md">
                            <span>{f.name}</span>
                            <div className="flex items-center space-x-3 font-semibold">
                              <span>R$ {f.fee.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveNeighborhoodFee(f.id)}
                                className="text-red-600 hover:scale-105"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cor do Tema (Hex ou Tailwind)</label>
                      <input
                        type="text"
                        placeholder="Ex: #ef4444"
                        value={editingStore.themeColor || ''}
                        onChange={e => setEditingStore({ ...editingStore, themeColor: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Instagram (URL)</label>
                      <input
                        type="text"
                        placeholder="Ex: @minhaloja"
                        value={editingStore.instagramUrl || ''}
                        onChange={e => setEditingStore({ ...editingStore, instagramUrl: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Status Ativo</label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingStore({ ...editingStore, isActive: !editingStore.isActive })}
                          className="text-slate-700 cursor-pointer"
                        >
                          {editingStore.isActive ? <ToggleRight className="text-orange-500" size={32} /> : <ToggleLeft className="text-slate-300" size={32} />}
                        </button>
                        <span>Exibir no catálogo público</span>
                      </div>
                    </div>
                  </div>

                  {/* ADMIN GERAL: DIAS ONLINE, BLOQUEIO MANUAL & NOTA DE AVALIAÇÃO */}
                  {isSuperAdmin && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                        Controle de Acesso & Assinatura (Admin Geral)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Dias Online do Estabelecimento
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editingStore.daysOnline ?? 30}
                            onChange={e => {
                              const days = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setEditingStore({
                                ...editingStore,
                                daysOnline: days,
                                planExpiresAt: calculatePlanExpiration(days)
                              });
                            }}
                            className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Ao faltar 5 dias ele recebe notificação. Se expirar, a página é bloqueada.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Nota de Avaliação (1.0 a 5.0)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            value={editingStore.rating ?? 4.9}
                            onChange={e => setEditingStore({ ...editingStore, rating: Number(e.target.value) })}
                            className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Exibida nos cards de destaque da página inicial.
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Bloquear Link do Cliente
                          </label>
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingStore({ ...editingStore, isBlocked: !editingStore.isBlocked })}
                              className="text-slate-700 cursor-pointer"
                            >
                              {editingStore.isBlocked ? <ToggleRight className="text-red-500" size={32} /> : <ToggleLeft className="text-slate-300" size={32} />}
                            </button>
                            <span className={`text-[11px] font-bold ${editingStore.isBlocked ? 'text-red-600' : 'text-emerald-700'}`}>
                              {editingStore.isBlocked ? 'Link Bloqueado' : 'Link Liberado'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Se bloqueado, a página exibe aviso de bloqueio.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seção de Credenciais de Acesso (Lojista/Admin) */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">
                      Dados de Acesso (Painel do Lojista)
                    </span>
                    {isSuperAdmin ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail do Proprietário</label>
                            <input
                              type="email"
                              placeholder="Ex: joao@loja.com"
                              value={editingStore.ownerEmail || ''}
                              onChange={e => setEditingStore({ ...editingStore, ownerEmail: e.target.value })}
                              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usuário de Login *</label>
                            <input
                              required
                              type="text"
                              placeholder="Ex: loginlojista"
                              value={editingStore.ownerLogin || ''}
                              onChange={e => setEditingStore({ ...editingStore, ownerLogin: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                              className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha de Acesso *</label>
                            <input
                              required
                              type="text"
                              placeholder="Ex: senhalojista"
                              value={editingStore.ownerPassword || ''}
                              onChange={e => setEditingStore({ ...editingStore, ownerPassword: e.target.value })}
                              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono"
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-400">
                          Somente o Administrador tem permissão para definir ou alterar o usuário e a senha deste lojista.
                        </div>
                      </>
                    ) : (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Lock size={14} className="text-slate-400" />
                            <span className="font-bold text-slate-700">Seu Usuário de Acesso:</span>
                            <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                              {editingStore.ownerLogin}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Senha: •••••••• (A alteração de senhas é gerenciada exclusivamente pelo Administrador).
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                          🔒 Senha Protegida
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingStore(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveStore}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-md cursor-pointer"
                  >
                    Salvar Dados
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          CATEGORY EDITOR MODAL (POPUP)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {editingCategory && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCategory(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative"
              >
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    {isCreatingCategory ? 'Nova Categoria' : 'Editar Categoria'}
                  </h3>
                  <button onClick={() => setEditingCategory(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome da Categoria *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Entradas, Hambúrgueres..."
                      value={editingCategory.name || ''}
                      onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ordem de Exibição (Numérica)</label>
                    <input
                      type="number"
                      value={editingCategory.order ?? 1}
                      onChange={e => setEditingCategory({ ...editingCategory, order: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
                  <button onClick={() => setEditingCategory(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={handleSaveCategory} className="px-4 py-1.5 bg-orange-500 text-white font-semibold rounded-lg shadow-sm cursor-pointer">
                    Salvar
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          PRODUCT EDITOR MODAL (POPUP)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
              >
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    {isCreatingProduct ? 'Adicionar Novo Item' : 'Editar Produto'}
                  </h3>
                  <button onClick={() => setEditingProduct(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center cursor-pointer">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Produto *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: Coca-cola em lata"
                        value={editingProduct.name || ''}
                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Preço do Produto (R$) *</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="Ex: 14.90"
                        value={editingProduct.price ?? ''}
                        onChange={e => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição / Ingredientes</label>
                    <textarea
                      placeholder="Ex: blend de carne de 120g, cheddar duplo..."
                      value={editingProduct.description || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 h-16 resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <ImageUploadField
                      label="Foto do Produto (Cardápio)"
                      value={editingProduct.imageUrl || ''}
                      onChange={url => setEditingProduct({ ...editingProduct, imageUrl: url })}
                      aspectRatio="product"
                      maxDimension={800}
                      helperText="Escolha uma foto do seu dispositivo ou cole um link web. Proporção 4:3."
                    />

                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="block text-[11px] font-bold text-slate-800">Disponibilidade em Estoque</span>
                        <span className="text-[10px] text-slate-400">Quando indisponível, clientes não poderão adicionar à sacola</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, isAvailable: !editingProduct.isAvailable })}
                          className="text-slate-700 cursor-pointer"
                        >
                          {editingProduct.isAvailable ? <ToggleRight className="text-emerald-500" size={32} /> : <ToggleLeft className="text-slate-300" size={32} />}
                        </button>
                        <span className={`font-bold text-xs ${editingProduct.isAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {editingProduct.isAvailable ? 'Disponível' : 'Esgotado'}
                        </span>
                      </div>
                    </div>

                    {/* PRODUTO EM DESTAQUE COM TEXTO PERSONALIZADO E TAMANHO ESPECÍFICO */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                            <Star size={16} className={editingProduct.isFeatured ? 'fill-amber-500 text-amber-500' : ''} />
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-amber-950">Destacar Produto no Cardápio</span>
                            <span className="text-[10px] text-amber-800/80">Exibe selo de destaque personalizado e pré-seleciona o tamanho em destaque</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editingProduct.isFeatured;
                            setEditingProduct({
                              ...editingProduct,
                              isFeatured: next,
                              featuredTag: next ? (editingProduct.featuredTag || '⭐ Mais Pedido!') : undefined
                            });
                          }}
                          className="text-slate-700 cursor-pointer"
                        >
                          {editingProduct.isFeatured ? <ToggleRight className="text-amber-500" size={32} /> : <ToggleLeft className="text-slate-300" size={32} />}
                        </button>
                      </div>

                      {editingProduct.isFeatured && (() => {
                        const productSizesOption = (editingProduct.options || []).find(isSizeOption);
                        const sizeChoices = productSizesOption?.choices || [];
                        const hasSizes = sizeChoices.length > 0;

                        return (
                          <div className="pt-3 border-t border-amber-200/80 space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-amber-950 uppercase mb-1">
                                🏷️ Texto do Selo em Destaque
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Mais Pedido!, Especial da Casa, Combo Campeão..."
                                value={editingProduct.featuredTag || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, featuredTag: e.target.value })}
                                className="w-full p-2.5 bg-white rounded-lg border border-amber-400 text-xs font-bold text-slate-800"
                              />
                              <span className="text-[9px] text-amber-800 mt-1 block">
                                Esse texto aparecerá em destaque sobre a foto e no botão de tamanho do produto.
                              </span>
                            </div>

                            {hasSizes && (
                              <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-300/80">
                                <label className="block text-[10px] font-extrabold text-amber-950 uppercase mb-1">
                                  🍕 Tamanho que ficará em Destaque:
                                </label>
                                <select
                                  value={editingProduct.featuredSizeId || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const matched = sizeChoices.find(c => c.id === val);
                                    setEditingProduct({
                                      ...editingProduct,
                                      featuredSizeId: val || undefined,
                                      featuredSizeName: matched ? matched.name : undefined
                                    });
                                  }}
                                  className="w-full p-2 bg-white rounded-lg border border-amber-400 text-xs font-bold text-amber-950 cursor-pointer"
                                >
                                  <option value="">Nenhum tamanho específico (destacar produto geral)</option>
                                  {sizeChoices.map(sc => (
                                    <option key={sc.id} value={sc.id}>
                                      🍕 Tamanho: {sc.name} (Preço: R$ {sc.price.toFixed(2)})
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[9px] text-amber-800 mt-1 block">
                                  O cliente verá este tamanho em evidência imediata com o selo e pré-selecionado na sacola.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Modifiers / Optional Addons Section */}
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Modificadores / Opcionais do Produto</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setNewOption({ name: '', type: 'single', required: false, choices: [] });
                          setIsEditingOptions(true);
                        }}
                        className="flex items-center space-x-1 text-orange-500 font-bold hover:scale-102"
                      >
                        <Plus size={14} />
                        <span>Adicionar Grupo</span>
                      </button>
                    </div>

                    {/* Active product modifiers options list */}
                    <div className="space-y-3">
                      {(editingProduct.options || []).map(opt => (
                        <div key={opt.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase mr-2 ${
                              opt.required ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {opt.required ? 'Obrigatório' : 'Opcional'}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{opt.name}</span>
                            <span className="text-[10px] text-slate-500 ml-1.5">({opt.choices.length} opções cadastradas)</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setNewOption({ ...opt });
                                setIsEditingOptions(true);
                              }}
                              className="text-slate-600 hover:text-slate-900 p-1 hover:bg-slate-200 rounded-md"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveOptionFromProduct(opt.id)}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-slate-200 rounded-md"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {(editingProduct.options || []).length === 0 && (
                        <p className="text-center py-4 bg-slate-50 rounded-xl text-slate-400 italic">Nenhum adicional ou modificador cadastrado para este produto.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-md cursor-pointer"
                  >
                    Salvar Produto
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          OPTIONS CONSTRUCTOR POPUP (SUB-MODAL)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {isEditingOptions && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingOptions(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative"
              >
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Configurar Grupo de Opcionais</h3>
                  <button onClick={() => setIsEditingOptions(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Grupo *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Escolha o sabor, Adicionais..."
                      value={newOption.name || ''}
                      onChange={e => setNewOption({ ...newOption, name: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Seleção</label>
                      <select
                        value={newOption.type || 'single'}
                        onChange={e => setNewOption({ ...newOption, type: e.target.value as 'single' | 'multiple' })}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="single">Seleção Única (Radio)</option>
                        <option value="multiple">Múltipla Seleção (Checkbox)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Obrigatoriedade</label>
                      <div className="flex items-center space-x-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => setNewOption({ ...newOption, required: !newOption.required })}
                          className="text-slate-700 cursor-pointer"
                        >
                          {newOption.required ? <ToggleRight className="text-orange-500" size={28} /> : <ToggleLeft className="text-slate-300" size={28} />}
                        </button>
                        <span>Cliente é obrigado a escolher</span>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">🍕 Definir como Grupo de Tamanhos</span>
                        <span className="text-[10px] text-amber-800">
                          Identifica este grupo como variação de tamanho do produto (ex: Broto, Média, Grande)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewOption({ ...newOption, isSize: !newOption.isSize })}
                        className="text-slate-700 cursor-pointer shrink-0 ml-2"
                      >
                        {newOption.isSize ? <ToggleRight className="text-amber-500" size={28} /> : <ToggleLeft className="text-slate-300" size={28} />}
                      </button>
                    </div>
                  </div>

                  {/* Add Choices (items inside this option group) */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                        Opções de Escolha / Tamanhos
                      </h4>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        💡 Você pode editar o preço direto sem deletar
                      </span>
                    </div>
                    
                    {/* Add Choice Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="sm:col-span-7">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nome do Item / Tamanho</label>
                        <input
                          type="text"
                          placeholder="Ex: Grande (8 fatias)"
                          value={newChoiceName}
                          onChange={e => setNewChoiceName(e.target.value)}
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.10"
                          value={newChoicePrice}
                          onChange={e => setNewChoicePrice(Number(e.target.value))}
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddChoiceToOption}
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-xs flex items-center justify-center space-x-1"
                        >
                          <Plus size={14} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>

                    {/* Choices List with Direct Price & Name Editing */}
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {(newOption.choices || []).map(choice => {
                        const isEditingThisChoice = editingChoiceId === choice.id;

                        if (isEditingThisChoice) {
                          return (
                            <div key={choice.id} className="bg-orange-50 border border-orange-300 p-2.5 rounded-xl flex items-center gap-2">
                              <input
                                type="text"
                                value={editingChoiceName}
                                onChange={e => setEditingChoiceName(e.target.value)}
                                className="flex-1 p-1.5 bg-white rounded-lg border border-orange-300 text-xs font-bold text-slate-800"
                                placeholder="Nome da opção"
                              />
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-bold text-slate-500">R$</span>
                                <input
                                  type="number"
                                  step="0.10"
                                  value={editingChoicePrice}
                                  onChange={e => setEditingChoicePrice(Number(e.target.value))}
                                  className="w-20 p-1.5 bg-white rounded-lg border border-orange-300 text-xs font-mono font-bold text-slate-900"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleSaveChoiceEdit}
                                className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
                                title="Salvar alteração"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingChoiceId(null)}
                                className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={choice.id} className="flex justify-between items-center bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs hover:border-slate-300 transition">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-800">{choice.name}</span>
                              <button
                                type="button"
                                onClick={() => handleStartEditChoice(choice)}
                                className="text-slate-400 hover:text-orange-500 p-0.5 rounded cursor-pointer"
                                title="Editar nome e preço"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>

                            <div className="flex items-center space-x-2 font-semibold text-xs">
                              {/* Direct price inline input so owner can quickly change price without deleting! */}
                              <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                <span className="text-[11px] text-slate-400 font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  value={choice.price}
                                  onChange={e => handleQuickUpdateChoicePrice(choice.id, Number(e.target.value))}
                                  className="w-16 bg-transparent text-right font-mono font-bold text-slate-900 text-xs focus:outline-hidden"
                                  title="Digite o novo preço diretamente aqui"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveChoiceFromOption(choice.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition cursor-pointer"
                                title="Remover esta opção"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
                  <button onClick={() => setIsEditingOptions(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={handleSaveNewOption} className="px-4 py-1.5 bg-orange-500 text-white font-semibold rounded-lg shadow-sm cursor-pointer">
                    Salvar Grupo
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          CLIENT CREATED SUCCESS MODAL (SUPER ADMIN CELEBRATION)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {clientCreatedSuccess && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClientCreatedSuccess(null)}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center relative overflow-hidden">
                  <button
                    onClick={() => setClientCreatedSuccess(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                  <div className="w-14 h-14 bg-white text-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-3">
                    <Sparkles size={28} />
                  </div>
                  <h3 className="font-sans font-extrabold text-xl text-white">Cliente Criado com Sucesso!</h3>
                  <p className="text-orange-100 text-xs mt-1">
                    O estabelecimento foi cadastrado e seu cardápio inicial já está configurado.
                  </p>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  {/* Store summary */}
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <img
                      src={clientCreatedSuccess.logoUrl}
                      alt={clientCreatedSuccess.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm">{clientCreatedSuccess.name}</h4>
                      <p className="text-slate-500 text-[11px] font-mono">slug: {clientCreatedSuccess.slug}</p>
                    </div>
                  </div>

                  {/* Sales Page link */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Página de Vendas do Cliente</span>
                      <span className="text-emerald-600 font-semibold">Link Pronto</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-800 truncate font-semibold">
                        {getSalesPageUrl(clientCreatedSuccess.slug)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySalesLink(clientCreatedSuccess.slug)}
                        className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer shrink-0"
                        title="Copiar Link de Vendas"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Client Access Credentials Box */}
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 space-y-2.5">
                    <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider block">
                      Credenciais para o Lojista Acessar o Painel Próprio
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-2.5 rounded-xl border border-orange-200/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Usuário de Login</span>
                        <span className="font-mono font-bold text-slate-800 text-sm truncate block">
                          {clientCreatedSuccess.ownerLogin}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-orange-200/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Senha</span>
                        <span className="font-mono font-bold text-slate-800 text-sm truncate block">
                          {clientCreatedSuccess.ownerPassword}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      O cliente usará esses dados na tela de login para gerenciar apenas o seu próprio cardápio e sua página de vendas.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppAccess(clientCreatedSuccess)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Send size={14} />
                      <span>Enviar Credenciais e Link pelo WhatsApp</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleCopyClientCredentials(clientCreatedSuccess)}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Copy size={14} />
                      <span>Copiar Mensagem de Boas-Vindas</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setClientCreatedSuccess(null)}
                    className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStoreId(clientCreatedSuccess.id);
                      setActiveTab('menu-editor');
                      setClientCreatedSuccess(null);
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Editar Cardápio Deste Cliente</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          FLOATING TOAST NOTIFICATION
         ---------------------------------------------------- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2.5 text-xs font-semibold"
          >
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
