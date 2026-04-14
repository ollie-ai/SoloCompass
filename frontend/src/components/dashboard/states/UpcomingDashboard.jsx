import { useState, useMemo, useEffect, useCallback } from 'react'
import { useWidgetState } from '../../../hooks/useWidgetState'
import { motion } from 'framer-motion'
import { Calendar, Shield, Briefcase, DollarSign, ListChecks, Clock, CloudSun, Globe, Wifi, Building2, Plane, AlertCircle, CheckCircle, EyeOff, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Lock } from 'lucide-react'
import TripImageHero from '../TripImageHero'
import DashboardModuleGrid, { ModuleCard } from '../DashboardModuleGrid'
import CollapsibleWidget from '../CollapsibleWidget'
import WidgetManagementPanel from '../WidgetManagementPanel'
import Button from '../../Button'
import ChecklistCard from '../widgets/ChecklistCard'
import NextBestActionCard from '../widgets/NextBestActionCard'
import AdvisorySummaryWidget from '../widgets/AdvisorySummaryWidget'
import SafetyStatusCard from '../widgets/SafetyStatusCard'
import StatusBadge from '../StatusBadge'
import BudgetSnapshotWidget from '../widgets/BudgetSnapshotWidget'
import LocalEmergencyCard from '../widgets/LocalEmergencyCard'
import GuardianStatusCard from '../widgets/GuardianStatusCard'
import SafeHavenCard from '../widgets/SafeHavenCard'
import DashboardSkeleton from '../DashboardSkeleton'
import { getTripChecklist, updateTripChecklist } from '../../../lib/api'
import { computeReadiness } from '../../../lib/dashboardStateResolver'
import { formatFreshness, DATA_HEALTH_STATUS, getDataFreshness } from '../../../lib/dashboardStatusSystem'
import { useAuthStore } from '../../../stores/authStore'
import { isGuardianPlus } from '../../../lib/subscriptionAccess'

// Widget configuration for the management panel
const WIDGET_CONFIG = {
  nextBestAction: { title: 'Next Best Action', icon: AlertCircle, accentColor: 'amber' },
  checklist: { title: 'Before You Go', icon: ListChecks, accentColor: 'sky' },
  safetySetup: { title: 'Safety & Contacts', icon: Shield, accentColor: 'violet' },
  travelDayPrep: { title: 'Travel-Day Prep', icon: CloudSun, accentColor: 'emerald' },
  tripEssentials: { title: 'Trip Essentials', icon: Briefcase, accentColor: 'blue' },
  budgetSnapshot: { title: 'Budget', icon: DollarSign, accentColor: 'emerald' },
  safeHavens: { title: 'Safe Havens', icon: Shield, accentColor: 'amber' },
  advisorySummary: { title: 'Travel Advisories', icon: AlertCircle, accentColor: 'amber' },
}

const FreshnessLabel = ({ timestamp, label = 'Updated' }) => {
  const freshness = getDataFreshness(timestamp, 30)
  const timeAgo = formatFreshness(timestamp)
  if (!timeAgo) return null
  const freshnessColor = freshness === DATA_HEALTH_STATUS.CURRENT ? 'text-emerald-500/60' : 'text-amber-500/60'
  return (
    <span className={`text-[10px] font-medium ${freshnessColor}`}>
      {label} {timeAgo}
    </span>
  )
}

const LockedTierCard = () => {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-base-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Lock size={16} className="text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-black text-base-content">Guardian+ Feature</p>
          <p className="text-xs text-base-content/50">Safe haven locator</p>
        </div>
      </div>
      <p className="text-sm text-base-content/70 mb-4">
        Upgrade to Guardian or Navigator to unlock nearby safe havens, emergency-location scouting, and pre-arrival safety context.
      </p>
      <Link to="/settings?tab=billing">
        <Button size="sm" className="w-full">Upgrade For Safe Havens</Button>
      </Link>
    </div>
  )
}

