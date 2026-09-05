import { Order } from '../types';
import { startNewOrderAlarm, ensureAudioUnlocked } from './audioAlert';

const BROADCAST_CHANNEL_NAME = 'cardapio_realtime_orders';

// Track browser document title flashing
let titleFlashTimer: any = null;
let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Cardápio Web';

export function flashDocumentTitle(message: string, count = 10) {
  if (typeof document === 'undefined') return;
  if (!originalDocumentTitle || originalDocumentTitle.includes('🔔')) {
    originalDocumentTitle = 'Cardápio Web';
  }

  if (titleFlashTimer) clearInterval(titleFlashTimer);

  let isAlternate = false;
  let cycles = 0;

  titleFlashTimer = setInterval(() => {
    document.title = isAlternate ? message : originalDocumentTitle;
    isAlternate = !isAlternate;
    cycles++;
    if (cycles >= count * 2) {
      clearInterval(titleFlashTimer);
      titleFlashTimer = null;
      document.title = originalDocumentTitle;
    }
  }, 800);
}

export function stopDocumentTitleFlash() {
  if (typeof document === 'undefined') return;
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (originalDocumentTitle) {
    document.title = originalDocumentTitle;
  }
}

// Request desktop notification permissions
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

// Show HTML5 native notification if supported and permitted
export function showSystemNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        });
      } catch (e) {
        // Ignore notification errors in certain sandboxed iframes
      }
    }
  }
}

// Realtime order subscriber
export type OrdersListener = (orders: Order[], isNewIncoming?: boolean, newOrder?: Order) => void;

export interface RealtimeDataPayload {
  stores?: any[];
  categories?: any[];
  products?: any[];
  adminSettings?: any;
  motoboys?: any[];
  orders?: any[];
}

export type DataListener = (payload: RealtimeDataPayload) => void;

export function deduplicateOrders(orders: Order[]): Order[] {
  if (!Array.isArray(orders)) return [];
  const seenIds = new Set<string>();
  const seenStoreCodes = new Set<string>();
  const unique: Order[] = [];

  for (const o of orders) {
    if (!o || !o.id) continue;
    const storeCodeKey = o.storeId && o.code ? `${o.storeId}_${o.code}` : null;
    if (seenIds.has(o.id)) continue;
    if (storeCodeKey && seenStoreCodes.has(storeCodeKey)) continue;

    seenIds.add(o.id);
    if (storeCodeKey) seenStoreCodes.add(storeCodeKey);
    unique.push(o);
  }
  return unique;
}

function computeOrdersSignature(orders: Order[]): string {
  if (!orders || orders.length === 0) return '';
  return orders
    .map(o => `${o.id}:${o.status}:${o.cancellationReason || ''}:${o.total}`)
    .sort()
    .join('|');
}

class RealtimeOrderManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private sseSource: EventSource | null = null;
  private pollInterval: any = null;
  private listeners: Set<OrdersListener> = new Set();
  private dataListeners: Set<DataListener> = new Set();
  private lastKnownOrderIds: Set<string> = new Set();
  private lastKnownOrders: Order[] = [];
  private lastKnownSignature: string = '';
  private lastKnownProductsSignature: string = '';
  private lastUserActionTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.initStorageListener();
      this.initSSE();
      this.startPolling();
    }
  }

  public setInitialOrders(orders: Order[]) {
    const deduped = deduplicateOrders(orders);
    this.lastKnownOrders = deduped;
    this.lastKnownSignature = computeOrdersSignature(deduped);
    this.lastKnownOrderIds = new Set(deduped.map(o => o.id));
  }

  public subscribe(listener: OrdersListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  private notifyListeners(orders: Order[], isNewIncoming = false, newOrder?: Order) {
    this.listeners.forEach(fn => {
      try {
        fn(orders, isNewIncoming, newOrder);
      } catch (err) {
        console.error('Error notifying order listener:', err);
      }
    });
  }

  private notifyDataListeners(payload: RealtimeDataPayload) {
    this.dataListeners.forEach(fn => {
      try {
        fn(payload);
      } catch (err) {
        console.error('Error notifying data listener:', err);
      }
    });
  }

  private handleIncomingOrders(incomingOrders: Order[], source = 'unknown') {
    if (!Array.isArray(incomingOrders)) return;

    // Grace period: If user recently performed an action locally (e.g. accepted an order),
    // do not let background server polling overwrite local state with stale data
    const now = Date.now();
    if (now - this.lastUserActionTime < 3500 && source === 'poll') {
      return;
    }

    const deduped = deduplicateOrders(incomingOrders);
    const newSignature = computeOrdersSignature(deduped);
    // If the data is identical, return immediately to prevent React re-renders and UI flickering
    if (newSignature === this.lastKnownSignature && this.lastKnownOrders.length === deduped.length) {
      return;
    }

    // Check if any incoming pending order wasn't known before
    let hasNewPendingOrder = false;
    let newestOrder: Order | undefined;

    deduped.forEach(order => {
      if (!this.lastKnownOrderIds.has(order.id)) {
        if (order.status === 'pending') {
          hasNewPendingOrder = true;
          newestOrder = order;
        }
      }
    });

    this.lastKnownOrders = deduped;
    this.lastKnownSignature = newSignature;
    this.lastKnownOrderIds = new Set(deduped.map(o => o.id));

    // Notify registered listeners with updated orders
    this.notifyListeners(deduped, hasNewPendingOrder, newestOrder);
  }

  // 1. Cross-tab BroadcastChannel (instant multi-tab communication)
  private initBroadcastChannel() {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (data && data.type === 'ORDERS_UPDATED' && Array.isArray(data.orders)) {
            this.handleIncomingOrders(data.orders, 'broadcast');
          } else if (data && data.type === 'NEW_ORDER' && data.order) {
            const updated = [data.order, ...this.lastKnownOrders.filter(o => o.id !== data.order.id)];
            this.handleIncomingOrders(updated, 'broadcast');
          } else if (data && data.type === 'DATA_UPDATED') {
            this.notifyDataListeners(data);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported or error:', e);
    }
  }

  // 2. Cross-tab storage listener (triggered by browser only when another tab updates localStorage)
  private initStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'cardapio_orders' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            this.handleIncomingOrders(parsed, 'storage_event');
          }
        } catch (e) {
          // ignore parse error
        }
      } else if (event.key === 'cardapio_products' && event.newValue) {
        try {
          const products = JSON.parse(event.newValue);
          this.notifyDataListeners({ products });
        } catch (e) {}
      } else if (event.key === 'cardapio_motoboys' && event.newValue) {
        try {
          const motoboys = JSON.parse(event.newValue);
          this.notifyDataListeners({ motoboys });
        } catch (e) {}
      }
    });
  }

  // 3. Server-Sent Events (SSE) for instant push across different devices
  private initSSE() {
    try {
      this.sseSource = new EventSource('/api/orders/stream');

      this.sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.orders)) {
            this.handleIncomingOrders(data.orders, 'sse');
          }
          if (data && data.type === 'DATA_UPDATED') {
            this.notifyDataListeners(data);
          }
        } catch (e) {
          // ignore parse error
        }
      };

      this.sseSource.onerror = () => {
        // SSE error or reconnection; fallback poller handles connection drops
      };
    } catch (e) {
      // ignore if SSE is not available
    }
  }

  // 4. Stable safety heartbeat: polls server every 4s without redundant localStorage parsing
  private startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.orders)) {
            this.handleIncomingOrders(data.orders, 'poll');
          }
        }
      } catch (e) {
        // server might be booting or offline
      }
    }, 4000);
  }

  // Send new order to all clients and server
  public async broadcastNewOrder(newOrder: Order) {
    this.lastUserActionTime = Date.now();
    const filtered = this.lastKnownOrders.filter(o => 
      o.id !== newOrder.id && 
      !(o.storeId && newOrder.storeId && o.storeId === newOrder.storeId && o.code && newOrder.code && o.code === newOrder.code)
    );
    const updated = deduplicateOrders([newOrder, ...filtered]);
    this.lastKnownOrders = updated;
    this.lastKnownSignature = computeOrdersSignature(updated);
    this.lastKnownOrderIds = new Set(updated.map(o => o.id));

    // 1. Broadcast via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'NEW_ORDER',
          order: newOrder,
          orders: updated
        });
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Update localStorage
    try {
      localStorage.setItem('cardapio_orders', JSON.stringify(updated));
    } catch (e) {
      console.warn('localStorage save error:', e);
    }

    // 3. Post to backend server
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
    } catch (e) {
      console.warn('Server POST /api/orders error:', e);
    }

    return updated;
  }

  // Broadcast updated order list (e.g. status changes or cancellations)
  public async broadcastUpdatedOrders(orders: Order[]) {
    this.lastUserActionTime = Date.now();
    const updated = deduplicateOrders(orders);
    this.lastKnownOrders = updated;
    this.lastKnownSignature = computeOrdersSignature(updated);
    this.lastKnownOrderIds = new Set(updated.map(o => o.id));

    // 1. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'ORDERS_UPDATED',
          orders: updated
        });
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. localStorage
    try {
      localStorage.setItem('cardapio_orders', JSON.stringify(updated));
    } catch (e) {
      console.warn('localStorage save error:', e);
    }

    // 3. Server sync
    try {
      await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
    } catch (e) {
      console.warn('Server PUT /api/orders error:', e);
    }
  }

  // Broadcast updated products/prices/stores/motoboys across all connected clients & server
  public async broadcastUpdatedData(payload: RealtimeDataPayload) {
    // 1. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DATA_UPDATED',
          ...payload
        });
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. localStorage
    try {
      if (payload.products) localStorage.setItem('cardapio_products', JSON.stringify(payload.products));
      if (payload.stores) localStorage.setItem('cardapio_stores', JSON.stringify(payload.stores));
      if (payload.categories) localStorage.setItem('cardapio_categories', JSON.stringify(payload.categories));
      if (payload.motoboys) localStorage.setItem('cardapio_motoboys', JSON.stringify(payload.motoboys));
      if (payload.adminSettings) localStorage.setItem('cardapio_admin_settings', JSON.stringify(payload.adminSettings));
    } catch (e) {
      console.warn('localStorage save error:', e);
    }

    // 3. Server sync
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Server POST /api/data error:', e);
    }
  }

  public cleanup() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const realtimeOrderManager = new RealtimeOrderManager();
