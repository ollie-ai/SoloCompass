import { useState, useMemo } from 'react'
import { useWidgetState } from '../../../hooks/useWidgetState'
import { motion } from 'framer-motion'
import { Shield, Clock, MapPin, Phone, Compass, Cross, CheckCircle, Bell, DollarSign, CloudSun, Wallet, Siren, Calendar, AlertTriangle, ShieldCheck, UserCircle, ChevronDown, ChevronRight, EyeOff, RefreshCw, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import TripImageHero from '../TripImageHero'
import DashboardModuleGrid, { ModuleCard } from '../DashboardModuleGrid'
import CollapsibleWidget from '../CollapsibleWidget'
import WidgetManagementPanel from '../WidgetManagementPanel'
import StatusBadge from '../StatusBadge'
import SafetyStatusCard from '../widgets/SafetyStatusCard'
import AccommodationCard from '../widgets/AccommodationCard'
import BookingsCard from '../widgets/BookingsCard'
import DocumentsCard from '../widgets/DocumentsCard'
import BudgetSnapshotWidget from '../widgets/BudgetSnapshotWidget'
import LocalEmergencyCard from '../widgets/LocalEmergencyCard'
import AdvisorySummaryWidget from '../widgets/AdvisorySummaryWidget'
import DashboardSkeleton from '../DashboardSkeleton'
import EsimWidget from '../../EsimWidget'
import { formatFreshness, getDataFreshness, DATA_HEALTH_STATUS } from '../../../lib/dashboardStatusSystem'

// Widget configuration for the management panel
const WIDGET_CONFIG = {
  safetyNow: { title: 'Safety Status', icon: ShieldCheck, accentColor: 'emerald' },
  emergencyNumbers: { title: 'Emergency Numbers', icon: Siren, accentColor: 'red' },
  usefulNow: { title: 'Useful Now', icon: Clock, accentColor: 'sky' },
  advisories: { title: 'Travel Advisories', icon: AlertTriangle, accentColor: 'amber' },
  accommodation: { title: 'Accommodation', icon: MapPin, accentColor: 'blue' },
  bookings: { title: 'Bookings', icon: Calendar, accentColor: 'emerald' },
  budget: { title: 'Budget', icon: Wallet, accentColor: 'emerald' },
  documents: { title: 'Documents', icon: CheckCircle, accentColor: 'blue' },
  esim: { title: 'eSIM Data', icon: Wifi, accentColor: 'indigo' },
}

const LiveTripDashboard = ({ trip = null, alerts = [], stats = {}, safetyData = {}, timeWeather = null }) => {
  // 1. Hooks first - get widget state and helper functions
  const [widgetState, setWidgetState, { 
    reorderWidgets, 
    unhideWidget, 
    toggleExpand, 
    expandAll, 
    collapseAll, 
    resetToDefaults,
    orderedKeys,
    defaultWidgetKeys 
  }] = useWidgetState('live_trip', {
    safetyNow: { expanded: true, hidden: false },
    usefulNow: { expanded: true, hidden: false },
    advisories: { expanded: true, hidden: false },
    emergencyNumbers: { expanded: true, hidden: false },
    accommodation: { expanded: true, hidden: false },
    bookings: { expanded: false, hidden: false },
    budget: { expanded: true, hidden: false },
    documents: { expanded: false, hidden: false },
    esim: { expanded: true, hidden: false },
  })

  const dayNumber = useMemo(() => {
    if (!trip?.start_date) return 1
    const now = new Date()
    const start = new Date(trip.start_date)
    const calculated = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)) + 1)
    return Math.min(calculated, 60)
  }, [trip?.start_date])
  
  const totalDays = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return null
    const start = new Date(trip.start_date)
    const end = new Date(trip.end_date)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  }, [trip?.start_date, trip?.end_date])
  
  const tripProgress = totalDays ? Math.round((dayNumber / totalDays) * 100) : 0

  const toggleHide = (key) => {
    setWidgetState(prev => ({ ...prev, [key]: { ...prev[key], hidden: true } }))
  }

  // Calculate visible widget count
  const visibleWidgetCount = useMemo(() => {
    return Object.keys(WIDGET_CONFIG).filter(key => !widgetState[key]?.hidden).length
  }, [widgetState]);

  // 2. Guard against invalid data AFTER hooks
  if (!trip || !trip.id) return <DashboardSkeleton />

  const destinationAlerts = (Array.isArray(alerts) ? alerts : []).filter(
    (a) => a.country?.toLowerCase() === trip?.destination?.toLowerCase()
  )

  const hasActiveAlerts = destinationAlerts?.length > 0
  
  return (
    <div className="space-y-6">
      <TripImageHero
        trip={trip} title={`${trip?.destination || "Your Trip"} — Day ${dayNumber}`}
        subtitle={`Today's plan, check-ins, and safety tools at a glance.`}
        primaryCta={{ label: "View trip details", href: `/trips/${trip?.id}` }}
        secondaryCta={{ label: "Check in now", href: "/safety" }}
        extraCtas={[
          { label: "🆘 SOS", href: "/safety?sos=1" },
          { label: "✦ Ask Atlas", href: "/dashboard?atlas=1" },
        ]}
        overlay="subtle"
        statusPanel={
          <div className="space-y-3">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/20 border border-emerald-500/30 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Live</span>
              </div>
              <div className="text-3xl font-black text-base-content">Day {dayNumber}</div>
              {totalDays && <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">of {totalDays} days</p>}
            </div>
            {totalDays && (
              <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${tripProgress}%` }} />
              </div>
            )}
          </div>
        }
        tripState="live_trip"
      />

      {/* Widget Management Panel */}
      <WidgetManagementPanel
        widgetStates={widgetState}
        widgetConfig={WIDGET_CONFIG}
        visibleCount={visibleWidgetCount}
        totalCount={Object.keys(WIDGET_CONFIG).length}
        onUnhide={unhideWidget}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onReset={resetToDefaults}
        defaultWidgetKeys={defaultWidgetKeys}
      />

      <DashboardModuleGrid 
        columns={2} 
        widgetStates={widgetState} 
        setWidgetState={setWidgetState}
        onReorder={reorderWidgets}
        orderedKeys={orderedKeys}
        draggable={true}
      >
        <CollapsibleWidget
          key="safetyNow" title="Safety Status" icon={ShieldCheck}
          expanded={widgetState.safetyNow?.expanded} collapsible={true} hideable={true} hidden={widgetState.safetyNow?.hidden}
          onToggleExpand={() => toggleExpand('safetyNow')} onHide={() => toggleHide('safetyNow')} accentColor="emerald"
          draggable={true}
        >
          <SafetyStatusCard hasContacts={safetyData?.contacts?.length > 0} contactCount={safetyData?.contacts?.length || 0} checkInScheduled={safetyData?.checkInScheduled} checkInSchedule={safetyData?.checkInSchedule} showHeading={true} />
        </CollapsibleWidget>

        <CollapsibleWidget
          key="emergencyNumbers" title="Emergency Numbers" icon={Siren}
          expanded={widgetState.emergencyNumbers?.expanded} collapsible={true} hideable={true} hidden={widgetState.emergencyNumbers?.hidden}
          onToggleExpand={() => toggleExpand('emergencyNumbers')} onHide={() => toggleHide('emergencyNumbers')} accentColor="red"
          draggable={true}
        >
          <LocalEmergencyCard destination={trip?.destination} showHeading={false} />
        </CollapsibleWidget>

        <CollapsibleWidget
          key="usefulNow" title="Useful Now" icon={Clock}
          expanded={widgetState.usefulNow?.expanded} collapsible={true} hideable={true} hidden={widgetState.usefulNow?.hidden}
          onToggleExpand={() => toggleExpand('usefulNow')} onHide={() => toggleHide('usefulNow')} accentColor="sky"
          draggable={true}
        >
          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 rounded-xl bg-base-200/50 border border-base-300">
                <p className="text-[10px] text-base-content/40 uppercase tracking-wider mb-1">Local Time</p>
                <p className="text-lg font-black">{timeWeather?.timezone?.localTime || '—'}</p>
             </div>
             <div className="p-3 rounded-xl bg-base-200/50 border border-base-300">
                <p className="text-[10px] text-base-content/40 uppercase tracking-wider mb-1">Weather</p>
                <p className="text-lg font-black">{timeWeather?.weather?.temp || '—'}°</p>
             </div>
          </div>
        </CollapsibleWidget>

        <CollapsibleWidget
          key="esim" title="eSIM Data" icon={Wifi}
          expanded={widgetState.esim?.expanded} collapsible={true} hideable={true} hidden={widgetState.esim?.hidden}
          onToggleExpand={() => toggleExpand('esim')} onHide={() => toggleHide('esim')} accentColor="indigo"
          draggable={true}
        >
          <EsimWidget destination={trip?.destination} compact tripId={trip?.id} />
        </CollapsibleWidget>

        <CollapsibleWidget
          key="advisories" title="Travel Advisories" icon={AlertTriangle}
          expanded={widgetState.advisories?.expanded} collapsible={true} hideable={true} hidden={widgetState.advisories?.hidden}
          onToggleExpand={() => toggleExpand('advisories')} onHide={() => toggleHide('advisories')} accentColor="amber"
          badge={hasActiveAlerts ? { label: `${destinationAlerts.length} Active`, type: 'error' } : null}
          draggable={true}
        >
          <AdvisorySummaryWidget destination={trip?.destination} />
        </CollapsibleWidget>

        <CollapsibleWidget
          key="accommodation" title="Accommodation" icon={MapPin}
          expanded={widgetState.accommodation?.expanded} collapsible={true} hideable={true} hidden={widgetState.accommodation?.hidden}
          onToggleExpand={() => toggleExpand('accommodation')} onHide={() => toggleHide('accommodation')} accentColor="blue"
          draggable={true}
        >
          <AccommodationCard tripId={trip?.id} accommodation={trip?.accommodation} showHeading={false} />
        </CollapsibleWidget>

        {trip?.bookings?.length > 0 && (
          <CollapsibleWidget
            key="bookings" title="Bookings" icon={Calendar}
            expanded={widgetState.bookings?.expanded} collapsible={true} hideable={true} hidden={widgetState.bookings?.hidden}
            onToggleExpand={() => toggleExpand('bookings')} onHide={() => toggleHide('bookings')}
            draggable={true}
          >
            <BookingsCard tripId={trip?.id} bookings={trip?.bookings} showHeading={false} />
          </CollapsibleWidget>
        )}

        {trip?.budget && (
          <CollapsibleWidget
            key="budget" title="Budget" icon={Wallet}
            expanded={widgetState.budget?.expanded} collapsible={true} hideable={true} hidden={widgetState.budget?.hidden}
            onToggleExpand={() => toggleExpand('budget')} onHide={() => toggleHide('budget')} accentColor="emerald"
            draggable={true}
          >
            <BudgetSnapshotWidget tripId={trip?.id} budget={trip?.budget} />
          </CollapsibleWidget>
        )}
      </DashboardModuleGrid>
    </div>
  )
}

export default LiveTripDashboard