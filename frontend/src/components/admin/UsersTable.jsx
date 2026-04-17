import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AdminDataTable from './AdminDataTable';
import AdminModal from './AdminModal';
import Button from '../Button';
import UserActivityTimeline from './UserActivityTimeline';
import ConfirmDialog from '../ConfirmDialog';
import { 
  User, 
  Edit2, 
  Trash2, 
  Eye, 
  RefreshCw,
  Shield,
  Mail,
  Calendar,
  MapPin,
  ToggleLeft,
  Activity,
  Download,
  EyeOff,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';

const UsersTable = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [userTrips, setUserTrips] = useState([]);
  const [userContacts, setUserContacts] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [bulkRole, setBulkRole] = useState('user');
  const [activeTab, setActiveTab] = useState('profile');
  const [showGDPRModal, setShowGDPRModal] = useState(false);
  const [gdprAction, setGdprAction] = useState(null);
  const [gdprLoading, setGdprLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, ids: [] });
  const limit = 10;

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm, filterType]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = { search: searchTerm, limit, offset };
      if (filterType === 'admins') {
        params.role = 'admin';
      }
      const response = await api.get('/users', { params });
      setUsers(response.data.data?.users || []);
      setTotal(response.data.data?.total || 0);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (user) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    setShowViewModal(true);
    setActiveTab('profile');
    
    try {
      const [userRes, tripsRes, contactsRes] = await Promise.all([
        api.get(`/users/${user.id}`),
        api.get('/trips', { params: { user_id: user.id } }),
        api.get('/emergency-contacts', { params: { user_id: user.id } })
      ]);
      
      setUserDetails(userRes.data.data?.user);
      setUserTrips(tripsRes.data.data?.trips || tripsRes.data.data || []);
      setUserContacts(contactsRes.data.data?.contacts || contactsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      await api.put(`/users/${selectedUser.id}`, { role: selectedUser.role });
      toast.success('User role updated');
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmDialog({ open: true, action: 'single', ids: [id] });
  };

  const executeDelete = async () => {
    const { action, ids } = confirmDialog;
    setConfirmDialog({ open: false, action: null, ids: [] });
    try {
      if (action === 'single') {
        await api.delete(`/users/${ids[0]}`);
        toast.success('User removed');
      } else {
        setLoading(true);
        await Promise.all(ids.map(id => api.delete(`/users/${id}`)));
        toast.success(`${ids.length} travelers removed`);
        setSelectedRows(new Set());
      }
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to delete user';
      toast.error(msg);
    } finally {
      setLoading(false);
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
    const idsToDelete = selectedIndices.map(idx => users[idx]?.id).filter(Boolean);
    setConfirmDialog({ open: true, action: 'bulk', ids: idsToDelete });
  };

  const handleBulkRoleChange = async (selectedIndices) => {
    const idsToUpdate = selectedIndices.map(idx => users[idx]?.id).filter(Boolean);
    try {
      setLoading(true);
      await Promise.all(idsToUpdate.map(id => 
        api.put(`/users/${id}`, { role: bulkRole })
      ));
      toast.success(`${idsToUpdate.length} travelers updated`);
      setSelectedRows(new Set());
      setShowRoleModal(false);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update users');
    } finally {
      setLoading(false);
    }
  };

  const handleGDPRAction = async (user, action) => {
    setSelectedUser(user);
    setGdprAction(action);
    
    if (action === 'delete') {
      setShowDeleteConfirm(true);
    } else {
      setGdprLoading(true);
      setShowGDPRModal(true);
      
      try {
        let endpoint = '';
        let method = 'get';
        
        switch (action) {
          case 'export':
            endpoint = `/admin/users/${user.id}/export`;
            break;
          case 'anonymize':
            endpoint = `/admin/users/${user.id}/anonymize`;
            method = 'post';
            break;
          default:
            return;
        }
        
        if (action === 'export') {
          const response = await api.get(endpoint);
          if (response.data.data) {
            const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `user-${user.id}-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('User data exported successfully');
          }
        } else {
          await api.post(endpoint);
          toast.success(`User data ${action === 'anonymize' ? 'anonymized' : 'exported'} successfully`);
        }
        
        setShowGDPRModal(false);
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || `Failed to ${action} user data`);
      } finally {
        setGdprLoading(false);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    
    setGdprLoading(true);
    try {
      await api.delete(`/admin/users/${selectedUser.id}/data`);
      toast.success('User data deleted successfully');
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user data');
    } finally {
      setGdprLoading(false);
    }
  };

  const bulkActions = [
    {
      label: 'Change Role',
      icon: <Shield size={14} />,
      variant: 'warning',
      onClick: () => setShowRoleModal(true)
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger',
      onClick: handleBulkDelete
    }
  ];

  const columns = useMemo(() => [
    {
      key: 'user',
      label: 'Traveler',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shadow-inner border border-primary/20">
            {row.name?.[0] || row.email[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-base-content leading-none mb-1">{row.name || 'Set Profile'}</p>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-tight">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (_, row) => (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${row.role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-base-300 text-base-content/50'}`}>
          {row.role}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs font-bold text-base-content/30">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button 
            onClick={() => handleView(row)} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-primary"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={() => handleGDPRAction(row, 'export')} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-sky-500"
            title="Export User Data"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={() => handleGDPRAction(row, 'anonymize')} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-amber-500"
            title="Anonymize User Data"
          >
            <EyeOff size={16} />
          </button>
          <button 
            onClick={() => handleEdit(row)} 
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-accent"
            title={row.role === 'admin' ? 'Demote' : 'Promote'}
          >
            <Shield size={16} />
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            className="p-2 hover:bg-base-100 hover:shadow-lg rounded-xl transition-all text-base-content/40 hover:text-error"
            title="Delete User"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ], []);

  const filterOptions = [
    { value: '', label: 'All Users' },
    { value: 'admins', label: 'Admins Only' }
  ];

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDialog({ open: false, action: null, ids: [] })}
        title={confirmDialog.action === 'bulk' ? `Delete ${confirmDialog.ids.length} Travelers?` : 'Delete Traveler?'}
        description="This will permanently delete the account(s) and all associated itineraries. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
      <AdminDataTable
        data={users}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={handlePageChange}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRefresh={fetchUsers}
        searchPlaceholder="Search travelers..."
        filterOptions={filterOptions}
        emptyMessage="No users found"
        emptyIcon={User}
        showCheckboxes={true}
        onSelectionChange={handleSelectionChange}
        bulkActions={bulkActions}
      />

      {/* Edit Modal */}
      <AdminModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User Role"
        size="sm"
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
        <div>
          <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Role</label>
          <select
            value={selectedUser?.role || 'user'}
            onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </AdminModal>

      {/* View Modal */}
      <AdminModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setUserDetails(null);
          setUserTrips([]);
          setUserContacts([]);
        }}
        title={selectedUser?.name || selectedUser?.email}
        size="lg"
      >
        {loadingDetails ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="animate-spin text-primary" size={32} />
          </div>
        ) : userDetails ? (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-base-300">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'profile'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/50 hover:text-base-content'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User size={16} />
                  Profile
                </div>
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'activity'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-base-content/50 hover:text-base-content'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} />
                  Activity
                </div>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' ? (
              <div className="space-y-6">
                {/* User Profile Header */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-black text-xl shadow-inner border border-primary/20">
                    {userDetails.name?.[0] || userDetails.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-black text-base-content">{userDetails.name || 'No name set'}</h4>
                    <p className="text-base-content/60">{userDetails.email}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${userDetails.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-base-300 text-base-content/60'}`}>
                        {userDetails.role}
                      </span>
                      {userDetails.is_premium && (
                        <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-bold rounded">
                          Premium
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-base-200/30 rounded-xl">
                    <div className="flex items-center gap-2 text-base-content/60 mb-1">
                      <Calendar size={14} />
                      <span className="text-xs font-bold">Joined</span>
                    </div>
                    <p className="font-bold text-base-content">
                      {new Date(userDetails.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="p-4 bg-base-200/30 rounded-xl">
                    <div className="flex items-center gap-2 text-base-content/60 mb-1">
                      <Mail size={14} />
                      <span className="text-xs font-bold">Email Verified</span>
                    </div>
                    <p className="font-bold text-base-content">
                      {userDetails.email_verified ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {/* Trips */}
                <div>
                  <h5 className="text-sm font-black text-base-content mb-3">Trips ({userTrips.length})</h5>
                  {userTrips.length > 0 ? (
                    <div className="space-y-2">
                      {userTrips.slice(0, 5).map(trip => (
                        <div key={trip.id} className="flex items-center justify-between p-3 bg-base-200/30 rounded-xl">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-primary" />
                            <span className="font-medium text-base-content">{trip.name || trip.destination}</span>
                          </div>
                          <span className="text-xs text-base-content/50">{trip.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-base-content/40 text-sm">No trips yet</p>
                  )}
                </div>

                {/* Emergency Contacts */}
                <div>
                  <h5 className="text-sm font-black text-base-content mb-3">Emergency Contacts ({userContacts.length})</h5>
                  {userContacts.length > 0 ? (
                    <div className="space-y-2">
                      {userContacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-3 bg-base-200/30 rounded-xl">
                          <div>
                            <p className="font-medium text-base-content">{contact.name}</p>
                            <p className="text-xs text-base-content/50">{contact.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-base-content/40 text-sm">No emergency contacts</p>
                  )}
                </div>
              </div>
            ) : (
              <UserActivityTimeline user={selectedUser} />
            )}
          </div>
        ) : (
          <div className="text-center p-12 text-base-content/40">
            <User size={48} className="mx-auto mb-2 opacity-30" />
            <p>No user details available</p>
          </div>
        )}
      </AdminModal>

      {/* Bulk Role Change Modal */}
      <AdminModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change Travelers Role"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => handleBulkRoleChange(selectedRows)} disabled={loading}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-black text-base-content/60 uppercase tracking-widest mb-2">Role</label>
          <select
            value={bulkRole}
            onChange={(e) => setBulkRole(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm font-medium"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <p className="text-xs text-base-content/50 mt-2">
            This will update the role for {selectedRows.size} selected travelers.
          </p>
        </div>
      </AdminModal>

      {/* GDPR Action Modal (Export/Anonymize) */}
      <AdminModal
        isOpen={showGDPRModal}
        onClose={() => setShowGDPRModal(false)}
        title={gdprAction === 'export' ? 'Export User Data' : 'Anonymize User Data'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowGDPRModal(false)}>
              Cancel
            </Button>
          </>
        }
      >
        {gdprLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="animate-spin text-sky-500" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base-content/70">
              {gdprAction === 'export' 
                ? 'This will export all user data including trips, check-ins, and profile information.'
                : 'This will remove all personally identifiable information (PII) while keeping anonymized analytics data.'
              }
            </p>
            <div className="p-4 bg-sky-500/10 rounded-xl border border-sky-500/20">
              <div className="flex items-start gap-3">
                {gdprAction === 'export' ? (
                  <Download size={18} className="text-sky-500 mt-0.5" />
                ) : (
                  <EyeOff size={18} className="text-amber-500 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-base-content text-sm">
                    {gdprAction === 'export' ? 'Data Export (JSON)' : 'Anonymization'}
                  </p>
                  <p className="text-xs text-base-content/60 mt-1">
                    {gdprAction === 'export' 
                      ? 'A JSON file with all user data will be downloaded.'
                      : 'Name, email, phone, and profile data will be replaced with anonymized values.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      {/* GDPR Delete Confirmation Modal */}
      <AdminModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmText('');
        }}
        title="Delete User Data (GDPR)"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmText('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="error" 
              onClick={handleDeleteConfirm} 
              disabled={deleteConfirmText !== 'DELETE' || gdprLoading}
            >
              {gdprLoading ? 'Deleting...' : 'Delete All Data'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <div className="flex items-start gap-3">
              <Trash2 size={18} className="text-red-500 mt-0.5" />
              <div>
                <p className="font-bold text-red-500 text-sm">Warning: Permanent Action</p>
                <p className="text-xs text-base-content/60 mt-1">
                  This will permanently delete all user data. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-base-content/60 mb-2">
              To confirm, type <span className="font-bold text-base-content">DELETE</span> below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-4 py-2.5 rounded-xl border border-base-300 bg-base-100 focus:ring-2 focus:ring-error/50 focus:border-error outline-none text-sm font-medium"
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default UsersTable;