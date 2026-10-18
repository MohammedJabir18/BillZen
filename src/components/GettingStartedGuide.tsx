import React, { useState, useEffect } from 'react';
import { updateGuideStatus } from '../adapters/tauri';
import { translations, type Language } from '../i18n';
import {
  Package,
  Users,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Barcode,
  Layers,
  Palette,
  Check,
} from 'lucide-react';

export interface GettingStartedGuideProps {
  currentLanguage: Language;
  isOpen: boolean;
  onClose: () => void;
  isReplay?: boolean;
}

export const GettingStartedGuide: React.FC<GettingStartedGuideProps> = ({
  currentLanguage,
  isOpen,
  onClose,
  isReplay = false,
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const t = translations[currentLanguage] || translations.en;
  const isRTL = currentLanguage === 'ar';

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(1);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        if (isRTL) {
          handlePrev();
        } else {
          handleNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (isRTL) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide, isRTL]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentSlide < 3) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 1) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (!isReplay) {
      try {
        await updateGuideStatus('skipped', 1);
      } catch (err) {
        console.error('Failed to update guide status:', err);
      }
    }
    onClose();
  };

  const handleFinish = async () => {
    if (!isReplay) {
      try {
        await updateGuideStatus('completed', 1);
      } catch (err) {
        console.error('Failed to update guide status:', err);
      }
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
    >
      <div
        className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col transition-all transform scale-100 font-sans ${
          isRTL ? 'rtl' : 'ltr'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-lime-600 dark:text-lime-400" />
            </div>
            <div>
              <h2 id="guide-title" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                {t.guide_title}
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Step {currentSlide} of 3
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="guide-close-button"
            onClick={handleSkip}
            aria-label="Close Guide"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Body */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col items-center text-center">
          {/* Slide 1: Products, Barcodes, Inventory */}
          {currentSlide === 1 && (
            <div className="space-y-4 max-w-sm animate-fadeIn">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-lime-50 dark:bg-lime-950/40 border border-lime-200 dark:border-lime-900/60 flex items-center justify-center text-lime-600 dark:text-lime-400 shadow-sm relative">
                <Package className="w-10 h-10" />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-1 border border-lime-300 dark:border-lime-800">
                  <Barcode className="w-4 h-4 text-lime-600 dark:text-lime-400" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {t.guide_slide1_title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t.guide_slide1_body}
              </p>

              <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Zero-padded Barcodes</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Atomic Movements</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Scanner Ready</span>
              </div>
            </div>
          )}

          {/* Slide 2: Customers & Receivables */}
          {currentSlide === 2 && (
            <div className="space-y-4 max-w-sm animate-fadeIn">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm relative">
                <Users className="w-10 h-10" />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-1 border border-indigo-300 dark:border-indigo-800">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {t.guide_slide2_title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t.guide_slide2_body}
              </p>

              <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">GSTIN / TRN IDs</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Contact Details</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Address Book</span>
              </div>
            </div>
          )}

          {/* Slide 3: Durability & Appearance */}
          {currentSlide === 3 && (
            <div className="space-y-4 max-w-sm animate-fadeIn">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm relative">
                <ShieldCheck className="w-10 h-10" />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-1 border border-emerald-300 dark:border-emerald-800">
                  <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {t.guide_slide3_title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                {t.guide_slide3_body}
              </p>

              <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">SQLite WAL Engine</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">Single-Instance Lock</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">System / Light / Dark</span>
              </div>
            </div>
          )}

          {/* Pagination Dots */}
          <div className="flex items-center gap-1.5 mt-6">
            {[1, 2, 3].map((dotIndex) => (
              <span
                key={dotIndex}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === dotIndex
                    ? 'w-6 bg-lime-500'
                    : 'w-2 bg-slate-200 dark:bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            data-testid="guide-skip-button"
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
          >
            {t.guide_action_skip}
          </button>

          <div className="flex items-center gap-2">
            {currentSlide > 1 && (
              <button
                type="button"
                data-testid="guide-prev-button"
                onClick={handlePrev}
                className="min-h-[44px] px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                <span>{t.guide_action_prev}</span>
              </button>
            )}

            {currentSlide < 3 ? (
              <button
                type="button"
                data-testid="guide-next-button"
                onClick={handleNext}
                className="min-h-[44px] px-5 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span>{t.guide_action_next}</span>
                {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <button
                type="button"
                data-testid="guide-finish-button"
                onClick={handleFinish}
                className="min-h-[44px] px-5 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.guide_action_finish}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
