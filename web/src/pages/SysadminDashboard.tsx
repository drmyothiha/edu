import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { SchoolDTO, CreateSchoolRequest, PCodeDTO } from '../types';
import { silentlyRefreshSchoolsCache } from '../services/schoolCacheStorage';
import {
  Building2,
  Globe2,
  Plus,
  Search,
  Filter,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  GraduationCap,
  Sparkles,
  Tag,
  Hash,
  Layers,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export const SysadminDashboard: React.FC = () => {
  const [schools, setSchools] = useState<SchoolDTO[]>([]);
  const [states, setStates] = useState<PCodeDTO[]>([]);
  const [townships, setTownships] = useState<PCodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Server-side pagination & filter states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(24);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [anchoring, setAnchoring] = useState(false);

  // New School Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedStatePCode, setSelectedStatePCode] = useState('MMR013'); // default Yangon
  const [selectedTownshipPCode, setSelectedTownshipPCode] = useState('MMR013001'); // default Dagon
  const [wards, setWards] = useState<PCodeDTO[]>([]);
  const [selectedWardPCode, setSelectedWardPCode] = useState<string>('');
  const [loadingWards, setLoadingWards] = useState(false);
  const [wardNumber, setWardNumber] = useState('001');
  const [wardName, setWardName] = useState('Ward No. 1');
  const [schoolCategory, setSchoolCategory] = useState('BEHS');
  const [sequenceNumber, setSequenceNumber] = useState('01');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Debounce search input to avoid hitting backend on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated schools from server
  const fetchSchools = useCallback(
    async (
      targetPage: number,
      targetLimit: number,
      targetSearch: string,
      targetRegion: string,
      targetCategory: string
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.schools.list({
          page: targetPage,
          limit: targetLimit,
          search: targetSearch || undefined,
          region: targetRegion !== 'all' ? targetRegion : undefined,
          category: targetCategory !== 'all' ? targetCategory : undefined,
        });
        setSchools(res.data);
        setTotalCount(res.pagination.total);
        setTotalPages(res.pagination.total_pages);
        setPage(res.pagination.page);
      } catch (err: any) {
        setError(err.message || 'Failed to load school facilities');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch wards & village tracts for a given township
  const fetchWardsForTownship = useCallback(async (tsPCode: string, targetWardNum?: string) => {
    if (!tsPCode) {
      setWards([]);
      setSelectedWardPCode('');
      return;
    }
    setLoadingWards(true);
    try {
      const wardData = await api.pcodes.wards(tsPCode);
      setWards(wardData);
      if (wardData.length > 0) {
        const desiredSuffix = targetWardNum !== undefined ? targetWardNum : '001';
        const match =
          wardData.find((w) => w.pcode.endsWith(desiredSuffix) || w.pcode.slice(-3) === desiredSuffix) ||
          wardData[0];
        setSelectedWardPCode(match.pcode);
        setWardName(match.name_my ? `${match.name_en} (${match.name_my})` : match.name_en);
        const suffix = match.pcode.slice(-3);
        if (/^\d{3}$/.test(suffix)) {
          setWardNumber(suffix);
        }
      } else {
        setSelectedWardPCode('');
      }
    } catch {
      setWards([]);
      setSelectedWardPCode('');
    } finally {
      setLoadingWards(false);
    }
  }, []);

  // Load MIMU metadata once on mount
  useEffect(() => {
    let ignore = false;
    const loadMetadata = async () => {
      try {
        const [statesData, tsData] = await Promise.all([
          api.pcodes.states(),
          api.pcodes.townships('MMR013'),
        ]);
        if (!ignore) {
          setStates(statesData);
          setTownships(tsData);
          if (tsData.length > 0) {
            fetchWardsForTownship(tsData[0].pcode, '001');
          }
          // Warm nationwide schools IndexedDB cache in background
          silentlyRefreshSchoolsCache().catch(() => {});
        }
      } catch {
        // ignore
      }
    };
    loadMetadata();
    return () => {
      ignore = true;
    };
  }, [fetchWardsForTownship]);

  // Fetch schools on filter/search/limit change (resets to page 1)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchSchools(1, limit, debouncedSearch, selectedRegionFilter, selectedCategoryFilter);
      return;
    }
    setPage(1);
    fetchSchools(1, limit, debouncedSearch, selectedRegionFilter, selectedCategoryFilter);
  }, [debouncedSearch, selectedRegionFilter, selectedCategoryFilter, limit, fetchSchools]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    fetchSchools(newPage, limit, debouncedSearch, selectedRegionFilter, selectedCategoryFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnchorBatch = async () => {
    setAnchoring(true);
    setError(null);
    try {
      const res = await api.blockchain.anchorBatch();
      if (res.batch_size > 0) {
        setSuccessMsg(`Anchored ${res.batch_size} credentials to ${res.network}! Merkle Root: [${res.merkle_root.slice(0, 16)}...] Tx: [${res.tx_hash.slice(0, 16)}...]`);
      } else {
        setSuccessMsg('All student credentials are already anchored to Layer-2.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to anchor credentials to blockchain');
    } finally {
      setAnchoring(false);
    }
  };

  // Derived Option A Code Preview: {Ward_PCode}-{Category}{Seq}
  const currentWardObj = wards.find((w) => w.pcode === selectedWardPCode);
  const fullWardPCode =
    selectedWardPCode && selectedWardPCode !== 'custom'
      ? selectedWardPCode
      : `${selectedTownshipPCode}${wardNumber.padStart(3, '0')}`;
  const generatedOptionACode = `${fullWardPCode}-${schoolCategory}${sequenceNumber ? sequenceNumber.padStart(2, '0') : '01'}`;

  // When selected State/Region changes in modal, fetch corresponding townships & wards
  const handleStateChange = async (srPCode: string) => {
    setSelectedStatePCode(srPCode);
    try {
      const tsData = await api.pcodes.townships(srPCode);
      setTownships(tsData);
      if (tsData.length > 0) {
        setSelectedTownshipPCode(tsData[0].pcode);
        fetchWardsForTownship(tsData[0].pcode);
      } else {
        setSelectedTownshipPCode('');
        setWards([]);
        setSelectedWardPCode('');
      }
    } catch {
      // ignore
    }
  };

  const handleTownshipChange = (tsPCode: string) => {
    setSelectedTownshipPCode(tsPCode);
    fetchWardsForTownship(tsPCode);
  };

  const handleWardSelect = (pcode: string) => {
    setSelectedWardPCode(pcode);
    if (pcode === 'custom') {
      return;
    }
    const match = wards.find((w) => w.pcode === pcode);
    if (match) {
      setWardName(match.name_my ? `${match.name_en} (${match.name_my})` : match.name_en);
      const suffix = match.pcode.slice(-3);
      if (/^\d{3}$/.test(suffix)) {
        setWardNumber(suffix);
      }
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const currentState = states.find((s) => s.pcode === selectedStatePCode);
      const currentTS = townships.find((t) => t.pcode === selectedTownshipPCode);

      const payload: CreateSchoolRequest = {
        name: name.trim(),
        code: generatedOptionACode,
        city: currentTS?.name_en || 'Yangon',
        region: currentState?.name_en || 'Yangon Region',
        address: address.trim(),
        phone: phone.trim(),
        status: 'active',
        pcode_sr: selectedStatePCode,
        pcode_ts: selectedTownshipPCode,
        pcode_ward_vt: fullWardPCode,
        pcode_level: currentWardObj?.pcode_type || 'ward',
        township_name: currentTS?.name_en || '',
        ward_village_name: wardName.trim(),
        school_category: schoolCategory,
      };

      const created = await api.schools.create(payload);
      setSuccessMsg(`School "${created.name}" provisioned with Option A Code [${created.code}]!`);
      setModalOpen(false);
      setName('');
      setAddress('');
      setPhone('');
      // Refresh current page & silently update IndexedDB cache
      fetchSchools(1, limit, debouncedSearch, selectedRegionFilter, selectedCategoryFilter);
      setPage(1);
      silentlyRefreshSchoolsCache().catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to provision school');
    } finally {
      setCreating(false);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'BEHS':
      case 'HS':
        return { label: 'BEHS (အ.ထ.က)', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'BEHS-BR':
      case 'PO':
        return { label: 'BEHS Branch (အ.ထ.က ခွဲ)', bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'BEMS':
      case 'MS':
        return { label: 'BEMS (အ.လ.က)', bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'BEPS':
      case 'PS':
        return { label: 'BEPS (အ.မ.က)', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'UNI':
      case 'UCSY':
      case 'YTU':
      case 'UIT':
      case 'HEI':
        return { label: `${cat} (တက္ကသိုလ်)`, bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'PV':
        return { label: 'Private (ကိုယ်ပိုင်)', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'ME':
        return { label: 'Monastic (ဘ.က)', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      default:
        return { label: cat ? `${cat} (ကျောင်း)` : 'School (ကျောင်း)', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-700 text-white shadow-sm">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                National Multi-Tenant Registry
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                MIMU P-Code v9.7
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              တစ်နိုင်ငံလုံးရှိ ကျောင်းများနှင့် တက္ကသိုလ်များ ကွန်ရက် စီမံခန့်ခွဲမှု • Option A P-Code Organization
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/verify"
            target="_blank"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Public Verifier
          </Link>
          <button
            onClick={handleAnchorBatch}
            disabled={anchoring}
            className="p-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Layers className="h-3.5 w-3.5" />
            {anchoring ? 'Anchoring to L2...' : 'Anchor Batch (Polygon L2)'}
          </button>
          <button
            onClick={() => fetchSchools(page, limit, debouncedSearch, selectedRegionFilter, selectedCategoryFilter)}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
          >
            <Plus className="h-4 w-4" /> Provision New School
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Nationwide Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Schools</span>
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{totalCount.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Across {states.length || 15} States & Regions
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">MIMU Coverage</span>
            <Globe2 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{states.length || 15}</p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
            All 15 States & Regions
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">P-Code Standard</span>
            <Hash className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 truncate">Option A</p>
          <span className="text-[11px] text-indigo-600 font-semibold mt-1 inline-block font-mono">
            {'{Ward}-{Type}{Seq}'}
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Tenant Partition</span>
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">Active</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Strict isolation
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name, code, city, township..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-xs"
          >
            <option value="all">All States & Regions (တစ်နိုင်ငံလုံး)</option>
            {states.map((st) => (
              <option key={st.pcode} value={st.pcode}>
                {st.name_en} ({st.name_my})
              </option>
            ))}
          </select>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="BEHS">BEHS (အ.ထ.က)</option>
            <option value="BEHS-BR">BEHS Branch (အ.ထ.က ခွဲ)</option>
            <option value="BEMS">BEMS (အ.လ.က)</option>
            <option value="BEPS">BEPS (အ.မ.က)</option>
            <option value="UNI">Universities (တက္ကသိုလ်များ)</option>
            <option value="PV">Private / Intl (ကိုယ်ပိုင်)</option>
            <option value="ME">Monastic (ဘ.က)</option>
          </select>
        </div>
      </div>

      {/* Schools Directory Cards */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading nationwide schools...</p>
        </div>
      ) : schools.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No school facilities found</p>
          <p className="text-xs text-slate-400">Try adjusting search filters or provision a new facility.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schools.map((school) => {
            const badge = getCategoryBadge(school.school_category);
            return (
              <div
                key={school.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        school.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {school.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-tight mt-1">
                    {school.name_my || school.name}
                  </h3>

                  {/* Option A MIMU P-Code Tag */}
                  <div className="flex items-center gap-1.5 mt-2 mb-3">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {school.code}
                    </span>
                    {school.pcode_ward_vt && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        P-Code: {school.pcode_ward_vt}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        {school.city}, {school.region}
                      </span>
                    </div>
                    {school.address && (
                      <div className="text-[11px] text-slate-500 pl-5 truncate">
                        {school.address}
                      </div>
                    )}
                    {school.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-mono text-[11px]">{school.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-mono">UUID: {school.id.slice(0, 8)}...</span>
                  <Link
                    to={`/school-admin?school_id=${school.id}`}
                    className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded transition"
                  >
                    Campus Classes <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server-Side Pagination Bar */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Showing <strong className="text-slate-900 font-semibold">{((page - 1) * limit) + 1}</strong> -{' '}
              <strong className="text-slate-900 font-semibold">{Math.min(page * limit, totalCount)}</strong> of{' '}
              <strong className="text-slate-900 font-semibold">{totalCount.toLocaleString()}</strong> schools
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Per page:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition font-medium"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-1">
              {getPageNumbers().map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(Number(p))}
                    disabled={loading}
                    className={`h-8 min-w-[32px] px-2 rounded-lg font-semibold transition ${
                      page === p
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition font-medium"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Provision School Modal with Cascading MIMU P-Codes */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Provision School with MIMU P-Code</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select Myanmar administrative divisions to automatically generate the standardized Option A School Code.
            </p>

            <form onSubmit={handleCreateSchool} className="space-y-4">
              {/* Option A Dynamic Code Preview Banner */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                    Generated Option A School Code
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded font-bold">
                    Official Format
                  </span>
                </div>
                <div className="font-mono text-lg font-black text-indigo-900 tracking-tight">
                  {generatedOptionACode}
                </div>
                <p className="text-[11px] text-indigo-700 mt-1">
                  Format: [Ward P-Code ({fullWardPCode})] - [Type ({schoolCategory})] [Seq ({sequenceNumber})]
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  School Name (ကျောင်းအမည်) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Basic Education High School No. 1 Dagon"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* State/Region & Township Cascading Dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    State / Region (တိုင်း / ပြည်နယ်) *
                  </label>
                  <select
                    value={selectedStatePCode}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {states.map((st) => (
                      <option key={st.pcode} value={st.pcode}>
                        {st.name_en} ({st.pcode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Township (မြို့နယ်) *
                  </label>
                  <select
                    value={selectedTownshipPCode}
                    onChange={(e) => handleTownshipChange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {townships.map((ts) => (
                      <option key={ts.pcode} value={ts.pcode}>
                        {ts.name_en} {ts.name_my ? `(${ts.name_my})` : ''} ({ts.pcode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ward / Village Tract MIMU Selector & Manual Fields */}
              <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      MIMU Ward / Village Tract (ရပ်ကွက် / ကျေးရွာအုပ်စု)
                    </label>
                    {loadingWards && (
                      <span className="text-[11px] text-indigo-600 animate-pulse font-semibold">
                        MIMU စာရင်း ရယူနေသည်...
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedWardPCode}
                    onChange={(e) => handleWardSelect(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="">
                      {wards.length > 0
                        ? `-- ရွေးချယ်ပါ / Select from ${wards.length} MIMU units --`
                        : '-- No MIMU units found (use manual entry) --'}
                    </option>
                    {wards.filter((w) => w.pcode_type === 'ward').length > 0 && (
                      <optgroup label="Urban Wards (မြို့ပေါ်ရပ်ကွက်များ)">
                        {wards
                          .filter((w) => w.pcode_type === 'ward')
                          .map((w) => (
                            <option key={w.pcode} value={w.pcode}>
                              {w.name_en} {w.name_my ? `(${w.name_my})` : ''} - {w.pcode}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {wards.filter((w) => w.pcode_type === 'village_tract').length > 0 && (
                      <optgroup label="Village Tracts (ကျေးရွာအုပ်စုများ)">
                        {wards
                          .filter((w) => w.pcode_type === 'village_tract')
                          .map((w) => (
                            <option key={w.pcode} value={w.pcode}>
                              {w.name_en} {w.name_my ? `(${w.name_my})` : ''} - {w.pcode}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <option value="custom">-- Custom / အခြား ကိုယ်တိုင်ထည့်မည် --</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Ward / Village Tract No. *
                    </label>
                    <input
                      type="text"
                      required
                      value={wardNumber}
                      onChange={(e) => {
                        setWardNumber(e.target.value);
                        setSelectedWardPCode('custom');
                      }}
                      placeholder="001"
                      maxLength={4}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono bg-white"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">Ward PCode: {fullWardPCode}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Ward / Village Name
                    </label>
                    <input
                      type="text"
                      value={wardName}
                      onChange={(e) => setWardName(e.target.value)}
                      placeholder="e.g. Alam / အာလမ်"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Category & Sequence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    School Level / Category *
                  </label>
                  <select
                    value={schoolCategory}
                    onChange={(e) => setSchoolCategory(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
                  >
                    <optgroup label="Basic Education (အခြေခံပညာ)">
                      <option value="BEHS">BEHS (အ.ထ.က) - High School</option>
                      <option value="BEHS-BR">BEHS-BR (အ.ထ.က ခွဲ) - High School Branch</option>
                      <option value="BEMS">BEMS (အ.လ.က) - Middle School</option>
                      <option value="BEPS">BEPS (အ.မ.က) - Primary School</option>
                    </optgroup>
                    <optgroup label="Higher Education (တက္ကသိုလ် / ကောလိပ်)">
                      <option value="UNI">UNI - General University (တက္ကသိုလ်)</option>
                      <option value="UCSY">UCSY - Computer University (ကွန်ပျူတာတက္ကသိုလ်)</option>
                      <option value="YTU">YTU - Technological University (နည်းပညာတက္ကသိုလ်)</option>
                      <option value="UIT">UIT - Information Technology University (သတင်းအချက်အလက်နည်းပညာတက္ကသိုလ်)</option>
                    </optgroup>
                    <optgroup label="Other Institutions (အခြား)">
                      <option value="PV">Private / International (ကိုယ်ပိုင်)</option>
                      <option value="ME">Monastic (ဘ.က - ဘုန်းတော်ကြီးသင်)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Facility Sequence No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={sequenceNumber}
                    onChange={(e) => setSequenceNumber(e.target.value)}
                    placeholder="01"
                    maxLength={2}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">e.g. 01 for No. 1, 16 for No. 16</span>
                </div>
              </div>

              {/* Address & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Campus Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Pyay Road, Dagon"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+95 1 234 567"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {creating && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  Register with Code: {generatedOptionACode}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