const UpcomingDashboard = ({ trip, alerts = [], stats = {}, safetyData = {}, timeWeather = null }) => {
  // 1. Hooks MUST come first
  const { user } = useAuthStore()
  const [checklistState, setChecklistState] = useState({
    packing: false,
    contacts: false,
    checkins: false,
    documents: false,
  })
  const [checklistLoading, setChecklistLoading] = useState(true)
  const canViewSafeHavens = isGuardianPlus(user)
  
  const [widgetState, setWidgetState, { 
    reorderWidgets, 
    unhideWidget, 
    toggleExpand, 
    expandAll, 
    collapseAll, 
    resetToDefaults,
    orderedKeys,
    defaultWidgetKeys 
  }] = useWidgetState('upcoming', {
    travelDayPrep: { expanded: true, hidden: false },
    tripEssentials: { expanded: true, hidden: false },
    safetySetup: { expanded: true, hidden: false },
    emergencyContacts: { expanded: true, hidden: false },
    safeHavens: { expanded: true, hidden: false },
  })

  useEffect(() => {
    if (!trip?.id) return
    const fetchChecklist = async () => {
      try {
        const data = await getTripChecklist(trip.id)
        if (data?.data?.state) setChecklistState(data.data.state)
      } catch (err) {
        console.error('Error fetching checklist:', err)
      } finally {
        setChecklistLoading(false)
      }
    }
    fetchChecklist()
  }, [trip?.id])

  const toggleItem = async (key) => {
    const newState = !checklistState[key]
    setChecklistState(prev => ({ ...prev, [key]: newState }))
    try {
      await updateTripChecklist(trip.id, key, newState)
    } catch (err) {
      console.error('Error updating checklist:', err)
      setChecklistState(prev => ({ ...prev, [key]: !newState }))
      toast.error('Failed to save checklist item')
    }
  }

  const toggleWidgetHide = (key) => {
    setWidgetState(prev => ({ ...prev, [key]: { ...prev[key], hidden: true } }))
  }

  const readinessItems = useMemo(() => [
    { label: "Packing list complete", done: checklistState.packing, key: "packing" },
    { label: "Emergency contacts confirmed", done: checklistState.contacts, key: "contacts" },
    { label: "Check-ins scheduled", done: checklistState.checkins, key: "checkins" },
    { label: "Important documents saved", done: checklistState.documents, key: "documents" },
  ], [checklistState])

  const readiness = useMemo(() => computeReadiness(checklistState, trip), [checklistState, trip])
  const readinessPct = readiness.percentage

  const countdown = useMemo(() => {
    if (!trip?.start_date) return null
    const now = new Date()
    const start = new Date(trip.start_date)
    const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return { text: "Today", days: 0, urgency: "high" }
    if (diff === 1) return { text: "Tomorrow", days: 1, urgency: "high" }
    if (diff <= 7) return { text: `${diff} days`, days: diff, urgency: "medium" }
    return { text: `${diff} days`, days: diff, urgency: "low" }
  }, [trip?.start_date])

  const weatherFreshness = timeWeather?.lastUpdated ? getDataFreshness(timeWeather.lastUpdated, 30) : null
  const now = new Date()
  const departureDate = trip?.start_date ? new Date(trip.start_date) : null
  const daysUntilDeparture = departureDate ? Math.ceil((departureDate - now) / (1000 * 60 * 60 * 24)) : null

  const travelPrepItems = useMemo(() => {
    const hasBookings = trip?.bookings && trip.bookings.length > 0
    const weatherStatus = timeWeather?.weather?.forecast ? 'ready' : daysUntilDeparture && daysUntilDeparture <= 14 ? 'check-later' : 'needs-setup'
    const localTimeStatus = timeWeather?.timezone ? 'ready' : 'needs-setup'
    const transferStatus = hasBookings && trip.bookings.some(b => b.type === 'transfer') ? 'ready' : 'needs-setup'
    const insuranceStatus = trip?.documents?.some(d => d.type === 'insurance') ? 'ready' : 'needs-setup'
    const esimStatus = trip?.esim_status === 'active' ? 'ready' : 'needs-setup'

    return [
        { icon: CloudSun, label: 'Weather', status: weatherStatus, value: timeWeather?.weather?.forecast?.[0] ? `${timeWeather.weather.forecast[0]?.temp_min}°–${timeWeather.weather.forecast[0]?.temp_max}°` : weatherStatus === 'check-later' ? 'Check closer' : 'Needs setup' },
        { icon: Clock, label: 'Local time', status: localTimeStatus, value: timeWeather?.timezone?.localTime || '—' },
        { icon: Shield, label: 'Insurance', status: insuranceStatus, value: insuranceStatus === 'ready' ? 'Confirmed' : 'Not confirmed' },
        { icon: Wifi, label: 'eSIM', status: esimStatus, value: esimStatus === 'ready' ? 'Active' : 'Not set up' },
        { icon: Plane, label: 'Transfer', status: transferStatus, value: transferStatus === 'ready' ? 'Planned' : 'Not planned' },
    ]
  }, [trip, timeWeather, daysUntilDeparture])

  const itemsReadyCount = travelPrepItems.filter(i => i.status === 'ready').length

  // Calculate visible widget count
  const visibleWidgetCount = useMemo(() => {
    return Object.keys(WIDGET_CONFIG).filter(key => !widgetState[key]?.hidden).length
  }, [widgetState]);

  // 2. Guard against invalid data AFTER hooks
  if (!trip || !trip.id) return <DashboardSkeleton />

  const hasAccommodation = trip?.accommodation || trip?.accommodation_id
  const hasBookings = trip?.bookings && trip.bookings.length > 0
  const hasDocuments = trip?.documents && trip.documents.length > 0
  const hasBudget = trip?.budget && (trip.budget.totalBudget > 0 || trip.budget.convertedTotalBudget > 0)

  return (
    <div className="space-y-6">
      {readiness.blockers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex items-center gap-4 ${readiness.urgency === 'high' ? 'bg-red-500/10 border-red-500/20' : readiness.urgency === 'medium' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-sky-500/10 border-sky-500/20'}`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${readiness.urgency === 'high' ? 'bg-red-500/20' : readiness.urgency === 'medium' ? 'bg-amber-500/20' : 'bg-sky-500/20'}`}>
            {readiness.urgency === 'high' ? <AlertCircle size={20} className="text-red-500" /> : <AlertCircle size={20} className="text-amber-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${readiness.urgency === 'high' ? 'text-red-700' : readiness.urgency === 'medium' ? 'text-amber-700' : 'text-sky-700'}`}>{readiness.blockers[0]?.message || 'Complete your trip setup'}</p>
            <p className="text-xs text-base-content/60 truncate">{readiness.blockers[0]?.type?.replace(/_/g, ' ') || 'Tap to address'}</p>
          </div>
          <Link to={readiness.blockers[0]?.type === 'missing_core_safety_setup' ? '/safety' : readiness.blockers[0]?.type === 'missing_required_document' ? `/trips/${trip?.id}?tab=documents` : readiness.blockers[0]?.type === 'no_accommodation' ? `/trips/${trip?.id}?tab=accommodation` : readiness.blockers[0]?.type === 'no_checkin_setup' ? '/safety?tab=checkins' : `/trips/${trip?.id}`} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors ${readiness.urgency === 'high' ? 'bg-red-500 hover:bg-red-600' : readiness.urgency === 'medium' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-500 hover:bg-sky-600'}`}>Fix Now</Link>
        </motion.div>
      )}

      <TripImageHero
        trip={trip} title={trip?.destination || "Your Upcoming Trip"}
        subtitle={countdown ? `${countdown.text} until departure — review what's ready.` : "Review what's ready."}
        primaryCta={{ label: "Open Trip", href: `/trips/${trip?.id}` }}
        secondaryCta={{ label: "Safety", href: "/safety" }}
        extraCtas={[
          { label: "🆘 SOS", href: "/safety?sos=1" },
          { label: "✦ Ask Atlas", href: "/dashboard?atlas=1" },
        ]}
        overlay="subtle"
        statusPanel={
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16 shrink-0 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-base-200" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 * (1 - readinessPct / 100)} className="text-primary transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-xl font-black">{countdown?.days ?? "—"}</span>
                <span className="text-[9px] opacity-70 uppercase font-black tracking-tighter">Days</span>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-1 text-center">Departure</div>
              <div className="text-sm font-bold flex items-center gap-2">
                <Calendar size={14} className="text-primary" /> 
                {trip?.start_date ? new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </div>
            </div>
            <div className="space-y-3 w-full">
              <div className="flex justify-between items-end">
                <span className="text-[10px] opacity-60 font-black uppercase tracking-widest">Readiness</span>
                <span className="text-sm font-black text-primary">{readinessPct}%</span>
              </div>
              <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${readinessPct}%` }} />
              </div>
            </div>
          </div>
        }
        tripState="upcoming"
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
        <NextBestActionCard 
          key="nextBestAction" 
          blockers={readiness.blockers} 
          readinessLabel={readiness.status} 
          urgency={readiness.urgency} 
        />
        <ChecklistCard 
          key="checklist" 
          title="Before you go" 
          items={readinessItems} 
          loading={checklistLoading} 
          onToggle={(i) => { const key = readinessItems[i]?.key; if (key) toggleItem(key); }} 
        />
        
        <CollapsibleWidget
          key="safetySetup" title="Safety & Contacts" icon={Shield}
          expanded={widgetState.safetySetup?.expanded} collapsible={true} hideable={true} hidden={widgetState.safetySetup?.hidden}
          onToggleExpand={() => toggleExpand('safetySetup')} onHide={() => toggleWidgetHide('safetySetup')} accentColor="violet"
          draggable={true}
        >
          <div className="space-y-4">
            <SafetyStatusCard hasContacts={safetyData?.contacts?.length > 0} contactCount={safetyData?.contacts?.length || 0} checkInScheduled={safetyData?.checkInScheduled} checkInSchedule={safetyData?.checkInSchedule} showHeading={true} />
            <GuardianStatusCard contacts={safetyData?.contacts || []} tripId={trip?.id} showHeading={true} />
          </div>
        </CollapsibleWidget>

        <CollapsibleWidget
          key="travelDayPrep" title="Travel-Day Prep" icon={CloudSun}
          expanded={widgetState.travelDayPrep?.expanded} collapsible={true} hideable={true} hidden={widgetState.travelDayPrep?.hidden}
          onToggleExpand={() => toggleExpand('travelDayPrep')} onHide={() => toggleWidgetHide('travelDayPrep')} accentColor="emerald"
          badge={{ label: `${itemsReadyCount}/5 ready`, type: itemsReadyCount === 5 ? 'success' : itemsReadyCount >= 3 ? 'warning' : 'error' }}
          draggable={true}
        >
          <div className="grid grid-cols-2 gap-2">
            {travelPrepItems.map((item, index) => {
              const StatusIcon = item.status === 'ready' ? CheckCircle : item.status === 'needs-setup' ? AlertCircle : Clock
              return (
                <div key={index} className="flex items-center gap-2 p-2.5 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === 'ready' ? 'bg-emerald-500/10' : item.status === 'needs-setup' ? 'bg-amber-500/10' : 'bg-sky-500/10'}`}>
                    <item.icon size={14} className={item.status === 'ready' ? 'text-emerald-500' : item.status === 'needs-setup' ? 'text-amber-500' : 'text-sky-500'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-base-content/40 uppercase tracking-wide truncate">{item.label}</p>
                    <p className="text-sm font-bold text-base-content/80 truncate">{item.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CollapsibleWidget>

        <CollapsibleWidget
          key="tripEssentials" title="Trip essentials" icon={ListChecks}
          expanded={widgetState.tripEssentials?.expanded} collapsible={true} hideable={true} hidden={widgetState.tripEssentials?.hidden}
          onToggleExpand={() => toggleExpand('tripEssentials')} onHide={() => toggleWidgetHide('tripEssentials')} accentColor="blue"
          draggable={true}
        >
          <div className="space-y-2">
            {[ { icon: DollarSign, label: 'Budget', status: hasBudget, link: `/trips/${trip?.id}?tab=budget` }, { icon: Building2, label: 'Accommodation', status: hasAccommodation, link: `/trips/${trip?.id}` }, { icon: Briefcase, label: 'Documents', status: hasDocuments, link: `/trips/${trip?.id}` } ].map((item, i) => (
              <Link key={`preparation-${item.label}`} to={item.link} className="flex items-center gap-3 p-3 rounded-xl bg-base-200 hover:bg-brand-vibrant/5 border border-transparent hover:border-brand-vibrant/20 transition-all duration-200 group">
                <div className="w-8 h-8 rounded-lg bg-base-200 group-hover:bg-brand-vibrant/10 flex items-center justify-center transition-colors">
                  <item.icon size={16} className="text-base-content/40 group-hover:text-brand-vibrant transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-base-content/80 group-hover:text-base-content transition-colors block">{item.label}</span>
                  <span className={`text-xs ${item.status ? 'text-emerald-500' : 'text-amber-500'}`}>{item.status ? (item.label === 'Documents' ? `${trip.documents.length} saved` : 'Configured') : 'Needs setup'}</span>
                </div>
              </Link>
            ))}
          </div>
        </CollapsibleWidget>

        {hasBudget && (
          <BudgetSnapshotWidget 
            key="budgetSnapshot" 
            tripId={trip?.id} 
            budget={trip?.budget} 
          />
        )}
        
        <CollapsibleWidget
          key="safeHavens" title="Safe havens" icon={Shield}
          expanded={widgetState.safeHavens?.expanded} collapsible={true} hideable={true} hidden={widgetState.safeHavens?.hidden}
          onToggleExpand={() => toggleExpand('safeHavens')} onHide={() => toggleWidgetHide('safeHavens')} accentColor="amber"
          draggable={true}
        >
          {canViewSafeHavens ? (
            <SafeHavenCard destination={trip?.destination} tripId={trip?.id} showHeading={false} />
          ) : (
            <LockedTierCard />
          )}
        </CollapsibleWidget>

        <AdvisorySummaryWidget key="advisorySummary" destination={trip?.destination} />
      </DashboardModuleGrid>
    </div>
  )
}

export default UpcomingDashboard