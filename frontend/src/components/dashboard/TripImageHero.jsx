import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { MapPin, ChevronRight, ShieldCheck, Calendar, CheckCircle2 } from 'lucide-react'

const destinationImages = {
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&h=400&fit=crop',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&h=400&fit=crop',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&h=400&fit=crop',
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&h=400&fit=crop',
  lisbon: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&h=400&fit=crop',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&h=400&fit=crop',
  bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&h=400&fit=crop',
  rome: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&h=400&fit=crop',
  berlin: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1200&h=400&fit=crop',
  amsterdam: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&h=400&fit=crop',
  prague: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&h=400&fit=crop',
  vienna: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200&h=400&fit=crop',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=400&fit=crop',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&h=400&fit=crop',
  sydney: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&h=400&fit=crop',
  'chiang mai': 'https://images.unsplash.com/photo-1598935898639-318e56a4a8e6?w=1200&h=400&fit=crop',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&h=400&fit=crop',
  madrid: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&h=400&fit=crop',
  istanbul: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200&h=400&fit=crop',
  'rio de janeiro': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1200&h=400&fit=crop',
  'cape town': 'https://images.unsplash.com/photo-1580060839134-75a5edca2e27?w=1200&h=400&fit=crop',
  'los angeles': 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1200&h=400&fit=crop',
  'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=400&fit=crop',
  miami: 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1200&h=400&fit=crop',
  seoul: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&h=400&fit=crop',
  kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&h=400&fit=crop',
  osaka: 'https://images.unsplash.com/photo-1590559310327-5b1251fa6747?w=1200&h=400&fit=crop',
  hanoi: 'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200&h=400&fit=crop',
  'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&h=400&fit=crop',
  phuket: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&h=400&fit=crop',
  athens: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=1200&h=400&fit=crop',
  budapest: 'https://images.unsplash.com/photo-1551867633-194f125bddfa?w=1200&h=400&fit=crop',
  dublin: 'https://images.unsplash.com/photo-1564957983706-335a6455a330?w=1200&h=400&fit=crop',
  edinburgh: 'https://images.unsplash.com/photo-1565624576968-1e3f3eb7fcc1?w=1200&h=400&fit=crop',
  copenhagen: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&h=400&fit=crop',
  stockholm: 'https://images.unsplash.com/photo-1509356843151-3e7d96141e13?w=1200&h=400&fit=crop',
  oslo: 'https://images.unsplash.com/photo-1520769669658-f07657f5a307?w=1200&h=400&fit=crop',
  warsaw: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?w=1200&h=400&fit=crop',
  moscow: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=1200&h=400&fit=crop',
  beijing: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&h=400&fit=crop',
  shanghai: 'https://images.unsplash.com/photo-1537531383496-f4749bfa8068?w=1200&h=400&fit=crop',
  mumbai: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200&h=400&fit=crop',
  delhi: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1200&h=400&fit=crop',
  'buenos aires': 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200&h=400&fit=crop',
  mexico: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&h=400&fit=crop',
  'mexico city': 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&h=400&fit=crop',
  cairo: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1200&h=400&fit=crop',
  marrakech: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1200&h=400&fit=crop',
  nairobi: 'https://images.unsplash.com/photo-1576487236230-eaa4afe68191?w=1200&h=400&fit=crop',
}

const fallbackByRegion = {
  europe: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&h=400&fit=crop',
  asia: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=1200&h=400&fit=crop',
  americas: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&h=400&fit=crop',
  africa: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&h=400&fit=crop',
  oceania: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&h=400&fit=crop',
  middle_east: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=400&fit=crop',
}

