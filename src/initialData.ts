import { Store, Category, Product, AdminSettings, Order, CashTransaction, StoreNotificationSettings, Motoboy } from './types';

export const DEFAULT_NOTIFICATION_SETTINGS: StoreNotificationSettings = {
  acceptedMessage: 'Olá {cliente}! 👋 Seu pedido {pedido} foi *ACEITO* e já começou a ser preparado com todo carinho! 👨‍🍳🔥\n\n⏱️ Tempo estimado: {tempo}\n💰 Total: R$ {total}\n\nAssim que sair para entrega te avisamos por aqui!',
  deliveryMessage: 'Oba, {cliente}! 🚀 Seu pedido {pedido} acabou de *SAIR PARA ENTREGA*!\n\n🛵 Nosso entregador está a caminho do seu endereço: {endereco}.\n\nAgradecemos a preferência e bom apetite! ❤️',
  completedMessage: 'Olá {cliente}! Seu pedido {pedido} foi entregue com sucesso. Bom apetite e volte sempre! ⭐',
  cancelledMessage: 'Olá {cliente}. Informamos que infelizmente não pudemos aceitar seu pedido {pedido} no momento pelo seguinte motivo: {motivo}. Pedimos desculpas pelo ocorrido!',
  estimatedDeliveryTime: '30 a 45 min'
};

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  adminLogin: 'admin',
  adminPass: 'admin',
  superAdminWhatsapp: '5594992944888'
};

export const INITIAL_STORES: Store[] = [
  {
    id: 'store-1',
    name: 'Burger Prime',
    slug: 'burger-prime',
    logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&h=150&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    phone: '5511999999999',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    deliveryFeeType: 'neighborhood',
    deliveryFee: 5.0,
    neighborhoodFees: [
      { id: 'n1', name: 'Bela Vista', fee: 4.0 },
      { id: 'n2', name: 'Consolação', fee: 6.0 },
      { id: 'n3', name: 'Jardins', fee: 8.0 },
      { id: 'n4', name: 'Centro', fee: 10.0 }
    ],
    minOrder: 25.0,
    workingHours: 'Terça a Domingo das 18:00 às 23:30',
    themeColor: '#ef4444', // Red-500
    isActive: true,
    isApproved: true,
    isBlocked: false,
    rating: 4.9,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    daysOnline: 30,
    ownerEmail: 'contato@burgerprime.com',
    ownerLogin: 'burger',
    ownerPassword: '123',
    instagramUrl: 'https://instagram.com/burgerprime',
    facebookUrl: 'https://facebook.com/burgerprime',
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
  },
  {
    id: 'store-2',
    name: 'Bella Italia Pizzaria',
    slug: 'bella-italia',
    logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&h=150&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=800&q=80',
    phone: '5511988888888',
    address: 'Rua Augusta, 1500 - Consolação, São Paulo - SP',
    deliveryFeeType: 'flat',
    deliveryFee: 7.0,
    minOrder: 35.0,
    workingHours: 'Todos os dias das 18:00 às 23:00',
    themeColor: '#16a34a', // Green-600
    isActive: true,
    isApproved: true,
    isBlocked: false,
    rating: 4.8,
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    daysOnline: 30,
    ownerEmail: 'contato@bellaitaliapizza.com',
    ownerLogin: 'pizza',
    ownerPassword: '123',
    instagramUrl: 'https://instagram.com/bellaitaliapizza',
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
  }
];

