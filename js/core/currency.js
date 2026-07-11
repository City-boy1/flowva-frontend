import AppState from './state.js';
import { normalizeCountry, countryInfo } from './countries.js';

const SYMBOLS = {
  USD:'$', GHS:'GH₵', NGN:'₦', KES:'KSh', ZAR:'R', GBP:'£', EUR:'€',
  CAD:'CA$', BRL:'R$', MXN:'MX$', ARS:'AR$', CLP:'CL$', PEN:'S/',
  NOK:'kr', PLN:'zł', SEK:'kr', CHF:'CHF', AUD:'A$', CNY:'¥', INR:'₹',
  MYR:'RM', NZD:'NZ$', SGD:'S$', THB:'฿', VND:'₫', ILS:'₪', KWD:'KD',
  QAR:'QR', SAR:'SR', TRY:'₺', AED:'AED ', DZD:'DA', EGP:'E£', ETB:'Br',
  LSL:'L', MGA:'Ar', MWK:'MK', MUR:'₨', MAD:'DH', MZN:'MT', XOF:'CFA',
  TZS:'TSh', UGX:'USh', ZMW:'ZK', ZWL:'Z$',
};
const ZERO_DECIMAL = new Set(['NGN','KES','ZAR','VND','UGX','TZS','XOF','MGA']);

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

// Tolerant of whatever field name the backend ends up using for creator country.
export function templateCountry(t) {
  return normalizeCountry(t.creatorCountry ?? t.creator?.country ?? t.country ?? null);
}

// A template "has" a usable USD price when either:
//  - the creator's own currency IS USD (their required price field
//    already IS the USD price, no separate field needed), or
//  - the creator explicitly set the optional priceUSD add-on.
// Used to hide a template entirely from foreign/USD-fallback views
// when neither is true — a missing USD price means "not listed there",
// not "show it for free" or "show the wrong number".
export function hasUsdPrice(t) {
  const creatorCurrency = t.currency || 'USD';
  if (creatorCurrency === 'USD') return t.priceLocal != null || t.price != null;
  return t.priceUSD != null;
}

function _resolveUsdAmount(t) {
  const creatorCurrency = t.currency || 'USD';
  if (creatorCurrency === 'USD') {
    const v = t.priceLocal ?? t.price;
    return v != null ? Number(v) : null;
  }
  return t.priceUSD != null ? Number(t.priceUSD) : null;
}

// Core pricing rule, matching Flowva's pricing policy:
//  - Local pricing (showLocalPricing: true) — used only when browsing
//    your own country's real creator pool: show the creator's required
//    price in their currency (== yours, since the pool is already
//    filtered to your country).
//  - Everywhere else (foreign country browsing, or the USD fallback
//    catalog when your home country has no creators yet): always USD.
//    Callers are expected to have already filtered out templates that
//    fail hasUsdPrice() before reaching this function — it still
//    degrades to amount: 0 defensively if that filtering was skipped.
export function getDisplayPrice(t, { viewingCountry, homeCountry, showLocalPricing } = {}) {
  const isHomeView = !!homeCountry && viewingCountry === homeCountry;
  const useLocal = showLocalPricing ?? isHomeView;

  if (useLocal) {
    const creatorCurrency = t.currency || 'USD';
    const localAmount = t.priceLocal ?? t.price;
    if (localAmount != null) {
      return { amount: Number(localAmount), currency: creatorCurrency, noLocalPrice: false };
    }
  }

  const usdAmount = _resolveUsdAmount(t);
  return { amount: usdAmount ?? 0, currency: 'USD', noLocalPrice: useLocal };
}