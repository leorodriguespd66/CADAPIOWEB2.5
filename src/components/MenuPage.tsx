import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ShoppingBag, Plus, Minus, X, MapPin, Clock, Phone, 
  Bike, Check, ArrowLeft, AlertCircle, Trash2, ShieldCheck, Clipboard,
  Star, Flame, Navigation, ExternalLink, Radio, Sparkles, Instagram,
  BellRing, CheckCircle2, XCircle, Truck, ChefHat
} from 'lucide-react';
import { Store, Category, Product, CartItem, OrderDetails, OptionChoice, Order, OrderItem } from '../types';
import { 
  isSizeOption, 
  getSizeChoicePrice, 
  calculateItemPrice, 
  getProductDisplayPricing 
} from '../utils/productPricing';
import { getStoreHoursStatus } from '../utils/storeHours';
import { calculateStoreRating } from '../utils/rating';
import { notificationAudio } from '../utils/notificationAudio';
import LiveOrderTrackingModal from './LiveOrderTrackingModal';

interface MenuPageProps {
  store: Store;
  categories: Category[];
  products: Product[];
  orders?: Order[];
  onBackToLanding: () => void;
  onPlaceOrder?: (newOrder: Order) => void;
  onUpdateOrders?: (orders: Order[]) => void;
}

