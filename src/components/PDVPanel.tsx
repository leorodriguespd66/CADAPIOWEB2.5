import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, ArrowDownCircle, ArrowUpCircle, FileText, Bell, BellOff, 
  Check, X, Bike, Clock, Search, Plus, Trash2, Send, ChevronDown, 
  ChevronUp, AlertTriangle, Printer, Filter, Calendar, MessageSquare, 
  ShoppingBag, CheckCircle2, User, Phone, MapPin, CreditCard, RefreshCw,
  MinusCircle, Navigation, ExternalLink, Star
} from 'lucide-react';
import { Store, Order, CashTransaction, OrderStatus, StoreNotificationSettings, Motoboy } from '../types';
import { generateDailyReportPDF } from '../utils/pdfGenerator';
import { startNewOrderAlarm, stopNewOrderAlarm, previewAlertSound, toggleMuteAlert, isAlertMuted, ensureAudioUnlocked } from '../utils/audioAlert';
import { stopDocumentTitleFlash, flashDocumentTitle } from '../utils/realtimeSync';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../initialData';
import MotoboyDeliveryModal from './MotoboyDeliveryModal';

interface PDVPanelProps {
  store: Store;
  orders: Order[];
  cashTransactions: CashTransaction[];
  motoboys?: Motoboy[];
  isSuperAdmin?: boolean;
  onUpdateOrders: (orders: Order[]) => void;
  onUpdateCashTransactions: (transactions: CashTransaction[]) => void;
  onUpdateStore: (store: Store) => void;
}

