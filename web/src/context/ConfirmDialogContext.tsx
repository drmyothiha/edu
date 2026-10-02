import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  cautionText?: string;
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: DialogVariant;
}

interface DialogState {
  isOpen: boolean;
  type: 'confirm' | 'alert';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: DialogVariant;
  cautionText?: string;
  resolve: (value: boolean) => void;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
  alert: (options: AlertDialogOptions | string) => Promise<void>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

// Global imperative trigger for non-hook usage
let globalConfirmTrigger: ((options: ConfirmDialogOptions | string) => Promise<boolean>) | null = null;
let globalAlertTrigger: ((options: AlertDialogOptions | string) => Promise<void>) | null = null;

export const showConfirmDialog = (options: ConfirmDialogOptions | string): Promise<boolean> => {
  if (globalConfirmTrigger) {
    return globalConfirmTrigger(options);
  }
  // Fallback to native window.confirm if context not mounted
  const msg = typeof options === 'string' ? options : options.message;
  return Promise.resolve(window.confirm(msg));
};

export const showAlertDialog = (options: AlertDialogOptions | string): Promise<void> => {
  if (globalAlertTrigger) {
    return globalAlertTrigger(options);
  }
  const msg = typeof options === 'string' ? options : options.message;
  window.alert(msg);
  return Promise.resolve();
};

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmDialogOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      const isDelete =
        opts.variant === 'danger' ||
        /remove|delete|ပယ်ဖျက်|ဖျက်|cancel/i.test(opts.message) ||
        /remove|delete|ပယ်ဖျက်/i.test(opts.title || '');

      setDialog({
        isOpen: true,
        type: 'confirm',
        title: opts.title || (isDelete ? 'သေချာပါသလား? (Confirmation)' : 'အတည်ပြုရန် (Confirmation)'),
        message: opts.message,
        confirmText: opts.confirmText || (isDelete ? 'ပယ်ဖျက်မည် (Remove)' : 'အတည်ပြုသည် (Confirm)'),
        cancelText: opts.cancelText || 'မလုပ်တော့ပါ (Cancel)',
        variant: opts.variant || (isDelete ? 'danger' : 'info'),
        cautionText: opts.cautionText || (isDelete ? 'ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရနိုင်ပါ (This action cannot be undone)' : undefined),
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertDialogOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setDialog({
        isOpen: true,
        type: 'alert',
        title: opts.title || 'အသိပေးချက် (Notice)',
        message: opts.message,
        confirmText: opts.buttonText || 'နားလည်ပါပြီ (OK)',
        cancelText: '',
        variant: opts.variant || 'info',
        resolve: () => resolve(),
      });
    });
  }, []);

  useEffect(() => {
    globalConfirmTrigger = confirm;
    globalAlertTrigger = alert;
    return () => {
      globalConfirmTrigger = null;
      globalAlertTrigger = null;
    };
  }, [confirm, alert]);

  // Handle keyboard events (Escape to cancel, Enter to confirm)
  useEffect(() => {
    if (!dialog?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto focus confirm button or cancel button
    const timer = setTimeout(() => {
      if (dialog.type === 'confirm' && dialog.variant === 'danger') {
        cancelBtnRef.current?.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [dialog]);

  const handleConfirm = () => {
    if (!dialog) return;
    const res = dialog.resolve;
    setDialog(null);
    res(true);
  };

  const handleCancel = () => {
    if (!dialog) return;
    const res = dialog.resolve;
    setDialog(null);
    res(false);
  };

  // Helper to format messages with highlighted quoted phrases e.g. "KG - Section B"
  const renderFormattedMessage = (msg: string) => {
    const parts = msg.split(/(".*?")/g);
    return parts.map((part, idx) => {
      if (part.startsWith('"') && part.endsWith('"') && part.length > 2) {
        const text = part.slice(1, -1);
        return (
          <span
            key={idx}
            className="inline-block px-1.5 py-0.5 mx-0.5 font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded-md shadow-2xs"
          >
            {text}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Modern Dialog Modal Overlay */}
      {dialog?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (dialog.type === 'alert') handleConfirm();
              else handleCancel();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Top Close Button */}
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="ပိတ်မည်"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon + Title */}
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-2xs ${
                  dialog.variant === 'danger'
                    ? 'bg-rose-50 border border-rose-200 text-rose-600 ring-4 ring-rose-50/50'
                    : dialog.variant === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-600 ring-4 ring-amber-50/50'
                    : dialog.variant === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 ring-4 ring-emerald-50/50'
                    : 'bg-indigo-50 border border-indigo-200 text-indigo-600 ring-4 ring-indigo-50/50'
                }`}
              >
                {dialog.variant === 'danger' ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : dialog.variant === 'warning' ? (
                  <AlertCircle className="h-6 w-6" />
                ) : dialog.variant === 'success' ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <Info className="h-6 w-6" />
                )}
              </div>

              <div className="flex-1 pr-4">
                <h3
                  id="confirm-dialog-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
                >
                  {dialog.title}
                </h3>
                <div className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {renderFormattedMessage(dialog.message)}
                </div>
              </div>
            </div>

            {/* Caution Banner for Danger */}
            {dialog.cautionText && (
              <div className="mt-4 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span className="font-medium">{dialog.cautionText}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center gap-2.5">
              {dialog.type === 'confirm' && (
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {dialog.cancelText}
                </button>
              )}

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 ${
                  dialog.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-400'
                    : dialog.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 focus:ring-amber-400'
                    : dialog.variant === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:ring-emerald-400'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:ring-indigo-400'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirm = (): ConfirmDialogContextType => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    return {
      confirm: showConfirmDialog,
      alert: showAlertDialog,
    };
  }
  return context;
};
