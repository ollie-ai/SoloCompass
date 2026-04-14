import { motion } from 'framer-motion'
import { Compass, MapPin, Shield, Calendar, User, Plus, CheckCircle, ArrowRight, Clock, Briefcase, DollarSign, ListChecks, Sparkles, PartyPopper, Luggage } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardHero from '../DashboardHero'
import DashboardModuleGrid, { ModuleCard } from '../DashboardModuleGrid'
import Button from '../../Button'

const NoTripsDashboard = () => {
  const [setupSteps, setSetupSteps] = useState([
    { icon: User, label: "Complete your profile", href: "/settings", done: false },
    { icon: Shield, label: "Add emergency contacts", href: "/safety", done: false },
    { icon: Compass, label: "Choose travel style or preferences", href: "/trips/new", done: false },
  ])

  const toggleStep = (index) => {
    setSetupSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, done: !step.done } : step
    ))
  }

  const completedCount = setupSteps.filter(s => s.done).length

  const starterDestinations = [
    { name: "Lisbon", country: "Portugal", region: "Western Europe", bestFor: "First-timers", tripLength: "5-7 days", safety: "Very Safe", vibe: "Walkable & vibrant", icon: MapPin },
    { name: "Tokyo", country: "Japan", region: "East Asia", bestFor: "Culture & food", tripLength: "7-10 days", safety: "Very Safe", vibe: "Efficient & fascinating", icon: MapPin },
    { name: "Chiang Mai", country: "Thailand", region: "Southeast Asia", bestFor: "Budget travel", tripLength: "4-7 days", safety: "Safe", vibe: "Affordable & relaxed", icon: MapPin },
    { name: "Reykjavik", country: "Iceland", region: "Nordic", bestFor: "Nature & solitude", tripLength: "5-8 days", safety: "Very Safe", vibe: "Wild & peaceful", icon: MapPin },
  ]
  
  return (
    <div className="space-y-6">
      <DashboardHero
        state="no_trips"
        title={
          <span className="font-outfit font-black tracking-tight leading-tight">
            Start your first <span className="text-gradient">solo trip plan</span>
          </span>
        }
        subtitle="Build your itinerary, set up check-ins, and get premium safety tools in one place."
        primaryCta={{ label: "Plan a new trip", href: "/trips/new" }}
        secondaryCta={{ label: "Explore demos", href: "/?demo=true" }}
        extraCtas={[
          { label: "🆘 SOS", href: "/safety?sos=1" },
          { label: "✦ Ask Atlas", href: "/dashboard?atlas=1" },
        ]}
        statusPanel={
          <div className="space-y-4">
            <div className="flex items-center gap-3 justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200/50 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-base-content/40 border border-base-content/5">
                <Compass size={12} strokeWidth={2.5} /> No active trip
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-vibrant/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-brand-vibrant border border-brand-vibrant/20">
                <CheckCircle size={12} strokeWidth={2.5} /> 3-min setup
              </span>
            </div>
            <p className="text-center text-xs text-base-content/40 font-bold uppercase tracking-wider">
              Calibrate AI → Generate Itinerary → Secure Trip
            </p>
          </div>
        }
      />
      
      <DashboardModuleGrid columns={3}>
        <ModuleCard key="missionStart" className="p-8" accentColor="emerald">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-vibrant/20 to-brand-vibrant/5 flex items-center justify-center shadow-inner">
              <Plus size={24} className="text-brand-vibrant" />
            </div>
            <h3 className="text-xl font-outfit font-black text-base-content tracking-tight">Mission Start</h3>
          </div>
          <div className="space-y-3 mb-6">
            {[
              { icon: MapPin, label: "Pick a destination" },
              { icon: Calendar, label: "Set your dates" },
              { icon: ListChecks, label: "Calibrate Travel DNA" },
              { icon: Shield, label: "Arm safety protocols" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-brand-vibrant/10 flex items-center justify-center flex-shrink-0">
                  <item.icon size={12} strokeWidth={2.5} className="text-brand-vibrant" />
                </div>
                <span className="text-sm text-base-content/70 font-semibold tracking-tight">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-base-content/30 mb-6">Full telemetry customization available</p>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link to="/trips/new">
              <Button variant="primary" className="btn-premium w-full !rounded-xl">
                Initialize Trip Plan
              </Button>
            </Link>
          </motion.div>
        </ModuleCard>
        
        <ModuleCard key="coreSystems" className="p-8" accentColor="violet">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/5 flex items-center justify-center shadow-inner">
              <Shield size={24} className="text-brand-accent" />
            </div>
            <h3 className="text-xl font-outfit font-black text-base-content tracking-tight">Core Systems</h3>
          </div>
          <ul className="space-y-4">
            {[
              { icon: Compass, label: "Atlas AI Engine", desc: "Precision itineraries calibrated to your Travel DNA" },
              { icon: Shield, label: "Sentinel Protocol", desc: "Automated check-ins and emergency contact mesh" },
              { icon: Sparkles, label: "Precision Logistics", desc: "Flight tracking and integrated budget telemetry" },
            ].map((b) => (
              <li key={b.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-vibrant/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <b.icon size={14} strokeWidth={2.5} className="text-brand-vibrant" />
                </div>
                <div>
                  <span className="text-sm font-black text-base-content/80 tracking-tight">{b.label}</span>
                  <p className="text-xs text-base-content/40 font-medium leading-relaxed">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </ModuleCard>
        
        <ModuleCard key="profileSync" className="p-8" accentColor="blue">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 flex items-center justify-center shadow-inner">
              <User size={24} className="text-sky-500" />
            </div>
            <h3 className="text-xl font-outfit font-black text-base-content tracking-tight">Profile Sync</h3>
          </div>
          <div className="space-y-2">
            {setupSteps.map((item) => (
              <button
                key={item.label}
                onClick={() => toggleStep(i)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-base-200/50 transition-all group text-left border border-transparent hover:border-base-content/5"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${item.done ? 'bg-success/20' : 'bg-base-200 group-hover:bg-brand-vibrant/10'}`}>
                  {item.done ? (
                    <CheckCircle size={14} strokeWidth={2.5} className="text-success" />
                  ) : (
                    <item.icon size={14} strokeWidth={2} className="text-base-content/40 group-hover:text-brand-vibrant transition-colors" />
                  )}
                </div>
                <span className={`text-sm font-bold tracking-tight flex-1 transition-colors ${item.done ? 'text-base-content/30 line-through' : 'text-base-content/70 group-hover:text-base-content'}`}>
                  {item.label}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${item.done ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-base-300'}`} />
              </button>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-base-content/5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-base-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-vibrant to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  style={{ width: `${(completedCount / setupSteps.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30">{completedCount}/{setupSteps.length} Sync</span>
            </div>
          </div>
        </ModuleCard>
      </DashboardModuleGrid>
      
      <div className="pt-8">
        <div className="flex items-center gap-4 mb-8">
          <h3 className="text-xl font-outfit font-black text-base-content tracking-tight">Precision Starting Points</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-base-content/10 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {starterDestinations.map((dest) => (
            <motion.div
              key={dest.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              whileHover={{ y: -2, scale: 1.02 }}
              className="bg-base-100 rounded-xl border border-base-300/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.10)] transition-all duration-300 p-4 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-brand-vibrant/10 flex items-center justify-center">
                  <dest.icon size={13} strokeWidth={3} className="text-brand-vibrant" />
                </div>
                <span className="text-base font-bold text-base-content">{dest.name}</span>
              </div>
              <p className="text-sm text-base-content/40 ml-9">{dest.country} · {dest.region}</p>
              <div className="flex items-center gap-1.5 mt-2 ml-9 flex-wrap">
                <span className="inline-block px-2 py-0.5 rounded-md bg-success/10 text-xs font-bold text-success">
                  {dest.safety}
                </span>
                <span className="inline-block px-2 py-0.5 rounded-md bg-info/10 text-xs font-bold text-info">
                  {dest.bestFor}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-base-content/40 font-medium">
                  <Clock size={10} /> {dest.tripLength}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      <ModuleCard className="p-6 bg-gradient-to-br from-brand-vibrant/5 to-brand-accent/5 border-brand-vibrant/20">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-brand-vibrant" />
          <span className="text-xs font-black uppercase tracking-widest text-brand-vibrant">Sample itinerary preview</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1">
            <p className="text-sm text-base-content/60 font-medium mb-4">Here's what a generated trip looks like for Lisbon, Portugal (5 days).</p>
            <div className="space-y-2">
              {[
                { day: "Day 1", title: "Arrival & Alfama walk", items: "Check-in, neighborhood stroll, sunset at Miradouro" },
                { day: "Day 2", title: "Belém & riverside", items: "Pastéis de Belém, Jerónimos monastery, Tagus walk" },
                { day: "Day 3", title: "Sintra day trip", items: "Palácio da Pena, Moorish Castle, historic center" },
                { day: "Day 4", title: "Free explore & food tour", items: "Time Out Market, Bairro Alto, optional Fado evening" },
                { day: "Day 5", title: "Departure", items: "Last-minute shopping, airport transfer" },
              ].map((day) => (
                <div key={day.day} className="flex items-start gap-3 p-3 rounded-lg bg-base-100/60 border border-base-300/50">
                  <span className="text-xs font-bold text-brand-vibrant bg-brand-vibrant/10 px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5">{day.day}</span>
                  <div>
                    <span className="text-sm font-bold text-base-content/80">{day.title}</span>
                    <p className="text-xs text-base-content/40">{day.items}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0 sm:items-end">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-base-content/60">
                <Luggage size={14} className="text-base-content/40" />
                <span>Packing list auto-generated</span>
              </div>
              <div className="flex items-center gap-2 text-base-content/60">
                <DollarSign size={14} className="text-base-content/40" />
                <span>Budget tracker included</span>
              </div>
              <div className="flex items-center gap-2 text-base-content/60">
                <Shield size={14} className="text-base-content/40" />
                <span>Safety check-ins scheduled</span>
              </div>
            </div>
            <Link to="/trips/new" className="flex items-center gap-2 text-sm font-bold text-brand-vibrant hover:text-brand-vibrant/80 transition-colors group">
              Create your trip <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </ModuleCard>
    </div>
  )
}

export default NoTripsDashboard
