import AppState from './state.js';
import { normalizeCountry, countryInfo } from './countries.js';

const SYMBOLS = { USD:'$', GHS:'GH₵' };
const ZERO_DECIMAL = new Set();

export function formatPrice(amount, currencyCode) {
  const code = currencyCode || 'USD';
  const symbol = SYMBOLS[code] ?? `${code} `;
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
  const n = Number(amount ?? 0);
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// Buyer's home country, set at signup — null if missing/unsupported.
export function getBuyerCountry() {
  return normalizeCountry(AppState.getUser()?.country);
}

// Handles either field name the backend may use for creator country.
export function templateCountry(t) {
  return normalizeCountry(t.creatorCountry ?? t.creator?.country ?? t.country ?? null);
}

// True if this template has a valid price to show in USD.
// GHS-priced templates need an explicit priceUSD; USD-priced ones already have it.
export function hasUsdPrice(t) {
  if (templateCountry(t) !== 'GH') return t.priceLocal != null;
  return t.priceUSD != null;
}

function _resolveUsdAmount(t) {
  if (templateCountry(t) !== 'GH') {
    return t.priceLocal != null ? Number(t.priceLocal) : null;
  }
  return t.priceUSD != null ? Number(t.priceUSD) : null;
}

// Home view: creator's own currency (GHS for Ghana creators, USD otherwise).
// Any other view: USD. Caller should pre-filter with hasUsdPrice().
export function getDisplayPrice(t, { viewingCountry, homeCountry, showLocalPricing } = {}) {
  const isHomeView = !!homeCountry && viewingCountry === homeCountry;
  const useLocal = showLocalPricing ?? isHomeView;

  if (useLocal && templateCountry(t) === 'GH') {
    if (t.priceLocal != null) {
      return { amount: Number(t.priceLocal), currency: 'GHS', noLocalPrice: false };
    }
  }

  const usdAmount = _resolveUsdAmount(t);
  return { amount: usdAmount ?? 0, currency: 'USD', noLocalPrice: useLocal };
}