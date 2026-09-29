import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeImage } from './QRCodeImage';
import { StudentBlockchainIDResponse } from '../types';
import { getTownshipBurmese, getSchoolBurmese } from '../utils/mimuTranslations';
import {
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Printer,
} from 'lucide-react';

interface StudentSmartCardProps {
  blockchainId: StudentBlockchainIDResponse;
  gradeLevel?: string;
  className?: string;
  photoUrl?: string;
  showPrintButton?: boolean;
}

export const StudentSmartCard: React.FC<StudentSmartCardProps> = ({
  blockchainId,
  gradeLevel,
  className,
  photoUrl,
  showPrintButton = true,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // 1. School name & Township in Burmese from MIMU
  const schoolBurmese = getSchoolBurmese(blockchainId.issuer_school, blockchainId.issuer_school_my);
  const displaySchool = schoolBurmese.includes('အင်းတိုင်') ? 'အထက အင်းတိုင်' : schoolBurmese;
  const townshipBurmese = getTownshipBurmese(blockchainId.township) || 'လှည်းကူးမြို့နယ်';

  // 2. Grade & Academic Year formatting in Burmese:
  // e.g. "Grade 5-A (မူလတန်း) • 2026-2027 ပညာသင်နှစ်"
  const getGradeBurmese = () => {
    const rawClass = (className || '').trim();
    const rawGrade = (gradeLevel || '').trim();

    let classNameStr = rawClass;
    if (!classNameStr) {
      if (rawGrade === 'KG') classNameStr = 'KG';
      else if (rawGrade.startsWith('Grade')) classNameStr = rawGrade;
      else if (rawGrade) classNameStr = `Grade ${rawGrade}`;
      else classNameStr = 'Grade 5-A';
    }

    // Determine school category in Burmese
    let category = 'မူလတန်း'; // Default Primary
    const combined = `${classNameStr} ${rawGrade}`.toLowerCase();
    if (combined.includes('kg') || combined.includes('kindergarten')) {
      category = 'သူငယ်တန်း';
    } else if (
      combined.includes('grade 6') ||
      combined.includes('grade 7') ||
      combined.includes('grade 8') ||
      combined.includes('grade 9') ||
      combined.includes('middle')
    ) {
      category = 'အလယ်တန်း';
    } else if (
      combined.includes('grade 10') ||
      combined.includes('grade 11') ||
      combined.includes('grade 12') ||
      combined.includes('high')
    ) {
      category = 'အထက်တန်း';
    }

    return `${classNameStr} (${category}) • 2026-2027 ပညာသင်နှစ်`;
  };

  const gradeDisplay = getGradeBurmese();

  // 3. Extract last part of the DID string for QR code label:
  // e.g. did:edu:mm:013:MMR013035-BEHS01-2026-STU0042 -> STU0042
  const getLastPart = (did: string) => {
    if (!did) return 'STU0000';
    const parts = did.split('-');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    const colonParts = did.split(':');
    return colonParts[colonParts.length - 1];
  };

  const lastPart = getLastPart(blockchainId.did);
  const qrSubLabel = `did:edu:mm:...-${lastPart}`;

  // Verification URL
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/edu/verify?did=${encodeURIComponent(blockchainId.did)}`
    : `/edu/verify?did=${encodeURIComponent(blockchainId.did)}`;

  return (
    <div className="flex flex-col items-center select-none">
      {/* Print-specific style block for CR80 standard credit card (85.6mm x 53.98mm) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-smart-card-area, #print-smart-card-area * {
            visibility: visible;
          }
          #print-smart-card-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 85.6mm !important;
            height: 53.98mm !important;
            margin: 0 !important;
            padding: 4.5mm !important;
            border-radius: 3.18mm !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ID-1 / Credit Card Format Container: 85.6mm x 53.98mm ratio (approx 480px x 302px) */}
      <div
        id="print-smart-card-area"
        className="w-full max-w-[480px] h-[302px] rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between"
      >
        {/* Visual Card Holographic Ambient Blur */}
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

        {/* ---------------- CARD HEADER ---------------- */}
        {/* [Photo]  အထက အင်းတိုင်                                        [((o)) NFC] */}
        {/* လှည်းကူးမြို့နယ် */}
        <div className="relative z-10 flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {/* [Photo] Student Passport Avatar / Photo */}
            <div className="relative w-11 h-13 rounded-lg overflow-hidden border-2 border-indigo-300/40 bg-slate-800 shadow-md flex-shrink-0 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt={blockchainId.student_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-indigo-800 to-slate-900 flex flex-col items-center justify-center p-1 text-center">
                  <div className="w-5 h-5 rounded-full bg-amber-400/80 border border-amber-300/50 mb-0.5" />
                  <div className="w-7 h-3 rounded-t-md bg-emerald-600 border border-emerald-400/60" />
                </div>
              )}
              {/* Photo watermark tag */}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[6px] font-bold text-center text-slate-300 py-0.2 uppercase">
                STUDENT
              </div>
            </div>

            {/* School Burmese Name & Township */}
            <div>
              <div className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>{displaySchool}</span>
              </div>
              <div className="text-xs text-indigo-200 font-sans tracking-tight mt-0.5">
                <span>{townshipBurmese}</span>
              </div>
            </div>
          </div>

          {/* Right: [((o)) NFC] Smart Contactless Wave Indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0 bg-indigo-950/70 border border-indigo-400/30 px-2.5 py-1 rounded-xl shadow-xs">
            <Wifi className="h-4 w-4 text-emerald-400 rotate-90 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-emerald-300 font-mono">
              ((o)) NFC
            </span>
            <div className="w-5 h-4 ml-0.5 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-xs flex items-center justify-center p-0.5">
              <div className="w-full h-full border border-amber-800/40 rounded-xs grid grid-cols-2 grid-rows-2 gap-0.5 opacity-80">
                <div className="border-r border-b border-amber-800/40" />
                <div className="border-b border-amber-800/40" />
                <div className="border-r border-amber-800/40" />
                <div />
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- CARD BODY ---------------- */}
        {/* ကျောင်းသားကဒ်                 +----------------+ */}
        {/* MAUNG KYAW KYAW              |  [QR CODE]     | */}
        {/* Grade 5-A (မူလတန်း) • 2026-2027 ပညာသင်နှစ်  | did:edu:mm:...-STU0042 | */}
        {/*                              +----------------+ */}
        {/* DID: did:edu:mm:013:MMR013035-BEHS01-2026-STU0042 [Copy] */}
        <div className="relative z-10 grid grid-cols-3 gap-2 items-center my-auto">
          <div className="col-span-2 space-y-1">
            {/* Title: ကျောင်းသားကဒ် */}
            <div>
              <span className="text-xs font-bold text-amber-300 font-sans tracking-wide">
                ကျောင်းသားကဒ်
              </span>
            </div>

            {/* Student Name */}
            <h2
              className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase truncate"
              title={blockchainId.student_name}
            >
              {blockchainId.student_name}
            </h2>

            {/* Grade Level in Burmese */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 font-sans">
                {gradeDisplay}
              </span>
            </div>

            {/* Full DID on Card with Copy button */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase font-mono">DID:</span>
              <div
                className="px-2 py-0.5 rounded bg-slate-950/80 border border-indigo-500/20 text-[9.5px] font-mono text-indigo-200/90 truncate max-w-[200px]"
                title={blockchainId.did}
              >
                {blockchainId.did}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(blockchainId.did)}
                className="no-print text-indigo-400 hover:text-indigo-300 p-1 transition"
                title="Copy DID"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Right Column: [QR CODE] with DID encoded and sublabel */}
          <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white text-slate-900 shadow-md ml-auto">
            <QRCodeImage
              value={verifyUrl}
              size={76}
              className="rounded"
              alt="Student Blockchain DID QR"
            />
            {/* Sublabel under QR code: did:edu:mm:...-STU0042 */}
            <span
              className="text-[7px] text-slate-700 font-mono font-bold tracking-tighter uppercase mt-0.5 truncate max-w-[82px]"
              title={blockchainId.did}
            >
              {qrSubLabel}
            </span>
          </div>
        </div>

        {/* ---------------- CARD BOTTOM ---------------- */}
        {/* [W3C Verifiable Identity]   [Polygon L2 Anchored]            [Verifier] */}
        <div className="relative z-10 pt-2 border-t border-indigo-500/20 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider">
            <span className="text-indigo-300 bg-indigo-950/90 px-2.5 py-0.5 rounded border border-indigo-800/80">
              W3C Verifiable Identity
            </span>
            <span className="text-emerald-300 bg-emerald-950/90 px-2.5 py-0.5 rounded border border-emerald-800/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Polygon L2 Anchored
            </span>
          </div>

          <div className="no-print flex items-center gap-1.5">
            <Link
              to={`/verify?did=${encodeURIComponent(blockchainId.did)}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold shadow transition shrink-0"
              title="Open in Public Verifier"
            >
              <ExternalLink className="h-3 w-3" /> Verifier
            </Link>
          </div>
        </div>
      </div>

      {/* Action Toolbar: Print Card for PVC Printer & Copy DID */}
      {showPrintButton && (
        <div className="no-print flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700 shadow-sm transition"
          >
            <Printer className="h-4 w-4 text-indigo-400" />
            <span>Print Smart Card (PVC CR80)</span>
          </button>
          <button
            type="button"
            onClick={() => copyToClipboard(blockchainId.did)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
            <span>{copied ? 'DID Copied!' : 'Copy DID'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
