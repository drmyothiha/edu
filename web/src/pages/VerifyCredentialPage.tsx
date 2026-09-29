import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { VerificationResult } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Award,
  Building2,
  QrCode,
  Globe2,
  Hash,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const VerifyCredentialPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialIdentifier = searchParams.get('identifier') || searchParams.get('did') || searchParams.get('hash') || '';

  const [inputVal, setInputVal] = useState(initialIdentifier);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performVerification = async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await api.blockchain.verify(target.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Verification service temporarily unavailable');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialIdentifier) {
      performVerification(initialIdentifier);
    }
  }, [initialIdentifier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ identifier: inputVal.trim() });
      performVerification(inputVal.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/login"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
          >
            ← Back to EduPlatform
          </Link>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Globe2 className="h-3 w-3 text-indigo-600" /> W3C DID & Layer-2 Merkle Verifier
          </span>
        </div>

        {/* Verification Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-50 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 mb-4">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Independent Credential & ID Verifier
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            Verify student identity cards, academic standing, and diplomas anchored on-chain.
            No login, account, or private access required.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Enter Student DID (did:edu:mm:...) or Credential Hash (0x...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputVal.trim()}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
            >
              {loading ? 'Verifying...' : 'Verify Proof'}
            </button>
          </form>

          {/* Sample quick button */}
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <span>Examples:</span>
            <button
              type="button"
              onClick={() => {
                const sampleDID = 'did:edu:mm:013:MMR013001001-BEHS01-2026-STU0042';
                setInputVal(sampleDID);
                setSearchParams({ identifier: sampleDID });
                performVerification(sampleDID);
              }}
              className="text-indigo-600 hover:underline font-mono"
            >
              BEHS 1 Dagon Sample DID
            </button>
          </div>
        </div>

        {/* Verification Loading Skeleton */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
            <p className="text-xs font-semibold text-slate-700">Verifying Cryptographic Signatures & On-Chain State...</p>
            <p className="text-[11px] text-slate-400">Checking Ed25519 digital signature and Merkle root against Polygon Amoy</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 text-xs flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Verification Result Card */}
        {searched && !loading && result && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Verification Status Banner */}
            <div
              className={`p-6 border-b flex items-center justify-between ${
                result.is_valid
                  ? 'bg-emerald-500/10 border-emerald-200 text-emerald-900'
                  : 'bg-rose-500/10 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.is_valid ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle className="h-8 w-8 text-rose-600 flex-shrink-0" />
                )}
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    {result.is_valid ? 'Authentic & Independently Verified' : 'Verification Warning / Invalid'}
                  </h2>
                  <p className="text-xs font-medium opacity-80">{result.message}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  result.is_valid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {result.is_valid ? 'VALID PROOF' : 'INVALID'}
              </span>
            </div>

            {/* Proof Breakdown */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* School Authority */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" /> Issuing School Facility
                  </div>
                  <p className="text-sm font-bold text-slate-900">{result.school_name || 'BEHS 1 Dagon'}</p>
                  <p className="text-xs text-slate-500 font-mono">Code: {result.school_code}</p>
                </div>

                {/* Decentralized Identifier */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <Hash className="h-3.5 w-3.5 text-purple-600" /> Decentralized Identifier (DID)
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900 break-all">{result.did}</p>
                  <p className="text-[10px] text-slate-400">W3C Standard Compliant</p>
                </div>
              </div>

              {/* Cryptographic Validation Checklist */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Cryptographic Audit Verification
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">1. School Digital Signature (Ed25519)</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        result.signature_valid ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {result.signature_valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {result.signature_valid ? 'Mathematically Valid' : 'Failed Signature'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">2. Revocation Status</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        !result.is_revoked ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {!result.is_revoked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {!result.is_revoked ? 'Active & Good Standing' : 'REVOKED'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-medium">3. Layer-2 Blockchain Merkle Anchor</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        result.merkle_root ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {result.merkle_root ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {result.merkle_root ? 'Anchored (Polygon L2)' : 'Local Certified (Batch Pending)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              <div className="rounded-2xl bg-slate-900 text-slate-100 p-5 space-y-3 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-400 font-sans text-xs">
                  <span className="font-bold uppercase tracking-wider">Cryptographic Fingerprints</span>
                  <span>{result.network}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Credential SHA-256 Hash:</span>
                  <span className="text-indigo-300 break-all">{result.credential_hash}</span>
                </div>
                {result.merkle_root && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Merkle Root Hash:</span>
                    <span className="text-emerald-300 break-all">{result.merkle_root}</span>
                  </div>
                )}
                {result.polygon_tx_hash && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Polygon L2 Transaction:</span>
                    <span className="text-sky-300 break-all">{result.polygon_tx_hash}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
