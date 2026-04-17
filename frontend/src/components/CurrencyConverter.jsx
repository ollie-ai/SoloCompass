import { useState, useEffect } from 'react';
import { ArrowRightLeft, Loader2, RefreshCw } from 'lucide-react';
import api, { getExchangeRates } from '../lib/api';
import toast from 'react-hot-toast';

const COMMON_CURRENCIES = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
];

const CurrencyConverter = ({ defaultFrom = 'GBP', defaultTo = 'EUR', initialAmount = 100 }) => {
  const [amount, setAmount] = useState(initialAmount);
  const [fromCurrency, setFromCurrency] = useState(defaultFrom);
  const [toCurrency, setToCurrency] = useState(defaultTo);
  const [result, setResult] = useState(null);
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currencies, setCurrencies] = useState(COMMON_CURRENCIES);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  useEffect(() => {
    if (amount > 0) {
      convertCurrency();
    }
  }, [amount, fromCurrency, toCurrency]);

  const fetchCurrencies = async () => {
    try {
      const response = await api.get('/currency/list');
      if (response.data.success && response.data.data.currencies) {
        const currencyList = Object.entries(response.data.data.currencies).map(([code, name]) => ({
          code,
          name,
          symbol: code
        }));
        setCurrencies([...COMMON_CURRENCIES, ...currencyList.filter(c => !COMMON_CURRENCIES.find(cc => cc.code === c.code))]);
      }
    } catch (err) {
      console.error('Failed to fetch currencies:', err);
      // Use default currencies on error
    }
  };

  const convertCurrency = async () => {
    if (!amount || amount <= 0) return;
    
    setLoading(true);
    setError(null);

    try {
      // Try the dedicated currency conversion endpoint first
      const response = await api.post('/currency/convert', {
        amount: parseFloat(amount),
        from: fromCurrency,
        to: toCurrency
      });

      if (response.data.success) {
        setResult(response.data.data.converted);
        setRate(response.data.data.rate);
      }
    } catch (primaryErr) {
      // Fallback to /exchange/rates endpoint
      try {
        const ratesResponse = await getExchangeRates(fromCurrency, toCurrency);
        if (ratesResponse.success && ratesResponse.data?.rates?.[toCurrency]) {
          const exchangeRate = ratesResponse.data.rates[toCurrency];
          setRate(exchangeRate);
          setResult(parseFloat(amount) * exchangeRate);
        } else {
          throw new Error('No rate data available');
        }
      } catch (fallbackErr) {
        console.error('Currency conversion error:', fallbackErr);
        toast.error('Currency conversion failed. Please try again.');
        setError(primaryErr.response?.data?.message || 'Conversion failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const getCurrencySymbol = (code) => {
    const currency = (currencies || []).find(c => c.code === code);
    return currency?.symbol || code;
  };

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center gap-2 text-brand-vibrant font-black uppercase text-[10px] tracking-[0.2em] mb-4">
        <ArrowRightLeft size={14} /> Currency Converter
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 font-bold">
            {getCurrencySymbol(fromCurrency)}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Currency Selectors */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">
            From
          </label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content bg-base-100"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={swapCurrencies}
          className="mt-6 p-2 rounded-full bg-brand-vibrant/10 hover:bg-brand-vibrant/20 transition-colors"
        >
          <ArrowRightLeft size={20} className="text-brand-vibrant" />
        </button>

        <div className="flex-1">
          <label className="block text-xs font-bold text-base-content/40 uppercase tracking-wider mb-2">
            To
          </label>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-base-300 focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20 outline-none font-bold text-base-content bg-base-100"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="text-brand-vibrant animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      ) : result !== null ? (
        <div className="bg-brand-vibrant/5 rounded-xl p-4 border border-brand-vibrant/10">
          <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-1">Converted Amount</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-base-content">
              {getCurrencySymbol(toCurrency)}{result.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-base-content/60 mt-2">
            1 {fromCurrency} = {rate?.toFixed(4)} {toCurrency}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default CurrencyConverter;