const todayISO = new Date().toISOString();
const todayDateStr = todayISO.split('T')[0];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    code: '#1001',
    storeId: 'store-1',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    customerName: 'Lucas Ferreira',
    customerPhone: '11987654321',
    receiptType: 'delivery',
    addressStreet: 'Rua Augusta',
    addressNumber: '1200',
    addressNeighborhood: 'Consolação',
    addressComplement: 'Apto 42',
    paymentMethod: 'pix',
    subtotal: 69.80,
    deliveryFee: 6.00,
    total: 75.80,
    status: 'completed',
    items: [
      {
        productName: 'Prime Burger Duo',
        quantity: 2,
        unitPrice: 34.90,
        totalPrice: 69.80,
        choicesText: ['Ponto: Ao ponto para bem']
      }
    ]
  },
  {
    id: 'ord-2',
    code: '#1002',
    storeId: 'store-1',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    customerName: 'Mariana Costa',
    customerPhone: '11976543210',
    receiptType: 'delivery',
    addressStreet: 'Alameda Santos',
    addressNumber: '850',
    addressNeighborhood: 'Jardins',
    paymentMethod: 'dinheiro',
    changeFor: '50',
    subtotal: 28.90,
    deliveryFee: 8.00,
    total: 36.90,
    status: 'completed',
    items: [
      {
        productName: 'Smash Bacon Burger',
        quantity: 1,
        unitPrice: 28.90,
        totalPrice: 28.90
      }
    ]
  },
  {
    id: 'ord-3',
    code: '#1003',
    storeId: 'store-1',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    customerName: 'Carlos Eduardo Silva',
    customerPhone: '11991234567',
    receiptType: 'delivery',
    addressStreet: 'Rua Bela Cintra',
    addressNumber: '450',
    addressNeighborhood: 'Consolação',
    paymentMethod: 'cartao_credito',
    subtotal: 89.90,
    deliveryFee: 6.00,
    total: 95.90,
    status: 'delivering',
    items: [
      {
        productName: 'Combo Prime Casal',
        quantity: 1,
        unitPrice: 89.90,
        totalPrice: 89.90
      }
    ]
  },
  {
    id: 'ord-4',
    code: '#1004',
    storeId: 'store-1',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    customerName: 'Fernanda Lima',
    customerPhone: '11982345678',
    receiptType: 'pickup',
    paymentMethod: 'cartao_debito',
    subtotal: 57.80,
    deliveryFee: 0,
    total: 57.80,
    status: 'preparing',
    items: [
      {
        productName: 'Prime Burger Duo',
        quantity: 1,
        unitPrice: 34.90,
        totalPrice: 34.90
      },
      {
        productName: 'Batata Rústica com Alecrim',
        quantity: 1,
        unitPrice: 22.90,
        totalPrice: 22.90
      }
    ]
  }
];

