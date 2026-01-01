/**
 * Tax Calculation Service
 * 
 * Handles state-specific sales tax and excise tax calculations for orders.
 * Currently uses environment variables for rates, but can be extended to
 * use a database or external tax service.
 */

export interface TaxCalculationInput {
  subtotal: number;
  shippingState: string;
  items: Array<{
    netWeightGrams: number;
    quantity: number;
  }>;
}

export interface TaxCalculationResult {
  salesTaxAmount: number;
  exciseTaxAmount: number;
  totalTaxAmount: number;
  salesTaxRate: number;
  exciseTaxPerGram: number;
}

/**
 * Get sales tax rate for a state
 * 
 * Currently uses a single rate from environment variable.
 * Can be extended to lookup state-specific rates from database or config.
 */
function getSalesTaxRate(state: string): number {
  // Default to environment variable
  const defaultRate = Number(process.env.SALES_TAX_RATE || '0');
  
  // TODO: Implement state-specific tax rate lookup
  // This could query a database table or config service
  // For now, return the default rate
  return defaultRate;
}

/**
 * Get excise tax rate per gram
 * 
 * Currently uses environment variable.
 * Can be extended to lookup state-specific excise tax rates.
 */
function getExciseTaxPerGram(state: string): number {
  // Default to environment variable
  const defaultRate = Number(process.env.EXCISE_TAX_PER_GRAM || '0');
  
  // TODO: Implement state-specific excise tax rate lookup
  // This could query a database table or config service
  // For now, return the default rate
  return defaultRate;
}

/**
 * Calculate taxes for an order
 * 
 * @param input - Order details for tax calculation
 * @returns Tax calculation result with all tax amounts
 */
export function calculateTaxes(input: TaxCalculationInput): TaxCalculationResult {
  const salesTaxRate = getSalesTaxRate(input.shippingState);
  const exciseTaxPerGram = getExciseTaxPerGram(input.shippingState);
  
  // Calculate sales tax on subtotal
  const salesTaxAmount = input.subtotal * salesTaxRate;
  
  // Calculate excise tax based on total weight
  const totalWeightGrams = input.items.reduce(
    (sum, item) => sum + (item.netWeightGrams * item.quantity),
    0
  );
  const exciseTaxAmount = totalWeightGrams * exciseTaxPerGram;
  
  const totalTaxAmount = salesTaxAmount + exciseTaxAmount;
  
  return {
    salesTaxAmount: Math.round(salesTaxAmount * 100) / 100, // Round to 2 decimals
    exciseTaxAmount: Math.round(exciseTaxAmount * 100) / 100,
    totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
    salesTaxRate,
    exciseTaxPerGram,
  };
}

