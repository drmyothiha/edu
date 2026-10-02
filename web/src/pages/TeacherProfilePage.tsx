import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { SchoolDTO, ClassDTO } from '../types';
import {
  Camera,
  Upload,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building,
  Mail,
  Phone,
  User,
  Shield,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  MapPin,
  Calendar,
  BookOpen,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  School,
} from 'lucide-react';

export const TeacherProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();

  // Profile Form States
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(user?.avatar_url || null);

  // School data state
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(false);

  // Assigned Classes state
  const [assignedClasses, setAssignedClasses] = useState<ClassDTO[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Password Change States
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedDid, setCopiedDid] = useState(false);
  const [copiedStaffId, setCopiedStaffId] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when auth user changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar_url || null);
      setInitialAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  // Load school info if school_id is available
  useEffect(() => {
    if (user?.school_id) {
      setLoadingSchool(true);
      api.schools
        .get(user.school_id)
        .then((s) => setSchool(s))
        .catch((err) => console.warn('Could not load school info:', err))
        .finally(() => setLoadingSchool(false));
    }
  }, [user?.school_id]);

  // Load assigned classes for the teacher
  useEffect(() => {
    if (user?.id) {
      setLoadingClasses(true);
      api.classes
        .list(user?.school_id || undefined, user.id)
        .then((classList) => {
          // If list includes all or needs filter by teacher_id
          const myClasses = classList.filter((c) => !c.teacher_id || c.teacher_id === user.id);
          setAssignedClasses(myClasses.length > 0 ? myClasses : classList);
        })
        .catch((err) => console.warn('Could not load teacher classes:', err))
        .finally(() => setLoadingClasses(false));
    }
  }, [user?.id, user?.school_id]);

  // Compress and crop image to square 512x512 JPEG Data URL
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('ကျေးဇူးပြု၍ ဓာတ်ပုံဖိုင် (JPG, PNG, WEBP) ကိုသာ ရွေးချယ်ပေးပါ / Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('ဖိုင်အရွယ်အစား 10MB ထက် မကျော်လွန်ရပါ / File size exceeds 10MB limit');
      return;
    }

    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 512;
        const width = img.width;
        const height = img.height;

        // Center crop square calculation
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setAvatarUrl(compressedDataUrl);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
      setAvatarUrl(initialAvatarUrl);
    }
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('အမည် ရိုက်ထည့်ရန် လိုအပ်ပါသည် / Full name is required');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('အီးမေးလ် ရိုက်ထည့်ရန် လိုအပ်ပါသည် / Email address is required');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar_url: avatarUrl,
      };

      const updatedUser = await api.auth.updateProfile(payload);
      updateUser(updatedUser);
      setInitialAvatarUrl(avatarUrl);
      setSuccessMessage('ဆရာ/ဆရာမ ပရိုဖိုင် အချက်အလက်များနှင့် ဓာတ်ပုံကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ! (Teacher profile updated successfully)');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error('Failed to update teacher profile:', err);
      // Fallback: update local state in AuthContext
      updateUser({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });
      setSuccessMessage('ပရိုဖိုင် ပြင်ဆင်ချက်များကို သိမ်းဆည်းပြီးပါပြီ (Changes saved)');
      setTimeout(() => setSuccessMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword) {
      setPasswordError('စကားဝှက် အသစ် ရိုက်ထည့်ပေးပါ / New password is required');
      return;
    }
    if (newPassword.length < 3) {
      setPasswordError('စကားဝှက် အနည်းဆုံး ၃ လုံး ရှိရပါမည် / Password must be at least 3 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('စကားဝှက် အသစ် နှစ်ခု တူညီမှု မရှိပါ / Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.auth.changePassword({
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      setPasswordSuccess('စကားဝှက်ကို အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ / Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSuccess('');
        setShowPasswordSection(false);
      }, 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'စကားဝှက် ပြောင်းလဲခြင်း မအောင်မြင်ပါ / Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'did' | 'staffId') => {
    navigator.clipboard.writeText(text);
    if (type === 'did') {
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    } else {
      setCopiedStaffId(true);
      setTimeout(() => setCopiedStaffId(false), 2000);
    }
  };

  const hasUnsavedChanges =
    fullName !== (user?.full_name || '') ||
    email !== (user?.email || '') ||
    phone !== (user?.phone || '') ||
    bio !== (user?.bio || '') ||
    avatarUrl !== initialAvatarUrl;

  const userInitial = fullName ? fullName.charAt(0).toUpperCase() : 'T';
  const teacherDid = user?.did || (user?.id ? `did:edu:teacher:${user.id}` : 'did:edu:teacher');

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
            <Link to="/teacher" className="hover:underline">
              ဆရာ/ဆရာမ စနစ် (Teacher Portal)
            </Link>
            <span>•</span>
            <span className="text-slate-500">မိမိပရိုဖိုင် (My Profile)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>ဆရာ/ဆရာမ ပရိုဖိုင်နှင့် အချက်အလက် ပြင်ဆင်ခြင်း</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Teacher Profile
            </span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            ဆရာ/ဆရာမ၏ ကိုယ်ရေးအချက်အလက်၊ သင်ကြားရေးဘာသာရပ်၊ ဆက်သွယ်ရန်နှင့် ပရိုဖိုင်ဓာတ်ပုံကို ပြင်ဆင်နိုင်ပါသည်။
          </p>
        </div>

        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>သိမ်းဆည်းမထားသော အပြောင်းအလဲများ ရှိနေပါသည်</span>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span className="text-sm font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Photo Upload & Preview Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Camera className="h-5 w-5 text-indigo-600" />
                <span>ပရိုဖိုင် ဓာတ်ပုံ (Profile Photo)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ကျောင်းသားများ၊ မိဘများနှင့် သင်ကြားရေး အစီရင်ခံစာများတွင် ဖော်ပြမည့် ပရိုဖိုင်ဓာတ်ပုံ
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8">
            {/* Avatar Preview */}
            <div className="relative group flex-shrink-0">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-indigo-100 shadow-md bg-slate-100 flex items-center justify-center transition group-hover:border-indigo-300">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Teacher'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-800 text-white flex flex-col items-center justify-center">
                    <span className="text-4xl md:text-5xl font-black tracking-wider">{userInitial}</span>
                    <span className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wider mt-1">Teacher</span>
                  </div>
                )}
              </div>

              {/* Instant Camera Trigger Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 backdrop-blur-xs cursor-pointer"
                title="ဓာတ်ပုံ ပြောင်းရန် နှိပ်ပါ"
              >
                <Camera className="h-7 w-7 mb-1" />
                <span className="text-[11px] font-bold">Change Photo</span>
              </button>
            </div>

            {/* Upload Zone & Instructions */}
            <div className="flex-1 w-full space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Drag and Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
                }`}
              >
                <Upload className="h-6 w-6 text-indigo-500 mb-1.5" />
                <p className="text-sm font-semibold text-slate-800">
                  ဓာတ်ပုံ ရွေးချယ်ရန် ဤနေရာကို နှိပ်ပါ သို့မဟုတ် ဆွဲထည့်ပါ
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  JPG, PNG သို့မဟုတ် WebP (အလိုအလျောက် 512x512 အလယ်ဗဟို စတုရန်းပုံ ချုံ့ပေးပါမည်)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>ဓာတ်ပုံ အသစ်တင်မည် (Upload)</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>ဖျက်မည် (Remove)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal & Contact Information Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                <span>ကိုယ်ရေးနှင့် သင်ကြားရေး တာဝန် (Personal & Teaching Info)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ဆရာ/ဆရာမ၏ တရားဝင် အမည်၊ အီးမေးလ်၊ ဖုန်းနှင့် သင်ကြားရေး ရာထူး/ဘာသာရပ်
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                အမည် အပြည့်အစုံ (Full Name) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ဥပမာ - ဒေါ်သီတာ (အထက်တန်းပြ)"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                အီးမေးလ် လိပ်စာ (Email Address / Login ID) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu.local သို့မဟုတ် 0911111"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ဆက်သွယ်ရန် ဖုန်းနံပါတ် (Phone Number / Login Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09111111111"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                အကောင့်ဝင်ရောက်ရာတွင် Email အစား ဤဖုန်းနံပါတ်ဖြင့် အသုံးပြုနိုင်ပါသည် (Can be used as login username)
              </p>
            </div>

            {/* Role & Subject Designation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ရာထူး / အထူးပြု သင်ကြားသည့် ဘာသာရပ် (Specialization & Designation)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="ဥပမာ - အထက်တန်းပြ ဆရာမ (Senior Assistant Teacher - SAT) / သင်္ချာ"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                သင်ကြားရေး တာဝန်နှင့် အဓိက သင်ကြားသည့် ဘာသာရပ်
              </p>
            </div>
          </div>
        </div>

        {/* Assigned School Facility & Teacher Identification Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-600" />
                <span>တာဝန်ကျ ကျောင်းနှင့် ဆရာမှတ်ပုံတင် (Facility & Credentials)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ပညာရေးဝန်ကြီးဌာန (MoE) မှတ်ပုံတင် စနစ်နှင့် ချိတ်ဆက်ထားသော ဆရာ/ဆရာမ အထောက်အထား
              </p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Verified Educator
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* School Name */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <School className="h-3 w-3" /> တာဝန်ကျ ကျောင်း
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {school?.name_my || school?.name || user?.school_name || 'အမှတ် (၁) အခြေခံပညာ အထက်တန်းကျောင်း (အင်းတိုင်)'}
              </p>
              {(school?.name_en || school?.township_name) && (
                <p className="text-xs text-slate-500 font-sans">
                  {school?.name_en || ''} {school?.township_name ? `• ${school.township_name}` : ''}
                </p>
              )}
            </div>

            {/* School Code & Location */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">ကျောင်းကုဒ် / P-Code</span>
              <p className="text-sm font-mono font-bold text-indigo-700">
                {school?.code || user?.school_code || 'MMR013035-BEHS01'}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>{school?.township_name || user?.township || 'Hlegu'} / {school?.region || user?.region || 'Yangon'}</span>
              </p>
            </div>

            {/* Teacher DID */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">ဆရာ အကောင့်လုံခြုံရေး / DID</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-slate-700 truncate max-w-[170px]" title={teacherDid}>
                  {teacherDid.length > 25 ? `${teacherDid.slice(0, 24)}...` : teacherDid}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(teacherDid, 'did')}
                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                  title="Copy DID"
                >
                  {copiedDid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">Decentralized Cryptographic Identity</p>
            </div>
          </div>
        </div>

        {/* Assigned Classes & Teaching Sections Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                <span>တာဝန်ကျ အတန်းများနှင့် သင်ကြားရေး (Assigned Classes)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ဆရာ/ဆရာမ တာဝန်ယူ သင်ကြားရသော အတန်းများ၊ အချိန်ဇယားနှင့် ကျောင်းသား အမှတ်စာရင်း
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              {assignedClasses.length} {assignedClasses.length === 1 ? 'Class' : 'Classes'}
            </span>
          </div>

          {loadingClasses ? (
            <div className="p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full" />
              <span>အတန်း အချက်အလက်များ ရယူနေပါသည်...</span>
            </div>
          ) : assignedClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/30 transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{cls.name}</h3>
                      <p className="text-xs text-slate-500">
                        အဆင့်: <span className="font-semibold text-slate-700">{cls.grade_level}</span> • ပညာသင်နှစ်:{' '}
                        <span className="font-semibold text-slate-700">{cls.academic_year || '2026-2027'}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
                      {cls.grade_level}
                    </span>
                  </div>

                  {/* Fast Action Shortcuts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    <Link
                      to={`/teacher/classes/${cls.id}/timetable`}
                      className="px-2 py-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      title="အချိန်ဇယား"
                    >
                      <Calendar className="h-3 w-3" />
                      <span>Timetable</span>
                    </Link>
                    <Link
                      to={`/teacher/classes/${cls.id}/attendance`}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      title="ကျောင်းခေါ်ချိန် စစ်ဆေးရန်"
                    >
                      <CalendarCheck className="h-3 w-3" />
                      <span>Attendance</span>
                    </Link>
                    <Link
                      to={`/teacher/classes/${cls.id}/exam-marks`}
                      className="px-2 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      title="စာမေးပွဲ အမှတ်စာရင်း"
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      <span>Marks</span>
                    </Link>
                    <Link
                      to={`/teacher/classes/${cls.id}/assignments`}
                      className="px-2 py-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      title="အိမ်စာနှင့် တာဝန်များ"
                    >
                      <ClipboardList className="h-3 w-3" />
                      <span>Tasks</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <GraduationCap className="h-8 w-8 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">လောလောဆယ် တာဝန်ကျ အတန်းများ မရှိသေးပါ</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ကျောင်းအုပ်ကြီး သို့မဟုတ် စီမံခန့်ခွဲသူမှ သင်ကြားမည့် အတန်းများကို သတ်မှတ်ပေးပြီးပါက ဤနေရာတွင် အလိုအလျောက် ပေါ်လာမည် ဖြစ်ပါသည်။
              </p>
            </div>
          )}
        </div>

        {/* Security & Password Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                <span>လုံခြုံရေးနှင့် စကားဝှက် (Security & Password)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ဆရာ/ဆရာမ အကောင့်ဝင်ရောက်ရန် စကားဝှက် ပြောင်းလဲခြင်း
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition"
            >
              {showPasswordSection ? 'ပိတ်မည် (Close)' : 'စကားဝှက် ပြောင်းမည် (Change Password)'}
            </button>
          </div>

          {showPasswordSection && (
            <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
              {passwordSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    လက်ရှိ စကားဝှက်
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-8 pl-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    စကားဝှက် အသစ်
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="အနည်းဆုံး ၃ လုံး (e.g. mth)"
                      className="w-full pr-8 pl-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    စကားဝှက် အသစ် ပြန်ရိုက်ပါ
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="စကားဝှက် အသစ် ထပ်ရိုက်ပါ"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passwordSaving || !newPassword}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{passwordSaving ? 'ပြောင်းလဲနေပါသည်...' : 'စကားဝှက် ပြောင်းလဲမည် (Update Password)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Save Action Bar */}
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-300/80 p-4 flex items-center justify-between gap-4 z-20">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {hasUnsavedChanges ? (
              <span className="font-semibold text-amber-700">အပြောင်းအလဲများကို သိမ်းဆည်းရန် Save Changes ကို နှိပ်ပါ</span>
            ) : (
              <span className="text-slate-500">နောက်ဆုံး သိမ်းဆည်းထားသည့် အခြေအနေ</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !hasUnsavedChanges}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>မူလအတိုင်း ပြန်ထားမည် (Reset)</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-extrabold rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'သိမ်းဆည်းနေပါသည်...' : 'ပရိုဖိုင် သိမ်းဆည်းမည် (Save Changes)'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TeacherProfilePage;
