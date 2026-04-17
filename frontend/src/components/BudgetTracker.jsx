import { useState, useEffect } from 'react';
import { Wallet, Plus, Loader2, Trash2, Edit2, X, TrendingUp, TrendingDown, Download } from 'lucide-react';
import api, { exportBudgetCSV } from '../lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/utils';
import BudgetAlertBanner from './trip/BudgetAlertBanner';
import DailySpendCard from './trip/DailySpendCard';

const CATEGORIES = [
  { key: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { key: 'transport', label: 'Transport', icon: '✈️' },
  { key: 'food', label: 'Food & Dining', icon: '🍽️' },
  { key: 'activities', label: 'Activities', icon: '🎯' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'health', label: 'Health', icon: '💊' },
  { key: 'communication', label: 'Communication', icon: '📱' },
  { key: 'other', label: 'Other', icon: '📦' }
];

const STATIC_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'THB', 'KRW', 'SGD', 'NZD', 'ZAR'];

const BudgetTracker = ({ tripId, tripName, onClose }) => {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currencies, setCurrencies] = useState(STATIC_CURRENCIES);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [newItem, setNewItem] = useState({
    category: 'other',
    description: '',
    amount: '',
    currency: 'USD',
    type: 'expense'
  });
  const [budgetSettings, setBudgetSettings] = useState({
    totalBudget: '',
    currency: 'GBP'
  });

  useEffect(() => {
    fetchBudget();
    fetchCurrencies();
  }, [tripId]);

  const fetchCurrencies = async () => {
    try {
      setCurrenciesLoading(true);
      const response = await api.get('/currency/list');
      if (response.data?.data?.currencies) {
        const currencyList = Object.entries(response.data.data.currencies).map(([code, name]) => code);
        setCurrencies([...new Set([...STATIC_CURRENCIES, ...currencyList])]);
      } else if (Array.isArray(response.data?.data)) {
        setCurrencies(response.data.data);
      } else if (Array.isArray(response.data)) {
        setCurrencies(response.data);
      }
    } catch (err) {
      console.error('Error fetching currencies:', err);
    } finally {
      setCurrenciesLoading(false);
    }
  };

  const fetchBudget = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/budget/${tripId}`);
      setBudget(response.data.data);
      if (response.data.data) {
        setBudgetSettings({
          totalBudget: response.data.data.totalBudget.toString(),
          currency: response.data.data.currency
        });
        setNewItem(prev => ({ ...prev, currency: response.data.data.currency }));
      }
    } catch (error) {
      console.error('Error fetching budget:', error);
      toast.error('Failed to load budget details');
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const response = await api.post(`/budget/${tripId}`, {
        totalBudget: parseFloat(budgetSettings.totalBudget),
        currency: budgetSettings.currency
      });
      setBudget(response.data.data);
      setShowSettings(false);
      toast.success('Budget created!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create budget'));
    } finally {
      setCreating(false);
    }
  };

  const updateBudget = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const response = await api.post(`/budget/${tripId}`, {
        totalBudget: parseFloat(budgetSettings.totalBudget),
        currency: budgetSettings.currency
      });
      setBudget(response.data.data);
      setShowSettings(false);
      toast.success('Budget updated!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update budget'));
    } finally {
      setCreating(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.amount || parseFloat(newItem.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const response = await api.post(`/budget/${tripId}/items`, {
        category: newItem.category,
        description: newItem.description,
        amount: parseFloat(newItem.amount),
        currency: newItem.currency,
        type: newItem.type
      });
      setBudget(prev => ({
        ...prev,
        items: [response.data.data, ...(prev.items || [])],
        totalSpent: newItem.type === 'expense' 
          ? prev.totalSpent + response.data.data.amount 
          : prev.totalSpent,
        totalIncome: newItem.type === 'income'
          ? prev.totalIncome + response.data.data.amount
          : prev.totalIncome,
        remaining: newItem.type === 'expense'
          ? prev.remaining - response.data.data.amount
          : prev.remaining + response.data.data.amount
      }));
      setNewItem({
        category: budget?.currency || 'USD',
        description: '',
        amount: '',
        currency: budget?.currency || 'USD',
        type: 'expense'
      });
      setShowAddExpense(false);
      toast.success(newItem.type === 'expense' ? 'Expense added!' : 'Income added!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add item'));
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await api.delete(`/budget/${tripId}/items/${itemId}`);
      setBudget(prev => ({
        ...prev,
        items: (prev.items || []).filter(i => i.id !== itemId)
      }));
      toast.success('Item removed');
      fetchBudget();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportBudgetCSV(tripId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(tripName || 'trip').replace(/\s+/g, '_')}_budget.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to export budget');
    }
  };

  const getCategoryInfo = (categoryKey) => {
    return CATEGORIES.find(c => c.key === categoryKey) || { key: categoryKey, label: categoryKey, icon: '📦' };
  };

  const formatCurrency = (amount, currency = 'GBP') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDualAmount = (item) => {
    const converted = formatCurrency(item.amount, budget?.currency || 'GBP');
    if (!item.originalAmount || !item.originalCurrency || item.originalCurrency === budget?.currency) {
      return converted;
    }
    const original = formatCurrency(item.originalAmount, item.originalCurrency);
    return `${original} (${converted})`;
  };

  const getProgressColor = () => {
    if (!budget) return 'bg-brand-vibrant';
    const percent = (budget.totalSpent / budget.totalBudget) * 100;
    if (percent > 90) return 'bg-error/100';
    if (percent > 75) return 'bg-warning/100';
    return 'bg-brand-vibrant';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-brand-vibrant" size={32} />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="bg-base-100 rounded-2xl p-8 max-w-lg mx-auto shadow-xl border border-base-200">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-vibrant/20 to-brand-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Wallet className="text-brand-vibrant" size={36} />
          </div>
          <h2 className="text-2xl font-black text-base-content mb-2">Budget Tracker</h2>
          <p className="text-base-content/60 font-medium">Set a budget to track your spending for {tripName}</p>
        </div>

        <form onSubmit={createBudget} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-base-content/70 mb-2">Total Budget</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={budgetSettings.totalBudget}
                onChange={e => setBudgetSettings(prev => ({ ...prev, totalBudget: e.target.value }))}
                placeholder="Enter amount"
                className="flex-1 px-4 py-3.5 border-2 border-base-200 bg-base-100 rounded-xl focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none font-bold text-base-content"
                required
              />
              <select
                value={budgetSettings.currency}
                onChange={e => setBudgetSettings(prev => ({ ...prev, currency: e.target.value }))}
                className="px-4 py-3.5 border-2 border-base-200 bg-base-100 rounded-xl focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none font-bold text-base-content"
              >
                {currencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full py-4 bg-gradient-to-r from-brand-vibrant to-brand-accent text-white rounded-xl font-bold hover:shadow-xl hover:shadow-brand-vibrant/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 className="animate-spin" size={20} /> : <Wallet size={20} />}
            Create Budget
          </button>
        </form>
      </div>
    );
  }

  const spentPercent = Math.min((budget.totalSpent / budget.totalBudget) * 100, 100);

  return (
    <div className="bg-base-100 rounded-2xl p-8 max-w-lg mx-auto shadow-xl border border-base-200 max-h-[80vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-base-content">Budget Tracker</h2>
          <p className="text-sm text-base-content/60">{tripName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            title="Export CSV"
            className="p-2 text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-xl transition-colors"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-xl transition-colors"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand-deep to-slate-800 rounded-2xl p-6 text-white mb-6 shadow-xl shadow-brand-deep/20">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-sm text-base-content/30 mb-1 font-bold">Total Budget</p>
            <p className="text-3xl font-black">{formatCurrency(budget.totalBudget, budget.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-base-content/30 mb-1 font-bold">Remaining</p>
            <p className={`text-2xl font-black ${budget.remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {formatCurrency(budget.remaining, budget.currency)}
            </p>
          </div>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 rounded-full ${getProgressColor()}`}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-base-content/30 font-bold">Spent: {formatCurrency(budget.totalSpent, budget.currency)}</span>
          <span className="text-base-content/30 font-black">{spentPercent.toFixed(0)}%</span>
        </div>
      </div>

      {budget.totalIncome > 0 && (
        <div className="flex items-center gap-3 mb-4 p-4 bg-success/10 rounded-xl border border-success/20">
          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
            <TrendingUp className="text-emerald-500" size={20} />
          </div>
          <span className="text-sm font-bold text-success">
            +{formatCurrency(budget.totalIncome, budget.currency)} income
          </span>
        </div>
      )}

      {/* Budget Alert Banner */}
      <div className="mb-4">
        <BudgetAlertBanner
          totalBudget={budget.totalBudget}
          totalSpent={budget.totalSpent}
          currency={budget.currency}
        />
      </div>

      {/* Daily Spend Card */}
      {(budget.dailyAverage !== null || budget.dailyTarget !== null) && (
        <div className="mb-4">
          <DailySpendCard
            dailyAverage={budget.dailyAverage}
            dailyTarget={budget.dailyTarget}
            currency={budget.currency}
            daysElapsed={budget.daysElapsed}
            tripDays={budget.tripDays}
          />
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-black text-base-content/70 mb-3 uppercase tracking-wider">Spending by Category</h3>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => {
            const catItems = budget.items?.filter(i => i.category === cat.key && i.type === 'expense') || [];
            const catTotal = catItems.reduce((sum, i) => sum + i.amount, 0);
            const catPercent = budget.totalSpent > 0 ? (catTotal / budget.totalSpent) * 100 : 0;
            
            return (
              <div key={cat.key} className="p-3 bg-base-200 rounded-xl border border-base-200 hover:border-brand-vibrant/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm font-bold text-base-content/70 truncate">{cat.label}</span>
                </div>
                <p className="text-lg font-black text-base-content">{formatCurrency(catTotal, budget.currency)}</p>
                <div className="h-1.5 bg-base-300 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-vibrant to-brand-accent rounded-full"
                    style={{ width: `${catPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 pr-2">
        <h3 className="text-sm font-black text-base-content/70 mb-3 uppercase tracking-wider">Recent Transactions</h3>
        <div className="space-y-2">
          {budget.items?.length > 0 ? (
            budget.items.slice(0, 10).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-base-200 rounded-xl border border-base-200 hover:border-brand-vibrant/30 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-base-100 shadow-sm flex items-center justify-center text-lg">
                  {getCategoryInfo(item.category).icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base-content truncate">
                    {item.description || getCategoryInfo(item.category).label}
                  </p>
                  <p className="text-xs text-base-content/40 font-bold uppercase">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${item.type === 'income' ? 'text-emerald-500' : 'text-base-content'}`}>
                    {item.type === 'income' ? '+' : '-'}{formatDualAmount(item)}
                  </p>
                  {item.exchangeRate && item.originalCurrency && item.originalCurrency !== budget.currency ? (
                    <p className="text-[10px] text-base-content/40">rate {Number(item.exchangeRate).toFixed(4)}</p>
                  ) : null}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-xs text-base-content/40 hover:text-error transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-base-content/40 py-8 font-bold">No transactions yet</p>
          )}
        </div>
      </div>

      {showAddExpense ? (
        <form onSubmit={addItem} className="p-4 bg-base-200 rounded-xl space-y-3 border border-base-300">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setNewItem(prev => ({ ...prev, type: 'expense' }))}
              className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${
                newItem.type === 'expense' 
                  ? 'bg-red-100 text-error border-2 border-error/30' 
                  : 'bg-base-300 text-base-content/80 hover:bg-base-300 border-2 border-transparent'
              }`}
            >
              <TrendingDown size={16} className="inline mr-1" /> Expense
            </button>
            <button
              type="button"
              onClick={() => setNewItem(prev => ({ ...prev, type: 'income' }))}
              className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${
                newItem.type === 'income' 
                  ? 'bg-success/20 text-success border-2 border-success/30' 
                  : 'bg-base-300 text-base-content/80 hover:bg-base-300 border-2 border-transparent'
              }`}
            >
              <TrendingUp size={16} className="inline mr-1" /> Income
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="number"
              value={newItem.amount}
              onChange={e => setNewItem(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="Amount"
              step="0.01"
              className="flex-1 px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none text-base-content"
              required
            />
            <select
              value={newItem.currency}
              onChange={e => setNewItem(prev => ({ ...prev, currency: e.target.value }))}
              className="px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none text-base-content"
            >
              {currencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          <select
            value={newItem.category}
            onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none text-base-content"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>
            ))}
          </select>
          
          <input
            type="text"
            value={newItem.description}
            onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-3 py-2.5 border-2 border-base-300 bg-base-100 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none text-base-content"
          />
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddExpense(false)}
              className="flex-1 px-4 py-2.5 border-2 border-base-300 rounded-lg text-sm font-bold text-base-content/60 hover:bg-base-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-brand-vibrant text-white rounded-lg text-sm font-bold hover:bg-brand-vibrant/90 transition-colors shadow-lg shadow-brand-vibrant/20"
            >
              Add
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddExpense(true)}
          className="w-full py-3.5 border-2 border-dashed border-base-content/10 rounded-xl text-base-content/40 hover:border-brand-vibrant hover:text-brand-vibrant hover:bg-brand-vibrant/5 transition-all flex items-center justify-center gap-2 font-bold"
        >
          <Plus size={18} />
          Add Expense
        </button>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-base-content/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-base-content">Edit Budget</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={updateBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-base-content/70 mb-2">Total Budget</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={budgetSettings.totalBudget}
                    onChange={e => setBudgetSettings(prev => ({ ...prev, totalBudget: e.target.value }))}
                    className="flex-1 px-4 py-3.5 border-2 border-base-300 bg-base-100 rounded-xl focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none font-bold text-base-content"
                    required
                  />
                  <select
                    value={budgetSettings.currency}
                    onChange={e => setBudgetSettings(prev => ({ ...prev, currency: e.target.value }))}
                    className="px-4 py-3.5 border-2 border-base-300 bg-base-100 rounded-xl focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none font-bold text-base-content"
                  >
                    {currencies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-4 bg-gradient-to-r from-brand-vibrant to-brand-accent text-white rounded-xl font-bold hover:shadow-xl hover:shadow-brand-vibrant/20 transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 className="animate-spin mx-auto" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTracker;
