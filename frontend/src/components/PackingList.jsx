import { useState, useEffect } from 'react';
import { Check, Package, Loader2, Plus, Minus, Trash2, Copy, Share2 } from 'lucide-react';
import api, { duplicatePackingList, sharePackingList } from '../lib/api';
import toast from 'react-hot-toast';

const CATEGORY_ICONS = {
  documents: '📄',
  electronics: '🔌',
  clothing: '👕',
  toiletries: '🧴',
  medicine: '💊',
  essentials: '🎒',
  activities: '🎯',
  other: '📦'
};

const CATEGORY_LABELS = {
  documents: 'Documents',
  electronics: 'Electronics',
  clothing: 'Clothing',
  toiletries: 'Toiletries',
  medicine: 'Medicine',
  essentials: 'Essentials',
  activities: 'Activities',
  other: 'Other'
};

const PackingList = ({ tripId, tripName, onClose }) => {
  const [list, setList] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'other', quantity: 1 });

  useEffect(() => {
    fetchList();
    fetchTemplates();
  }, [tripId]);

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/packing-lists/${tripId}`);
      setList(response.data.data);
    } catch (error) {
      console.error('Error fetching packing list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!list?.id) return;
    try {
      const response = await duplicatePackingList(list.id);
      if (response.success) {
        toast.success('List duplicated! Go to the new trip to use it.');
        onClose();
      }
    } catch (error) {
      console.error('Error duplicating list:', error);
      toast.error('Failed to duplicate list');
    }
  };

  const handleShare = async () => {
    if (!list?.id) return;
    try {
      const response = await sharePackingList(list.id);
      if (response.data?.shareUrl) {
        const url = `${window.location.origin}${response.data.shareUrl}`;
        await navigator.clipboard.writeText(url);
        toast.success('Share link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing list:', error);
      toast.error('Failed to share packing list');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/packing-lists/templates');
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const createList = async (templateId) => {
    try {
      setCreating(true);
      const response = await api.post('/packing-lists', {
        tripId,
        name: `Packing for ${tripName}`,
        templateId
      });
      setList(response.data.data);
      setShowTemplates(false);
      toast.success(templateId ? 'List created from template!' : 'Packing list created!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = async (item) => {
    // Optimistic update first
    const newPacked = !item.isPacked;
    setList(prev => ({
      ...prev,
      items: (prev.items || []).map(i =>
        i.id === item.id ? { ...i, isPacked: newPacked } : i
      )
    }));
    try {
      await api.put(`/packing-lists/${list.id}/items/${item.id}`, {
        isPacked: newPacked
      });
    } catch (error) {
      // Rollback on failure
      setList(prev => ({
        ...prev,
        items: (prev.items || []).map(i =>
          i.id === item.id ? { ...i, isPacked: item.isPacked } : i
        )
      }));
      toast.error('Failed to update item');
    }
  };

  const updateQuantity = async (item, delta) => {
    const newQty = Math.max(1, item.quantity + delta);
    try {
      await api.put(`/packing-lists/${list.id}/items/${item.id}`, {
        quantity: newQty
      });
      setList(prev => ({
        ...prev,
        items: (prev.items || []).map(i => 
          i.id === item.id ? { ...i, quantity: newQty } : i
        )
      }));
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await api.delete(`/packing-lists/${list.id}/items/${itemId}`);
      setList(prev => ({
        ...prev,
        items: prev.items.filter(i => i.id !== itemId)
      }));
      toast.success('Item removed');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) {
      toast.error('Please enter an item name');
      return;
    }

    try {
      const response = await api.post(`/packing-lists/${list.id}/items`, {
        name: newItem.name,
        category: newItem.category,
        quantity: newItem.quantity
      });
      setList(prev => ({
        ...prev,
        items: [...prev.items, response.data.data]
      }));
      setNewItem({ name: '', category: 'other', quantity: 1 });
      setShowAddItem(false);
      toast.success('Item added!');
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  // Group items by category
  const groupedItems = list?.items?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}) || {};

  // Calculate progress
  const totalItems = list?.items?.length || 0;
  const packedItems = list?.items?.filter(i => i.isPacked).length || 0;
  const progress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

  // If no list exists, show template selection
  if (!list && !loading) {
    return (
      <div className="bg-base-100 rounded-2xl p-8 max-w-lg mx-auto shadow-xl border border-base-300/50">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-vibrant/20 to-brand-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Package className="text-brand-vibrant" size={36} />
          </div>
          <h2 className="text-2xl font-black text-base-content mb-2">Packing List</h2>
          <p className="text-base-content/60 font-medium">Create a packing list for your trip to {tripName}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => createList(null)}
            disabled={creating}
            className="w-full p-5 bg-gradient-to-r from-brand-vibrant to-brand-accent text-white rounded-xl font-bold hover:shadow-xl hover:shadow-brand-vibrant/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            Start with Essentials
          </button>

          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full p-5 bg-base-200 text-base-content/80 rounded-xl font-bold hover:bg-base-200 transition-colors"
          >
            Choose a Template
          </button>

          {showTemplates && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => createList(template.id)}
                  disabled={creating}
                  className="w-full p-4 bg-base-100 border-2 border-base-300/50 rounded-xl text-left hover:border-brand-vibrant hover:bg-brand-vibrant/5 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-base-content">{template.name}</p>
                      <p className="text-sm text-base-content/60">{template.description}</p>
                    </div>
                    <span className="text-xs bg-base-200 px-3 py-1 rounded-full capitalize text-base-content/80 font-bold">
                      {template.climate}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-brand-vibrant" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-2xl p-8 max-w-lg mx-auto shadow-xl border border-base-300/50 max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-base-content">Packing List</h2>
          <p className="text-sm text-base-content/60">{tripName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-base-content/40 hover:text-base-content/80 hover:bg-base-200 rounded-xl transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Progress */}
      <div className="mb-4 p-4 bg-gradient-to-r from-brand-vibrant/5 to-brand-accent/5 rounded-xl border border-brand-vibrant/10">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-base-content/80 font-bold">
            {packedItems} of {totalItems} items packed
          </span>
          <span className="font-black text-brand-vibrant">{progress}%</span>
        </div>
        <div className="h-3 bg-base-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-brand-vibrant to-brand-accent transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="text-xs text-brand-vibrant font-bold mt-2 text-center">🎉 All packed! You're ready to go!</p>
        )}
        <button
          onClick={handleDuplicate}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-base-200 hover:bg-base-300 text-base-content/70 hover:text-base-content rounded-lg text-sm font-bold transition-colors"
        >
          <Copy size={14} />
          Duplicate for Another Trip
        </button>
        <button
          onClick={handleShare}
          className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-base-200 hover:bg-base-300 text-base-content/70 hover:text-base-content rounded-lg text-sm font-bold transition-colors"
        >
          <Share2 size={14} />
          Share Packing List
        </button>
      </div>

      {/* Items by category */}
      <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-6">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-base-content/80 flex items-center gap-2 uppercase tracking-wider">
                <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                {CATEGORY_LABELS[category]}
                <span className="text-base-content/40 font-bold text-xs">
                  ({items.filter(i => i.isPacked).length}/{items.length})
                </span>
              </h3>
              <a 
                href={`https://www.amazon.co.uk/s?k=${encodeURIComponent(CATEGORY_LABELS[category] + ' for travel')}&tag=${import.meta.env.VITE_AMAZON_TAG || 'solocompass-21'}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-black text-warning hover:text-warning flex items-center gap-1 bg-warning/10 px-2 py-1 rounded-md transition-colors"
              >
                Shop Amazon <Package size={10} />
              </a>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <div 
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                    item.isPacked 
                      ? 'bg-success/10 border-success/20' 
                      : 'bg-base-100 border-base-300/50 hover:border-brand-vibrant/30 hover:shadow-sm'
                  }`}
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      item.isPacked 
                        ? 'bg-success/100 border-emerald-500 text-white shadow-sm' 
                        : 'border-base-300/70 hover:border-brand-vibrant'
                    }`}
                  >
                    {item.isPacked && <Check size={14} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-bold ${item.isPacked ? 'line-through text-base-content/40' : 'text-base-content'}`}>
                      {item.name}
                    </p>
                    {item.isEssential && (
                      <span className="text-xs text-warning font-bold">★ Essential</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-base-200 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item, -1)}
                      className="p-1 text-base-content/40 hover:text-base-content/80 rounded"
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item, 1)}
                      className="p-1 text-base-content/40 hover:text-base-content/80 rounded"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 text-base-content/40 hover:text-error rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Item */}
      {showAddItem ? (
        <form onSubmit={addItem} className="mt-4 p-4 bg-base-200 rounded-xl border border-base-300">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              value={newItem.name}
              onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Item name"
              className="col-span-2 px-3 py-2.5 border border-base-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none"
              autoFocus
            />
            <select
              value={newItem.category}
              onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2.5 border border-base-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-vibrant/20 focus:border-brand-vibrant outline-none"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddItem(false)}
              className="flex-1 px-4 py-2.5 border border-base-300 rounded-lg text-sm font-bold text-base-content/80 hover:bg-base-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-brand-vibrant text-white rounded-lg text-sm font-bold hover:bg-brand-vibrant/90 transition-colors shadow-lg shadow-brand-vibrant/20"
            >
              Add Item
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className="mt-4 w-full py-3.5 border-2 border-dashed border-base-300 rounded-xl text-base-content/60 hover:border-brand-vibrant hover:text-brand-vibrant hover:bg-brand-vibrant/5 transition-all flex items-center justify-center gap-2 font-bold"
        >
          <Plus size={18} />
          Add Item
        </button>
      )}
    </div>
  );
};

export default PackingList;
