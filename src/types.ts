export interface OptionChoice {
  id: string;
  name: string;
  price: number;
  originalPrice?: number; // Preço original sem desconto para este tamanho específico (opcional)
  isFeatured?: boolean; // Se este tamanho específico está em destaque
  featuredTag?: string; // Texto de destaque para este tamanho (ex: "Mais Pedido", "Grande em Oferta!")
}

export interface ProductOption {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  min?: number;
  max?: number;
  choices: OptionChoice[];
  isSize?: boolean; // Define se este grupo determina o tamanho/preço principal do produto
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number; // Preço original antes do desconto (opcional)
  discountTargetSizeId?: string; // ID do tamanho específico onde o desconto é aplicado (opcional)
  isFeatured?: boolean; // Produto em destaque
  featuredTag?: string; // Texto/selo customizado de destaque (ex: "Grande em Destaque", "Mais Pedido", "Oferta do Dia")
  featuredSizeId?: string; // ID da escolha/tamanho colocado em destaque
  featuredSizeName?: string; // Nome do tamanho em destaque (ex: "Grande (8 fatias)")
  imageUrl: string;
  isActive: boolean;
  isAvailable: boolean;
  options?: ProductOption[];
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  order: number;
}

export interface NeighborhoodFee {
  id: string;
  name: string;
  fee: number;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  coverUrl: string;
  phone: string; // WhatsApp number
  address: string;
  deliveryFeeType: 'flat' | 'neighborhood';
  deliveryFee: number; // Flat fee
  neighborhoodFees?: NeighborhoodFee[];
  minOrder?: number;
  workingHours: string;
  themeColor: string; // Tailwind tint or hex
  isActive: boolean;
  instagramUrl?: string;
  facebookUrl?: string;
  isApproved?: boolean;
  isBlocked?: boolean; // Bloqueio manual do link pelo Super Admin
  rating?: number; // Nota do estabelecimento (Ex: 4.9)
  ratingCount?: number; // Total de avaliações recebidas
  latitude?: number; // Latitude da loja (para rotas do motoboy)
  longitude?: number; // Longitude da loja
  planExpiresAt?: string; // Data ISO de expiração do plano online
  daysOnline?: number; // Quantidade de dias contratados
  ownerEmail?: string;
  ownerLogin?: string;
  ownerPassword?: string;
  notificationSettings?: StoreNotificationSettings;
}

export interface Review {
  id: string;
  storeId: string;
  orderId?: string;
  orderCode?: string;
  customerName: string;
  storeRating: number; // 1 a 5 estrelas
  orderRating?: number; // 1 a 5 estrelas para os produtos/pedido
  feedback?: string;
  createdAt: string;
}

export interface StoreNotificationSettings {
  acceptedMessage: string;
  deliveryMessage: string;
  completedMessage?: string;
  cancelledMessage?: string;
  estimatedDeliveryTime: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'delivering' | 'completed' | 'cancelled';

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  choicesText?: string[];
  notes?: string;
}

export interface Order {
  id: string;
  code: string;
  storeId: string;
  createdAt: string; // ISO format string
  customerName: string;
  customerPhone: string;
  receiptType: 'delivery' | 'pickup' | 'table';
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  addressComplement?: string;
  tableNumber?: string;
  customerCoordinates?: { lat: number; lng: number };
  googleMapsLink?: string;
  driverCoordinates?: { lat: number; lng: number; updatedAt?: string };
  driverId?: string; // ID do motoboy cadastrado
  driverName?: string;
  driverPhone?: string;
  driverFee?: number; // Valor que o motoboy recebe por este bairro/setor
  driverFeePaid?: boolean; // Se o valor já foi repassado/acertado com o motoboy
  driverFeePaidAt?: string;
  paymentMethod: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix';
  changeFor?: string;
  notes?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  items: OrderItem[];
  cancellationReason?: string;
  storeRating?: number; // 1 a 5 estrelas
  orderRating?: number; // 1 a 5 estrelas
  ratingFeedback?: string;
  ratedAt?: string;
}

export interface CashTransaction {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  type: 'in' | 'out'; // in: entrada/venda/reforço, out: saída/sangria/despesa
  category: 'venda' | 'reforco' | 'sangria' | 'despesa' | 'outro';
  description: string;
  amount: number;
  paymentMethod?: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'outro';
  orderId?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedChoices: {
    [optionId: string]: OptionChoice[]; // Map of optionId to selected choices
  };
  notes?: string;
  unitPrice?: number; // Preço unitário da unidade (preço do tamanho escolhido + adicionais)
  sizeName?: string; // Nome do tamanho escolhido (ex: Média, Grande, 500ml)
}

export interface OrderDetails {
  customerName: string;
  customerPhone: string;
  receiptType: 'delivery' | 'pickup' | 'table';
  addressStreet?: string;
  addressNumber?: string;
  addressNeighborhood?: string;
  addressComplement?: string;
  tableNumber?: string;
  customerCoordinates?: { lat: number; lng: number };
  googleMapsLink?: string;
  paymentMethod: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix';
  changeFor?: string;
  notes?: string;
  neighborhoodFee?: number;
}

export interface AdminSettings {
  adminLogin: string;
  adminPass: string;
  superAdminWhatsapp?: string; // WhatsApp de contato do Administrador Geral
}

export interface Motoboy {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  vehicle?: string; // Ex: Honda Fan 160 - Placa ABC-1234
  pixKey?: string;
  pixKeyType?: 'cpf' | 'telefone' | 'email' | 'aleatoria';
  isActive: boolean;
  createdAt: string;
}
