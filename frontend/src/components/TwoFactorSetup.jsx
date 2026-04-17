import { useState } from 'react';
import { Shield, Copy, Check, Loader, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function TwoFactorSetup({ onComplete, onCancel }) {
  const [step, setStep] = useState('intro'); // intro | setup | verify | backup | done
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [totpToken, setTotpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await api.post('/users/me/2fa/enable');
      const { qrCode: qr, secret: sec, backupCodes: codes } = res.data.data;
      setQrCode(qr);
      setSecret(sec);
      setBackupCodes(codes);
      setStep('setup');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!totpToken || totpToken.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await api.post('/users/me/2fa/verify', { token: totpToken });
      setStep('backup');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solocompass-backup-codes.txt';
    a.click();
  };

  if (step === 'intro') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-brand-vibrant" />
          <h3 className="text-lg font-semibold">Enable Two-Factor Authentication</h3>
        </div>
        <p className="text-base-content/70">Add an extra layer of security to your account. You'll need an authenticator app like Google Authenticator or Authy.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={handleEnable} disabled={loading} className="btn btn-primary gap-2">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Set Up 2FA
          </button>
          {onCancel && <button onClick={onCancel} className="btn btn-ghost">Cancel</button>}
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Scan QR Code</h3>
        <p className="text-sm text-base-content/70">Scan this QR code with your authenticator app:</p>
        {qrCode && <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg border border-base-300" />}
        <div className="collapse collapse-arrow bg-base-200">
          <input type="checkbox" />
          <div className="collapse-title text-sm font-medium">Can't scan? Enter manually</div>
          <div className="collapse-content">
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-base-300 px-2 py-1 rounded break-all">{secret}</code>
              <button onClick={copySecret} className="btn btn-ghost btn-xs">
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text font-medium">Enter the 6-digit code from your app to confirm:</span></label>
          <input
            type="text"
            className="input input-bordered w-48"
            placeholder="000000"
            maxLength={6}
            value={totpToken}
            onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <button onClick={handleVerify} disabled={loading || totpToken.length !== 6} className="btn btn-primary gap-2">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
          Verify & Enable
        </button>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Save Your Backup Codes</h3>
        </div>
        <p className="text-sm text-base-content/70">Save these backup codes somewhere safe. Each can only be used once if you lose access to your authenticator app.</p>
        <div className="grid grid-cols-2 gap-2 p-4 bg-base-200 rounded-lg">
          {backupCodes.map((code, i) => (
            <code key={i} className="text-sm font-mono text-center p-1">{code}</code>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={downloadBackupCodes} className="btn btn-outline btn-sm">Download Codes</button>
          <button onClick={() => { setStep('done'); onComplete?.(); }} className="btn btn-primary btn-sm">I've Saved My Codes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <Shield className="w-10 h-10 mx-auto mb-2 text-success" />
      <p className="font-semibold">2FA is now enabled!</p>
    </div>
  );
}
