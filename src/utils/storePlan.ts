import { Store } from '../types';

/**
 * Calculates remaining days online for a store.
 * Returns integer: > 0 for active days, <= 0 for expired.
 */
export function getStoreDaysRemaining(store: Store): number {
  if (!store.planExpiresAt) {
    return 30; // Default fallback for newly initialized stores
  }
  const expiresMs = new Date(store.planExpiresAt).getTime();
  const nowMs = Date.now();
  const diffMs = expiresMs - nowMs;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates an ISO expiration date based on number of days from now.
 */
export function calculatePlanExpiration(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Extends the store's plan days.
 */
export function extendStorePlanDays(store: Store, days: number): Store {
  return addDaysToStore(store, days);
}

export interface StorePlanDetails {
  remainingDays: number;
  isExpired: boolean;
  isNearExpiration: boolean;
  isBlocked: boolean;
  formattedExpiresAt: string;
  statusLabel: string;
  statusBadge: {
    label: string;
    variant: 'active' | 'warning' | 'expired' | 'blocked';
    color: string;
  };
}

/**
 * Returns comprehensive plan and expiration details for display.
 */
export function getStorePlanDetails(store: Store): StorePlanDetails {
  const remainingDays = getStoreDaysRemaining(store);
  const isExpired = remainingDays <= 0;
  const isNearExpiration = !isExpired && remainingDays <= 5;
  const formattedExpiresAt = formatExpirationDate(store.planExpiresAt);

  let statusBadge: StorePlanDetails['statusBadge'] = {
    label: `Liberado (${remainingDays}d)`,
    variant: 'active',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  if (store.isApproved === false) {
    statusBadge = {
      label: 'Pendente',
      variant: 'warning',
      color: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  } else if (store.isBlocked) {
    statusBadge = {
      label: 'Bloqueado pelo Adm',
      variant: 'blocked',
      color: 'bg-red-50 text-red-700 border-red-200'
    };
  } else if (isExpired) {
    statusBadge = {
      label: 'Plano Expirado',
      variant: 'expired',
      color: 'bg-red-50 text-red-700 border-red-200'
    };
  } else if (isNearExpiration) {
    statusBadge = {
      label: `Vence em ${remainingDays}d`,
      variant: 'warning',
      color: 'bg-amber-50 text-amber-800 border-amber-300'
    };
  }

  return {
    remainingDays,
    isExpired,
    isNearExpiration,
    isBlocked: !!store.isBlocked || isExpired || store.isApproved === false,
    formattedExpiresAt,
    statusLabel: statusBadge.label,
    statusBadge
  };
}

/**
 * Checks if the store's plan has expired.
 */
export function isStorePlanExpired(store: Store): boolean {
  return getStoreDaysRemaining(store) <= 0;
}

/**
 * Checks if the store is blocked from public access.
 * Returns the reason if blocked ('manual' | 'expired' | 'unapproved').
 */
export function getStoreBlockStatus(store: Store): {
  isBlocked: boolean;
  reason: 'manual' | 'expired' | 'unapproved' | null;
} {
  if (store.isApproved === false) {
    return { isBlocked: true, reason: 'unapproved' };
  }
  if (store.isBlocked === true) {
    return { isBlocked: true, reason: 'manual' };
  }
  if (isStorePlanExpired(store)) {
    return { isBlocked: true, reason: 'expired' };
  }
  return { isBlocked: false, reason: null };
}

/**
 * Adds days to a store's online subscription.
 * If already expired, extends from today.
 * If active, extends from the current expiration date.
 */
export function addDaysToStore(store: Store, daysToAdd: number): Store {
  const currentExpiresMs = store.planExpiresAt ? new Date(store.planExpiresAt).getTime() : 0;
  const now = Date.now();
  const baseMs = currentExpiresMs > now ? currentExpiresMs : now;
  const newExpiresMs = baseMs + (daysToAdd * 24 * 60 * 60 * 1000);

  return {
    ...store,
    isBlocked: false,
    isApproved: true,
    planExpiresAt: new Date(newExpiresMs).toISOString(),
    daysOnline: (store.daysOnline || 30) + daysToAdd
  };
}

/**
 * Sets an exact number of days online from right now.
 */
export function setExactDaysForStore(store: Store, daysFromNow: number): Store {
  const newExpiresMs = Date.now() + (daysFromNow * 24 * 60 * 60 * 1000);
  return {
    ...store,
    isBlocked: false,
    isApproved: true,
    planExpiresAt: new Date(newExpiresMs).toISOString(),
    daysOnline: daysFromNow
  };
}

/**
 * Formats an ISO date into Brazilian DD/MM/AAAA format.
 */
export function formatExpirationDate(isoDate?: string): string {
  if (!isoDate) return 'Não definida';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'Data inválida';
  }
}

/**
 * Generates direct WhatsApp link to the Super Administrator
 */
export function getAdminWhatsAppLink(phone: string = '5511999999999', message: string = ''): string {
  const cleanPhone = phone.replace(/\D/g, '') || '5511999999999';
  const defaultMsg = message || 'Olá! Gostaria de falar com o Administrador do Cardápio Web.';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
}
