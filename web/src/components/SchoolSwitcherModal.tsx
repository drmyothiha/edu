import React, { useState, useMemo } from 'react';
import { SchoolDTO } from '../types';
import { useSchoolCache } from '../hooks/useSchoolCache';
import {
  Building,
  Search,
  X,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Database,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface SchoolSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSchoolId?: string | null;
  onSelect: (school: SchoolDTO) => void;
}

export const SchoolSwitcherModal: React.FC<SchoolSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentSchoolId,
  onSelect,
}) => {
  const { schools, loading, isRevalidating, meta, refresh } = useSchoolCache({ autoFetch: isOpen });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Extract distinct regions for quick filter
  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const s of schools) {
      if (s.region) set.add(s.region);
    }
    return Array.from(set).sort();
  }, [schools]);

  // Filtered schools
  const filteredSchools = useMemo(() => {
    let result = schools;
    if (selectedRegion !== 'ALL') {
      result = result.filter((s) => s.region === selectedRegion);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((s) => {
        const nameEn = (s.name || '').toLowerCase();
        const nameMy = (s.name_my || '');
        const code = (s.code || '').toLowerCase();
        const city = (s.city || '').toLowerCase();
        const tsp = (s.township_name || '').toLowerCase();
        const cat = (s.school_category || '').toLowerCase();
        return (
          nameEn.includes(q) ||
          nameMy.includes(q) ||
          code.includes(q) ||
          city.includes(q) ||
          tsp.includes(q) ||
          cat.includes(q)
        );
      });
    }
    return result;
  }, [schools, searchTerm, selectedRegion]);

  const totalPages = Math.ceil(filteredSchools.length / pageSize) || 1;
  const paginatedSchools = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSchools.slice(start, start + pageSize);
  }, [filteredSchools, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ကျောင်းပြောင်းရွှေ့ကြည့်ရှုရန် (Switch School Facility)
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Database className="h-3 w-3 text-emerald-600" />
                  IndexedDB Cache ({schools.length.toLocaleString()} schools)
                </span>
                {isRevalidating ? (
                  <span className="flex items-center gap-1 font-semibold text-[11px] text-indigo-600 animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Silently updating...
                  </span>
                ) : meta?.last_cached_at ? (
                  <span className="text-[10px] text-slate-400">
                    Synced {new Date(meta.last_cached_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Region Filter Bar */}
        <div className="pt-4 pb-2 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by school name, Option A code, township (e.g. Dagon, BEHS, MMR013)..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => {
                  setSelectedRegion('ALL');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedRegion === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Regions ({schools.length})
              </button>
              {regions.map((reg) => (
                <button
                  key={reg}
                  onClick={() => {
                    setSelectedRegion(reg);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedRegion === reg
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {reg}
                </button>
              ))}
            </div>

            <button
              onClick={() => refresh()}
              disabled={isRevalidating}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-xs flex items-center gap-1 flex-shrink-0"
              title="Force silent refresh from API"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRevalidating ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 -mr-1 my-2">
          {loading && schools.length === 0 ? (
            <div className="py-12 text-center">
              <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading school directory into IndexedDB cache...</p>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်း မတွေ့ရှိပါ
            </div>
          ) : (
            paginatedSchools.map((s) => {
              const isCurrent = s.id === currentSchoolId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-indigo-50/80 border border-indigo-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {s.name_my || s.name}
                      </span>
                      {s.school_category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex-shrink-0">
                          {s.school_category}
                        </span>
                      )}
                    </div>
                    {s.name_my && s.name && s.name !== s.name_my && (
                      <p className="text-[11px] text-slate-500 truncate mb-1">{s.name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {s.code}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-600 font-sans">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {s.city}, {s.region}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" /> လက်ရှိကျောင်း
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600 transition">
                        Select →
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700">{filteredSchools.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-bold text-slate-700">{Math.min(page * pageSize, filteredSchools.length)}</span> of{' '}
            <span className="font-bold text-slate-700">{filteredSchools.length.toLocaleString()}</span> schools
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-[11px]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