export const INITIAL_CASH_TRANSACTIONS: CashTransaction[] = [
  {
    id: 'cash-1',
    storeId: 'store-1',
    date: todayDateStr,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    type: 'in',
    category: 'reforco',
    description: 'Fundo inicial de troco para abertura do caixa',
    amount: 150.00,
    paymentMethod: 'dinheiro'
  },
  {
    id: 'cash-2',
    storeId: 'store-1',
    date: todayDateStr,
    createdAt: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    type: 'out',
    category: 'despesa',
    description: 'Compra de embalagens descartáveis e guardanapos',
    amount: 45.00,
    paymentMethod: 'dinheiro'
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  // Burger Prime Categories
  { id: 'cat-b1', storeId: 'store-1', name: 'Hamburgueres Artesanais', order: 1 },
  { id: 'cat-b2', storeId: 'store-1', name: 'Combos Especiais', order: 2 },
  { id: 'cat-b3', storeId: 'store-1', name: 'Porções & Acompanhamentos', order: 3 },
  { id: 'cat-b4', storeId: 'store-1', name: 'Bebidas', order: 4 },
  { id: 'cat-b5', storeId: 'store-1', name: 'Sobremesas', order: 5 },

  // Bella Italia Categories
  { id: 'cat-p1', storeId: 'store-2', name: 'Pizzas Clássicas', order: 1 },
  { id: 'cat-p2', storeId: 'store-2', name: 'Pizzas Especiais', order: 2 },
  { id: 'cat-p3', storeId: 'store-2', name: 'Bebidas', order: 3 }
];

export const INITIAL_PRODUCTS: Product[] = [
  // Burger Prime Products
  {
    id: 'prod-b1',
    storeId: 'store-1',
    categoryId: 'cat-b1',
    name: 'Prime Burger Duo',
    description: 'Dois blends de carne de 120g grelhados no fogo, queijo cheddar duplo derretido, cebola caramelizada e molho da casa no pão brioche amanteigado.',
    price: 34.90,
    originalPrice: 42.90,
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-b1-1',
        name: 'Ponto da Carne',
        type: 'single',
        required: true,
        choices: [
          { id: 'ch-b1-1a', name: 'Ao ponto para bem', price: 0 },
          { id: 'ch-b1-1b', name: 'Ao ponto (rosado no centro)', price: 0 },
          { id: 'ch-b1-1c', name: 'Bem passado', price: 0 }
        ]
      },
      {
        id: 'opt-b1-2',
        name: 'Adicionais Extras',
        type: 'multiple',
        required: false,
        choices: [
          { id: 'ch-b1-2a', name: 'Bacon Crocante (+ 30g)', price: 4.50 },
          { id: 'ch-b1-2b', name: 'Queijo Cheddar Extra', price: 3.50 },
          { id: 'ch-b1-2c', name: 'Cebola Caramelizada Extra', price: 2.50 },
          { id: 'ch-b1-2d', name: 'Hambúrguer extra (120g)', price: 10.00 }
        ]
      }
    ]
  },
  {
    id: 'prod-b2',
    storeId: 'store-1',
    categoryId: 'cat-b1',
    name: 'Classic Cheeseburger',
    description: 'Blend bovino de 150g, muito queijo cheddar derretido, maionese artesanal no pão brioche macio.',
    price: 24.90,
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-b2-1',
        name: 'Adicionais',
        type: 'multiple',
        required: false,
        choices: [
          { id: 'ch-b2-1a', name: 'Bacon fatiado', price: 4.00 },
          { id: 'ch-b2-1b', name: 'Picles artesanal', price: 1.50 },
          { id: 'ch-b2-1c', name: 'Salada fresquinha (Alface e Tomate)', price: 2.00 }
        ]
      }
    ]
  },
  {
    id: 'prod-b3',
    storeId: 'store-1',
    categoryId: 'cat-b1',
    name: 'Smoky BBQ Bacon',
    description: 'Blend bovino de 150g, cheddar, tiras de bacon crocantes, anéis de cebola empanados e molho barbecue defumado.',
    price: 29.90,
    imageUrl: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  },
  {
    id: 'prod-combo1',
    storeId: 'store-1',
    categoryId: 'cat-b2',
    name: 'Combo Prime Individual',
    description: '1 Classic Cheeseburger + 1 Batata Frita Individual (150g) + 1 Refrigerante em lata 350ml à sua escolha.',
    price: 39.90,
    originalPrice: 48.90,
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-c1-1',
        name: 'Escolha a Bebida',
        type: 'single',
        required: true,
        choices: [
          { id: 'ch-c1-1a', name: 'Coca-Cola Zero Lata', price: 0 },
          { id: 'ch-c1-1b', name: 'Coca-Cola Original Lata', price: 0 },
          { id: 'ch-c1-1c', name: 'Guaraná Antarctica Lata', price: 0 },
          { id: 'ch-c1-1d', name: 'Suco de Laranja Natural', price: 4.00 }
        ]
      }
    ]
  },
  {
    id: 'prod-b4',
    storeId: 'store-1',
    categoryId: 'cat-b3',
    name: 'Batata Frita Rústica G',
    description: 'Batatas fritas cortadas rústicas com casca, temperadas com sal, alecrim fresco e páprica defumada. Acompanha maionese da casa.',
    price: 19.90,
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  },
  {
    id: 'prod-b5',
    storeId: 'store-1',
    categoryId: 'cat-b4',
    name: 'Coca-Cola Original 350ml',
    description: 'Lata gelada de 350ml.',
    price: 6.00,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  },
  {
    id: 'prod-b6',
    storeId: 'store-1',
    categoryId: 'cat-b4',
    name: 'Água Mineral sem Gás 500ml',
    description: 'Garrafa de 500ml.',
    price: 4.50,
    imageUrl: 'https://images.unsplash.com/photo-1608885898957-a599fb18de33?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  },
  {
    id: 'prod-b7',
    storeId: 'store-1',
    categoryId: 'cat-b5',
    name: 'Brownie de Chocolate Belga',
    description: 'Delicioso brownie cremoso de chocolate com nozes picadas. Servido quentinho.',
    price: 12.90,
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  },

  // Bella Italia Products
  {
    id: 'prod-p1',
    storeId: 'store-2',
    categoryId: 'cat-p1',
    name: 'Pizza Margherita',
    description: 'Molho de tomate artesanal italiano, muçarela premium ralada, fatias de tomate fresco, manjericão gigante e um fio de azeite extra virgem.',
    price: 49.90,
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-p1-1',
        name: 'Tamanho da Pizza',
        type: 'single',
        required: true,
        isSize: true,
        choices: [
          { id: 'ch-p1-1b', name: 'Média (6 fatias - 30cm)', price: 39.90 },
          { id: 'ch-p1-1a', name: 'Grande (8 fatias - 35cm)', price: 49.90 },
          { id: 'ch-p1-1c', name: 'Gigante (10 fatias - 40cm)', price: 61.90 }
        ]
      },
      {
        id: 'opt-p1-2',
        name: 'Borda Recheada',
        type: 'single',
        required: false,
        choices: [
          { id: 'ch-p1-2a', name: 'Sem Borda', price: 0 },
          { id: 'ch-p1-2b', name: 'Catupiry Original', price: 8.00 },
          { id: 'ch-p1-2c', name: 'Cheddar Cremoso', price: 8.00 },
          { id: 'ch-p1-2d', name: 'Chocolate Ao Leite', price: 10.00 }
        ]
      }
    ]
  },
  {
    id: 'prod-p2',
    storeId: 'store-2',
    categoryId: 'cat-p1',
    name: 'Pizza Calabresa',
    description: 'Molho de tomate artesanal, queijo muçarela, calabresa defumada fatiada de alta qualidade, cebola roxa e orégano.',
    price: 47.90,
    imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-p2-1',
        name: 'Tamanho da Pizza',
        type: 'single',
        required: true,
        isSize: true,
        choices: [
          { id: 'ch-p2-1b', name: 'Média (6 fatias - 30cm)', price: 39.90 },
          { id: 'ch-p2-1a', name: 'Grande (8 fatias - 35cm)', price: 47.90 },
          { id: 'ch-p2-1c', name: 'Gigante (10 fatias - 40cm)', price: 59.90 }
        ]
      }
    ]
  },
  {
    id: 'prod-p3',
    storeId: 'store-2',
    categoryId: 'cat-p2',
    name: 'Pizza Quatro Queijos Gourmet',
    description: 'Combinação espetacular de molho de tomate, muçarela premium, provolone defumado, queijo gorgonzola e catupiry cremoso legítimo.',
    price: 56.90,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true,
    options: [
      {
        id: 'opt-p3-1',
        name: 'Tamanho da Pizza',
        type: 'single',
        required: true,
        isSize: true,
        choices: [
          { id: 'ch-p3-1b', name: 'Média (6 fatias - 30cm)', price: 46.90 },
          { id: 'ch-p3-1a', name: 'Grande (8 fatias - 35cm)', price: 56.90 },
          { id: 'ch-p3-1c', name: 'Gigante (10 fatias - 40cm)', price: 68.90 }
        ]
      }
    ]
  },
  {
    id: 'prod-p4',
    storeId: 'store-2',
    categoryId: 'cat-p3',
    name: 'Coca-Cola Original 2 Litros',
    description: 'Garrafa pet de 2L gelada.',
    price: 13.90,
    imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80',
    isActive: true,
    isAvailable: true
  }
];

