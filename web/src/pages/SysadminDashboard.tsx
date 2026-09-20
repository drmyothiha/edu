import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SchoolDTO, CreateSchoolRequest, PCodeDTO } from '../types';
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
} from 'lucide-react';

export const SysadminDashboard: React.FC = () => {
  const [schools, setSchools] = useState<SchoolDTO[]>([]);
  const [states, setStates] = useState<PCodeDTO[]>([]);
  const [townships, setTownships] = useState<PCodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // New School Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedStatePCode, setSelectedStatePCode] = useState('MMR013'); // default Yangon
  const [selectedTownshipPCode, setSelectedTownshipPCode] = useState('MMR013001'); // default Dagon
  const [wardNumber, setWardNumber] = useState('001');
  const [wardName, setWardName] = useState('Ward No. 1');
  const [schoolCategory, setSchoolCategory] = useState('HS');
  const [sequenceNumber, setSequenceNumber] = useState('01');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derived Option A Code Preview: {Ward_PCode}-{Category}{Seq}
  const fullWardPCode = `${selectedTownshipPCode}${wardNumber.padStart(3, '0')}`;
  const generatedOptionACode = `${fullWardPCode}-${schoolCategory}${sequenceNumber.padStart(2, '0')}`;

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schoolsData, statesData] = await Promise.all([
        api.schools.list(),
        api.pcodes.states(),
      ]);
      setSchools(schoolsData);
      setStates(statesData);

      // Fetch initial townships for default state
      if (statesData.length > 0) {
        const tsData = await api.pcodes.townships('MMR013');
        setTownships(tsData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school facilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // When selected State/Region changes in modal, fetch corresponding townships
  const handleStateChange = async (srPCode: string) => {
    setSelectedStatePCode(srPCode);
    try {
      const tsData = await api.pcodes.townships(srPCode);
      setTownships(tsData);
      if (tsData.length > 0) {
        setSelectedTownshipPCode(tsData[0].pcode);
      }
    } catch {
      // ignore
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
        pcode_level: 'ward',
        township_name: currentTS?.name_en || '',
        ward_village_name: wardName.trim(),
        school_category: schoolCategory,
      };

      const created = await api.schools.create(payload);
      setSchools((prev) => [created, ...prev]);
      setSuccessMsg(`School "${created.name}" provisioned with Option A Code [${created.code}]!`);
      setModalOpen(false);
      setName('');
      setAddress('');
      setPhone('');
    } catch (err: any) {
      setError(err.message || 'Failed to provision school');
    } finally {
      setCreating(false);
    }
  };

  const regions = Array.from(new Set(schools.map((s) => s.region).filter(Boolean)));
  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      (s.pcode_ts && s.pcode_ts.toLowerCase().includes(search.toLowerCase())) ||
      (s.pcode_ward_vt && s.pcode_ward_vt.toLowerCase().includes(search.toLowerCase()));

    const matchesRegion = selectedRegionFilter === 'all' || s.region === selectedRegionFilter;
    const matchesCategory =
      selectedCategoryFilter === 'all' || (s.school_category || 'HS') === selectedCategoryFilter;

    return matchesSearch && matchesRegion && matchesCategory;
  });

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'HS':
        return { label: 'BEHS (အ.ထ.က)', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'MS':
        return { label: 'BEMS (အ.လ.က)', bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'PS':
        return { label: 'BEPS (အ.မ.က)', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'PV':
        return { label: 'Private (ကိုယ်ပိုင်)', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'ME':
        return { label: 'Monastic (ဘ.က)', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      default:
        return { label: 'School (ကျောင်း)', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
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

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialData}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
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
          <p className="text-3xl font-black text-slate-900 mt-2">{schools.length}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Across {regions.length} Regions
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">MIMU Coverage</span>
            <Globe2 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{states.length}</p>
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
            placeholder="Search school name, code, or P-Code..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All States & Regions</option>
            {regions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="HS">High School (အ.ထ.က)</option>
            <option value="MS">Middle School (အ.လ.က)</option>
            <option value="PS">Primary School (အ.မ.က)</option>
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
      ) : filteredSchools.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No school facilities found</p>
          <p className="text-xs text-slate-400">Try adjusting search filters or provision a new facility.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchools.map((school) => {
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
                    {school.name}
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
                  <span className="font-semibold text-indigo-600">Active Tenant</span>
                </div>
              </div>
            );
          })}
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
                    onChange={(e) => setSelectedTownshipPCode(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {townships.map((ts) => (
                      <option key={ts.pcode} value={ts.pcode}>
                        {ts.name_en} ({ts.pcode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ward P-Code Suffix & Ward Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ward / Village Tract No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={wardNumber}
                    onChange={(e) => setWardNumber(e.target.value)}
                    placeholder="001"
                    maxLength={3}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Ward PCode: {fullWardPCode}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ward / Village Name
                  </label>
                  <input
                    type="text"
                    value={wardName}
                    onChange={(e) => setWardName(e.target.value)}
                    placeholder="e.g. Ward No. 1 / အမှတ် (၁) ရပ်ကွက်"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
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
                    <option value="HS">BEHS (အ.ထ.က) - High School</option>
                    <option value="MS">BEMS (အ.လ.က) - Middle School</option>
                    <option value="PS">BEPS (အ.မ.က) - Primary School</option>
                    <option value="PO">Post-Primary (အ.ထ.က(ခွဲ))</option>
                    <option value="PV">Private / International (ကိုယ်ပိုင်)</option>
                    <option value="ME">Monastic (ဘ.က - ဘုန်းတော်ကြီးသင်)</option>
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
