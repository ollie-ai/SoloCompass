const defaultLocale = 'en';
let currentLocale = defaultLocale;
const translations = {};

translations.en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    loading: 'Loading...',
    error: 'Something went wrong',
    success: 'Success',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    close: 'Close',
    search: 'Search',
    noResults: 'No results found',
  },
  nav: {
    dashboard: 'Dashboard',
    trips: 'Trips',
    destinations: 'Destinations',
    safety: 'Safety',
    buddies: 'Buddies',
    messages: 'Messages',
    settings: 'Settings',
    notifications: 'Notifications',
  },
  settings: {
    profile: 'Profile',
    security: 'Security',
    notifications: 'Notifications',
    privacy: 'Privacy',
    billing: 'Billing',
    language: 'Language',
    units: 'Units',
    accessibility: 'Accessibility',
    connectedAccounts: 'Connected Accounts',
  },
  billing: {
    currentPlan: 'Current Plan',
    upgrade: 'Upgrade',
    downgrade: 'Downgrade',
    cancel: 'Cancel Subscription',
    freeTrial: 'Start Free Trial',
    trialDays: '7-day free trial',
    usage: 'Usage',
  },
  notifications: {
    markAllRead: 'Mark All Read',
    noNotifications: 'No notifications',
    preferences: 'Notification Preferences',
  },
};

export function setLocale(locale) {
  currentLocale = locale;
}

export function getLocale() {
  return currentLocale;
}

export function t(key, vars = {}) {
  const keys = key.split('.');
  let value = translations[currentLocale] || translations[defaultLocale];

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value !== 'string') {
    // Fallback to English
    value = translations[defaultLocale];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = key;
        break;
      }
    }
  }

  if (typeof value === 'string' && Object.keys(vars).length > 0) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  return typeof value === 'string' ? value : key;
}

export async function loadLocale(locale) {
  if (translations[locale]) {
    setLocale(locale);
    return true;
  }

  try {
    const module = await import(`./locales/${locale}.js`);
    translations[locale] = module.default;
    setLocale(locale);
    return true;
  } catch {
    console.warn(`[i18n] Locale ${locale} not found, using ${defaultLocale}`);
    return false;
  }
}

export default { t, setLocale, getLocale, loadLocale };
