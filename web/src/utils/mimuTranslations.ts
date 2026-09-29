/**
 * MIMU Place Code & Burmese Name Reference for Myanmar Educational Institutions
 */

export interface MimuLocation {
  srPcode: string;
  srNameEn: string;
  srNameMy: string;
  tsPcode?: string;
  tsNameEn?: string;
  tsNameMy?: string;
}

// State / Region Myanmar translations
export const REGION_MYANMAR_NAMES: Record<string, string> = {
  'Yangon Region': 'ရန်ကုန်တိုင်းဒေသကြီး',
  'Mandalay Region': 'မန္တလေးတိုင်းဒေသကြီး',
  'Bago Region': 'ပဲခူးတိုင်းဒေသကြီး',
  'Ayeyarwady Region': 'ဧရာဝတီတိုင်းဒေသကြီး',
  'Magway Region': 'မကွေးတိုင်းဒေသကြီး',
  'Sagaing Region': 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  'Tanintharyi Region': 'တနင်္သာရီတိုင်းဒေသကြီး',
  'Naypyitaw': 'နေပြည်တော်',
  'Nay Pyi Taw': 'နေပြည်တော်',
  'Shan State': 'ရှမ်းပြည်နယ်',
  'Mon State': 'မွန်ပြည်နယ်',
  'Kayin State': 'ကရင်ပြည်နယ်',
  'Kachin State': 'ကချင်ပြည်နယ်',
  'Kayah State': 'ကယားပြည်နယ်',
  'Chin State': 'ချင်းပြည်နယ်',
  'Rakhine State': 'ရခိုင်ပြည်နယ်',
};

// Common Township Myanmar translations
export const TOWNSHIP_MYANMAR_NAMES: Record<string, string> = {
  'Hlegu': 'လှည်းကူးမြို့နယ်',
  'Hlegu Township': 'လှည်းကူးမြို့နယ်',
  'Dagon': 'ဒဂုံမြို့နယ်',
  'Insein': 'အင်းစိန်မြို့နယ်',
  'Kamayut': 'ကမာရွတ်မြို့နယ်',
  'Kyauktada': 'ကျောက်တံတားမြို့နယ်',
  'Mingaladon': 'မင်္ဂလာဒုံမြို့နယ်',
  'Hlaing': 'လှိုင်မြို့နယ်',
  'Mayangone': 'မရမ်းကုန်းမြို့နယ်',
  'South Okkalapa': 'တောင်ဥက္ကလာပမြို့နယ်',
  'North Okkalapa': 'မြောက်ဥက္ကလာပမြို့နယ်',
  'Bahan': 'ဗဟန်းမြို့နယ်',
  'Botataung': 'ဗိုလ်တထောင်မြို့နယ်',
  'Pabedan': 'ပန်းဘဲတန်းမြို့နယ်',
  'Lanmadaw': 'လမ်းမတော်မြို့နယ်',
  'Latha': 'လသာမြို့နယ်',
  'Sanchaung': 'စမ်းချောင်းမြို့နယ်',
  'Thaketa': 'သာကေတမြို့နယ်',
  'Thingangyun': 'သင်္ဃန်းကျွန်းမြို့နယ်',
  'Tamwe': 'တာမွေမြို့နယ်',
  'Yankin': 'ရန်ကင်းမြို့နယ်',
  'Taunggyi': 'တောင်ကြီးမြို့နယ်',
  'Mandalay': 'မန္တလေးမြို့',
  'Chanayethazan': 'ချမ်းအေးသာစံမြို့နယ်',
  'Mahaaungmyay': 'မဟာအောင်မြေမြို့နယ်',
  'Pyinoolwin': 'ပြင်ဦးလွင်မြို့နယ်',
};

// School Myanmar abbreviation and names
export const SCHOOL_MYANMAR_NAMES: Record<string, string> = {
  'BEHS Intaing': 'အထက အင်းတိုင်',
  'BEHS Intaing (အင်းတိုင် အထက)': 'အထက အင်းတိုင်',
  'Basic Education High School Intaing': 'အထက အင်းတိုင်',
  'BEHS No. 1 Hlegu': 'အထက (၁) လှည်းကူး',
  'BEHS No. 2 Hlegu': 'အထက (၂) လှည်းကူး',
  'BEPS No. 11 Hlegu': 'အမက (၁၁) လှည်းကူး',
  'National Education Registry': 'ပညာရေးဝန်ကြီးဌာန ဗဟိုမှတ်ပုံတင်ဌာန',
};

/**
 * Returns the localized Burmese text for a given Region name
 */
export function getRegionBurmese(enName?: string): string {
  if (!enName) return 'ရန်ကုန်တိုင်းဒေသကြီး';
  return REGION_MYANMAR_NAMES[enName] || enName;
}

/**
 * Returns the localized Burmese text for a given Township name
 */
export function getTownshipBurmese(enName?: string): string {
  if (!enName) return 'လှည်းကူးမြို့နယ်';
  return TOWNSHIP_MYANMAR_NAMES[enName] || (enName.endsWith('Township') ? enName.replace('Township', 'မြို့နယ်') : `${enName}မြို့နယ်`);
}

/**
 * Returns formatted location line: e.g. "လှည်းကူးမြို့နယ်၊ ရန်ကုန်တိုင်းဒေသကြီး"
 */
export function formatBurmeseLocation(township?: string, region?: string): string {
  const ts = getTownshipBurmese(township);
  const rg = getRegionBurmese(region);
  return `${ts}၊ ${rg}`;
}

/**
 * Returns clean Burmese school name
 */
export function getSchoolBurmese(schoolName?: string, fallbackMy?: string): string {
  if (fallbackMy && fallbackMy.trim()) return fallbackMy;
  if (!schoolName) return 'အထက အင်းတိုင်';
  return SCHOOL_MYANMAR_NAMES[schoolName] || schoolName;
}
