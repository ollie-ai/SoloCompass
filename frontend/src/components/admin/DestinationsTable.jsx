import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import AdminDrawer from './AdminDrawer';
import Button from '../Button';
import BulkImport from './BulkImport';
import ConfirmDialog from '../ConfirmDialog';
import { 
  MapPin, 
  Edit2, 
  Trash2, 
  Eye, 
  RefreshCw,
  Globe,
  Shield,
  DollarSign,
  Image,
  ToggleLeft,
  CheckSquare,
  Plus,
  Download,
  Play,
  CheckCircle,
  FileText,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Bot,
  CheckCircle2,
  XCircle,
  Wand2,
  FlaskConical,
  Sparkles,
  Send,
  Filter
} from 'lucide-react';

const DestinationsTable = () => {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedDest, setSelectedDest] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('active');
  const [expandedAiContent, setExpandedAiContent] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [previewDest, setPreviewDest] = useState(null);
  const [showResearchPackDrawer, setShowResearchPackDrawer] = useState(false);
  const [researchPack, setResearchPack] = useState(null);
  const [researchPackLoading, setResearchPackLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, ids: [], count: 0 });
  const limit = 10;

  const [formData, setFormData] = useState({
    name: '',
    country: '',
    city: '',
    description: '',
    budget_level: 'moderate',
    safety_rating: 'medium',
    solo_friendly_rating: 4,
    image_url: '',
    fcdo_slug: '',
    latitude: 0,
    longitude: 0,
    emergency_contacts: { police: '112', ambulance: '112', fire: '112' },
    safety_intelligence: '',
    publication_status: 'draft',
    safety_gate_status: 'unchecked',
    manual_review_status: 'pending',
    short_summary: '',
    why_solo_travellers: '',
    arrival_tips: '',
    local_etiquette_notes: '',
    lgbtq_notes: '',
    women_solo_notes: '',
    after_dark_guidance: '',
    neighbourhood_shortlist: '',
    ideal_trip_length: '',
    ai_card_summary: '',
    ai_safety_brief: '',
    ai_solo_suitability: '',
    ai_arrival_checklist: '',
    ai_neighbourhood_guidance: '',
    ai_after_dark: '',
    ai_common_friction: '',
    ai_quick_facts: '',
    ai_fallback_summary: ''
  });

  useEffect(() => {
    fetchDestinations();
  }, [page, searchTerm, filterType]);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const response = await api.get('/destinations', {
        params: { 
          search: searchTerm, 
          filter: filterType,
          limit, 
          offset 
        }
      });
      setDestinations(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      toast.error('Failed to fetch destinations');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dest) => {
    setSelectedDest(dest);
    setFormData({
      name: dest.name || '',
      country: dest.country || '',
      city: dest.city || '',
      description: dest.description || '',
      budget_level: dest.budget_level || 'moderate',
      safety_rating: dest.safety_rating || 'medium',
      solo_friendly_rating: dest.solo_friendly_rating || 4,
      image_url: dest.image_url || '',
      fcdo_slug: dest.fcdo_slug || '',
      latitude: dest.latitude || 0,
      longitude: dest.longitude || 0,
      emergency_contacts: dest.emergency_contacts || { police: '112', ambulance: '112', fire: '112' },
      safety_intelligence: dest.safety_intelligence || '',
      publication_status: dest.publication_status || 'draft',
      safety_gate_status: dest.safety_gate_status || 'unchecked',
      manual_review_status: dest.manual_review_status || 'pending',
      short_summary: dest.short_summary || '',
      why_solo_travellers: dest.why_solo_travellers || '',
      arrival_tips: dest.arrival_tips || '',
      local_etiquette_notes: dest.local_etiquette_notes || '',
      lgbtq_notes: dest.lgbtq_notes || '',
      women_solo_notes: dest.women_solo_notes || '',
      after_dark_guidance: dest.after_dark_guidance || '',
      neighbourhood_shortlist: dest.neighbourhood_shortlist || '',
      ideal_trip_length: dest.ideal_trip_length || '',
      ai_card_summary: dest.ai_card_summary || '',
      ai_safety_brief: dest.ai_safety_brief || '',
      ai_solo_suitability: dest.ai_solo_suitability || '',
      ai_arrival_checklist: dest.ai_arrival_checklist || '',
      ai_neighbourhood_guidance: dest.ai_neighbourhood_guidance || '',
      ai_after_dark: dest.ai_after_dark || '',
      ai_common_friction: dest.ai_common_friction || '',
      ai_quick_facts: dest.ai_quick_facts || '',
      ai_fallback_summary: dest.ai_fallback_summary || ''
    });
    setShowEditModal(true);
  };

  const handleView = (dest) => {
    setSelectedDest(dest);
    setShowViewModal(true);
  };

  const handleDelete = (id) => {
    setConfirmDialog({ open: true, action: 'delete_single', ids: [id], count: 1 });
  };

  const executeConfirmedAction = async () => {
    const { action, ids } = confirmDialog;
    setConfirmDialog({ open: false, action: null, ids: [], count: 0 });
    try {
      setLoading(true);
      switch (action) {
        case 'delete_single':
          await api.delete(`/destinations/${ids[0]}`);
          toast.success('Destination deleted');
          break;
        case 'bulk_delete':
          await Promise.all(ids.map(id => api.delete(`/destinations/${id}`)));
          toast.success(`${ids.length} destinations deleted`);
          setSelectedRows(new Set());
          break;
        case 'bulk_research':
          await Promise.all(ids.map(id => api.post(`/destinations/${id}/run-research`)));
          toast.success(`Research started for ${ids.length} destinations`);
          setSelectedRows(new Set());
          break;
        case 'bulk_eligibility':
          await Promise.all(ids.map(id => api.get(`/destinations/${id}/eligibility`)));
          toast.success(`Eligibility checked for ${ids.length} destinations`);
          setSelectedRows(new Set());
          break;
        case 'bulk_publish':
          await Promise.all(ids.map(id => api.post(`/destinations/${id}/publish`)));
          toast.success(`${ids.length} destinations published`);
          setSelectedRows(new Set());
          break;
        case 'bulk_approve_publish':
          for (const id of ids) {
            await api.post(`/destinations/${id}/approve`, { status: 'approved' });
            await api.put(`/destinations/${id}`, { publication_status: 'live' });
          }
          toast.success(`${ids.length} destinations approved and published`);
          setSelectedRows(new Set());
          break;
        default: break;
      }
      fetchDestinations();
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunResearch = async (id) => {
    try {
      setActionLoading(`run-research-${id}`);
      await api.post(`/destinations/${id}/run-research`);
      toast.success('Research job started');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to start research');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateAi = async (id) => {
    try {
      setActionLoading(`generate-ai-${id}`);
      await api.post(`/destinations/${id}/generate-ai`);
      toast.success('AI generation started');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to start AI generation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckEligibility = async (id) => {
    try {
      setActionLoading(`eligibility-${id}`);
      const response = await api.get(`/destinations/${id}/eligibility`);
      toast.success('Eligibility check complete');
      if (response.data?.eligible) {
        toast.success('Destination is eligible for publishing');
      } else {
        toast.error(response.data?.reason || 'Not eligible for publishing');
      }
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to check eligibility');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuggestCities = async (id) => {
    try {
      setActionLoading(`suggest-cities-${id}`);
      await api.post(`/destinations/${id}/suggest-cities`);
      toast.success('City suggestions generated');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to suggest cities');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishNew = async (id) => {
    try {
      setActionLoading(`publish-${id}`);
      await api.post(`/destinations/${id}/publish`);
      toast.success('Destination published');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to publish destination');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewResearchPack = async (dest) => {
    try {
      setResearchPackLoading(true);
      const response = await api.get(`/destinations/${dest.id}/research-pack`);
      setResearchPack(response.data);
      setShowResearchPackDrawer(true);
    } catch (error) {
      toast.error('Failed to load research pack');
    } finally {
      setResearchPackLoading(false);
    }
  };

  const handleRunSafetyGate = async (id) => {
    try {
      setActionLoading(id);
      await api.post(`/destinations/${id}/run-safety-gate`);
      toast.success('Safety gate check completed');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to run safety gate check');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await api.post(`/destinations/${id}/approve`, { status: 'approved' });
      toast.success('Destination approved');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to approve destination');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (id) => {
    try {
      setActionLoading(id);
      await api.put(`/destinations/${id}`, { publication_status: 'live' });
      toast.success('Destination published');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to publish destination');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAndPublish = async (id) => {
    try {
      setActionLoading(id);
      await api.post(`/destinations/${id}/approve`, { status: 'approved' });
      await api.put(`/destinations/${id}`, { publication_status: 'live' });
      toast.success('Approved and published');
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to approve and publish');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreview = (dest) => {
    setPreviewDest(dest);
    setShowPreviewDrawer(true);
  };

  const toggleAiContent = (row) => {
    setExpandedAiContent(expandedAiContent?.id === row.id ? null : row);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (selectedDest) {
        await api.put(`/destinations/${selectedDest.id}`, formData);
        toast.success('Destination updated');
      } else {
        await api.post('/destinations', formData);
        toast.success('Destination created');
      }
      setShowEditModal(false);
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to save destination');
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handleFilter = (filter) => {
    setFilterType(filter);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleSelectionChange = (selected) => {
    setSelectedRows(selected);
  };

  const handleBulkDelete = (selectedIndices) => {
    const idsToDelete = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
    setConfirmDialog({ open: true, action: 'bulk_delete', ids: idsToDelete, count: idsToDelete.length });
  };

  const handleBulkResearch = (selectedIndices) => {
    const idsToResearch = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
    setConfirmDialog({ open: true, action: 'bulk_research', ids: idsToResearch, count: idsToResearch.length });
  };

  const handleBulkCheckEligibility = (selectedIndices) => {
    const idsToCheck = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
    setConfirmDialog({ open: true, action: 'bulk_eligibility', ids: idsToCheck, count: idsToCheck.length });
  };

  const handleBulkPublish = (selectedIndices) => {
    const idsToPublish = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
    setConfirmDialog({ open: true, action: 'bulk_publish', ids: idsToPublish, count: idsToPublish.length });
  };

  const handleBulkStatusChange = async (selectedIndices) => {
    const idsToUpdate = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
    try {
      setLoading(true);
      await Promise.all(idsToUpdate.map(id => 
        api.put(`/destinations/${id}`, { status: bulkStatus })
      ));
      toast.success(`${idsToUpdate.length} destinations updated`);
      setSelectedRows(new Set());
      setShowStatusModal(false);
      fetchDestinations();
    } catch (error) {
      toast.error('Failed to update destinations');
    } finally {
      setLoading(false);
    }
  };

  const bulkActions = [
    {
      label: 'Run Research',
      icon: <FlaskConical size={14} />,
      variant: 'primary',
      onClick: handleBulkResearch
    },
    {
      label: 'Check Eligibility',
      icon: <CheckCircle size={14} />,
      variant: 'info',
      onClick: handleBulkCheckEligibility
    },
    {
      label: 'Publish',
      icon: <Send size={14} />,
      variant: 'success',
      onClick: handleBulkPublish
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger',
      onClick: handleBulkDelete
    },
    {
      label: 'Change Status',
      icon: <ToggleLeft size={14} />,
      variant: 'warning',
      onClick: () => setShowStatusModal(true)
    },
    {
      label: 'Approve & Publish',
      icon: <CheckCircle2 size={14} />,
      variant: 'success',
      onClick: (selectedIndices) => {
        const idsToPublish = selectedIndices.map(idx => destinations[idx]?.id).filter(Boolean);
        setConfirmDialog({ open: true, action: 'bulk_approve_publish', ids: idsToPublish, count: idsToPublish.length });
      }
    }
  ];

  const getPublicationBadge = (status) => {
    const styles = {
      draft: 'bg-base-300/30 text-base-content/60',
      pending_review: 'bg-warning/20 text-warning',
      live: 'bg-success/20 text-success',
      paused: 'bg-warning/20 text-warning',
      blocked: 'bg-error/20 text-error'
    };
    return styles[status] || styles.draft;
  };

  const getSafetyGateBadge = (status) => {
    const styles = {
      unchecked: 'bg-base-300/30 text-base-content/60',
      pass: 'bg-success/20 text-success',
      fail: 'bg-error/20 text-error'
    };
    return styles[status] || styles.unchecked;
  };

  const getAiBriefingBadge = (status) => {
    const styles = {
      pending: 'bg-warning/20 text-warning',
      generated: 'bg-info/20 text-info',
      reviewed: 'bg-success/20 text-success'
    };
    return styles[status] || styles.pending;
  };

  const getResearchWorkflowBadge = (status) => {
    const styles = {
      draft: 'bg-base-300/30 text-base-content/60',
      source_pack_building: 'bg-info/20 text-info',
      source_pack_ready: 'bg-cyan-500/20 text-cyan-500',
      ai_in_progress: 'bg-purple-500/20 text-purple-500',
      needs_review: 'bg-warning/20 text-warning',
      approved: 'bg-success/20 text-success',
      live: 'bg-emerald-500/20 text-emerald-500 font-bold',
      paused: 'bg-warning/20 text-warning',
      blocked: 'bg-error/20 text-error'
    };
    return styles[status] || styles.draft;
  };

  const getSourceLabelBadge = (label) => {
    const styles = {
      official: 'bg-blue-500/20 text-blue-500',
      verified: 'bg-green-500/20 text-green-500',
      ai: 'bg-purple-500/20 text-purple-500',
      community: 'bg-yellow-500/20 text-yellow-500',
      partner: 'bg-base-300/30 text-base-content/60'
    };
    return styles[label] || styles.partner;
  };

  const getEligibilityStatus = (dest) => {
    if (dest.can_go_live === true || dest.eligible === true) {
      return { label: 'Eligible', className: 'bg-success/20 text-success', icon: '✅' };
    }
    if (dest.missing_fields && dest.missing_fields.length > 0) {
      return { label: `Missing ${dest.missing_fields.length} fields`, className: 'bg-warning/20 text-warning', icon: '⚠️', details: dest.missing_fields };
    }
    if (dest.blockers || dest.not_eligible) {
      return { label: 'Not Eligible', className: 'bg-error/20 text-error', icon: '❌', details: dest.blockers || dest.not_eligible };
    }
    return { label: 'Unknown', className: 'bg-base-300 text-base-content/60', icon: '❓' };
  };

  const calculateCompletenessScore = (dest) => {
    const fields = [
      'name', 'country', 'city', 'description', 'short_summary',
      'why_solo_travellers', 'arrival_tips', 'safety_rating',
      'budget_level', 'solo_friendly_rating', 'image_url'
    ];
    const aiFields = [
      'ai_card_summary', 'ai_safety_brief', 'ai_solo_suitability',
      'ai_arrival_checklist', 'ai_neighbourhood_guidance'
    ];
    
    const filledFields = fields.filter(f => dest[f] && dest[f] !== '').length;
    const filledAiFields = aiFields.filter(f => dest[f] && dest[f] !== '').length;
    
    const baseScore = (filledFields / fields.length) * 70;
    const aiScore = (filledAiFields / aiFields.length) * 30;
    
    return Math.round(baseScore + aiScore);
  };

  const getTrustState = (row) => {
    if (row.safety_gate_status === 'fail' || row.manual_review_status === 'rejected') {
      return { label: 'Blocked', className: 'bg-error/20 text-error' };
    }
    if (row.safety_gate_status === 'unchecked' || row.manual_review_status === 'pending') {
      return { label: 'Review', className: 'bg-warning/20 text-warning' };
    }
    if (row.safety_gate_status === 'pass' && row.manual_review_status === 'approved') {
      return { label: 'Trusted', className: 'bg-success/20 text-success' };
    }
    return { label: 'Unknown', className: 'bg-base-300 text-base-content/60' };
  };

  const isPublishReady = (row) => {
    return row.safety_gate_status === 'pass' && 
           row.manual_review_status === 'approved' && 
           row.publication_status === 'draft';
  };

  const isEligible = (row) => {
    return row.can_go_live === true || row.eligible === true;
  };

  const columns = useMemo(() => [
    {
      key: 'destination',
      label: 'Destination',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden grayscale group-hover:grayscale-0 transition-all shadow-md border border-base-300">
            <img 
              src={row.image_url || 'https://via.placeholder.com/40'} 
              className="w-full h-full object-cover" 
              alt={`${row.name} destination thumbnail`}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-base-content leading-none mb-1">{row.name}</p>
              {row.destination_level && (
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                  row.destination_level === 'country' ? 'bg-brand-vibrant/20 text-brand-vibrant' : 
                  row.destination_level === 'city' ? 'bg-info/20 text-info' :
                  'bg-base-300 text-base-content/60'
                }`}>
                  {row.destination_level}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-tight">
              {row.city || 'N/A'}, {row.country}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'source_label',
      label: 'Source',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getSourceLabelBadge(row.source_label)}`}>
          {row.source_label || 'partner'}
        </span>
      )
    },
    {
      key: 'research_workflow_state',
      label: 'Research State',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getResearchWorkflowBadge(row.research_workflow_state)}`}>
          {row.research_workflow_state || 'draft'}
        </span>
      )
    },
    {
      key: 'completeness_score',
      label: 'Complete',
      sortable: true,
      render: (_, row) => {
        const score = calculateCompletenessScore(row);
        const color = score >= 80 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-error';
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-base-300 rounded-full overflow-hidden">
              <div 
                className={`h-full ${color} transition-all`} 
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-base-content/60">{score}%</span>
          </div>
        );
      }
    },
    {
      key: 'eligibility_status',
      label: 'Eligibility',
      sortable: false,
      render: (_, row) => {
        const eligibility = getEligibilityStatus(row);
        return (
          <div className="relative group">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-help ${eligibility.className}`}>
              {eligibility.icon} {eligibility.label}
            </span>
            {eligibility.details && (
              <div className="hidden group-hover:block absolute z-50 bottom-full left-0 mb-2 w-48 bg-base-100 border border-base-300 rounded-lg p-2 shadow-xl">
                <p className="text-[10px] font-bold text-base-content/60 uppercase mb-1">Missing/Blockers:</p>
                {Array.isArray(eligibility.details) ? (
                  <ul className="text-[10px] text-base-content/80 space-y-1">
                    {eligibility.details.slice(0, 5).map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                    {eligibility.details.length > 5 && <li>...and {eligibility.details.length - 5} more</li>}
                  </ul>
                ) : (
                  <p className="text-[10px] text-base-content/80">{eligibility.details}</p>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'publication_status',
      label: 'Status',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getPublicationBadge(row.publication_status)}`}>
          {row.publication_status || 'draft'}
        </span>
      )
    },
    {
      key: 'trust_state',
      label: 'Trust',
      sortable: false,
      render: (_, row) => {
        const trust = getTrustState(row);
        return (
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${trust.className}`}>
            {trust.label}
          </span>
        );
      }
    },
    {
      key: 'ready',
      label: 'Ready',
      sortable: false,
      render: (_, row) => {
        const ready = isPublishReady(row);
        return ready ? (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-success/20 text-success flex items-center gap-1">
            <CheckCircle2 size={12} />
            Publish
          </span>
        ) : null;
      }
    },
    {
      key: 'advisory_stance',
      label: 'Advisory',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
          row.advisory_stance === 'normal' ? 'bg-success/20 text-success' :
          row.advisory_stance === 'exercise_caution' ? 'bg-warning/20 text-warning' :
          row.advisory_stance === 'advise_against' ? 'bg-error/20 text-error' :
          'bg-base-300 text-base-content/50'
        }`}>
          {row.advisory_stance || 'N/A'}
        </span>
      )
    },
    {
      key: 'research_status',
      label: 'Research',
      sortable: true,
      render: (_, row) => {
        const state = row.research_status || 'not_started';
        const icons = {
          complete: <Bot size={12} />,
          in_progress: <RefreshCw size={12} className="animate-spin" />,
          failed: <XCircle size={12} />,
          not_started: null
        };
        return (
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${
            state === 'complete' ? 'bg-info/20 text-info' :
            state === 'in_progress' ? 'bg-primary/20 text-primary' :
            state === 'failed' ? 'bg-error/20 text-error' :
            'bg-base-300 text-base-content/50'
          }`}>
            {icons[state]}
            {state}
          </span>
        );
      }
    },
    {
      key: 'content_fresh',
      label: 'Fresh',
      sortable: true,
      render: (_, row) => {
        if (!row.content_fresh_until) {
          return <span className="text-[10px] text-base-content/40 flex items-center gap-1">
            <AlertTriangle size={12} />Never
          </span>;
        }
        const fresh = new Date(row.content_fresh_until) > new Date();
        const daysUntil = Math.ceil((new Date(row.content_fresh_until) - new Date()) / (1000 * 60 * 60 * 24));
        return (
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold ${fresh ? 'text-success' : 'text-warning'}`}>
              {fresh ? '✓' : '⚠'} {new Date(row.content_fresh_until).toLocaleDateString('en-GB')}
            </span>
            <span className={`text-[8px] ${daysUntil < 0 ? 'text-error' : daysUntil < 30 ? 'text-warning' : 'text-base-content/50'}`}>
              {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d left`}
            </span>
          </div>
        );
      }
    },
    {
      key: 'ai_briefing_status',
      label: 'AI',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getAiBriefingBadge(row.ai_briefing_status)}`}>
          {row.ai_briefing_status || 'pending'}
        </span>
      )
    },
    {
      key: 'budget_level',
      label: 'Budget',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs font-bold text-base-content/60 capitalize tracking-wide">
          {row.budget_level}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1 flex-wrap">
          <button 
            onClick={() => handleRunResearch(row.id)}
            disabled={actionLoading === `run-research-${row.id}`}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-primary disabled:opacity-50"
            title="Run Full Research"
          >
            <FlaskConical size={16} />
          </button>
          <button 
            onClick={() => handleGenerateAi(row.id)}
            disabled={actionLoading === `generate-ai-${row.id}`}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-purple-500 disabled:opacity-50"
            title="Generate AI"
          >
            <Sparkles size={16} />
          </button>
          <button 
            onClick={() => handleCheckEligibility(row.id)}
            disabled={actionLoading === `eligibility-${row.id}`}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-success disabled:opacity-50"
            title="Check Eligibility"
          >
            <CheckCircle size={16} />
          </button>
          <button 
            onClick={() => handleSuggestCities(row.id)}
            disabled={actionLoading === `suggest-cities-${row.id}`}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-info disabled:opacity-50"
            title="Suggest Cities"
          >
            <MapPin size={16} />
          </button>
          <button 
            onClick={() => handlePublishNew(row.id)}
            disabled={actionLoading === `publish-${row.id}` || !isEligible(row)}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-success disabled:opacity-30"
            title="Publish"
          >
            <Send size={16} />
          </button>
          <button 
            onClick={() => handleViewResearchPack(row)}
            disabled={actionLoading === `research-pack-${row.id}`}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-info disabled:opacity-50"
            title="View Research Pack"
          >
            <FileText size={16} />
          </button>
          <button 
            onClick={() => handleRunSafetyGate(row.id)}
            disabled={actionLoading === row.id}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-info disabled:opacity-50"
            title="Run Safety Gate"
          >
            <ShieldCheck size={16} />
          </button>
          <button 
            onClick={() => handleApprove(row.id)}
            disabled={actionLoading === row.id || row.manual_review_status === 'approved'}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-success disabled:opacity-50"
            title="Approve"
          >
            <CheckCircle size={16} />
          </button>
          <button 
            onClick={() => handlePreview(row)}
            disabled={actionLoading === row.id}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-info disabled:opacity-50"
            title="Preview"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={() => handleApproveAndPublish(row.id)}
            disabled={actionLoading === row.id || !isPublishReady(row)}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-success disabled:opacity-30"
            title="Approve & Publish"
          >
            <Wand2 size={16} />
          </button>
          <button 
            onClick={() => toggleAiContent(row)}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-primary"
            title="View AI Content"
          >
            <Bot size={16} />
          </button>
          <button 
            onClick={() => handleView(row)} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-primary"
            title="Details"
          >
            <FileText size={16} />
          </button>
          <button 
            onClick={() => handleEdit(row)} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-primary"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-error"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ], [actionLoading]);

  const filterOptions = [
    { value: '', label: 'All Destinations', group: 'All' },
    { group: 'Trust Exceptions' },
    { value: 'needs_review', label: 'Needs Review', group: 'Trust Exceptions' },
    { value: 'stale', label: 'Stale Content', group: 'Trust Exceptions' },
    { value: 'publish_ready', label: 'Publish Ready', group: 'Trust Exceptions' },
    { value: 'research_failed', label: 'Research Failed', group: 'Trust Exceptions' },
    { group: 'Status' },
    { value: 'draft', label: 'Draft', group: 'Status' },
    { value: 'pending_review', label: 'Pending Review', group: 'Status' },
    { value: 'live', label: 'Live', group: 'Status' },
    { value: 'paused', label: 'Paused', group: 'Status' },
    { value: 'blocked', label: 'Blocked', group: 'Status' },
    { group: 'Research' },
    { value: 'research_not_started', label: 'Not Started', group: 'Research' },
    { value: 'research_in_progress', label: 'In Progress', group: 'Research' },
    { value: 'research_complete', label: 'Complete', group: 'Research' },
    { group: 'Research Workflow' },
    { value: 'research_workflow_draft', label: 'Workflow: Draft', group: 'Research Workflow' },
    { value: 'research_workflow_source_pack_building', label: 'Source Pack Building', group: 'Research Workflow' },
    { value: 'research_workflow_source_pack_ready', label: 'Source Pack Ready', group: 'Research Workflow' },
    { value: 'research_workflow_ai_in_progress', label: 'AI In Progress', group: 'Research Workflow' },
    { value: 'research_workflow_needs_review', label: 'Needs Review', group: 'Research Workflow' },
    { value: 'research_workflow_approved', label: 'Approved', group: 'Research Workflow' },
    { value: 'research_workflow_live', label: 'Live', group: 'Research Workflow' },
    { group: 'Eligibility' },
    { value: 'eligible', label: 'Eligible', group: 'Eligibility' },
    { value: 'not_eligible', label: 'Not Eligible', group: 'Eligibility' },
    { group: 'Source' },
    { value: 'source_official', label: 'Official', group: 'Source' },
    { value: 'source_verified', label: 'Verified', group: 'Source' },
    { value: 'source_ai', label: 'AI', group: 'Source' },
    { value: 'source_community', label: 'Community', group: 'Source' },
    { value: 'source_partner', label: 'Partner', group: 'Source' },
  ];

  const CONFIRM_LABELS = {
    delete_single: { title: 'Delete Destination?', description: 'This destination will be permanently deleted.', label: 'Delete', variant: 'danger' },
    bulk_delete: { title: `Delete ${confirmDialog.count} Destinations?`, description: 'These destinations will be permanently deleted.', label: 'Delete All', variant: 'danger' },
    bulk_research: { title: `Run AI Research on ${confirmDialog.count} Destinations?`, description: 'This will queue AI research jobs for the selected destinations.', label: 'Run Research', variant: 'warning' },
    bulk_eligibility: { title: `Check Eligibility for ${confirmDialog.count} Destinations?`, description: 'This will run eligibility checks for the selected destinations.', label: 'Check', variant: 'info' },
    bulk_publish: { title: `Publish ${confirmDialog.count} Destinations?`, description: 'These destinations will be made publicly visible.', label: 'Publish', variant: 'warning' },
    bulk_approve_publish: { title: `Approve & Publish ${confirmDialog.count} Destinations?`, description: 'These destinations will be approved and made publicly visible.', label: 'Approve & Publish', variant: 'warning' },
  };
  const activeConfirm = confirmDialog.action ? CONFIRM_LABELS[confirmDialog.action] : null;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmDialog({ open: false, action: null, ids: [], count: 0 })}
        title={activeConfirm?.title}
        description={activeConfirm?.description}
        confirmLabel={activeConfirm?.label}
        variant={activeConfirm?.variant || 'danger'}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => {
              setSelectedDest(null);
              setFormData({
                name: '',
                country: '',
                city: '',
                description: '',
                budget_level: 'moderate',
                safety_rating: 'medium',
                solo_friendly_rating: 4,
                image_url: '',
                fcdo_slug: '',
                latitude: 0,
                longitude: 0,
                emergency_contacts: { police: '112', ambulance: '112', fire: '112' },
                safety_intelligence: '',
                publication_status: 'draft',
                safety_gate_status: 'unchecked',
                manual_review_status: 'pending',
                short_summary: '',
                why_solo_travellers: '',
                arrival_tips: '',
                local_etiquette_notes: '',
                lgbtq_notes: '',
                women_solo_notes: '',
                after_dark_guidance: '',
                neighbourhood_shortlist: '',
                ideal_trip_length: '',
                ai_card_summary: '',
                ai_safety_brief: '',
                ai_solo_suitability: '',
                ai_arrival_checklist: '',
                ai_neighbourhood_guidance: '',
                ai_after_dark: '',
                ai_common_friction: '',
                ai_quick_facts: '',
                ai_fallback_summary: ''
              });
              setShowEditModal(true);
            }}
            className="gap-2"
          >
            <Plus size={16} />
            Add Destination
          </Button>
          <BulkImport onImportComplete={fetchDestinations} />
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              try {
                const res = await api.get('/admin/destinations/export?format=csv');
                if (res.data) {
                  const blob = new Blob([res.data], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'destinations.csv';
                  a.click();
                  toast.success('Destinations exported');
                }
              } catch (e) {
                toast.error('Export failed');
              }
            }}
          >
            <Download size={14} className="mr-2" />
            Export
          </Button>
        </div>
      </div>
      <AdminDataTable
        data={destinations}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={handlePageChange}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRefresh={fetchDestinations}
        searchPlaceholder="Search destinations..."
        filterOptions={filterOptions}
        emptyMessage="No destinations found"
        emptyIcon={MapPin}
        showCheckboxes={true}
        onSelectionChange={handleSelectionChange}
        bulkActions={bulkActions}
      />

      {expandedAiContent && (
        <div className="mt-4 p-4 bg-base-200/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-base-content uppercase tracking-widest flex items-center gap-2">
              <Bot size={16} />
              AI Briefing Content
            </h4>
            <button
              onClick={() => setExpandedAiContent(null)}
              className="text-base-content/50 hover:text-base-content"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expandedAiContent.ai_card_summary && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Card Summary</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_card_summary}</p>
              </div>
            )}
            {expandedAiContent.ai_safety_brief && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Safety Brief</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_safety_brief}</p>
              </div>
            )}
            {expandedAiContent.ai_solo_suitability && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Solo Suitability</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_solo_suitability}</p>
              </div>
            )}
            {expandedAiContent.ai_arrival_checklist && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Arrival Checklist</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_arrival_checklist}</p>
              </div>
            )}
            {expandedAiContent.ai_neighbourhood_guidance && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Neighbourhood Guidance</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_neighbourhood_guidance}</p>
              </div>
            )}
            {expandedAiContent.ai_after_dark && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">After Dark</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_after_dark}</p>
              </div>
            )}
            {expandedAiContent.ai_common_friction && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Common Friction</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_common_friction}</p>
              </div>
            )}
            {expandedAiContent.ai_quick_facts && (
              <div>
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Quick Facts</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_quick_facts}</p>
              </div>
            )}
            {expandedAiContent.ai_fallback_summary && (
              <div className="md:col-span-2">
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-widest mb-1">Fallback Summary</p>
                <p className="text-sm text-base-content/80">{expandedAiContent.ai_fallback_summary}</p>
              </div>
            )}
            {!expandedAiContent.ai_card_summary && !expandedAiContent.ai_safety_brief && !expandedAiContent.ai_solo_suitability && (
              <p className="text-sm text-base-content/50 italic">No AI content available for this destination.</p>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AdminModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={selectedDest ? `Edit: ${selectedDest.name}` : 'Add Destination'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Country</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Budget Level</label>
            <select
              value={formData.budget_level}
              onChange={(e) => setFormData({ ...formData, budget_level: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Safety Rating</label>
            <select
              value={formData.safety_rating}
              onChange={(e) => setFormData({ ...formData, safety_rating: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Solo Friendly Rating</label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.solo_friendly_rating}
              onChange={(e) => setFormData({ ...formData, solo_friendly_rating: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Publication Status</label>
            <select
              value={formData.publication_status}
              onChange={(e) => setFormData({ ...formData, publication_status: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            >
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="live">Live</option>
              <option value="paused">Paused</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Safety Gate Status</label>
            <select
              value={formData.safety_gate_status}
              onChange={(e) => setFormData({ ...formData, safety_gate_status: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            >
              <option value="unchecked">Unchecked</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Manual Review Status</label>
            <select
              value={formData.manual_review_status}
              onChange={(e) => setFormData({ ...formData, manual_review_status: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Image URL</label>
            <input
              type="text"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          
          <div className="md:col-span-2 border-t border-base-300 pt-4 mt-2">
            <h4 className="text-sm font-black text-base-content mb-4 uppercase tracking-widest">Editor Content</h4>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Short Summary</label>
            <textarea
              value={formData.short_summary}
              onChange={(e) => setFormData({ ...formData, short_summary: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Why Solo Travellers</label>
            <textarea
              value={formData.why_solo_travellers}
              onChange={(e) => setFormData({ ...formData, why_solo_travellers: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Arrival Tips</label>
            <textarea
              value={formData.arrival_tips}
              onChange={(e) => setFormData({ ...formData, arrival_tips: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Local Etiquette Notes</label>
            <textarea
              value={formData.local_etiquette_notes}
              onChange={(e) => setFormData({ ...formData, local_etiquette_notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">LGBTQ+ Notes</label>
            <textarea
              value={formData.lgbtq_notes}
              onChange={(e) => setFormData({ ...formData, lgbtq_notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Women Solo Notes</label>
            <textarea
              value={formData.women_solo_notes}
              onChange={(e) => setFormData({ ...formData, women_solo_notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">After Dark Guidance</label>
            <textarea
              value={formData.after_dark_guidance}
              onChange={(e) => setFormData({ ...formData, after_dark_guidance: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Neighbourhood Shortlist</label>
            <textarea
              value={formData.neighbourhood_shortlist}
              onChange={(e) => setFormData({ ...formData, neighbourhood_shortlist: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Ideal Trip Length</label>
            <input
              type="text"
              value={formData.ideal_trip_length}
              onChange={(e) => setFormData({ ...formData, ideal_trip_length: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>

          <div className="md:col-span-2 border-t border-base-300 pt-4 mt-2">
            <h4 className="text-sm font-black text-base-content mb-4 uppercase tracking-widest">AI Briefing Content</h4>
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Card Summary</label>
            <textarea
              value={formData.ai_card_summary}
              onChange={(e) => setFormData({ ...formData, ai_card_summary: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Safety Brief</label>
            <textarea
              value={formData.ai_safety_brief}
              onChange={(e) => setFormData({ ...formData, ai_safety_brief: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Solo Suitability</label>
            <textarea
              value={formData.ai_solo_suitability}
              onChange={(e) => setFormData({ ...formData, ai_solo_suitability: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Arrival Checklist</label>
            <textarea
              value={formData.ai_arrival_checklist}
              onChange={(e) => setFormData({ ...formData, ai_arrival_checklist: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Neighbourhood Guidance</label>
            <textarea
              value={formData.ai_neighbourhood_guidance}
              onChange={(e) => setFormData({ ...formData, ai_neighbourhood_guidance: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI After Dark</label>
            <textarea
              value={formData.ai_after_dark}
              onChange={(e) => setFormData({ ...formData, ai_after_dark: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Common Friction</label>
            <textarea
              value={formData.ai_common_friction}
              onChange={(e) => setFormData({ ...formData, ai_common_friction: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Quick Facts</label>
            <textarea
              value={formData.ai_quick_facts}
              onChange={(e) => setFormData({ ...formData, ai_quick_facts: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">AI Fallback Summary</label>
            <textarea
              value={formData.ai_fallback_summary}
              onChange={(e) => setFormData({ ...formData, ai_fallback_summary: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
            />
          </div>
        </div>
      </AdminModal>

      {/* View Modal */}
      <AdminModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedDest?.name}
        size="lg"
      >
        {selectedDest && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-base-300">
                <img 
                  src={selectedDest.image_url || 'https://via.placeholder.com/96'} 
                  className="w-full h-full object-cover" 
                  alt={selectedDest.name}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/96'; }}
                />
              </div>
              <div>
                <h4 className="text-2xl font-black text-base-content">{selectedDest.name}</h4>
                <p className="text-base-content/60">{selectedDest.city}, {selectedDest.country}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 bg-success/10 text-success text-xs font-bold rounded">
                    {selectedDest.safety_rating} safety
                  </span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded">
                    {selectedDest.budget_level} budget
                  </span>
                </div>
              </div>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-base-content/70">{selectedDest.description || 'No description available.'}</p>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Bulk Status Change Modal */}
      <AdminModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Change Destinations Status"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => handleBulkStatusChange(selectedRows)} disabled={loading}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Status</label>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </select>
          <p className="text-xs text-base-content/50 mt-2">
            This will update the status for {selectedRows.size} selected destinations.
          </p>
        </div>
      </AdminModal>

      {/* Preview Drawer */}
      <AdminDrawer
        isOpen={showPreviewDrawer}
        onClose={() => setShowPreviewDrawer(false)}
        title={`Preview: ${previewDest?.name}`}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPreviewDrawer(false)}>
              Close
            </Button>
            {previewDest && isPublishReady(previewDest) && (
              <Button variant="primary" onClick={() => {
                handleApproveAndPublish(previewDest.id);
                setShowPreviewDrawer(false);
              }}>
                <Wand2 size={14} className="mr-2" />
                Approve & Publish
              </Button>
            )}
          </>
        }
      >
        {previewDest && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border border-base-300 shrink-0">
                <img 
                  src={previewDest.image_url || 'https://via.placeholder.com/128'} 
                  className="w-full h-full object-cover" 
                  alt={previewDest.name}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/128'; }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-black text-base-content">{previewDest.name}</h3>
                  {previewDest.destination_level && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      previewDest.destination_level === 'country' ? 'bg-brand-vibrant/20 text-brand-vibrant' : 
                      'bg-info/20 text-info'
                    }`}>
                      {previewDest.destination_level}
                    </span>
                  )}
                </div>
                <p className="text-base-content/60 mb-3">{previewDest.city}, {previewDest.country}</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getPublicationBadge(previewDest.publication_status)}`}>
                    {previewDest.publication_status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getSafetyGateBadge(previewDest.safety_gate_status)}`}>
                    Safety: {previewDest.safety_gate_status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    previewDest.manual_review_status === 'approved' ? 'bg-success/20 text-success' :
                    previewDest.manual_review_status === 'rejected' ? 'bg-error/20 text-error' :
                    'bg-warning/20 text-warning'
                  }`}>
                    Review: {previewDest.manual_review_status}
                  </span>
                </div>
              </div>
            </div>

            {isPublishReady(previewDest) && (
              <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-success" />
                <div>
                  <p className="font-bold text-success">Ready to Publish</p>
                  <p className="text-xs text-base-content/60">This destination has passed all checks and is ready to go live.</p>
                </div>
              </div>
            )}

            <div className="border-t border-base-300 pt-4">
              <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-2">Description</h4>
              <p className="text-base-content/80">{previewDest.description || 'No description provided.'}</p>
            </div>

            {previewDest.short_summary && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-2">Summary</h4>
                <p className="text-base-content/80">{previewDest.short_summary}</p>
              </div>
            )}

            {previewDest.ai_card_summary && (
              <div className="border-t border-base-300 pt-4">
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Bot size={14} />AI Briefing
                </h4>
                <p className="text-base-content/80 whitespace-pre-wrap">{previewDest.ai_card_summary}</p>
              </div>
            )}

            <div className="border-t border-base-300 pt-4 grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-black text-base-content/60 uppercase tracking-widest mb-1">Safety Rating</h4>
                <p className="font-bold capitalize">{previewDest.safety_rating}</p>
              </div>
              <div>
                <h4 className="text-xs font-black text-base-content/60 uppercase tracking-widest mb-1">Budget Level</h4>
                <p className="font-bold capitalize">{previewDest.budget_level}</p>
              </div>
              <div>
                <h4 className="text-xs font-black text-base-content/60 uppercase tracking-widest mb-1">Solo Friendly</h4>
                <p className="font-bold">{previewDest.solo_friendly_rating}/5</p>
              </div>
              <div>
                <h4 className="text-xs font-black text-base-content/60 uppercase tracking-widest mb-1">Content Fresh Until</h4>
                <p className="font-bold">{previewDest.content_fresh_until ? new Date(previewDest.content_fresh_until).toLocaleDateString('en-GB') : 'Never'}</p>
              </div>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* Research Pack Drawer */}
      <AdminDrawer
        isOpen={showResearchPackDrawer}
        onClose={() => {
          setShowResearchPackDrawer(false);
          setResearchPack(null);
        }}
        title="Research Pack"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setShowResearchPackDrawer(false);
              setResearchPack(null);
            }}>
              Close
            </Button>
          </>
        }
      >
        {researchPackLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <span className="ml-3 text-base-content/60">Loading research pack...</span>
          </div>
        ) : researchPack ? (
          <div className="space-y-6">
            {/* Can Go Live Status */}
            <div className={`p-4 rounded-xl border ${
              researchPack.can_go_live 
                ? 'bg-success/10 border-success/30' 
                : 'bg-warning/10 border-warning/30'
            }`}>
              <div className="flex items-center gap-2">
                {researchPack.can_go_live ? (
                  <CheckCircle2 size={20} className="text-success" />
                ) : (
                  <AlertTriangle size={20} className="text-warning" />
                )}
                <span className={`font-bold ${researchPack.can_go_live ? 'text-success' : 'text-warning'}`}>
                  {researchPack.can_go_live ? 'Can Go Live' : 'Cannot Go Live Yet'}
                </span>
              </div>
            </div>

            {/* Eligibility Details */}
            {researchPack.eligibility_details && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} />Eligibility Details
                </h4>
                <div className="bg-base-200/30 rounded-xl p-4 space-y-2">
                  {Object.entries(researchPack.eligibility_details).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-base-content/60 capitalize">{key.replace(/_/g, ' ')}</span>
                      {typeof value === 'boolean' ? (
                        value ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-error" />
                      ) : (
                        <span className="text-xs text-base-content/80">{String(value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier 1 Sources */}
            {researchPack.tier1_sources && researchPack.tier1_sources.length > 0 && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Globe size={16} className="text-success" />Tier 1 Sources (Official)
                </h4>
                <div className="space-y-2">
                  {researchPack.tier1_sources.map((source, i) => (
                    <div key={i} className="bg-base-200/30 rounded-lg p-3">
                      <p className="text-sm text-base-content/80">{source.title}</p>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {source.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier 2 Sources */}
            {researchPack.tier2_sources && researchPack.tier2_sources.length > 0 && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-info" />Tier 2 Sources (Verified)
                </h4>
                <div className="space-y-2">
                  {researchPack.tier2_sources.map((source, i) => (
                    <div key={i} className="bg-base-200/30 rounded-lg p-3">
                      <p className="text-sm text-base-content/80">{source.title}</p>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {source.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier 3 Sources */}
            {researchPack.tier3_sources && researchPack.tier3_sources.length > 0 && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <DollarSign size={16} className="text-warning" />Tier 3 Sources (Community)
                </h4>
                <div className="space-y-2">
                  {researchPack.tier3_sources.map((source, i) => (
                    <div key={i} className="bg-base-200/30 rounded-lg p-3">
                      <p className="text-sm text-base-content/80">{source.title}</p>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {source.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summaries */}
            {researchPack.ai_summaries && researchPack.ai_summaries.length > 0 && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Bot size={16} className="text-purple-500" />AI Summaries
                </h4>
                <div className="space-y-3">
                  {researchPack.ai_summaries.map((summary, i) => (
                    <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-xs font-bold text-purple-500 uppercase mb-1">{summary.type}</p>
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">{summary.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Sections */}
            {researchPack.missing_sections && researchPack.missing_sections.length > 0 && (
              <div>
                <h4 className="text-sm font-black text-base-content uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-warning" />Missing Sections
                </h4>
                <div className="flex flex-wrap gap-2">
                  {researchPack.missing_sections.map((section, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-warning/20 text-warning">
                      {section}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-base-content/50">No research pack data available.</p>
        )}
      </AdminDrawer>
    </div>
  );
};

export default DestinationsTable;
