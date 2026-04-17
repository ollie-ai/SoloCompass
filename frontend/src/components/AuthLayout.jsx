import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-vibrant">
            <Compass className="w-8 h-8" />
            <span className="text-xl font-bold">SoloCompass</span>
          </Link>
          {title && <h1 className="text-2xl font-bold mt-4 text-base-content">{title}</h1>}
          {subtitle && <p className="text-base-content/60 mt-1">{subtitle}</p>}
        </div>
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
