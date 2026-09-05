import { Product, ProductOption, OptionChoice } from '../types';

/**
 * Checks whether an option group represents a product size choice.
 */
export function isSizeOption(option: ProductOption): boolean {
  if (option.isSize === true) return true;
  if (option.type !== 'single') return false;

  const normalized = (option.name || '').toLowerCase().trim();
  const sizePatterns = [
    'tamanho',
    'tamanhos',
    'size',
    'sizes',
    'porção',
    'porcao',
    'porções',
    'porcoes',
    'volume',
    'capacidade',
    'medida'
  ];

  return sizePatterns.some(pattern => normalized.includes(pattern));
}

/**
 * Calculates the absolute price for a specific size choice.
 * Handles both:
 * 1) Direct absolute pricing (e.g. Broto: 29.90, Média: 39.90, Grande: 49.90)
 * 2) Base-relative differential pricing (e.g. Base: 49.90, Média: -10.00, Grande: 0, Gigante: +12.00)
 */
export function getSizeChoicePrice(
  choice: OptionChoice,
  baseProductPrice: number,
  allChoicesInOption: OptionChoice[] = []
): number {
  const priceVal = Number(choice.price) || 0;
  const basePrice = Number(baseProductPrice) || 0;

  // Check if there is explicit relative differential indicators (negative price or + / adicional in name)
  const hasNegativePrice = allChoicesInOption.some(c => (Number(c.price) || 0) < 0);
  const choiceName = (choice.name || '').toLowerCase();
  const isExplicitAddition = choiceName.includes('+') || choiceName.includes('adicional') || choiceName.includes('acréscimo');

  // If any choice has negative price, or the choice explicitly indicates an addition (+):
  if (hasNegativePrice || isExplicitAddition) {
    return Math.max(0, Math.round((basePrice + priceVal) * 100) / 100);
  }

  // If choice price is 0 and product has base price, that size costs the base price
  if (priceVal === 0 && basePrice > 0) {
    return Math.round(basePrice * 100) / 100;
  }

  // If choice has a positive price, it is the direct absolute price of that size
  if (priceVal > 0) {
    return Math.round(priceVal * 100) / 100;
  }

  return Math.round(basePrice * 100) / 100;
}

export interface CalculatedItemPrice {
  basePrice: number; // The product price based on selected size or default product price
  originalBasePrice?: number; // Preço original sem desconto (para riscar)
  discountPercentage?: number; // % de desconto deste tamanho ou produto
  addonsTotal: number; // The sum of non-size additions
  unitPrice: number; // basePrice + addonsTotal
  selectedSizeChoice?: OptionChoice;
  selectedSizePrice?: number;
  sizeOptionName?: string;
  hasSizeOption: boolean;
}

/**
 * Calculates unit price breakdown for a product given its selected choices.
 */
