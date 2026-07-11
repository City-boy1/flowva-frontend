// Master list of Flowva-supported countries for the marketplace country filter.
// Keep `value` slugs in sync with backend `user.country` / `template.creatorCountry`.

export const COUNTRY_GROUPS = [
  { label: '🌍 Africa', countries: [
    { value:'algeria',      label:'Algeria',      flag:'🇩🇿', currency:'DZD' },
    { value:'egypt',        label:'Egypt',        flag:'🇪🇬', currency:'EGP' },
    { value:'ethiopia',     label:'Ethiopia',     flag:'🇪🇹', currency:'ETB' },
    { value:'ghana',        label:'Ghana',        flag:'🇬🇭', currency:'GHS' },
    { value:'kenya',        label:'Kenya',        flag:'🇰🇪', currency:'KES' },
    { value:'lesotho',      label:'Lesotho',      flag:'🇱🇸', currency:'LSL' },
    { value:'madagascar',   label:'Madagascar',   flag:'🇲🇬', currency:'MGA' },
    { value:'malawi',       label:'Malawi',       flag:'🇲🇼', currency:'MWK' },
    { value:'mauritius',    label:'Mauritius',    flag:'🇲🇺', currency:'MUR' },
    { value:'morocco',      label:'Morocco',      flag:'🇲🇦', currency:'MAD' },
    { value:'mozambique',   label:'Mozambique',   flag:'🇲🇿', currency:'MZN' },
    { value:'nigeria',      label:'Nigeria',      flag:'🇳🇬', currency:'NGN' },
    { value:'senegal',      label:'Senegal',      flag:'🇸🇳', currency:'XOF' },
    { value:'south_africa', label:'South Africa', flag:'🇿🇦', currency:'ZAR' },
    { value:'tanzania',     label:'Tanzania',     flag:'🇹🇿', currency:'TZS' },
    { value:'uganda',       label:'Uganda',       flag:'🇺🇬', currency:'UGX' },
    { value:'zambia',       label:'Zambia',       flag:'🇿🇲', currency:'ZMW' },
    { value:'zimbabwe',     label:'Zimbabwe',     flag:'🇿🇼', currency:'ZWL' },
  ]},
  { label: '🌎 Americas', countries: [
    { value:'united_states', label:'United States', flag:'🇺🇸', currency:'USD' },
    { value:'canada',        label:'Canada',         flag:'🇨🇦', currency:'CAD' },
    { value:'brazil',        label:'Brazil',         flag:'🇧🇷', currency:'BRL' },
    { value:'mexico',        label:'Mexico',         flag:'🇲🇽', currency:'MXN' },
    { value:'argentina',     label:'Argentina',      flag:'🇦🇷', currency:'ARS' },
    { value:'chile',         label:'Chile',          flag:'🇨🇱', currency:'CLP' },
    { value:'peru',          label:'Peru',           flag:'🇵🇪', currency:'PEN' },
  ]},
  { label: '🌍 Europe', countries: [
    { value:'austria',        label:'Austria',        flag:'🇦🇹', currency:'EUR' },
    { value:'belgium',        label:'Belgium',        flag:'🇧🇪', currency:'EUR' },
    { value:'france',         label:'France',         flag:'🇫🇷', currency:'EUR' },
    { value:'germany',        label:'Germany',        flag:'🇩🇪', currency:'EUR' },
    { value:'italy',          label:'Italy',          flag:'🇮🇹', currency:'EUR' },
    { value:'netherlands',    label:'Netherlands',    flag:'🇳🇱', currency:'EUR' },
    { value:'norway',         label:'Norway',         flag:'🇳🇴', currency:'NOK' },
    { value:'poland',         label:'Poland',         flag:'🇵🇱', currency:'PLN' },
    { value:'spain',          label:'Spain',          flag:'🇪🇸', currency:'EUR' },
    { value:'sweden',         label:'Sweden',         flag:'🇸🇪', currency:'SEK' },
    { value:'switzerland',    label:'Switzerland',    flag:'🇨🇭', currency:'CHF' },
    { value:'united_kingdom', label:'United Kingdom', flag:'🇬🇧', currency:'GBP' },
  ]},
  { label: '🌏 Asia-Pacific', countries: [
    { value:'australia',   label:'Australia',   flag:'🇦🇺', currency:'AUD' },
    { value:'china',       label:'China',       flag:'🇨🇳', currency:'CNY' },
    { value:'india',       label:'India',       flag:'🇮🇳', currency:'INR' },
    { value:'malaysia',    label:'Malaysia',    flag:'🇲🇾', currency:'MYR' },
    { value:'new_zealand', label:'New Zealand', flag:'🇳🇿', currency:'NZD' },
    { value:'singapore',   label:'Singapore',   flag:'🇸🇬', currency:'SGD' },
    { value:'thailand',    label:'Thailand',    flag:'🇹🇭', currency:'THB' },
    { value:'vietnam',     label:'Vietnam',     flag:'🇻🇳', currency:'VND' },
  ]},
  { label: '🌍 Middle East', countries: [
    { value:'israel',       label:'Israel',              flag:'🇮🇱', currency:'ILS' },
    { value:'kuwait',       label:'Kuwait',              flag:'🇰🇼', currency:'KWD' },
    { value:'qatar',        label:'Qatar',               flag:'🇶🇦', currency:'QAR' },
    { value:'saudi_arabia', label:'Saudi Arabia',        flag:'🇸🇦', currency:'SAR' },
    { value:'turkey',       label:'Turkey',              flag:'🇹🇷', currency:'TRY' },
    { value:'uae',          label:'United Arab Emirates',flag:'🇦🇪', currency:'AED' },
  ]},
];

export const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap(g => g.countries);

const ALIASES = {
  uk:'united_kingdom', usa:'united_states',
  united_arab_emirates:'uae',

  // ISO-2 codes from the signup/profile country <select> — this is what
  // user.country actually stores, so these mappings are required for
  // normalizeCountry() to resolve a creator's/buyer's real country at all.
  dz:'algeria', eg:'egypt', et:'ethiopia', gh:'ghana', ke:'kenya', ls:'lesotho',
  mg:'madagascar', mw:'malawi', mu:'mauritius', ma:'morocco', mz:'mozambique',
  ng:'nigeria', sn:'senegal', za:'south_africa', tz:'tanzania', ug:'uganda',
  zm:'zambia', zw:'zimbabwe',

  ar:'argentina', br:'brazil', ca:'canada', cl:'chile', mx:'mexico', pe:'peru',
  us:'united_states',

  at:'austria', be:'belgium', fr:'france', de:'germany', it:'italy',
  nl:'netherlands', no:'norway', pl:'poland', es:'spain', se:'sweden',
  ch:'switzerland', gb:'united_kingdom',

  au:'australia', cn:'china', in:'india', my:'malaysia', nz:'new_zealand',
  sg:'singapore', th:'thailand', vn:'vietnam',

  il:'israel', kw:'kuwait', qa:'qatar', sa:'saudi_arabia', tr:'turkey', ae:'uae',
};

// Normalizes any raw country string (signup value, creator record, etc.)
// into one of the slugs above, or null if it isn't supported yet.
export function normalizeCountry(raw) {
  if (!raw) return null;
  const slug = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ALL_COUNTRIES.some(c => c.value === slug)) return slug;
  if (ALIASES[slug]) return ALIASES[slug];
  const byLabel = ALL_COUNTRIES.find(c => c.label.toLowerCase() === String(raw).trim().toLowerCase());
  return byLabel ? byLabel.value : null;
}

export function countryInfo(value) {
  return ALL_COUNTRIES.find(c => c.value === value) ?? null;
}