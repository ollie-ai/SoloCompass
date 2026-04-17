import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, Crown, MapPin, Sparkles, Star, Globe, Zap, ScanFace } from 'lucide-react';

const SoloIDCard = ({ data, loading = false, variant = 'compact' }) => {
  if (loading) {
    return (
      <div className="w-full h-64 rounded-2xl bg-base-200 animate-pulse border border-base-300/50 flex items-center justify-center">
        <ScanFace className="w-12 h-12 text-base-content/10 animate-pulse" />
      </div>
    );
  }

  const {
    name,
    displayName,
    avatarUrl,
    homeCity,
    verificationTier = 0,
    isPremium = false,
    interests = [],
    travelStyle,
    travelDna
  } = data || {};

  const getTierDetails = (tier) => {
    switch (tier) {
      case 3: return { label: 'Established', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/50', icon: Crown };
      case 2: return { label: 'Trusted', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', icon: Shield };
      case 1: return { label: 'Explorer', color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/50', icon: CheckCircle };
      default: return { label: 'Newbie', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/50', icon: Globe };
    }
  };

  const tier = getTierDetails(verificationTier);
  const TierIcon = tier.icon;

  const cardVariants = {
    hover: { y: -5, transition: { duration: 0.3, ease: 'easeOut' } }
  };

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02, rotateY: 2 }}
      variants={cardVariants}
      className={`relative overflow-hidden rounded-[2rem] border ${tier.border} bg-slate-950/80 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] p-8 text-white group`}
    >
      {/* Dynamic Background Mesh */}
      <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-[0.05] pointer-events-none" />
      
      {/* Decorative Shimmer/Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-vibrant/20 rounded-full blur-[100px] group-hover:bg-brand-vibrant/30 transition-colors duration-500" />
      <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-brand-accent/20 rounded-full blur-[80px] group-hover:bg-brand-accent/30 transition-colors duration-500" />

      {/* Header */}
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 font-outfit">Solo Passport</span>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${tier.bg} ${tier.color} text-[10px] font-black border border-current/20 backdrop-blur-md shadow-lg`}>
            <TierIcon size={12} strokeWidth={3} />
            <span className="uppercase tracking-widest">{tier.label}</span>
          </div>
        </div>
        {isPremium && (
          <div className="bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 p-2 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Crown size={16} fill="currentColor" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex items-center gap-6 mb-8 relative z-10">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-vibrant via-emerald-500 to-brand-accent p-[2px] shadow-2xl">
            <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center overflow-hidden border border-white/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt={`${displayName || name}'s profile photo`} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" />
              ) : (
                <span className="text-2xl font-outfit font-black text-white">{name?.charAt(0) || '?'}</span>
              )}
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-brand-vibrant text-white rounded-full p-1.5 border-4 border-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <ScanFace size={14} strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-outfit font-black truncate tracking-tight mb-1">{displayName || name}</h3>
          <div className="flex items-center gap-2 text-white/40 text-xs font-bold tracking-tight">
            <MapPin size={12} className="text-brand-vibrant" />
            <span className="truncate">{homeCity || 'Citizen of the World'}</span>
          </div>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md group-hover:bg-white/10 transition-colors">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Travel DNA</span>
          <div className="flex items-center gap-2 text-xs font-black text-brand-vibrant">
            <Zap size={14} fill="currentColor" className="text-brand-vibrant" />
            <span className="truncate uppercase tracking-tight">{travelDna?.style || travelStyle || 'Calibrating...'}</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md group-hover:bg-white/10 transition-colors">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Active Interests</span>
          <div className="flex items-center gap-2 text-xs font-black truncate">
             <Sparkles size={14} className="text-brand-accent" />
             <span className="truncate uppercase tracking-tight">
               {Array.isArray(interests) && interests.length > 0 ? interests.slice(0, 2).join(' / ') : 'Global Nomad'}
             </span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-6 border-t border-white/10 relative z-10">
        <div className="flex gap-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Trips</span>
              <span className="text-sm font-outfit font-black text-white/80">12</span>
           </div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Syncs</span>
              <span className="text-sm font-outfit font-black text-white/80">42</span>
           </div>
        </div>
        <div className="text-[10px] font-mono text-white/20 font-black tracking-widest bg-white/5 px-3 py-1 rounded-lg">
           ID: {name?.toUpperCase().slice(0, 3)}-{Math.floor(Math.random() * 900) + 100}
        </div>
      </div>
      
      {/* Decorative scanline */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-vibrant/10 to-transparent h-[2px] w-full animate-scan pointer-events-none opacity-50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
    </motion.div>
  );
};

export default SoloIDCard;