export default function MenuPage({ store, categories, products, orders = [], onBackToLanding, onPlaceOrder, onUpdateOrders }: MenuPageProps) {
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Real-time status notification toast state
  const [statusToast, setStatusToast] = useState<{
    type: 'accepted' | 'delivering' | 'cancelled' | 'completed';
    title: string;
    message: string;
    orderCode: string;
    driverName?: string;
    cancellationReason?: string;
  } | null>(null);

  // Helper to check if an order was created today and is recent (prevents past days' orders from reappearing)
  const isOrderFromToday = (order: Order): boolean => {
    if (!order || !order.createdAt) return false;
    try {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const isSameDay = orderDate.getFullYear() === now.getFullYear() &&
                        orderDate.getMonth() === now.getMonth() &&
                        orderDate.getDate() === now.getDate();
      const isRecent = (now.getTime() - orderDate.getTime()) < 4 * 60 * 60 * 1000;
      return isSameDay && isRecent;
    } catch {
      return false;
    }
  };

  // Placed Order Code & ID with localStorage memory (ONLY if created today)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('cardapio_orders');
      const savedId = localStorage.getItem(`active_order_id_${store.id}`);
      if (raw && savedId) {
        const list: Order[] = JSON.parse(raw);
        const found = list.find(o => o.id === savedId && o.storeId === store.id);
        if (found && isOrderFromToday(found)) {
          return savedId;
        }
      }
      // If order is old or not from today, cleanup localStorage
      localStorage.removeItem(`active_order_id_${store.id}`);
      localStorage.removeItem(`active_order_code_${store.id}`);
      return null;
    } catch {
      return null;
    }
  });

  const [placedOrderCode, setPlacedOrderCode] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('cardapio_orders');
      const savedCode = localStorage.getItem(`active_order_code_${store.id}`);
      if (raw && savedCode) {
        const list: Order[] = JSON.parse(raw);
        const found = list.find(o => o.code === savedCode && o.storeId === store.id);
        if (found && isOrderFromToday(found)) {
          return savedCode;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Find real-time placed order in orders list across all connected devices (ONLY if from today)
  const currentPlacedOrder = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    let found: Order | undefined;
    if (placedOrderId) {
      found = orders.find(o => o.id === placedOrderId);
    }
    if (!found && placedOrderCode) {
      found = orders.find(o => o.code === placedOrderCode);
    }
    if (found && isOrderFromToday(found)) {
      return found;
    }
    return null;
  }, [orders, placedOrderId, placedOrderCode]);

  // Track status changes and trigger sound + visual notification
  const lastKnownStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentPlacedOrder) {
      lastKnownStatusRef.current = null;
      return;
    }

    const currentStatus = currentPlacedOrder.status;
    const prevStatus = lastKnownStatusRef.current;

    // Trigger notification when merchant updates status
    if (prevStatus && prevStatus !== currentStatus) {
      if (currentStatus === 'preparing') {
        notificationAudio.playAccepted();
        setStatusToast({
          type: 'accepted',
          title: '🎉 Pedido Aceito pela Loja!',
          message: `O estabelecimento aceitou seu pedido ${currentPlacedOrder.code} e a cozinha já começou o preparo!`,
          orderCode: currentPlacedOrder.code
        });
      } else if (currentStatus === 'delivering') {
        notificationAudio.playDelivering();
        setStatusToast({
          type: 'delivering',
          title: '🛵 Saiu para Entrega!',
          message: `Seu pedido ${currentPlacedOrder.code} acabou de sair e está a caminho do seu endereço! ${currentPlacedOrder.driverName ? `Entregador: ${currentPlacedOrder.driverName}` : ''}`,
          orderCode: currentPlacedOrder.code,
          driverName: currentPlacedOrder.driverName
        });
      } else if (currentStatus === 'cancelled') {
        notificationAudio.playCancelled();
        setStatusToast({
          type: 'cancelled',
          title: '❌ Pedido Recusado pelo Estabelecimento',
          message: `O pedido ${currentPlacedOrder.code} não pôde ser aceito. Motivo: "${currentPlacedOrder.cancellationReason || 'Itens indisponíveis ou loja ocupada'}"`,
          orderCode: currentPlacedOrder.code,
          cancellationReason: currentPlacedOrder.cancellationReason
        });
      } else if (currentStatus === 'completed') {
        notificationAudio.playCompleted();
        setStatusToast({
          type: 'completed',
          title: '✅ Pedido Entregue com Sucesso!',
          message: `Seu pedido ${currentPlacedOrder.code} foi finalizado. Bom apetite!`,
          orderCode: currentPlacedOrder.code
        });
      }
    }

    lastKnownStatusRef.current = currentStatus;
  }, [currentPlacedOrder?.status, currentPlacedOrder?.code, currentPlacedOrder?.cancellationReason, currentPlacedOrder?.driverName]);

  // Dismiss notification toast after 9 seconds
  useEffect(() => {
    if (statusToast) {
      const timer = setTimeout(() => {
        setStatusToast(null);
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [statusToast]);

  // Current time for store hours real-time evaluation
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const storeHours = useMemo(() => {
    return getStoreHoursStatus(store, currentTime);
  }, [store, currentTime]);

  // Instagram Profile Link and Display
  const instagramHref = useMemo(() => {
    if (store.instagramUrl && store.instagramUrl.trim()) {
      if (store.instagramUrl.startsWith('http://') || store.instagramUrl.startsWith('https://')) {
        return store.instagramUrl;
      }
      const handle = store.instagramUrl.replace(/^@/, '').trim();
      return `https://instagram.com/${handle}`;
    }
    return `https://instagram.com/${store.slug.replace(/[^a-z0-9._]/gi, '')}`;
  }, [store.instagramUrl, store.slug]);

  const instagramDisplayName = useMemo(() => {
    if (store.instagramUrl && store.instagramUrl.trim()) {
      const handle = store.instagramUrl
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/$/, '')
        .replace(/^@/, '')
        .trim();
      return handle ? `@${handle}` : `@${store.slug}`;
    }
    return `@${store.slug}`;
  }, [store.instagramUrl, store.slug]);

  // Top selling product IDs for this store
  const topSellingProductIds = useMemo(() => {
    const counts: { [prodName: string]: number } = {};
    (orders || []).filter(o => o.storeId === store.id).forEach(o => {
      (o.items || []).forEach(it => {
        const baseName = it.productName.split('[')[0].trim().toLowerCase();
        counts[baseName] = (counts[baseName] || 0) + it.quantity;
      });
    });

    const sorted = [...products.filter(p => p.storeId === store.id)].sort((a, b) => {
      const aCount = counts[a.name.toLowerCase()] || 0;
      const bCount = counts[b.name.toLowerCase()] || 0;
      if (bCount !== aCount) return bCount - aCount;
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

    return new Set(sorted.slice(0, 3).map(p => p.id));
  }, [orders, products, store.id]);

  // Live Order Tracking and GPS States
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  
  // Cart States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Active Product Configuration States
  const [selectedChoices, setSelectedChoices] = useState<{ [optionId: string]: OptionChoice[] }>({});
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  // Checkout Form States
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({
    customerName: '',
    customerPhone: '',
    receiptType: 'delivery',
    addressStreet: '',
    addressNumber: '',
    addressNeighborhood: '',
    addressComplement: '',
    tableNumber: '',
    paymentMethod: 'pix',
    changeFor: '',
    notes: '',
    neighborhoodFee: 0
  });

  const [checkoutErrors, setCheckoutErrors] = useState<string[]>([]);

  // Load existing active order from localStorage only if it was placed today and is still active
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cardapio_orders');
      if (raw) {
        const list: Order[] = JSON.parse(raw);
        const storeOrders = list.filter(o => o.storeId === store.id);
        const active = storeOrders.reverse().find(o => 
          isOrderFromToday(o) &&
          o.status !== 'completed' && 
          o.status !== 'cancelled'
        );
        if (active) {
          setActiveTrackingOrder(active);
          setPlacedOrderCode(active.code);
          setPlacedOrderId(active.id);
        } else {
          setActiveTrackingOrder(null);
          setPlacedOrderCode(null);
          setPlacedOrderId(null);
          localStorage.removeItem(`active_order_id_${store.id}`);
          localStorage.removeItem(`active_order_code_${store.id}`);
        }
      } else {
        setActiveTrackingOrder(null);
        setPlacedOrderCode(null);
        setPlacedOrderId(null);
        localStorage.removeItem(`active_order_id_${store.id}`);
        localStorage.removeItem(`active_order_code_${store.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  }, [store.id]);

  // GPS Location Handler: Captures precise coordinates and generates Google Maps link
  const handleCaptureGpsLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

        setOrderDetails(prev => ({
          ...prev,
          customerCoordinates: { lat, lng },
          googleMapsLink: mapsLink
        }));
        setIsGettingGps(false);
      },
      (err) => {
        setIsGettingGps(false);
        console.warn('Geolocation error:', err);
        alert('Não foi possível obter sua localização exata. Permita o acesso ao GPS nas configurações do seu navegador ou insira seu endereço.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Order rating callback
  const handleRateOrder = (orderId: string, storeRating: number, orderRating: number, feedback?: string) => {
    setActiveTrackingOrder(prev => prev ? {
      ...prev,
      storeRating,
      orderRating,
      ratingFeedback: feedback,
      ratedAt: new Date().toISOString()
    } : null);

    try {
      const raw = localStorage.getItem('cardapio_orders');
      if (raw) {
        const list: Order[] = JSON.parse(raw);
        const updated = list.map(o => o.id === orderId ? {
          ...o,
          storeRating,
          orderRating,
          ratingFeedback: feedback,
          ratedAt: new Date().toISOString()
        } : o);
        localStorage.setItem('cardapio_orders', JSON.stringify(updated));
        window.dispatchEvent(new Event('order_updated'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter products belonging to this store and active
  const storeProducts = useMemo(() => {
    return products.filter(p => p.storeId === store.id && p.isActive);
  }, [products, store.id]);

  // Filter categories belonging to this store
  const storeCategories = useMemo(() => {
    return categories
      .filter(c => c.storeId === store.id)
      .sort((a, b) => a.order - b.order);
  }, [categories, store.id]);

  // Filter featured products for spotlight and discounts
  const featuredProducts = useMemo(() => {
    return storeProducts.filter(p => p.isFeatured);
  }, [storeProducts]);

  // Handle category change and filter products
  const filteredProducts = useMemo(() => {
    return storeProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' 
        ? true 
        : selectedCategory === 'featured' 
          ? !!p.isFeatured 
          : p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [storeProducts, searchTerm, selectedCategory]);

  // Open Product customizer
  const handleProductClick = (product: Product) => {
    if (!product.isAvailable) return;
    setActiveProduct(product);
    setItemQuantity(1);
    setItemNotes('');
    
    // Set default selected options
    const defaults: { [optionId: string]: OptionChoice[] } = {};
    if (product.options) {
      product.options.forEach(opt => {
        const isSize = isSizeOption(opt);
        if ((opt.required || isSize) && opt.choices.length > 0) {
          // Pre-select designated featured size if configured, or choice that matches the lowest menu price
          const featuredChoice = opt.choices.find(c => c.id === product.featuredSizeId || c.isFeatured);
          const sortedChoices = [...opt.choices].sort((a, b) => {
            if (isSize) {
              return getSizeChoicePrice(a, product.price, opt.choices) - getSizeChoicePrice(b, product.price, opt.choices);
            }
            return (Number(a.price) || 0) - (Number(b.price) || 0);
          });
          const bestDefault = featuredChoice || sortedChoices[0] || opt.choices[0];
          defaults[opt.id] = [bestDefault];
        } else {
          defaults[opt.id] = [];
        }
      });
    }
    setSelectedChoices(defaults);
  };

  // Choice Selection handlers
  const handleChoiceSelect = (optionId: string, choice: OptionChoice, isMultiple: boolean) => {
    setSelectedChoices(prev => {
      const current = prev[optionId] || [];
      if (isMultiple) {
        const exists = current.some(c => c.id === choice.id);
        if (exists) {
          return { ...prev, [optionId]: current.filter(c => c.id !== choice.id) };
        } else {
          return { ...prev, [optionId]: [...current, choice] };
        }
      } else {
        return { ...prev, [optionId]: [choice] };
      }
    });
  };

  // Calculate customized active product price based on chosen size and addons
  const activeCalculatedPrice = useMemo(() => {
    if (!activeProduct) return null;
    return calculateItemPrice(activeProduct, selectedChoices);
  }, [activeProduct, selectedChoices]);

  const activeProductPrice = useMemo(() => {
    if (!activeCalculatedPrice) return 0;
    return activeCalculatedPrice.unitPrice * itemQuantity;
  }, [activeCalculatedPrice, itemQuantity]);

  // Add customized item to shopping cart
  const handleAddToCart = () => {
    if (!activeProduct) return;

    // Validate if required options are chosen
    if (activeProduct.options) {
      for (const opt of activeProduct.options) {
        const selections = selectedChoices[opt.id] || [];
        if (opt.required && selections.length === 0) {
          alert(`Por favor, faça uma escolha em: "${opt.name}"`);
          return;
        }
        if (opt.min && selections.length < opt.min) {
          alert(`Selecione ao menos ${opt.min} itens em: "${opt.name}"`);
          return;
        }
        if (opt.max && selections.length > opt.max) {
          alert(`Selecione no máximo ${opt.max} itens em: "${opt.name}"`);
          return;
        }
      }
    }

    const calculated = calculateItemPrice(activeProduct, selectedChoices);

    const cartItem: CartItem = {
      product: activeProduct,
      quantity: itemQuantity,
      selectedChoices: { ...selectedChoices },
      notes: itemNotes,
      unitPrice: calculated.unitPrice,
      sizeName: calculated.selectedSizeChoice?.name
    };

    setCart(prev => [...prev, cartItem]);
    setActiveProduct(null);
  };

  // Remove item from cart
  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Update Cart Quantity
  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // Calculate cart subtotal (items only) based on exact item unitPrice
  const cartSubtotal = useMemo(() => {
    const rawSum = cart.reduce((sum, item) => {
      const price = typeof item.unitPrice === 'number' && item.unitPrice > 0
        ? item.unitPrice
        : calculateItemPrice(item.product, item.selectedChoices).unitPrice;
      return sum + (price * item.quantity);
    }, 0);
    return Math.round(rawSum * 100) / 100;
  }, [cart]);

  // Determine current active delivery fee
  const activeDeliveryFee = useMemo(() => {
    if (orderDetails.receiptType !== 'delivery') return 0;
    if (store.deliveryFeeType === 'flat') return Number(store.deliveryFee) || 0;
    
    // Neighborhood based
    const selectedNeighborhood = store.neighborhoodFees?.find(n => n.name === orderDetails.addressNeighborhood);
    return selectedNeighborhood ? (Number(selectedNeighborhood.fee) || 0) : (Number(store.deliveryFee) || 0);
  }, [orderDetails.receiptType, orderDetails.addressNeighborhood, store]);

  // Calculate Total Order
  const cartTotal = useMemo(() => {
    return Math.round((cartSubtotal + activeDeliveryFee) * 100) / 100;
  }, [cartSubtotal, activeDeliveryFee]);

  // Form input changer helper
  const handleFormChange = (key: keyof OrderDetails, value: any) => {
    setOrderDetails(prev => {
      const updated = { ...prev, [key]: value };
      
      // If neighborhood changes, update its associated fee
      if (key === 'addressNeighborhood' && store.deliveryFeeType === 'neighborhood') {
        const found = store.neighborhoodFees?.find(n => n.name === value);
        updated.neighborhoodFee = found ? found.fee : 0;
      }
      return updated;
    });
  };

  // Send WhatsApp Order
  const handleSendOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!orderDetails.customerName.trim()) {
      errors.push('Nome do cliente é obrigatório');
    }
    if (!orderDetails.customerPhone.trim()) {
      errors.push('Telefone de contato é obrigatório');
    }

    if (orderDetails.receiptType === 'delivery') {
      if (!orderDetails.addressStreet?.trim()) {
        errors.push('Rua/Avenida é obrigatória para entrega');
      }
      if (!orderDetails.addressNumber?.trim()) {
        errors.push('Número do endereço é obrigatório');
      }
      if (!orderDetails.addressNeighborhood?.trim()) {
        errors.push('Bairro é obrigatório para entrega');
      }
    } else if (orderDetails.receiptType === 'table') {
      if (!orderDetails.tableNumber?.trim()) {
        errors.push('Número da mesa é obrigatório');
      }
    }

    if (store.minOrder && cartSubtotal < store.minOrder) {
      errors.push(`O valor mínimo do pedido para esta loja é R$ ${store.minOrder.toFixed(2)}`);
    }

    if (errors.length > 0) {
      setCheckoutErrors(errors);
      return;
    }

    setCheckoutErrors([]);

    // Format WhatsApp Message
    let text = `*📋 NOVO PEDIDO - ${store.name.toUpperCase()}*\n`;
    text += `-------------------------------------------\n\n`;
    text += `*👤 CLIENTE:*\n`;
    text += `• *Nome:* ${orderDetails.customerName}\n`;
    text += `• *WhatsApp:* ${orderDetails.customerPhone}\n\n`;

    text += `*🚚 RETIRADA / ENTREGA:*\n`;
    if (orderDetails.receiptType === 'delivery') {
      text += `• *Tipo:* Entrega em Domicílio\n`;
      text += `• *Endereço:* ${orderDetails.addressStreet}, ${orderDetails.addressNumber}\n`;
      if (orderDetails.addressComplement) {
        text += `• *Complemento:* ${orderDetails.addressComplement}\n`;
      }
      text += `• *Bairro:* ${orderDetails.addressNeighborhood}\n`;
      if (orderDetails.googleMapsLink) {
        text += `• *📍 LOCALIZAÇÃO EXATA NO GOOGLE MAPS:*\n  ${orderDetails.googleMapsLink}\n`;
      }
    } else if (orderDetails.receiptType === 'pickup') {
      text += `• *Tipo:* Retirar no Estabelecimento\n`;
    } else {
      text += `• *Tipo:* Consumir no Local (Mesa)\n`;
      text += `• *Mesa:* ${orderDetails.tableNumber}\n`;
    }
    text += `\n`;

    text += `*🛍️ ITENS DO PEDIDO:*\n`;
    cart.forEach((item) => {
      const calc = calculateItemPrice(item.product, item.selectedChoices);
      const itemUnitPrice = calc.unitPrice;
      const optionsTxt: string[] = [];

      if (calc.selectedSizeChoice) {
        optionsTxt.push(`  • *Tamanho:* ${calc.selectedSizeChoice.name} (R$ ${calc.basePrice.toFixed(2)})`);
      }

      (Object.entries(item.selectedChoices) as [string, OptionChoice[]][]).forEach(([optId, choices]) => {
        const optDef = item.product.options?.find(o => o.id === optId);
        if (optDef && isSizeOption(optDef)) return;

        choices.forEach(c => {
          optionsTxt.push(`  • ${c.name} (${c.price > 0 ? `+R$ ${c.price.toFixed(2)}` : 'Incluso'})`);
        });
      });

      const sizeNameShort = calc.selectedSizeChoice ? ` [${calc.selectedSizeChoice.name.split('(')[0].trim()}]` : '';
      text += `${item.quantity}x *${item.product.name}*${sizeNameShort} - R$ ${(itemUnitPrice * item.quantity).toFixed(2)}\n`;
      if (optionsTxt.length > 0) {
        text += optionsTxt.join('\n') + `\n`;
      }
      if (item.notes?.trim()) {
        text += `  _Obs: ${item.notes}_\n`;
      }
      text += `\n`;
    });

    text += `-------------------------------------------\n`;
    text += `*Subtotal:* R$ ${cartSubtotal.toFixed(2)}\n`;
    if (orderDetails.receiptType === 'delivery') {
      text += `*Taxa de Entrega:* R$ ${activeDeliveryFee.toFixed(2)}\n`;
    }
    text += `*TOTAL DO PEDIDO:* R$ ${cartTotal.toFixed(2)}\n`;
    text += `-------------------------------------------\n\n`;

    text += `*💳 PAGAMENTO:*\n`;
    const payMethods: { [key: string]: string } = {
      pix: 'PIX',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      dinheiro: 'Dinheiro'
    };
    text += `• *Forma:* ${payMethods[orderDetails.paymentMethod]}\n`;
    if (orderDetails.paymentMethod === 'dinheiro' && orderDetails.changeFor) {
      text += `• *Troco para:* R$ ${orderDetails.changeFor}\n`;
    }
    if (orderDetails.notes?.trim()) {
      text += `\n*💬 OBSERVAÇÕES ADICIONAIS:*\n${orderDetails.notes}\n`;
    }

    text += `\n_Pedido gerado via Cardápio Web_`;

    // Save order in PDV system
    const orderId = 'ord-' + Date.now();
    const orderCode = '#' + Math.floor(1000 + Math.random() * 9000);

    const orderItems: OrderItem[] = cart.map(item => {
      const calc = calculateItemPrice(item.product, item.selectedChoices);
      const choicesText: string[] = [];

      if (calc.selectedSizeChoice) {
        choicesText.push(`Tamanho: ${calc.selectedSizeChoice.name} (R$ ${calc.basePrice.toFixed(2)})`);
      }

      (Object.entries(item.selectedChoices) as [string, OptionChoice[]][]).forEach(([optId, choices]) => {
        const optDef = item.product.options?.find(o => o.id === optId);
        if (optDef && isSizeOption(optDef)) return;

        choices.forEach(c => {
          choicesText.push(`${c.name} (${c.price > 0 ? `+R$ ${c.price.toFixed(2)}` : 'Incluso'})`);
        });
      });

      const sizeLabel = calc.selectedSizeChoice ? ` [${calc.selectedSizeChoice.name.split('(')[0].trim()}]` : '';

      return {
        productName: `${item.product.name}${sizeLabel}`,
        quantity: item.quantity,
        unitPrice: calc.unitPrice,
        totalPrice: calc.unitPrice * item.quantity,
        choicesText: choicesText.length > 0 ? choicesText : undefined,
        notes: item.notes?.trim() || undefined
      };
    });

    const newOrder: Order = {
      id: orderId,
      code: orderCode,
      storeId: store.id,
      createdAt: new Date().toISOString(),
      customerName: orderDetails.customerName.trim(),
      customerPhone: orderDetails.customerPhone.trim(),
      receiptType: orderDetails.receiptType,
      addressStreet: orderDetails.addressStreet?.trim(),
      addressNumber: orderDetails.addressNumber?.trim(),
      addressNeighborhood: orderDetails.addressNeighborhood?.trim(),
      addressComplement: orderDetails.addressComplement?.trim(),
      customerCoordinates: orderDetails.customerCoordinates,
      googleMapsLink: orderDetails.googleMapsLink,
      tableNumber: orderDetails.tableNumber?.trim(),
      paymentMethod: orderDetails.paymentMethod,
      changeFor: orderDetails.changeFor?.trim(),
      notes: orderDetails.notes?.trim(),
      subtotal: cartSubtotal,
      deliveryFee: activeDeliveryFee,
      total: cartTotal,
      status: 'pending', // Starts as pending to trigger alert sound in merchant PDV!
      items: orderItems
    };

    if (onPlaceOrder) {
      onPlaceOrder(newOrder);
    }

    // Persist order in local store history
    try {
      const raw = localStorage.getItem('cardapio_orders');
      const list: Order[] = raw ? JSON.parse(raw) : [];
      list.push(newOrder);
      localStorage.setItem('cardapio_orders', JSON.stringify(list));
      window.dispatchEvent(new Event('order_updated'));
    } catch (e) {
      console.error(e);
    }

    setActiveTrackingOrder(newOrder);
    setPlacedOrderCode(orderCode);
    setPlacedOrderId(newOrder.id);
    try {
      localStorage.setItem(`active_order_id_${store.id}`, newOrder.id);
      localStorage.setItem(`active_order_code_${store.id}`, orderCode);
    } catch {}
    setCart([]);
    setIsCartOpen(false);

    // Encode URL and redirect to wa.me
    const formattedPhone = store.phone.replace(/\D/g, '');
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 relative" id={`menu-store-${store.slug}`}>
      {/* Cover Image Banner */}
      <div className="h-48 sm:h-64 bg-slate-200 relative">
        <img
          src={store.coverUrl}
          alt={`Capa de ${store.name}`}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
        <button
          onClick={onBackToLanding}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center text-slate-800 shadow-md hover:scale-105 transition cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Store Header Info */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative -mt-16 z-10">
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white shrink-0">
            <img
              src={store.logoUrl}
              alt={`Logo de ${store.name}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-2">
              <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">{store.name}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${storeHours.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${storeHours.dotClass}`} />
                <span>{storeHours.isOpen ? 'Online • Aberto Agora' : 'Fechado no momento'}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({storeHours.nextEventText})
              </span>

              {/* Botão Clicável do Instagram da Empresa */}
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white text-xs font-extrabold shadow-xs hover:shadow-md hover:scale-105 transition cursor-pointer"
                title={`Abrir perfil no Instagram: ${instagramDisplayName}`}
              >
                <Instagram size={13} className="shrink-0" />
                <span>{instagramDisplayName}</span>
                <ExternalLink size={11} className="opacity-80" />
              </a>
            </div>
            <p className="text-slate-500 text-xs flex items-center justify-center md:justify-start gap-1.5 mb-4">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{store.address}</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4 text-xs">
              <div className="flex items-start space-x-2 justify-center md:justify-start">
                <Bike size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block font-normal text-[11px]">Taxa de Entrega</span>
                  <span className="font-semibold text-slate-800">
                    {store.deliveryFeeType === 'flat'
                      ? `R$ ${store.deliveryFee.toFixed(2)}`
                      : 'R$ Variável'}
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2 justify-center md:justify-start col-span-1 sm:col-span-1">
                <Clock size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block font-normal text-[11px]">Horário Completo</span>
                  <span className="font-bold text-slate-800 block text-xs leading-snug">
                    {store.workingHours}
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-2 justify-center md:justify-start">
                <Phone size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block font-normal text-[11px]">WhatsApp</span>
                  <a
                    href={`https://api.whatsapp.com/send?phone=${store.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-800 hover:text-emerald-600 block"
                  >
                    {store.phone || 'Enviar Pedido'}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-2 justify-center md:justify-start">
                <Instagram size={16} className="text-pink-600 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block font-normal text-[11px]">Instagram</span>
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-pink-600 hover:text-pink-700 hover:underline flex items-center gap-1"
                  >
                    <span>{instagramDisplayName}</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Closed Alert Banner if store is closed */}
      {!storeHours.isOpen && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex items-center gap-3 text-xs shadow-2xs">
            <Clock size={20} className="text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-950 text-sm">Estabelecimento Fechado no momento</p>
              <p className="text-rose-800 text-xs mt-0.5">
                Horário normal de atendimento: <strong>{store.workingHours}</strong>. ({storeHours.nextEventText}). Você pode consultar o cardápio e preços normalmente!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clean Order Rating Banner (ONLY for today's order, without fake tracking steps) */}
      {placedOrderCode && currentPlacedOrder && !currentPlacedOrder.storeRating && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 shadow-xs">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                <Star size={20} className="fill-amber-950 text-amber-950" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-950">
                  Como foi sua experiência com seu pedido recente {placedOrderCode}?
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Sua avaliação rápida leva 10 segundos e ajuda a loja a melhorar sempre.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setActiveTrackingOrder(currentPlacedOrder);
                  setIsLiveTrackingOpen(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition active:scale-95"
              >
                <Star size={13} className="fill-amber-950 text-amber-950" />
                <span>Avaliar Pedido</span>
              </button>
              <button
                onClick={() => {
                  setPlacedOrderCode(null);
                  setPlacedOrderId(null);
                  try {
                    localStorage.removeItem(`active_order_id_${store.id}`);
                    localStorage.removeItem(`active_order_code_${store.id}`);
                  } catch {}
                }}
                className="text-amber-800 hover:text-amber-950 text-xs font-bold px-2 py-1 cursor-pointer transition"
                title="Fechar e dispensar"
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Menu Catalog Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        {/* Search & Categories Bar */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs mb-8 flex flex-col md:flex-row gap-4 sticky top-16 z-30">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar itens no cardápio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-200 text-sm"
            />
          </div>

          <div className="flex overflow-x-auto gap-2 pb-1 md:pb-0 scrollbar-none shrink-0 max-w-full md:max-w-md">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Todos
            </button>
            {featuredProducts.length > 0 && (
              <button
                onClick={() => setSelectedCategory('featured')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === 'featured'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-300/80'
                }`}
              >
                <Flame size={13} className={selectedCategory === 'featured' ? 'text-white fill-white' : 'text-amber-600 fill-amber-500'} />
                <span>Destaques & Ofertas ({featuredProducts.length})</span>
              </button>
            )}
            {storeCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                style={selectedCategory === cat.id ? { backgroundColor: store.themeColor } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Featured / Spotlight Special Section (shown on "all" or "featured") */}
        {featuredProducts.length > 0 && (selectedCategory === 'all' || selectedCategory === 'featured') && !searchTerm && (
          <section className="mb-12">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Flame size={18} className="fill-white" />
                </div>
                <div>
                  <h2 className="font-sans font-extrabold text-xl text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Produtos em Destaque & Promoções</span>
                  </h2>
                  <span className="text-[11px] text-amber-800">Ofertas com descontos especiais selecionados pelo restaurante</span>
                </div>
              </div>
              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full font-bold">
                {featuredProducts.length} {featuredProducts.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredProducts.map(product => {
                const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                const discountPct = hasDiscount ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;
                const displayPricing = getProductDisplayPricing(product);
                const isTopSeller = topSellingProductIds.has(product.id);

                return (
                  <motion.div
                    key={`featured-${product.id}`}
                    whileHover={product.isAvailable ? { y: -2 } : {}}
                    onClick={() => handleProductClick(product)}
                    className={`bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 rounded-xl border border-amber-200/90 shadow-2xs hover:shadow-xs transition p-4 flex gap-4 relative overflow-hidden ${
                      product.isAvailable ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                    }`}
                  >
                    {hasDiscount && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-bl-lg shadow-2xs tracking-wider">
                        {discountPct}% OFF
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {isTopSeller && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 border border-orange-300 inline-flex items-center gap-1">
                              <Flame size={10} className="fill-orange-600 text-orange-600" />
                              Mais Vendido
                            </span>
                          )}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                            <Star size={10} className="fill-amber-500 text-amber-500" />
                            {product.featuredTag || 'Destaque'}
                          </span>
                          {product.featuredSizeName && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-200">
                              Tamanho: {product.featuredSizeName}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-base leading-tight mb-1">{product.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{product.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-bold text-slate-900 font-mono">
                            {displayPricing.hasSizeVariation ? displayPricing.displayPrice : `R$ ${product.price.toFixed(2)}`}
                          </span>
                          {hasDiscount && (
                            <span className="text-[11px] text-slate-400 line-through font-mono">
                              R$ {product.originalPrice!.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {!product.isAvailable ? (
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">Indisponível</span>
                        ) : (
                          <span className="p-1.5 rounded-lg bg-orange-500 text-white shadow-2xs hover:bg-orange-600 transition">
                            <Plus size={15} />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-amber-100">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Categories Display */}
        {selectedCategory !== 'featured' && storeCategories.map(cat => {
          // If a category has products in filtered products list
          const catProducts = filteredProducts.filter(p => p.categoryId === cat.id);
          if (catProducts.length === 0) return null;

          return (
            <section key={cat.id} className="mb-12">
              <h2 className="font-sans font-extrabold text-xl text-slate-900 border-b border-slate-100 pb-3 mb-6 tracking-tight flex items-center justify-between">
                <span>{cat.name}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold font-mono">
                  {catProducts.length} {catProducts.length === 1 ? 'item' : 'itens'}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {catProducts.map(product => {
                  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                  const discountPct = hasDiscount ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;
                  const displayPricing = getProductDisplayPricing(product);
                  const isTopSeller = topSellingProductIds.has(product.id);

                  return (
                    <motion.div
                      key={product.id}
                      whileHover={product.isAvailable ? { y: -2 } : {}}
                      onClick={() => handleProductClick(product)}
                      className={`bg-white rounded-xl border border-slate-100 shadow-2xs hover:shadow-xs transition p-4 flex gap-4 relative overflow-hidden ${
                        product.isAvailable ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                      }`}
                    >
                      {hasDiscount && (
                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg shadow-2xs">
                          {discountPct}% OFF
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {isTopSeller && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-950 border border-orange-300 inline-flex items-center gap-1">
                                <Flame size={10} className="fill-orange-600 text-orange-600" />
                                Mais Vendido
                              </span>
                            )}
                            {product.isFeatured && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                <Star size={10} className="fill-amber-500 text-amber-500" />
                                Destaque
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 text-base leading-tight mb-1">{product.name}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{product.description}</p>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-bold text-slate-900 font-mono">
                              {displayPricing.hasSizeVariation ? displayPricing.displayPrice : `R$ ${product.price.toFixed(2)}`}
                            </span>
                            {hasDiscount && (
                              <span className="text-[11px] text-slate-400 line-through font-mono">
                                R$ {product.originalPrice!.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {!product.isAvailable ? (
                            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">Indisponível</span>
                          ) : (
                            <span className="p-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition">
                              <Plus size={16} />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 p-8 max-w-md mx-auto">
            <AlertCircle size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-800 text-base mb-1">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-500">Tente buscar por termos diferentes ou selecione outra categoria.</p>
          </div>
        )}
      </main>

      {/* Floating Cart Button (shows when cart has items) */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto z-40"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full py-4 px-6 rounded-2xl text-white font-semibold flex items-center justify-between shadow-xl shadow-orange-500/20 hover:scale-102 transition cursor-pointer"
              style={{ backgroundColor: store.themeColor }}
            >
              <div className="flex items-center space-x-3">
                <ShoppingBag size={20} />
                <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-bold">{cart.length}</span>
              </div>
              <span className="text-sm">Visualizar Sacola</span>
              <span className="font-mono font-bold text-sm">R$ {cartSubtotal.toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Options Customizer Dialog (Modal) */}
      <AnimatePresence>
        {activeProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="product-options-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveProduct(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Content Container */}
            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
              >
                {/* Header picture */}
                <div className="h-44 sm:h-52 bg-slate-100 relative shrink-0">
                  <img
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={() => setActiveProduct(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/40 backdrop-blur-xs flex items-center justify-center text-white hover:bg-slate-900/60 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scroller Area */}
                <div className="overflow-y-auto p-6 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {activeProduct.isFeatured && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                        <Star size={11} className="fill-amber-500 text-amber-500" />
                        Destaque Promocional
                      </span>
                    )}
                    {activeProduct.originalPrice && activeProduct.originalPrice > activeProduct.price && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                        {Math.round(((activeProduct.originalPrice - activeProduct.price) / activeProduct.originalPrice) * 100)}% OFF
                      </span>
                    )}
                    {activeCalculatedPrice?.selectedSizeChoice && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-200">
                        Tamanho: {activeCalculatedPrice.selectedSizeChoice.name.split('(')[0].trim()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-sans font-extrabold text-xl text-slate-900 tracking-tight mb-1">{activeProduct.name}</h3>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xl font-black text-slate-900 font-mono">
                      R$ {(activeCalculatedPrice ? activeCalculatedPrice.basePrice : activeProduct.price).toFixed(2)}
                    </span>
                    {activeCalculatedPrice?.addonsTotal && activeCalculatedPrice.addonsTotal > 0 ? (
                      <span className="text-xs text-orange-600 font-semibold font-mono">
                        (+ R$ {activeCalculatedPrice.addonsTotal.toFixed(2)} adicionais)
                      </span>
                    ) : null}
                    {activeProduct.originalPrice && activeProduct.originalPrice > activeProduct.price && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        R$ {activeProduct.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">{activeProduct.description}</p>

                  {/* Options List */}
                  {activeProduct.options && activeProduct.options.map(opt => {
                    const isSizeGroup = isSizeOption(opt);
                    const selections = selectedChoices[opt.id] || [];
                    return (
                      <div key={opt.id} className="mb-6 pb-6 border-b border-slate-100 last:border-b-0">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-800">{opt.name}</h4>
                              {isSizeGroup && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                                  Define o Preço
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {isSizeGroup 
                                ? 'Selecione o tamanho desejado para definir o valor do produto'
                                : opt.type === 'single' 
                                  ? 'Escolha uma opção' 
                                  : 'Escolha múltiplas opções'}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            opt.required || isSizeGroup
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {opt.required || isSizeGroup ? 'Obrigatório' : 'Opcional'}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {opt.choices.map(choice => {
                            const isSelected = selections.some(c => c.id === choice.id);
                            const sizePrice = isSizeGroup
                              ? getSizeChoicePrice(choice, activeProduct.price, opt.choices)
                              : choice.price;

                            return (
                              <div
                                key={choice.id}
                                onClick={() => handleChoiceSelect(opt.id, choice, opt.type === 'multiple' && !isSizeGroup)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium cursor-pointer transition ${
                                  isSelected 
                                    ? 'bg-orange-50 border-orange-300 text-orange-950 ring-1 ring-orange-400 shadow-2xs' 
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5">
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition shrink-0 ${
                                    isSelected 
                                      ? 'border-orange-500 bg-orange-500 text-white' 
                                      : 'border-slate-300'
                                  }`}>
                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                  </div>
                                  <span className={isSelected ? 'font-bold' : ''}>{choice.name}</span>
                                </div>

                                {isSizeGroup ? (
                                  <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md transition ${
                                    isSelected
                                      ? 'bg-orange-500 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    R$ {sizePrice.toFixed(2)}
                                  </span>
                                ) : choice.price > 0 ? (
                                  <span className="font-mono text-slate-500 font-semibold">+ R$ {choice.price.toFixed(2)}</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Incluso</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Notes input */}
                  <div className="mt-4">
                    <h4 className="font-bold text-sm text-slate-800 mb-2">Observações Especiais</h4>
                    <textarea
                      placeholder="Ex: sem pão com gergelim, molho à parte, bem passado..."
                      value={itemNotes}
                      onChange={e => setItemNotes(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-100 text-xs h-20 resize-none"
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between gap-4">
                  {/* Quantity controls */}
                  <div className="flex items-center border border-slate-200 bg-white rounded-lg p-1">
                    <button
                      onClick={() => setItemQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-slate-800 font-mono">{itemQuantity}</span>
                    <button
                      onClick={() => setItemQuantity(q => q + 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Add to cart */}
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 py-3 rounded-xl font-semibold text-white shadow-md hover:scale-102 transition cursor-pointer flex items-center justify-center space-x-2 text-sm"
                    style={{ backgroundColor: store.themeColor }}
                  >
                    <span>Adicionar</span>
                    <span>•</span>
                    <span className="font-mono font-bold">R$ {activeProductPrice.toFixed(2)}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Shopping Cart Slider Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="cart-drawer-container">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Slider Sheet */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-screen max-w-md bg-white flex flex-col shadow-2xl h-full"
              >
                {/* Header */}
                <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2.5">
                    <ShoppingBag className="text-slate-800" size={20} />
                    <h3 className="font-sans font-extrabold text-lg text-slate-900 tracking-tight">Sua Sacola</h3>
                    <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                      <h4 className="font-bold text-slate-800 mb-1 text-sm">Sua sacola está vazia</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">Adicione delícias do cardápio digital para montar seu pedido.</p>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="mt-6 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer"
                      >
                        Voltar para o Cardápio
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Products List */}
                      <div className="space-y-4">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Itens Selecionados</h4>
                        {cart.map((item, index) => {
                          const calc = calculateItemPrice(item.product, item.selectedChoices);
                          const singleItemPrice = calc.unitPrice;
                          const selectedChoicesArray: string[] = [];

                          if (calc.selectedSizeChoice) {
                            selectedChoicesArray.push(`Tamanho: ${calc.selectedSizeChoice.name}`);
                          }

                          (Object.entries(item.selectedChoices) as [string, OptionChoice[]][]).forEach(([optId, choices]) => {
                            const optDef = item.product.options?.find(o => o.id === optId);
                            if (optDef && isSizeOption(optDef)) return;
                            choices.forEach(c => {
                              selectedChoicesArray.push(c.price > 0 ? `${c.name} (+R$ ${c.price.toFixed(2)})` : c.name);
                            });
                          });

                          return (
                            <div key={index} className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100 relative">
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0"
                                referrerPolicy="no-referrer"
                              />

                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1 pr-6">{item.product.name}</h5>
                                
                                {selectedChoicesArray.length > 0 && (
                                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{selectedChoicesArray.join(', ')}</p>
                                )}
                                
                                {item.notes && (
                                  <p className="text-[10px] text-amber-700 italic font-medium line-clamp-1 mt-0.5">Obs: {item.notes}</p>
                                )}

                                <div className="flex items-center justify-between mt-3">
                                  <span className="font-bold text-xs text-slate-900 font-mono">R$ {(singleItemPrice * item.quantity).toFixed(2)}</span>
                                  
                                  {/* Quantity Selector */}
                                  <div className="flex items-center border border-slate-200 bg-white rounded-md p-0.5">
                                    <button
                                      onClick={() => handleUpdateCartQty(index, -1)}
                                      className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xs cursor-pointer"
                                    >
                                      <Minus size={10} />
                                    </button>
                                    <span className="w-5 text-center font-bold text-xs text-slate-700 font-mono">{item.quantity}</span>
                                    <button
                                      onClick={() => handleUpdateCartQty(index, 1)}
                                      className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xs cursor-pointer"
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleRemoveFromCart(index)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Checkout Information Form */}
                      <form onSubmit={handleSendOrder} className="space-y-5 border-t border-slate-100 pt-6">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Dados da Entrega / Pedido</h4>

                        {/* Customer Identification */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Seu Nome *</label>
                            <input
                              required
                              type="text"
                              placeholder="Ex: João Silva"
                              value={orderDetails.customerName}
                              onChange={e => handleFormChange('customerName', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-slate-400 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp *</label>
                            <input
                              required
                              type="tel"
                              placeholder="Ex: (11) 99999-9999"
                              value={orderDetails.customerPhone}
                              onChange={e => handleFormChange('customerPhone', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-slate-400 text-xs"
                            />
                          </div>
                        </div>

                        {/* Receipt Method Choice */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Como deseja receber? *</label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => handleFormChange('receiptType', 'delivery')}
                              className={`py-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.receiptType === 'delivery'
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              Entrega
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormChange('receiptType', 'pickup')}
                              className={`py-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.receiptType === 'pickup'
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              Retirada
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormChange('receiptType', 'table')}
                              className={`py-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.receiptType === 'table'
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              Mesa
                            </button>
                          </div>
                        </div>

                        {/* Conditional Receipt Fields */}
                        {orderDetails.receiptType === 'delivery' && (
                          <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-fadeIn">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rua / Logradouro *</label>
                                <input
                                  required
                                  type="text"
                                  placeholder="Rua, Av, Travessa..."
                                  value={orderDetails.addressStreet}
                                  onChange={e => handleFormChange('addressStreet', e.target.value)}
                                  className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número *</label>
                                <input
                                  required
                                  type="text"
                                  placeholder="123"
                                  value={orderDetails.addressNumber}
                                  onChange={e => handleFormChange('addressNumber', e.target.value)}
                                  className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bairro *</label>
                                {store.deliveryFeeType === 'neighborhood' && store.neighborhoodFees && store.neighborhoodFees.length > 0 ? (
                                  <select
                                    required
                                    value={orderDetails.addressNeighborhood}
                                    onChange={e => handleFormChange('addressNeighborhood', e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                                  >
                                    <option value="">Selecione o Bairro</option>
                                    {store.neighborhoodFees.map(n => (
                                      <option key={n.id} value={n.name}>{n.name} (Taxa: R$ {n.fee.toFixed(2)})</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    required
                                    type="text"
                                    placeholder="Ex: Centro"
                                    value={orderDetails.addressNeighborhood}
                                    onChange={e => handleFormChange('addressNeighborhood', e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                                  />
                                )}
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Complemento</label>
                                <input
                                  type="text"
                                  placeholder="Apto, Bloco, Fundos..."
                                  value={orderDetails.addressComplement}
                                  onChange={e => handleFormChange('addressComplement', e.target.value)}
                                  className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                                />
                              </div>
                            </div>

                            {/* GPS & Google Maps Location Picker (Direct Location) */}
                            <div className="pt-2 border-t border-slate-200/80">
                              <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                                    <Navigation size={13} className="text-emerald-600" />
                                    <span>Localização Exata via Google Maps</span>
                                  </span>
                                  {orderDetails.googleMapsLink && (
                                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/70 px-1.5 py-0.5 rounded-md">
                                      ✓ GPS Conectado
                                    </span>
                                  )}
                                </div>

                                <p className="text-[10px] text-emerald-800 leading-relaxed">
                                  Envie o link com a localização exata de onde você está para o entregador seguir direto pelo mapa.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-2 items-center">
                                  <button
                                    type="button"
                                    onClick={handleCaptureGpsLocation}
                                    className="w-full sm:w-auto flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                                  >
                                    <Navigation size={13} className={isGettingGps ? 'animate-spin' : ''} />
                                    <span>{isGettingGps ? 'Obtendo GPS...' : '📍 Obter Meu GPS Exato'}</span>
                                  </button>

                                  {orderDetails.googleMapsLink && (
                                    <a
                                      href={orderDetails.googleMapsLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 py-1.5 px-2.5 rounded-lg flex items-center gap-1 transition"
                                    >
                                      <span>Ver no Maps</span>
                                      <ExternalLink size={11} />
                                    </a>
                                  )}
                                </div>

                                {/* Custom / editable Google Maps link */}
                                <div>
                                  <label className="block text-[9px] font-bold text-emerald-900 uppercase mb-0.5">
                                    Link do Google Maps (Gerado automaticamente ou cole o seu)
                                  </label>
                                  <input
                                    type="url"
                                    placeholder="https://maps.google.com/?q=..."
                                    value={orderDetails.googleMapsLink || ''}
                                    onChange={e => handleFormChange('googleMapsLink', e.target.value)}
                                    className="w-full p-2 rounded-lg border border-emerald-300 bg-white text-[11px] text-slate-700 font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {orderDetails.receiptType === 'table' && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 animate-fadeIn">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qual o número da sua mesa? *</label>
                            <input
                              required
                              type="text"
                              placeholder="Ex: Mesa 04"
                              value={orderDetails.tableNumber}
                              onChange={e => handleFormChange('tableNumber', e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                            />
                          </div>
                        )}

                        {/* Payment Method Select */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Forma de Pagamento *</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleFormChange('paymentMethod', 'pix')}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.paymentMethod === 'pix'
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              ⚡ PIX
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormChange('paymentMethod', 'cartao_credito')}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.paymentMethod === 'cartao_credito'
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              💳 Cartão de Crédito
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormChange('paymentMethod', 'cartao_debito')}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.paymentMethod === 'cartao_debito'
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              💳 Cartão de Débito
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormChange('paymentMethod', 'dinheiro')}
                              className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                                orderDetails.paymentMethod === 'dinheiro'
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              💵 Dinheiro
                            </button>
                          </div>
                        </div>

                        {/* Cash change field */}
                        {orderDetails.paymentMethod === 'dinheiro' && (
                          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-fadeIn">
                            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1">Precisa de troco para quanto?</label>
                            <input
                              type="text"
                              placeholder="Ex: R$ 50, R$ 100..."
                              value={orderDetails.changeFor}
                              onChange={e => handleFormChange('changeFor', e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                        )}

                        {/* General comments */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas adicionais sobre o pedido</label>
                          <textarea
                            placeholder="Algum recado para o entregador ou estabelecimento..."
                            value={orderDetails.notes}
                            onChange={e => handleFormChange('notes', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden text-xs h-16 resize-none"
                          />
                        </div>

                        {/* Checkout errors container */}
                        {checkoutErrors.length > 0 && (
                          <div className="p-3 bg-red-50 text-red-800 border border-red-100 rounded-lg text-xs space-y-1">
                            {checkoutErrors.map((err, i) => (
                              <div key={i} className="flex items-center space-x-1.5 font-medium">
                                <AlertCircle size={12} className="shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Bill Breakdown */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-xs text-slate-600">
                          <div className="flex justify-between">
                            <span>Itens selecionados</span>
                            <span className="font-mono font-medium">R$ {cartSubtotal.toFixed(2)}</span>
                          </div>
                          {orderDetails.receiptType === 'delivery' && (
                            <div className="flex justify-between">
                              <span>Taxa de Entrega</span>
                              <span className="font-mono font-medium">
                                {activeDeliveryFee > 0 ? `R$ ${activeDeliveryFee.toFixed(2)}` : 'Grátis'}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                            <span>Total Geral</span>
                            <span className="font-mono text-base text-slate-950">R$ {cartTotal.toFixed(2)}</span>
                          </div>
                          {store.minOrder && store.minOrder > cartSubtotal && (
                            <p className="text-[10px] text-orange-600 font-semibold pt-1">
                              ⚠️ Pedido mínimo: R$ {store.minOrder.toFixed(2)} (Faltam R$ {(store.minOrder - cartSubtotal).toFixed(2)})
                            </p>
                          )}
                        </div>

                        {/* Final submit */}
                        <button
                          type="submit"
                          className="w-full py-4 rounded-xl text-white font-semibold shadow-md hover:scale-102 transition flex items-center justify-center space-x-2 text-sm cursor-pointer"
                          style={{ backgroundColor: store.themeColor }}
                        >
                          <Clipboard size={18} />
                          <span>Finalizar & Enviar p/ WhatsApp</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 text-[10px] text-slate-400 text-center flex items-center justify-center space-x-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Seus dados estão protegidos. Compra direta no WhatsApp.</span>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Order Tracking Modal with Real-time GPS & Rating */}
      {isLiveTrackingOpen && activeTrackingOrder && (
        <LiveOrderTrackingModal
          order={activeTrackingOrder}
          store={store}
          onClose={() => setIsLiveTrackingOpen(false)}
          onRateOrder={handleRateOrder}
        />
      )}
    </div>
  );
}
