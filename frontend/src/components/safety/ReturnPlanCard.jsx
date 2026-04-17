import { Building, Phone, Plane, Hotel, DollarSign, ChevronRight, Shield } from 'lucide-react';
import offlineStorage from '../../lib/offlineStorage';

function PlanRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={13} className="text-brand-vibrant mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-base-content/50 mr-1">{label}:</span>
        <span className="text-base-content/80 font-medium">{value}</span>
      </div>
    </div>
  );
}

export default function ReturnPlanCard({ plan, onEdit, onActivate, compact = false }) {
  // Fall back to cached offline plan
  const effectivePlan = plan || offlineStorage.getReturnPlan();

  if (!effectivePlan) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-base-300/60 text-center">
        <Shield size={24} className="mx-auto mb-2 text-base-content/30" />
        <p className="text-xs font-bold text-base-content/50">No return plan saved</p>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-brand-vibrant font-bold mt-2 hover:underline">
            Create one now
          </button>
        )}
      </div>
    );
  }

  const isActivated = effectivePlan.status === 'activated';

  return (
    <div className={`rounded-2xl border ${isActivated ? 'border-error/60 bg-error/5' : 'border-base-300/60 bg-base-100'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-base-300/40">
        <div className="flex items-center gap-2">
          <Shield size={16} className={isActivated ? 'text-error' : 'text-brand-vibrant'} />
          <p className="font-black text-sm text-base-content">Return Plan</p>
          {isActivated && (
            <span className="text-[10px] font-black bg-error text-white px-1.5 py-0.5 rounded-full uppercase animate-pulse">
              Active
            </span>
          )}
        </div>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-brand-vibrant font-bold hover:underline flex items-center gap-0.5">
            Edit <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Key info */}
      <div className={`px-4 py-3 space-y-2 ${compact ? '' : 'space-y-2.5'}`}>
        <PlanRow icon={Building} label="Embassy" value={effectivePlan.embassy_name} />
        <PlanRow icon={Phone} label="Embassy tel" value={effectivePlan.embassy_phone} />
        <PlanRow icon={Phone} label="Hospital" value={effectivePlan.hospital_name} />
        <PlanRow icon={Phone} label="Hospital tel" value={effectivePlan.hospital_phone} />
        <PlanRow icon={Plane} label="Airport" value={effectivePlan.nearest_airport || effectivePlan.nearestAirport} />
        <PlanRow icon={Hotel} label="Accommodation" value={effectivePlan.accommodation_name || effectivePlan.accommodationName} />
        {(effectivePlan.emergency_fund_amount || effectivePlan.emergencyFundAmount) && (
          <PlanRow
            icon={DollarSign}
            label="Emergency fund"
            value={`${effectivePlan.emergency_fund_amount || effectivePlan.emergencyFundAmount} ${effectivePlan.emergency_fund_currency || effectivePlan.emergencyFundCurrency || 'USD'}`}
          />
        )}
      </div>

      {/* Activate button */}
      {onActivate && !isActivated && effectivePlan.id && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onActivate(effectivePlan)}
            className="w-full bg-error text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wide hover:bg-red-600 transition-colors"
          >
            🚨 Activate Emergency Return
          </button>
        </div>
      )}
    </div>
  );
}
