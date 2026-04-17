import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Loading from '../components/Loading';
import { hasAdminAccess } from '../lib/adminAccess';
import { 
  MapPin, 
  Users, 
  BarChart3, 
  Palette, 
  Bell, 
  ShieldAlert, 
  AlertTriangle, 
  Edit2, 
  Activity,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Compass,
  Settings,
  LayoutDashboard,
  Shield,
  AlertCircle,
  Package,
  Zap,
  CreditCard,
  HeadphonesIcon,
  Monitor,
  HeartHandshake,
  Wallet,
  LifeBuoy,
  Megaphone,
  Gauge,
  ShieldCheck,
  Flag,
  HelpCircle,
  BookOpen
} from 'lucide-react';

// Eager load all components (faster)
import AdminDashboard from '../components/admin/AdminDashboard';
import UsersTable from '../components/admin/UsersTable';
import DestinationsTable from '../components/admin/DestinationsTable';
import AuditLogsSection from '../components/admin/AuditLogsSection';
import ErrorReportsSection from '../components/admin/ErrorReportsSection';
import SessionManagement from '../components/admin/SessionManagement';
import GDPRTools from '../components/admin/GDPRTools';
import SystemHealthSection from '../components/admin/SystemHealthSection';
import ModerationSection from '../components/admin/ModerationSection';
import AdminStats from '../components/AdminStats';
import ConfigSection from '../components/admin/ConfigSection';
import ThemeEditor from '../components/admin/ThemeEditor';
import NotificationTemplates from '../components/admin/NotificationTemplates';
import IncidentsSection from '../components/admin/IncidentsSection';
import JobsSection from '../components/admin/JobsSection';
import SafetySection from '../components/admin/SafetySection';
import BillingSection from '../components/admin/BillingSection';
import SupportSection from '../components/admin/SupportSection';
import AnnouncementsSection from '../components/admin/AnnouncementsSection';
import StripeReconciliation from '../components/admin/StripeReconciliation';
import MetricsThresholds from '../components/admin/MetricsThresholds';
import ActionApprovalSection from '../components/admin/ActionApprovalSection';
import AdminReportsSection from '../components/admin/AdminReportsSection';
import FAQManagement from '../components/admin/FAQManagement';
import ChangelogManagement from '../components/admin/ChangelogManagement';

const AdminPage = ({ activeTab }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !hasAdminAccess(user)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'destinations':
        return <DestinationsTable />;
      case 'users':
        return <UsersTable />;
      case 'analytics':
        return <AdminStats />;
      case 'theme':
        return <ThemeEditor />;
      case 'notifications':
        return <NotificationTemplates />;
      case 'audit':
        return <AuditLogsSection />;
      case 'errors':
        return <ErrorReportsSection />;
      case 'moderation':
        return <ModerationSection />;
      case 'health':
        return <SystemHealthSection />;
      case 'config':
        return <ConfigSection />;
      case 'sessions':
        return <SessionManagement />;
      case 'gdpr':
        return <GDPRTools />;
      case 'incidents':
        return <IncidentsSection />;
      case 'jobs':
        return <JobsSection />;
      case 'safety':
        return <SafetySection />;
      case 'billing':
        return <BillingSection />;
      case 'reconciliation':
        return <StripeReconciliation />;
      case 'support':
        return <SupportSection />;
      case 'reports':
        return <ReportsQueueSection />;
      case 'announcements':
        return <AnnouncementsSection />;
      case 'metrics':
        return <MetricsThresholds />;
      case 'actions':
        return <ActionApprovalSection />;
      case 'reports':
        return <AdminReportsSection />;
      case 'faq':
        return <FAQManagement />;
      case 'cl':
        return <ChangelogManagement />;
      default:
        return <AdminDashboard />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: 'Overview and quick actions' };
      case 'destinations':
        return { title: 'Destinations', subtitle: 'Manage your travel destinations' };
      case 'users':
        return { title: 'Travelers', subtitle: 'Manage user accounts and permissions' };
      case 'analytics':
        return { title: 'Intelligence', subtitle: 'View analytics and reports' };
      case 'theme':
        return { title: 'Theme', subtitle: 'Customize application appearance' };
      case 'notifications':
        return { title: 'Notifications', subtitle: 'Manage notification systems' };
      case 'audit':
        return { title: 'Audit Logs', subtitle: 'View system audit trails' };
      case 'errors':
        return { title: 'Error Reports', subtitle: 'Monitor system errors' };
      case 'moderation':
        return { title: 'Moderation', subtitle: 'Content moderation queue' };
      case 'health':
        return { title: 'System Health', subtitle: 'Monitor system status' };
      case 'config':
        return { title: 'Config', subtitle: 'Feature flags and integrations' };
      case 'sessions':
        return { title: 'Sessions', subtitle: 'Manage active user sessions' };
      case 'gdpr':
        return { title: 'GDPR', subtitle: 'Privacy and data management' };
      case 'incidents':
        return { title: 'Incidents', subtitle: 'Manage launch blockers and issues' };
      case 'jobs':
        return { title: 'Jobs & Webhooks', subtitle: 'Monitor failed jobs and webhooks' };
      case 'safety':
        return { title: 'Safety Operations', subtitle: 'Monitor SOS events and check-in escalations' };
      case 'billing':
        return { title: 'Billing', subtitle: 'Payment failures and subscription activity' };
      case 'reconciliation':
        return { title: 'Reconciliation', subtitle: 'Stripe entitlement reconciliation' };
      case 'support':
        return { title: 'Support', subtitle: 'Support tickets and user issues' };
      case 'reports':
        return { title: 'Content Reports', subtitle: 'User-submitted content and safety reports' };
      case 'faq':
        return { title: 'FAQ Management', subtitle: 'Manage help centre articles' };
      case 'cl':
        return { title: 'Changelog', subtitle: 'Manage release notes and changelog entries' };
      case 'announcements':
        return { title: 'Announcements', subtitle: 'Site-wide announcements and banners' };
      case 'metrics':
        return { title: 'Metrics', subtitle: 'Monitor system metrics and thresholds' };
      case 'actions':
        return { title: 'Action Approvals', subtitle: 'Review and approve sensitive admin actions' };
      default:
        return { title: 'Dashboard', subtitle: 'Admin overview' };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in bg-base-100 text-base-content min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-base-content tracking-tighter">{pageInfo.title}</h1>
        <p className="text-base-content/60 font-medium">{pageInfo.subtitle}</p>
      </div>
      {renderContent()}
    </div>
  );
};

