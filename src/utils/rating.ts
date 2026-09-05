import { Store, Order } from '../types';

export interface CalculatedRating {
  rating: number; // Ex: 4.8
  count: number; // Total de avaliações
  displayable: boolean; // Só pode mostrar a nota quando tiver 3.0 pontos para cima
  formatted: string; // Ex: "4.8"
}

/**
 * Calcula a nota da loja que cresce gradualmente de acordo com as avaliações dos clientes.
 * Regra: Só pode exibir a nota publicamente se a nota for de 3.0 pontos para cima.
 */
export function calculateStoreRating(store: Store, orders: Order[] = []): CalculatedRating {
  const ratedOrders = (orders || []).filter(
    o => o.storeId === store.id && typeof o.storeRating === 'number' && o.storeRating > 0
  );

  let finalRating = store.rating ?? 0;
  let finalCount = store.ratingCount ?? 0;

  if (ratedOrders.length > 0) {
    const sum = ratedOrders.reduce((acc, o) => acc + (o.storeRating || 0), 0);
    const count = ratedOrders.length;
    // Média real calculada a partir das avaliações dos clientes
    const avg = sum / count;
    finalRating = Math.round(avg * 10) / 10;
    finalCount = count;
  }

  return {
    rating: finalRating,
    count: finalCount,
    displayable: finalRating >= 3.0,
    formatted: finalRating.toFixed(1)
  };
}
