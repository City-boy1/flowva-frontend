// Master list of Flowva-supported countries for the marketplace country filter.
// Keep `value` slugs in sync with backend `user.country` / `template.creatorCountry`.

export const COUNTRY_GROUPS = [
  { label: '🌍 Africa', countries: [
    { value:'angola',       label:'Angola',       flag:'🇦🇴', currency:'AOA' },
    { value:'benin',        label:'Benin',        flag:'🇧🇯', currency:'XOF' },
    { value:'botswana',     label:'Botswana',     flag:'🇧🇼', currency:'BWP' },
    { value:'burundi',      label:'Burundi',      flag:'🇧🇮', currency:'BIF' },
    { value:'cameroon',     label:'Cameroon',     flag:'🇨🇲', currency:'XAF' },
    { value:'egypt',        label:'Egypt',        flag:'🇪🇬', currency:'EGP' },
    { value:'gabon',        label:'Gabon',        flag:'🇬🇦', currency:'XAF' },
    { value:'ghana',        label:'Ghana',        flag:'🇬🇭', currency:'GHS' },
    { value:'ivory_coast',  label:'Ivory Coast',  flag:'🇨🇮', currency:'XOF' },
    { value:'kenya',        label:'Kenya',        flag:'🇰🇪', currency:'KES' },
    { value:'mali',         label:'Mali',         flag:'🇲🇱', currency:'XOF' },
    { value:'mozambique',   label:'Mozambique',   flag:'🇲🇿', currency:'MZN' },
    { value:'namibia',      label:'Namibia',      flag:'🇳🇦', currency:'NAD' },
    { value:'niger',        label:'Niger',        flag:'🇳🇪', currency:'XOF' },
    { value:'nigeria',      label:'Nigeria',      flag:'🇳🇬', currency:'NGN' },
    { value:'rwanda',       label:'Rwanda',       flag:'🇷🇼', currency:'RWF' },
    { value:'senegal',      label:'Senegal',      flag:'🇸🇳', currency:'XOF' },
    { value:'south_africa', label:'South Africa', flag:'🇿🇦', currency:'ZAR' },
    { value:'tanzania',     label:'Tanzania',     flag:'🇹🇿', currency:'TZS' },
    { value:'togo',         label:'Togo',         flag:'🇹🇬', currency:'XOF' },
    { value:'uganda',       label:'Uganda',       flag:'🇺🇬', currency:'UGX' },
    { value:'zambia',       label:'Zambia',       flag:'🇿🇲', currency:'ZMW' },
  ]},
  { label: '🌎 Americas', countries: [
    { value:'united_states', label:'United States', flag:'🇺🇸', currency:'USD' },
    { value:'canada',        label:'Canada',         flag:'🇨🇦', currency:'CAD' },
    { value:'mexico',        label:'Mexico',         flag:'🇲🇽', currency:'MXN' },
  ]},
  { label: '🌍 Europe', countries: [
    { value:'france',         label:'France',         flag:'🇫🇷', currency:'EUR' },
    { value:'germany',        label:'Germany',        flag:'🇩🇪', currency:'EUR' },
    { value:'united_kingdom', label:'United Kingdom', flag:'🇬🇧', currency:'GBP' },
  ]},
  { label: '🌏 Asia-Pacific', countries: [
    { value:'china',       label:'China',       flag:'🇨🇳', currency:'CNY' },
    { value:'india',       label:'India',       flag:'🇮🇳', currency:'INR' },
    { value:'malaysia',    label:'Malaysia',    flag:'🇲🇾', currency:'MYR' },
    { value:'philippines', label:'Philippines', flag:'🇵🇭', currency:'PHP' },
    { value:'thailand',    label:'Thailand',    flag:'🇹🇭', currency:'THB' },
  ]},
  { label: '🌍 Middle East', countries: [
    { value:'qatar', label:'Qatar',                flag:'🇶🇦', currency:'QAR' },
    { value:'turkey', label:'Turkey',              flag:'🇹🇷', currency:'TRY' },
    { value:'uae',   label:'United Arab Emirates', flag:'🇦🇪', currency:'AED' },
  ]},
];

export const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap(g => g.countries);

const ALIASES = {
  uk:'united_kingdom', usa:'united_states',
  united_arab_emirates:'uae', cote_divoire:'ivory_coast', ci:'ivory_coast',

  // ISO-2 codes, as stored in user.country
  ao:'angola', bj:'benin', bw:'botswana', bi:'burundi', cm:'cameroon',
  eg:'egypt', ga:'gabon', gh:'ghana', ke:'kenya', ml:'mali', mz:'mozambique',
  na:'namibia', ne:'niger', ng:'nigeria', rw:'rwanda', sn:'senegal',
  za:'south_africa', tz:'tanzania', tg:'togo', ug:'uganda', zm:'zambia',

  ca:'canada', mx:'mexico', us:'united_states',

  fr:'france', de:'germany', gb:'united_kingdom',

  cn:'china', in:'india', my:'malaysia', ph:'philippines', th:'thailand',

  qa:'qatar', tr:'turkey', ae:'uae',
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