export const INITIAL_MOTOBOYS: Motoboy[] = [
  {
    id: 'mb-1',
    storeId: 'store-1',
    name: 'Carlos Oliveira (Carlinhos)',
    phone: '5511977771111',
    vehicle: 'Honda CG 160 Fan - Placa ABC-1234',
    pixKey: '11977771111',
    pixKeyType: 'telefone',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mb-2',
    storeId: 'store-1',
    name: 'Marcos Silva (Marcão)',
    phone: '5511977772222',
    vehicle: 'Yamaha Fazer 250 - Placa XYZ-9876',
    pixKey: 'marcos.entregas@pix.com',
    pixKeyType: 'email',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export function getLocalStorageData() {
  if (typeof window === 'undefined') {
    return {
      stores: INITIAL_STORES,
      categories: INITIAL_CATEGORIES,
      products: INITIAL_PRODUCTS,
      adminSettings: DEFAULT_ADMIN_SETTINGS,
      orders: INITIAL_ORDERS,
      cashTransactions: INITIAL_CASH_TRANSACTIONS,
      motoboys: INITIAL_MOTOBOYS
    };
  }

  // Load from local storage or set defaults
  let stores = INITIAL_STORES;
  let categories = INITIAL_CATEGORIES;
  let products = INITIAL_PRODUCTS;
  let adminSettings = DEFAULT_ADMIN_SETTINGS;
  let orders: Order[] = INITIAL_ORDERS;
  let cashTransactions: CashTransaction[] = INITIAL_CASH_TRANSACTIONS;
  let motoboys: Motoboy[] = INITIAL_MOTOBOYS;

  const storedStores = localStorage.getItem('cardapio_stores');
  const storedCategories = localStorage.getItem('cardapio_categories');
  const storedProducts = localStorage.getItem('cardapio_products');
  const storedAdmin = localStorage.getItem('cardapio_admin_settings');
  const storedOrders = localStorage.getItem('cardapio_orders');
  const storedCash = localStorage.getItem('cardapio_cash_transactions');
  const storedMotoboys = localStorage.getItem('cardapio_motoboys');

  if (storedStores) {
    try {
      const parsed = JSON.parse(storedStores);
      if (Array.isArray(parsed)) {
        stores = parsed.map(s => ({
          ...s,
          isApproved: s.isApproved ?? true,
          isBlocked: s.isBlocked ?? false,
          rating: s.rating ?? 4.9,
          planExpiresAt: s.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysOnline: s.daysOnline ?? 30,
          ownerLogin: s.ownerLogin || s.slug.replace(/[^a-z0-9]/gi, '').toLowerCase(),
          ownerPassword: s.ownerPassword || '123',
          notificationSettings: s.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS
        }));
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_stores', JSON.stringify(INITIAL_STORES));
  }

  if (storedCategories) {
    try {
      categories = JSON.parse(storedCategories);
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_categories', JSON.stringify(INITIAL_CATEGORIES));
  }

  if (storedProducts) {
    try {
      const parsedProds = JSON.parse(storedProducts);
      if (Array.isArray(parsedProds)) {
        products = parsedProds.map(p => {
          const normalizedOptions = (p.options || []).map((opt: any) => {
            const isSize = opt.isSize ?? (opt.type === 'single' && /(tamanho|tamanhos|size|porção|porcao)/i.test(opt.name || ''));
            let choices = opt.choices || [];
            if (isSize) {
              const hasNegative = choices.some((c: any) => c.price < 0);
              const hasZero = choices.some((c: any) => c.price === 0);
              if (hasNegative || (hasZero && p.price > 0)) {
                choices = choices.map((c: any) => ({
                  ...c,
                  price: c.price <= 0 || c.price < p.price * 0.4 ? Math.max(0, p.price + c.price) : c.price
                }));
              }
            }
            return {
              ...opt,
              isSize,
              choices
            };
          });

          return {
            ...p,
            isFeatured: p.isFeatured ?? (p.id === 'prod-b1' || p.id === 'prod-combo1'),
            originalPrice: p.originalPrice ?? (p.id === 'prod-b1' ? 42.90 : p.id === 'prod-combo1' ? 48.90 : undefined),
            options: normalizedOptions
          };
        });
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_products', JSON.stringify(INITIAL_PRODUCTS));
  }

  if (storedAdmin) {
    try {
      const parsedAdmin = JSON.parse(storedAdmin);
      let whatsapp = parsedAdmin.superAdminWhatsapp || DEFAULT_ADMIN_SETTINGS.superAdminWhatsapp;
      if (whatsapp === '5511999999999') {
        whatsapp = DEFAULT_ADMIN_SETTINGS.superAdminWhatsapp;
      }
      if (whatsapp && !whatsapp.startsWith('55') && (whatsapp.length === 10 || whatsapp.length === 11)) {
        whatsapp = '55' + whatsapp;
      }
      adminSettings = {
        ...DEFAULT_ADMIN_SETTINGS,
        ...parsedAdmin,
        superAdminWhatsapp: whatsapp
      };
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_admin_settings', JSON.stringify(DEFAULT_ADMIN_SETTINGS));
  }

  if (storedOrders) {
    try {
      orders = JSON.parse(storedOrders);
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_orders', JSON.stringify(INITIAL_ORDERS));
  }

  if (storedCash) {
    try {
      cashTransactions = JSON.parse(storedCash);
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_cash_transactions', JSON.stringify(INITIAL_CASH_TRANSACTIONS));
  }

  if (storedMotoboys) {
    try {
      motoboys = JSON.parse(storedMotoboys);
    } catch (e) {
      console.error(e);
    }
  } else {
    localStorage.setItem('cardapio_motoboys', JSON.stringify(INITIAL_MOTOBOYS));
  }

  return { stores, categories, products, adminSettings, orders, cashTransactions, motoboys };
}

export function saveLocalStorageData(
  stores: Store[],
  categories: Category[],
  products: Product[],
  adminSettings: AdminSettings,
  orders?: Order[],
  cashTransactions?: CashTransaction[],
  motoboys?: Motoboy[]
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cardapio_stores', JSON.stringify(stores));
    localStorage.setItem('cardapio_categories', JSON.stringify(categories));
    localStorage.setItem('cardapio_products', JSON.stringify(products));
    localStorage.setItem('cardapio_admin_settings', JSON.stringify(adminSettings));
    if (orders) {
      localStorage.setItem('cardapio_orders', JSON.stringify(orders));
    }
    if (cashTransactions) {
      localStorage.setItem('cardapio_cash_transactions', JSON.stringify(cashTransactions));
    }
    if (motoboys) {
      localStorage.setItem('cardapio_motoboys', JSON.stringify(motoboys));
    }
  } catch (err) {
    console.warn('Unable to write to localStorage (quota or private browsing mode):', err);
  }
}