const regionMap = {
  tokyo: 'asia', paris: 'europe', london: 'europe', barcelona: 'europe',
  lisbon: 'europe', 'new york': 'americas', bangkok: 'asia', rome: 'europe',
  berlin: 'europe', amsterdam: 'europe', prague: 'europe', vienna: 'europe',
  dubai: 'middle_east', singapore: 'asia', sydney: 'oceania', 'chiang mai': 'asia',
  bali: 'asia', madrid: 'europe', istanbul: 'europe', 'rio de janeiro': 'americas',
  'cape town': 'africa', 'los angeles': 'americas', 'san francisco': 'americas',
  miami: 'americas', seoul: 'asia', kyoto: 'asia', osaka: 'asia', hanoi: 'asia',
  'ho chi minh': 'asia', phuket: 'asia', athens: 'europe', budapest: 'europe',
  dublin: 'europe', edinburgh: 'europe', copenhagen: 'europe', stockholm: 'europe',
  oslo: 'europe', warsaw: 'europe', moscow: 'europe', beijing: 'asia',
  shanghai: 'asia', mumbai: 'asia', delhi: 'asia', 'buenos aires': 'americas',
  mexico: 'americas', 'mexico city': 'americas', cairo: 'africa', marrakech: 'africa',
  nairobi: 'africa',
}

const fallbackGradient = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'

const TripImageHero = ({
  trip,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  extraCtas = [],
  statusPanel,
  children,
  overlay = 'dark',
  image,
  className = '',
  tripState = 'upcoming',
  countdownDays = null,
  readinessPct = null,
}) => {
  const dest = (trip?.destination || '').toLowerCase()
  const bgImage = image || destinationImages[dest] || (regionMap[dest] ? fallbackByRegion[regionMap[dest]] : fallbackByRegion.europe)

  const stateLabels = {
    no_trips: { label: 'Ready to Explore', icon: MapPin },
    upcoming: { label: 'Upcoming Adventure', icon: MapPin },
    live_trip: { label: 'Live Journey', icon: MapPin },
    completed: { label: 'Trip Complete', icon: MapPin },
    planning: { label: 'Planning Mode', icon: MapPin },
  }

  const StateIcon = stateLabels[tripState]?.icon || MapPin
  const stateLabel = stateLabels[tripState]?.label || 'Adventure'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative rounded-[2rem] overflow-hidden shadow-2xl group transition-all duration-500 ${className}`}
    >
      <div className="relative h-auto min-h-[420px]">
        <img
          src={bgImage}
          alt={trip?.destination || 'Destination'}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 group-hover:blur-[1px]"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.parentElement.style.background = fallbackGradient
          }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />
        
        <div className="relative h-full flex flex-col justify-between p-6 md:p-10">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 w-fit px-4 py-1.5 rounded-full text-white text-[10px] font-black tracking-widest uppercase">
            <StateIcon size={12} className="text-emerald-400" /> {stateLabel}
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 mt-8 md:mt-0">
            <div className="max-w-xl w-full">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-[2rem] mb-6 shadow-xl">
                <h1 className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tighter leading-none">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-white/90 text-base md:text-lg font-medium leading-relaxed max-w-md">
                    {subtitle}
                  </p>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4">
                {primaryCta && (
                  <Link 
                    to={primaryCta.href}
                    className="bg-[#10b981] hover:bg-[#059669] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 transform active:scale-95"
                  >
                    {primaryCta.label} <ChevronRight size={18} />
                  </Link>
                )}
                {secondaryCta && (
                  <Link 
                    to={secondaryCta.href}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-8 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                  >
                    <ShieldCheck size={18} className="text-emerald-400" /> {secondaryCta.label}
                  </Link>
                )}
                {extraCtas.map((cta, i) => (
                  <Link
                    key={i}
                    to={cta.href}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-6 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-2 text-sm"
                  >
                    {cta.label}
                  </Link>
                ))}
              </div>
            </div>

            {statusPanel && (
              <div className="w-full md:w-auto">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-6 text-white shadow-2xl min-w-[260px] transform transition-transform group-hover:-translate-y-1">
                  {statusPanel}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default TripImageHero