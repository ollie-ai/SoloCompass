import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import Button from './Button';
import { reportError } from '../lib/errorCollector';

class APIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('API Error Boundary caught:', error, errorInfo);
    this.setState({ errorInfo });
    reportError(error, {
      context: 'APIErrorBoundary',
      componentStack: errorInfo?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-[400px] flex items-center justify-center p-6 bg-base-200/50 rounded-2xl border-2 border-dashed border-base-300"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-error shadow-lg shadow-red-200/50">
              <ShieldAlert size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-base-content">Something went wrong</h2>
              <p className="text-base-content/60 font-medium leading-relaxed">
                We encountered an unexpected error while fetching your travel data. Our mission control has been notified.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="p-4 bg-slate-900 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-rose-400 font-mono text-xs mb-2 font-bold">{this.state.error.toString()}</p>
                <p className="text-base-content/40 font-mono text-[10px] whitespace-pre">
                  {this.state.errorInfo?.componentStack}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={this.handleRetry}
                variant="primary"
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold bg-brand-vibrant shadow-lg shadow-brand-vibrant/20"
              >
                <RefreshCw size={18} />
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = '/dashboard'}
                variant="outline"
                className="flex-1 py-3.5 rounded-xl font-bold border-base-300 text-base-content/80"
              >
                <Home size={18} className="mr-2 inline" />
                Dashboard
              </Button>
            </div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default APIErrorBoundary;
