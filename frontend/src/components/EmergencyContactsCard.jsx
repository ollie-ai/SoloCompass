import { Phone, AlertTriangle, Ambulance, Shield, Building2 } from 'lucide-react';

const CATEGORIES = [
  { key: 'police', label: 'Police', icon: Shield, color: 'text-blue-600' },
  { key: 'ambulance', label: 'Ambulance', icon: Ambulance, color: 'text-red-500' },
  { key: 'fire', label: 'Fire', icon: AlertTriangle, color: 'text-orange-500' },
  { key: 'embassy', label: 'Embassy', icon: Building2, color: 'text-indigo-500' },
  { key: 'tourist_police', label: 'Tourist Police', icon: Shield, color: 'text-cyan-600' },
  { key: 'emergency', label: 'Emergency', icon: Phone, color: 'text-success' },
];

const ContactRow = ({ icon: Icon, color, label, number }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200/50 border border-base-300/50">
    <div className={`w-8 h-8 rounded-lg bg-base-100 flex items-center justify-center shadow-sm ${color}`}>
      <Icon size={15} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-base-content/80">{label}</p>
      {number && <p className="text-[11px] font-medium text-base-content/50">{number}</p>}
    </div>
    {number && (
      <a href={`tel:${number}`}
        className="text-xs font-black text-brand-vibrant hover:underline">
        Call
      </a>
    )}
  </div>
);

/**
 * Standalone destination-level emergency contacts card.
 *
 * Props:
 *  - destination {string}
 *  - numbers {object}  Emergency numbers keyed by category (police, ambulance, fire, etc.)
 *  - contacts {Array}  Additional named contacts [{name, phone, role}]
 *  - className {string}
 */
const EmergencyContactsCard = ({ destination, numbers = {}, contacts = [], className = '' }) => {
  const hasNumbers = CATEGORIES.some(c => numbers[c.key]);
  const hasContacts = contacts.length > 0;

  if (!hasNumbers && !hasContacts) {
    return (
      <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
        <h3 className="font-black text-base-content text-base mb-1">Emergency Contacts</h3>
        {destination && <p className="text-xs text-base-content/50">{destination}</p>}
        <p className="text-xs text-base-content/40 mt-4">No emergency numbers available for this destination.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-base-300/60 bg-base-100 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
          <Phone size={15} className="text-error" />
        </div>
        <div>
          <h3 className="font-black text-base-content text-base leading-tight">Emergency Contacts</h3>
          {destination && <p className="text-xs font-medium text-base-content/50">{destination}</p>}
        </div>
      </div>

      <div className="space-y-2">
        {CATEGORIES.map(({ key, label, icon, color }) => {
          const number = numbers[key];
          if (!number) return null;
          return <ContactRow key={key} icon={icon} color={color} label={label} number={number} />;
        })}

        {contacts.map((c, i) => (
          <ContactRow key={i} icon={Phone} color="text-base-content/60" label={c.name || c.role || 'Contact'} number={c.phone} />
        ))}
      </div>
    </div>
  );
};

export default EmergencyContactsCard;