export function calculateItemPrice(
  product: Product,
  selectedChoices: Record<string, OptionChoice[]>
): CalculatedItemPrice {
  let basePrice = product.price;
  let originalBasePrice = product.originalPrice && product.originalPrice > product.price ? product.originalPrice : undefined;
  let addonsTotal = 0;
  let selectedSizeChoice: OptionChoice | undefined;
  let selectedSizePrice: number | undefined;
  let sizeOptionName: string | undefined;
  let hasSizeOption = false;

  const options = product.options || [];

  // Find size option if any
  const sizeOption = options.find(isSizeOption);

  if (sizeOption) {
    hasSizeOption = true;
    sizeOptionName = sizeOption.name;
    const sizeSelections = selectedChoices[sizeOption.id] || [];
    if (sizeSelections.length > 0) {
      selectedSizeChoice = sizeSelections[0];
      selectedSizePrice = getSizeChoicePrice(
        selectedSizeChoice,
        product.price,
        sizeOption.choices
      );
      basePrice = selectedSizePrice;
      if (selectedSizeChoice.originalPrice && selectedSizeChoice.originalPrice > selectedSizePrice) {
        originalBasePrice = selectedSizeChoice.originalPrice;
      }
    } else if (sizeOption.choices.length > 0) {
      // If none selected yet, use designated featured size or size matching minimum price
      const featuredChoice = sizeOption.choices.find(c => c.id === product.featuredSizeId || c.isFeatured);
      const defaultChoice = featuredChoice || [...sizeOption.choices].sort((a, b) => {
        return getSizeChoicePrice(a, product.price, sizeOption.choices) - getSizeChoicePrice(b, product.price, sizeOption.choices);
      })[0];

      selectedSizePrice = getSizeChoicePrice(
        defaultChoice,
        product.price,
        sizeOption.choices
      );
      selectedSizeChoice = defaultChoice;
      basePrice = selectedSizePrice;
      if (defaultChoice.originalPrice && defaultChoice.originalPrice > selectedSizePrice) {
        originalBasePrice = defaultChoice.originalPrice;
      }
    }
  }

  // Calculate non-size addons
  Object.entries(selectedChoices).forEach(([optionId, choicesList]) => {
    // Skip the size option for addon calculations since size sets the base price
    if (sizeOption && optionId === sizeOption.id) {
      return;
    }

    choicesList.forEach(choice => {
      addonsTotal += Number(choice.price) || 0;
    });
  });

  basePrice = Math.round(basePrice * 100) / 100;
  addonsTotal = Math.round(addonsTotal * 100) / 100;
  const unitPrice = Math.round((basePrice + addonsTotal) * 100) / 100;
  const discountPercentage = originalBasePrice && originalBasePrice > basePrice
    ? Math.round(((originalBasePrice - basePrice) / originalBasePrice) * 100)
    : undefined;

  return {
    basePrice,
    originalBasePrice,
    discountPercentage,
    addonsTotal,
    unitPrice,
    selectedSizeChoice,
    selectedSizePrice,
    sizeOptionName,
    hasSizeOption
  };
}

/**
 * Summarizes product price range for catalogue display ("A partir de R$ XX,XX" or "R$ XX,XX").
 */
export function getProductDisplayPricing(product: Product): {
  minPrice: number;
  maxPrice: number;
  hasSizeVariation: boolean;
  displayPrice: string;
  sizesCount: number;
  hasDiscount: boolean;
  maxDiscountPercentage?: number;
  discountedSizeName?: string;
} {
  const options = product.options || [];
  const sizeOption = options.find(isSizeOption);

  // Check if any size has discount
  let hasDiscount = Boolean(product.originalPrice && product.originalPrice > product.price);
  let maxDiscountPercentage = hasDiscount && product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
    : undefined;
  let discountedSizeName: string | undefined = undefined;

  if (sizeOption && sizeOption.choices.length > 0) {
    sizeOption.choices.forEach(choice => {
      const choicePrice = getSizeChoicePrice(choice, product.price, sizeOption.choices);
      if (choice.originalPrice && choice.originalPrice > choicePrice) {
        const pct = Math.round(((choice.originalPrice - choicePrice) / choice.originalPrice) * 100);
        if (!maxDiscountPercentage || pct > maxDiscountPercentage) {
          maxDiscountPercentage = pct;
          hasDiscount = true;
          discountedSizeName = choice.name;
        }
      }
    });
  }

  if (!sizeOption || sizeOption.choices.length === 0) {
    return {
      minPrice: product.price,
      maxPrice: product.price,
      hasSizeVariation: false,
      displayPrice: `R$ ${product.price.toFixed(2)}`,
      sizesCount: 0,
      hasDiscount,
      maxDiscountPercentage,
      discountedSizeName
    };
  }

  const prices = sizeOption.choices.map(choice =>
    getSizeChoicePrice(choice, product.price, sizeOption.choices)
  );

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const hasSizeVariation = minPrice !== maxPrice && prices.length > 1;

  return {
    minPrice,
    maxPrice,
    hasSizeVariation,
    displayPrice: hasSizeVariation ? `A partir de R$ ${minPrice.toFixed(2)}` : `R$ ${minPrice.toFixed(2)}`,
    sizesCount: sizeOption.choices.length,
    hasDiscount,
    maxDiscountPercentage,
    discountedSizeName
  };
}