export default function PDVPanel({
  store,
  orders,
  cashTransactions,
  motoboys = [],
  isSuperAdmin = false,
  onUpdateOrders,
  onUpdateCashTransactions,
  onUpdateStore
}: PDVPanelProps) {
  // Current selected date for PDV view (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Status Filter for orders
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');

  // Modals
  const [showCashModal, setShowCashModal] = useState<'in' | 'out' | null>(null);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashDescription, setCashDescription] = useState<string>('');
  const [cashCategory, setCashCategory] = useState<string>('reforco');

  // Driver Assignment for Dispatch
  const [selectingDriverForOrder, setSelectingDriverForOrder] = useState<Order | null>(null);

  // WhatsApp notification modal/popover
  const [notifyingOrder, setNotifyingOrder] = useState<{ order: Order; action: 'accepted' | 'delivering' | 'completed' | 'cancelled' } | null>(null);
  const [customNotifyMsg, setCustomNotifyMsg] = useState<string>('');

  // Rejection modal
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Ingredientes esgotados no momento');

  // Motoboy GPS & Delivery Tracking modal
  const [motoboyModalOrder, setMotoboyModalOrder] = useState<Order | null>(null);

  // Expanded order items view
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // Active store notification settings
  const notificationSettings: StoreNotificationSettings = store.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

  // Store orders
  const storeOrders = useMemo(() => {
    return orders.filter(o => o.storeId === store.id);
  }, [orders, store.id]);

  // Check for pending orders to ring continuous audio alarm
  const pendingOrders = useMemo(() => {
    return storeOrders.filter(o => o.status === 'pending');
  }, [storeOrders]);

  // SOUND EFFECT: Ring continuously while there are pending orders
  // CRITICAL RULE: Sound ONLY stops when the owner/admin accepts or rejects ALL pending orders
  useEffect(() => {
    if (pendingOrders.length > 0) {
      ensureAudioUnlocked();
      startNewOrderAlarm();
      flashDocumentTitle(`🔔 (${pendingOrders.length}) NOVO PEDIDO!`);
    } else {
      stopNewOrderAlarm();
      stopDocumentTitleFlash();
    }
  }, [pendingOrders.length]);

  // Orders for the selected date
  const dayOrders = useMemo(() => {
    return storeOrders.filter(o => {
      const orderDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      return orderDate === selectedDate;
    });
  }, [storeOrders, selectedDate]);

  // Filtered orders for table display
  const filteredOrders = useMemo(() => {
    return dayOrders.filter(o => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesSearch = 
        !orderSearchTerm ||
        o.code.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
        o.customerPhone.includes(orderSearchTerm);
      return matchesStatus && matchesSearch;
    });
  }, [dayOrders, statusFilter, orderSearchTerm]);

  // Cash transactions for the selected date
  const dayCashTransactions = useMemo(() => {
    return cashTransactions.filter(t => t.storeId === store.id && t.date === selectedDate);
  }, [cashTransactions, store.id, selectedDate]);

  // Financial Metrics for the selected date
  const validDayOrders = useMemo(() => {
    return dayOrders.filter(o => o.status !== 'cancelled');
  }, [dayOrders]);

  const totalSales = useMemo(() => {
    return validDayOrders.reduce((sum, o) => sum + o.total, 0);
  }, [validDayOrders]);

  const paymentBreakdown = useMemo(() => {
    const stats = {
      dinheiro: { count: 0, total: 0 },
      pix: { count: 0, total: 0 },
      cartao_credito: { count: 0, total: 0 },
      cartao_debito: { count: 0, total: 0 }
    };
    validDayOrders.forEach(o => {
      if (stats[o.paymentMethod]) {
        stats[o.paymentMethod].count += 1;
        stats[o.paymentMethod].total += o.total;
      }
    });
    return stats;
  }, [validDayOrders]);

  // Manual cash entries (entradas avulsas)
  const manualCashIn = useMemo(() => {
    return dayCashTransactions
      .filter(t => t.type === 'in' && t.category !== 'venda')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [dayCashTransactions]);

  // Manual cash exits (saídas / despesas)
  const manualCashOut = useMemo(() => {
    return dayCashTransactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [dayCashTransactions]);

  // Total cash flow
  const totalCashInflow = totalSales + manualCashIn;
  const netCashBalance = totalCashInflow - manualCashOut;

  // Helper to format WhatsApp message variables
  const formatNotificationText = (template: string, order: Order, reason?: string) => {
    const addressStr = order.receiptType === 'delivery' 
      ? `${order.addressStreet || ''}, ${order.addressNumber || ''} - ${order.addressNeighborhood || ''}`
      : (order.receiptType === 'table' ? `Mesa ${order.tableNumber}` : 'Retirada no Balcão');

    return template
      .replace(/{cliente}/g, order.customerName)
      .replace(/{pedido}/g, order.code)
      .replace(/{tempo}/g, notificationSettings.estimatedDeliveryTime || '30 a 45 min')
      .replace(/{total}/g, order.total.toFixed(2))
      .replace(/{endereco}/g, addressStr)
      .replace(/{motivo}/g, reason || 'indisponibilidade momentânea');
  };

  // Status transition handlers
  const handleAcceptOrder = (order: Order) => {
    const updated = orders.map(o => o.id === order.id ? { ...o, status: 'preparing' as OrderStatus } : o);
    onUpdateOrders(updated);
    const remainingPendingCount = storeOrders.filter(o => o.id !== order.id && o.status === 'pending').length;
    if (remainingPendingCount === 0) {
      stopNewOrderAlarm();
      stopDocumentTitleFlash();
    }

    // Prepare WhatsApp message
    const msg = formatNotificationText(notificationSettings.acceptedMessage, order);
    setCustomNotifyMsg(msg);
    setNotifyingOrder({ order, action: 'accepted' });
  };

  const handleConfirmRejectOrder = () => {
    if (!rejectingOrder) return;
    const order = rejectingOrder;
    const updated = orders.map(o => o.id === order.id ? { 
      ...o, 
      status: 'cancelled' as OrderStatus, 
      cancellationReason: rejectReason 
    } : o);
    onUpdateOrders(updated);
    const remainingPendingCount = storeOrders.filter(o => o.id !== order.id && o.status === 'pending').length;
    if (remainingPendingCount === 0) {
      stopNewOrderAlarm();
      stopDocumentTitleFlash();
    }
    setRejectingOrder(null);

    // Prepare cancellation message
    const msg = formatNotificationText(notificationSettings.cancelledMessage || '', order, rejectReason);
    setCustomNotifyMsg(msg);
    setNotifyingOrder({ order, action: 'cancelled' });
  };

  const handleInitiateDispatch = (order: Order) => {
    const storeMotoboys = motoboys.filter(m => m.storeId === store.id && m.isActive);
    if (storeMotoboys.length > 0 && order.receiptType === 'delivery') {
      setSelectingDriverForOrder(order);
    } else {
      handleDirectDispatch(order);
    }
  };

  const handleDirectDispatch = (order: Order, driver?: Motoboy) => {
    const driverFee = order.deliveryFee || 0;
    const updated = orders.map(o => o.id === order.id ? { 
      ...o, 
      status: 'delivering' as OrderStatus,
      driverId: driver?.id || o.driverId,
      driverName: driver?.name || o.driverName,
      driverPhone: driver?.phone || o.driverPhone,
      driverFee: driver ? driverFee : (o.driverFee ?? driverFee),
      driverFeePaid: false
    } : o);
    onUpdateOrders(updated);
    setSelectingDriverForOrder(null);

    const updatedOrder = updated.find(o => o.id === order.id) || order;
    const msg = formatNotificationText(notificationSettings.deliveryMessage, updatedOrder);
    setCustomNotifyMsg(msg);
    setNotifyingOrder({ order: updatedOrder, action: 'delivering' });
  };

  const handleDispatchOrder = (order: Order) => {
    handleInitiateDispatch(order);
  };

  const handleCompleteOrder = (order: Order) => {
    const updated = orders.map(o => o.id === order.id ? { ...o, status: 'completed' as OrderStatus } : o);
    onUpdateOrders(updated);
  };

  const handleSendNotificationWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setNotifyingOrder(null);
  };

  // Add manual cash transaction
  const handleAddCashTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(cashAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }
    if (!cashDescription.trim()) {
      alert('Informe uma descrição para o lançamento.');
      return;
    }

    const newTransaction: CashTransaction = {
      id: 'cash-' + Date.now(),
      storeId: store.id,
      date: selectedDate,
      createdAt: new Date().toISOString(),
      type: showCashModal === 'in' ? 'in' : 'out',
      category: (cashCategory as any) || (showCashModal === 'in' ? 'reforco' : 'despesa'),
      description: cashDescription.trim(),
      amount: amountNum,
      paymentMethod: 'dinheiro'
    };

    onUpdateCashTransactions([newTransaction, ...cashTransactions]);
    setShowCashModal(null);
    setCashAmount('');
    setCashDescription('');
  };

  const handleDeleteCashTransaction = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta movimentação de caixa?')) {
      onUpdateCashTransactions(cashTransactions.filter(t => t.id !== id));
    }
  };

  // Download PDF Report
  const handleDownloadPDF = () => {
    generateDailyReportPDF({
      store,
      dateString: selectedDate,
      orders: dayOrders,
      cashTransactions: dayCashTransactions
    });
  };

  // Toggle order items expansion
  const toggleOrderExpand = (id: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6" id="pdv-panel-container">
      {/* 🚨 PENDING ORDER ALERT BANNER (CANNOT BE MUTED; PERSISTS UNTIL ALL PENDING ORDERS ARE ACCEPTED OR REJECTED) */}
      {pendingOrders.length > 0 && (
        <div className="bg-red-600 text-white rounded-2xl p-4 sm:p-5 shadow-xl shadow-red-500/25 border-2 border-red-400 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 text-center md:text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <Bell size={26} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-white text-red-600 font-extrabold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Alarme Sonoro Contínuo
                  </span>
                  <span className="text-xs text-red-100 font-medium">
                    {pendingOrders.length} pedido(s) aguardando sua resposta
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold mt-1">
                  🚨 Pedido recebido! O som NÃO para e os botões não somem até você Aceitar ou Recusar o pedido.
                </h3>
              </div>
            </div>
          </div>

          {/* Cards for each pending order with Aceitar and Recusar buttons */}
          <div className="space-y-2.5 pt-2 border-t border-red-400/60">
            {pendingOrders.map(order => (
              <div 
                key={order.id} 
                className="bg-red-700/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-red-300/40 shadow-sm"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-white text-sm bg-red-900/80 px-2.5 py-0.5 rounded-md">
                      {order.code}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {order.customerName}
                    </span>
                    <span className="text-xs text-red-100">
                      ({order.customerPhone})
                    </span>
                    <span className="text-xs text-red-200">
                      • {order.receiptType === 'delivery' ? '🛵 Entrega' : order.receiptType === 'pickup' ? '🛍️ Retirada' : `🍽️ Mesa ${order.tableNumber}`}
                    </span>
                  </div>
                  <div className="text-xs text-red-100 mt-1">
                    <span className="font-bold text-white text-sm">Total: R$ {order.total.toFixed(2)}</span>
                    {' • '}
                    <span>{order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setRejectingOrder(order)}
                    className="px-4 py-2.5 rounded-xl bg-red-900 hover:bg-black/40 text-white font-bold text-xs border border-white/30 shadow-md flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <X size={16} />
                    <span>Recusar Pedido</span>
                  </button>
                  <button
                    onClick={() => handleAcceptOrder(order)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-950/30 flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <Check size={16} />
                    <span>Aceitar Pedido</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Header & Date Selector */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <span>Painel PDV & Fluxo de Caixa</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">
                {store.name}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de vendas do dia a dia, entradas e saídas de caixa e notificações automáticas aos clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Quick Date Selectors */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedDate === todayStr ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                setSelectedDate(y);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedDate !== todayStr ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ontem
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-hidden cursor-pointer"
            />
          </div>

          {/* Sound Preview / Toggle */}
          <button
            onClick={() => {
              previewAlertSound();
            }}
            title="Testar toque de notificação"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
          >
            <Bell size={15} />
            <span className="hidden sm:inline">Testar Som</span>
          </button>

          {/* Download Daily PDF Report */}
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center space-x-2 transition cursor-pointer ml-auto lg:ml-0"
          >
            <FileText size={15} />
            <span>Baixar Relatório (PDF)</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vendas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total em Vendas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            R$ {totalSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{validDayOrders.length} pedido(s) válidos</span>
            <span className="text-blue-600 font-semibold">{dayOrders.length} no total</span>
          </div>
        </div>

        {/* Entradas / Reforços */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reforços / Aportes</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            + R$ {manualCashIn.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Fundo inicial ou reforço</span>
            <button
              onClick={() => {
                setShowCashModal('in');
                setCashCategory('reforco');
              }}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {/* Saídas / Sangrias */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Saídas / Despesas</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowUpCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 tracking-tight">
            - R$ {manualCashOut.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Sangrias e compras</span>
            <button
              onClick={() => {
                setShowCashModal('out');
                setCashCategory('despesa');
              }}
              className="text-red-700 font-bold hover:underline cursor-pointer"
            >
              - Registrar
            </button>
          </div>
        </div>

        {/* Saldo Líquido do Caixa */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Líquido Apurado</span>
            <div className={`w-8 h-8 rounded-xl ${netCashBalance >= 0 ? 'bg-slate-900 text-white' : 'bg-red-500 text-white'} flex items-center justify-center`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${netCashBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            R$ {netCashBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total entradas menos saídas
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CreditCard size={15} className="text-orange-500" />
          <span>Vendas por Forma de Pagamento</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">PIX</div>
            <div className="text-lg font-black text-emerald-900 mt-0.5">
              R$ {paymentBreakdown.pix.total.toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">{paymentBreakdown.pix.count} venda(s)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Dinheiro</div>
            <div className="text-lg font-black text-amber-900 mt-0.5">
              R$ {paymentBreakdown.dinheiro.total.toFixed(2)}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">{paymentBreakdown.dinheiro.count} venda(s)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100">
            <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Cartão Crédito</div>
            <div className="text-lg font-black text-purple-900 mt-0.5">
              R$ {paymentBreakdown.cartao_credito.total.toFixed(2)}
            </div>
            <div className="text-[11px] text-purple-700 mt-0.5">{paymentBreakdown.cartao_credito.count} venda(s)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
            <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Cartão Débito</div>
            <div className="text-lg font-black text-blue-900 mt-0.5">
              R$ {paymentBreakdown.cartao_debito.total.toFixed(2)}
            </div>
            <div className="text-[11px] text-blue-700 mt-0.5">{paymentBreakdown.cartao_debito.count} venda(s)</div>
          </div>
        </div>
      </div>

      {/* Orders List & Flow Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Pedidos do Dia ({filteredOrders.length})</span>
              {pendingOrders.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {pendingOrders.length} pendente(s)
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie o status de cada pedido com botões clicáveis e notificação automática no WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente ou código..."
                value={orderSearchTerm}
                onChange={e => setOrderSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-slate-300"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">⏳ Pendente</option>
              <option value="preparing">👨‍🍳 Em Preparo</option>
              <option value="delivering">🛵 Saiu p/ Entrega</option>
              <option value="completed">✅ Concluído</option>
              <option value="cancelled">❌ Cancelado</option>
            </select>
          </div>
        </div>

        {/* PENDING ORDERS ALWAYS-VISIBLE SECTION (NEVER DISAPPEARS WHILE PENDING ORDERS EXIST) */}
        {pendingOrders.length > 0 && (
          <div className="p-4 sm:p-5 bg-red-50/90 border-b-2 border-red-200">
            <div className="flex items-center space-x-2 text-red-800 font-bold text-xs mb-3">
              <AlertTriangle size={17} className="text-red-600 animate-pulse shrink-0" />
              <span>🚨 PEDIDOS PENDENTES AGUARDANDO SUA DECISÃO ({pendingOrders.length}) — O SOM TOCA ATÉ VOCÊ RESPONDER:</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {pendingOrders.map(pOrder => (
                <div 
                  key={pOrder.id} 
                  className="bg-white border-2 border-red-400 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-red-600 text-sm bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-200">
                        {pOrder.code}
                      </span>
                      <span className="font-black text-slate-900 text-sm">
                        Total: R$ {pOrder.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-bold mt-2">
                      {pOrder.customerName} <span className="font-normal text-slate-500">({pOrder.customerPhone})</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {pOrder.receiptType === 'delivery' ? '🛵 Entrega' : '🏪 Retirada no Balcão'}
                      {pOrder.receiptType === 'delivery' && (
                        <span className="text-slate-500 ml-1">
                          • {pOrder.addressStreet}, {pOrder.addressNumber} ({pOrder.addressNeighborhood})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                      {pOrder.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setRejectingOrder(pOrder)}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition border border-red-200"
                    >
                      <X size={15} />
                      <span>Recusar</span>
                    </button>
                    <button
                      onClick={() => handleAcceptOrder(pOrder)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer transition"
                    >
                      <Check size={15} />
                      <span>Aceitar Pedido</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShoppingBag size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum pedido encontrado para esta data</p>
            <p className="text-xs text-slate-400 mt-1">Os pedidos feitos no cardápio online aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Pedido / Hora</th>
                  <th className="py-3 px-4">Cliente / Contato</th>
                  <th className="py-3 px-4">Tipo & Endereço</th>
                  <th className="py-3 px-4">Itens</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => {
                  const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  const isExpanded = expandedOrderIds[order.id];
                  const isPending = order.status === 'pending';

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-slate-50/80 transition ${isPending ? 'bg-red-50/40 font-medium' : ''}`}
                    >
                      {/* Code & Time */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`font-black font-mono text-sm ${isPending ? 'text-red-600' : 'text-slate-900'}`}>
                            {order.code}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{timeStr}</span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{order.customerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Phone size={11} className="text-slate-400" />
                          <span>{order.customerPhone}</span>
                        </div>
                      </td>

                      {/* Delivery / Pickup */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="font-semibold text-slate-700">
                          {order.receiptType === 'delivery' ? '🛵 Entrega em Casa' : order.receiptType === 'pickup' ? '🛍️ Retirar no Balcão' : `🍽️ Mesa ${order.tableNumber}`}
                        </div>
                        {order.receiptType === 'delivery' && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={`${order.addressStreet}, ${order.addressNumber} - ${order.addressNeighborhood}`}>
                            {order.addressStreet}, {order.addressNumber} ({order.addressNeighborhood})
                          </div>
                        )}
                        {order.googleMapsLink && (
                          <div className="mt-1">
                            <a
                              href={order.googleMapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition"
                              title="Abrir localização exata do cliente no Google Maps"
                            >
                              <Navigation size={10} className="text-emerald-600" />
                              <span>GPS no Maps</span>
                              <ExternalLink size={9} />
                            </a>
                          </div>
                        )}
                        {(order.storeRating || order.orderRating) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {order.storeRating && (
                              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-bold" title={`Avaliação da Loja: ${order.storeRating} estrelas`}>
                                <Star size={10} className="fill-amber-400 text-amber-500" />
                                <span>Loja: {order.storeRating}</span>
                              </span>
                            )}
                            {order.orderRating && (
                              <span className="inline-flex items-center gap-0.5 bg-orange-50 text-orange-900 border border-orange-200 px-1.5 py-0.5 rounded font-bold" title={`Avaliação do Pedido: ${order.orderRating} estrelas`}>
                                <Star size={10} className="fill-orange-400 text-orange-500" />
                                <span>Pedido: {order.orderRating}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleOrderExpand(order.id)}
                          className="text-left font-semibold text-slate-800 hover:text-orange-600 flex items-center space-x-1 cursor-pointer"
                        >
                          <span>{order.items.length} item(ns)</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-1 bg-white p-2 rounded-lg border border-slate-200 text-[11px] shadow-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="border-b border-slate-50 pb-1 last:border-0">
                                <span className="font-bold">{item.quantity}x</span> {item.productName} (R$ {item.totalPrice.toFixed(2)})
                                {item.choicesText && item.choicesText.length > 0 && (
                                  <div className="text-[10px] text-slate-500 pl-2">
                                    {item.choicesText.join(', ')}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-[10px] text-amber-700 italic pl-2">
                                    Obs: {item.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                            {order.deliveryFee > 0 && (
                              <div className="text-[10px] text-slate-500 pt-1">
                                Taxa de Entrega: R$ {order.deliveryFee.toFixed(2)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-sm">
                          R$ {order.total.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">
                          {order.paymentMethod === 'pix' ? 'PIX' : order.paymentMethod === 'dinheiro' ? `Dinheiro ${order.changeFor ? `(Troco p/ ${order.changeFor})` : ''}` : order.paymentMethod === 'cartao_credito' ? 'Crédito' : 'Débito'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {order.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse inline-block">
                            ⏳ Pendente
                          </span>
                        )}
                        {order.status === 'preparing' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-block">
                            👨‍🍳 Em Preparo
                          </span>
                        )}
                        {order.status === 'delivering' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 inline-block">
                            🛵 Saiu p/ Entrega
                          </span>
                        )}
                        {order.status === 'completed' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-block">
                            ✅ Concluído
                          </span>
                        )}
                        {order.status === 'cancelled' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 inline-block" title={order.cancellationReason}>
                            ❌ Recusado
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* When Pending: Clickable buttons to Accept or Reject (STOPS SOUND) */}
                          {order.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleAcceptOrder(order)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center space-x-1 shadow-xs transition cursor-pointer"
                                title="Aceitar pedido e parar o alarme sonoro"
                              >
                                <Check size={13} />
                                <span>Aceitar</span>
                              </button>
                              <button
                                onClick={() => setRejectingOrder(order)}
                                className="px-2 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                                title="Recusar pedido e parar o alarme sonoro"
                              >
                                <X size={13} />
                                <span>Recusar</span>
                              </button>
                            </>
                          )}

                          {/* When Preparing: Option to dispatch */}
                          {order.status === 'preparing' && (
                            <button
                              onClick={() => handleDispatchOrder(order)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center space-x-1 shadow-xs transition cursor-pointer"
                              title="Despachar para entrega e notificar cliente"
                            >
                              <Bike size={13} />
                              <span>Saindo p/ Entrega</span>
                            </button>
                          )}

                          {/* When Delivering: Complete */}
                          {order.status === 'delivering' && (
                            <button
                              onClick={() => handleCompleteOrder(order)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center space-x-1 transition cursor-pointer"
                              title="Finalizar pedido como entregue"
                            >
                              <CheckCircle2 size={13} />
                              <span>Finalizar</span>
                            </button>
                          )}

                          {/* Motoboy Real-time GPS Tracking Modal Button */}
                          {order.receiptType === 'delivery' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setMotoboyModalOrder(order)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                                order.status === 'delivering'
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                              }`}
                              title="Acompanhar e transmitir GPS do entregador em tempo real"
                            >
                              <Navigation size={12} className={order.status === 'delivering' ? 'animate-spin' : ''} />
                              <span>{order.status === 'delivering' ? 'GPS Ao Vivo' : 'Motoboy GPS'}</span>
                            </button>
                          )}

                          {/* Direct WhatsApp notify button for any active order */}
                          <button
                            onClick={() => {
                              let tmpl = notificationSettings.acceptedMessage;
                              if (order.status === 'delivering') tmpl = notificationSettings.deliveryMessage;
                              if (order.status === 'completed') tmpl = notificationSettings.completedMessage || '';
                              const msg = formatNotificationText(tmpl, order);
                              setCustomNotifyMsg(msg);
                              setNotifyingOrder({ 
                                order, 
                                action: order.status === 'delivering' ? 'delivering' : 'accepted' 
                              });
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                            title="Enviar notificação WhatsApp ao cliente"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash Flow Log (Movimentações de Caixa do Dia) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Controle de Caixa: Entradas & Saídas Avulsas ({dayCashTransactions.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reforços de caixa, sangrias para compras rápidas ou pagamentos a fornecedores no dia.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setShowCashModal('in');
                setCashCategory('reforco');
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition cursor-pointer flex items-center space-x-1"
            >
              <Plus size={14} />
              <span>Entrada / Reforço</span>
            </button>
            <button
              onClick={() => {
                setShowCashModal('out');
                setCashCategory('despesa');
              }}
              className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition cursor-pointer flex items-center space-x-1"
            >
              <MinusCircle size={14} className="rotate-45" />
              <span>Saída / Sangria</span>
            </button>
          </div>
        </div>

        {dayCashTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhuma movimentação avulsa registrada para o dia {selectedDate}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Hora</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Categoria</th>
                  <th className="py-2.5 px-4">Descrição</th>
                  <th className="py-2.5 px-4">Valor</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayCashTransactions.map(trans => {
                  const timeStr = trans.createdAt ? new Date(trans.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  const isEntry = trans.type === 'in';

                  return (
                    <tr key={trans.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono text-slate-500">{timeStr}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isEntry ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isEntry ? 'ENTRADA (+)' : 'SAÍDA (-)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600 uppercase text-[10px]">
                        {trans.category}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {trans.description}
                      </td>
                      <td className={`py-3 px-4 font-bold text-sm ${isEntry ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isEntry ? '+' : '-'} R$ {trans.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteCashTransaction(trans.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Remover movimentação"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: REGISTRAR ENTRADA OU SAÍDA DE CAIXA */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {showCashModal === 'in' ? (
                  <>
                    <ArrowDownCircle size={20} className="text-emerald-500" />
                    <span>Lançar Entrada / Reforço de Caixa</span>
                  </>
                ) : (
                  <>
                    <ArrowUpCircle size={20} className="text-red-500" />
                    <span>Lançar Saída / Sangria de Caixa</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowCashModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCashTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 50.00"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold text-base focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Categoria</label>
                <select
                  value={cashCategory}
                  onChange={e => setCashCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                >
                  {showCashModal === 'in' ? (
                    <>
                      <option value="reforco">Fundo de Troco / Aporte Inicial</option>
                      <option value="venda">Venda Balcão Avulsa</option>
                      <option value="outro">Outra Entrada</option>
                    </>
                  ) : (
                    <>
                      <option value="despesa">Despesa Operacional / Compra Insumos</option>
                      <option value="sangria">Sangria de Caixa (Retirada de Lucro)</option>
                      <option value="entregador">Pagamento a Entregador / Diária</option>
                      <option value="outro">Outra Saída</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição / Motivo</label>
                <input
                  type="text"
                  placeholder={showCashModal === 'in' ? 'Ex: Reforço de troco de notas e moedas' : 'Ex: Compra de hortifruti na feira'}
                  value={cashDescription}
                  onChange={e => setCashDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCashModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md ${
                    showCashModal === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECUSAR PEDIDO */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center space-x-3 mb-4 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg text-slate-900">
                Recusar Pedido {rejectingOrder.code}
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Ao confirmar a recusa deste pedido, o som só desligará se todos os pedidos pendentes tiverem sido respondidos, e você poderá enviar uma justificativa ao cliente pelo WhatsApp.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">Motivo da Recusa:</label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              >
                <option value="Ingredientes ou itens do cardápio esgotados">Ingredientes ou itens do cardápio esgotados</option>
                <option value="Estabelecimento sobrecarregado ou fechado">Estabelecimento sobrecarregado ou fechado</option>
                <option value="Endereço de entrega fora da área atendida">Endereço de entrega fora da área atendida</option>
                <option value="Valor abaixo do pedido mínimo">Valor abaixo do pedido mínimo</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRejectingOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmRejectOrder}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md cursor-pointer"
              >
                Confirmar Recusa & Parar Som
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BOT DE NOTIFICAÇÃO VIA WHATSAPP (MENSAGEM PERSONALIZADA) */}
      {notifyingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Notificar Cliente via WhatsApp
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cliente: <strong>{notifyingOrder.order.customerName}</strong> ({notifyingOrder.order.customerPhone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifyingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Mensagem Gerada pelo Bot:</span>
                <span className="text-[10px] text-slate-400">Você pode editar o texto antes de enviar</span>
              </div>

              <textarea
                rows={6}
                value={customNotifyMsg}
                onChange={e => setCustomNotifyMsg(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-sans leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50"
              />
            </div>

            <div className="flex justify-end space-x-2 mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setNotifyingOrder(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Fechar sem Enviar
              </button>
              <button
                onClick={() => handleSendNotificationWhatsApp(notifyingOrder.order.customerPhone, customNotifyMsg)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                <Send size={14} />
                <span>Enviar no WhatsApp do Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Motoboy Delivery & Real-time GPS Tracking Modal */}
      {motoboyModalOrder && (
        <MotoboyDeliveryModal
          order={motoboyModalOrder}
          store={store}
          onClose={() => setMotoboyModalOrder(null)}
          onUpdateOrder={(updatedOrder) => {
            const updated = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
            onUpdateOrders(updated);
            setMotoboyModalOrder(updatedOrder);
          }}
        />
      )}

      {/* SELECT MOTOBOY MODAL ON DISPATCH */}
      {selectingDriverForOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Bike size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Selecione o Motoboy
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pedido <strong>#{selectingDriverForOrder.code}</strong> • {selectingDriverForOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectingDriverForOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Delivery address and Neighborhood fee info */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 mb-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-900 font-bold">Bairro / Setor:</span>
                <span className="text-xs font-black text-blue-950 bg-blue-100 px-2.5 py-0.5 rounded-md">
                  {selectingDriverForOrder.addressNeighborhood || 'Geral'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-900 font-bold">Taxa creditada ao Motoboy:</span>
                <span className="text-sm font-black text-emerald-700 font-mono">
                  R$ {(selectingDriverForOrder.deliveryFee || 0).toFixed(2)}
                </span>
              </div>
              {selectingDriverForOrder.addressStreet && (
                <p className="text-[11px] text-blue-800/80 pt-1 border-t border-blue-200/60 mt-1 truncate">
                  📍 {selectingDriverForOrder.addressStreet}, {selectingDriverForOrder.addressNumber}
                </p>
              )}
            </div>

            <p className="text-xs font-bold text-slate-700 mb-2">
              Escolha quem irá levar este pedido:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {motoboys
                .filter(m => m.storeId === store.id && m.isActive)
                .map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => handleDirectDispatch(selectingDriverForOrder, driver)}
                    className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-600 transition shrink-0">
                        <Bike size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{driver.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {driver.vehicle || 'Motocicleta'} • {driver.phone}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-blue-600 group-hover:translate-x-0.5 transition shrink-0 ml-2">
                      Atribuir →
                    </span>
                  </button>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleDirectDispatch(selectingDriverForOrder)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
              >
                Despachar sem motoboy
              </button>
              <button
                onClick={() => setSelectingDriverForOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