const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('adminSidebarCollapsed');
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('adminSidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const tabs = [
    // Main
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-sky-500', bg: 'bg-sky-500/10', hover: 'hover:bg-sky-500/10 hover:text-sky-600' },
    { id: 'destinations', label: 'Destinations', icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-500/10', hover: 'hover:bg-emerald-500/10 hover:text-emerald-600' },
    { id: 'users', label: 'Travelers', icon: Users, color: 'text-sky-500', bg: 'bg-sky-500/10', hover: 'hover:bg-sky-500/10 hover:text-sky-600' },
    { id: 'analytics', label: 'Intelligence', icon: BarChart3, color: 'text-violet-500', bg: 'bg-violet-500/10', hover: 'hover:bg-violet-500/10 hover:text-violet-600' },
    
    // Operations
    { id: 'incidents', label: 'Incidents', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', hover: 'hover:bg-red-500/10 hover:text-red-600' },
    { id: 'jobs', label: 'Jobs & Webhooks', icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10', hover: 'hover:bg-amber-500/10 hover:text-amber-600' },
    { id: 'safety', label: 'Safety', icon: HeartHandshake, color: 'text-rose-500', bg: 'bg-rose-500/10', hover: 'hover:bg-rose-500/10 hover:text-rose-600' },
    { id: 'errors', label: 'Errors', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', hover: 'hover:bg-red-500/10 hover:text-red-600' },
    { id: 'health', label: 'Health', icon: Activity, color: 'text-lime-500', bg: 'bg-lime-500/10', hover: 'hover:bg-lime-500/10 hover:text-lime-600' },
    
    // Management
    { id: 'sessions', label: 'Sessions', icon: Monitor, color: 'text-cyan-500', bg: 'bg-cyan-500/10', hover: 'hover:bg-cyan-500/10 hover:text-cyan-600' },
    { id: 'moderation', label: 'Moderation', icon: Edit2, color: 'text-orange-500', bg: 'bg-orange-500/10', hover: 'hover:bg-orange-500/10 hover:text-orange-600' },
    { id: 'gdpr', label: 'Privacy/GDPR', icon: Shield, color: 'text-violet-500', bg: 'bg-violet-500/10', hover: 'hover:bg-violet-500/10 hover:text-violet-600' },
    { id: 'billing', label: 'Billing', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10', hover: 'hover:bg-emerald-500/10 hover:text-emerald-600' },
    { id: 'reconciliation', label: 'Reconciliation', icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10', hover: 'hover:bg-violet-500/10 hover:text-violet-600' },
    { id: 'support', label: 'Support', icon: LifeBuoy, color: 'text-blue-500', bg: 'bg-blue-500/10', hover: 'hover:bg-blue-500/10 hover:text-blue-600' },
    { id: 'reports', label: 'Reports', icon: Flag, color: 'text-red-500', bg: 'bg-red-500/10', hover: 'hover:bg-red-500/10 hover:text-red-600' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, color: 'text-sky-500', bg: 'bg-sky-500/10', hover: 'hover:bg-sky-500/10 hover:text-sky-600' },
    { id: 'cl', label: 'Changelog', icon: BookOpen, color: 'text-violet-500', bg: 'bg-violet-500/10', hover: 'hover:bg-violet-500/10 hover:text-violet-600' },
    { id: 'actions', label: 'Approvals', icon: ShieldCheck, color: 'text-violet-500', bg: 'bg-violet-500/10', hover: 'hover:bg-violet-500/10 hover:text-violet-600' },
    
    // Settings
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10', hover: 'hover:bg-amber-500/10 hover:text-amber-600' },
    { id: 'metrics', label: 'Metrics', icon: Gauge, color: 'text-cyan-500', bg: 'bg-cyan-500/10', hover: 'hover:bg-cyan-500/10 hover:text-cyan-600' },
    { id: 'theme', label: 'Theme', icon: Palette, color: 'text-pink-500', bg: 'bg-pink-500/10', hover: 'hover:bg-pink-500/10 hover:text-pink-600' },
    { id: 'config', label: 'Config', icon: Settings, color: 'text-sky-500', bg: 'bg-sky-500/10', hover: 'hover:bg-sky-500/10 hover:text-sky-600' },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'text-amber-500', bg: 'bg-amber-500/10', hover: 'hover:bg-amber-500/10 hover:text-amber-600' },
    
    // Legacy
    { id: 'audit', label: 'Audit Logs', icon: ShieldAlert, color: 'text-cyan-500', bg: 'bg-cyan-500/10', hover: 'hover:bg-cyan-500/10 hover:text-cyan-600' }
  ];

  useEffect(() => {
    if (user && !hasAdminAccess(user)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!routeTab) {
      setActiveTab('dashboard');
      return;
    }

    if (tabs.find(tab => tab.id === routeTab)) {
      setActiveTab(routeTab);
      return;
    }

    navigate('/admin/dashboard', { replace: true });
  }, [navigate, routeTab, tabs]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    navigate(`/admin/${tabId}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-base-200 via-base-200 to-sky-500/5">
      {/* Mobile Menu Toggle */}
      <button
        className="fixed top-4 left-4 z-50 p-2.5 bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 transition-all lg:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40
        flex flex-col
        bg-gradient-to-b from-base-100 via-base-100 to-sky-500/[0.02]
        text-base-content
        border-r border-sky-500/20
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-[72px]' : 'w-72'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Decorative gradient line at top */}
        <div className="h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-500" />

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-sky-500/10 bg-sky-500/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
              <Compass size={22} />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-base-content text-lg tracking-tight truncate">SoloCompass</h2>
                <p className="text-xs text-sky-600/70 font-medium truncate">Admin Command Center</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 hover:bg-sky-500/10 rounded-xl transition-all text-sky-500/60 hover:text-sky-500 hover:shadow-sm shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={20} className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group relative flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all duration-200
                  ${activeTab === tab.id 
                    ? `${tab.bg} ${tab.color} shadow-sm` 
                    : 'hover:bg-sky-500/5 hover:text-base-content/80 text-base-content/50'
                  }
                `}
              >
                {activeTab === tab.id && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 ${tab.color.replace('text-', 'bg-')} rounded-r-full`} />
                )}
                
                <div className={`
                  flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200
                  ${activeTab === tab.id 
                    ? `${tab.bg} ${tab.color}` 
                    : 'bg-base-200/50 group-hover:bg-sky-500/10 text-base-content/40 group-hover:text-sky-500'
                  }
                `}>
                  <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                </div>
                
                {!sidebarCollapsed && (
                  <span className={`font-semibold text-sm truncate ${activeTab === tab.id ? 'text-base-content' : ''}`}>
                    {tab.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Divider with gradient */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />

        {/* Footer - User Info */}
        <div className="p-2 bg-sky-500/[0.02]">
          <div className={`
            flex items-center gap-2 p-2 rounded-xl bg-base-200/50 hover:bg-sky-500/10 transition-colors
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
              {user?.name?.[0] || user?.email[0].toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base-content text-sm truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-sky-600/70 truncate">{user?.role || 'Administrator'}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/10 rounded-xl transition-all text-base-content/40 hover:text-red-500 hover:shadow-sm shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
          
          {/* Branding footer */}
          {!sidebarCollapsed && (
            <div className="mt-2 p-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-sky-500/10">
                <p className="text-[10px] text-center text-base-content/40 font-medium">
                  SoloCompass v1.0
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-sky-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AdminPage activeTab={activeTab} />
      </main>
    </div>
  );
};

export default AdminLayout;
