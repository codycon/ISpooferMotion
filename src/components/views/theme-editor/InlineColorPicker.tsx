import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { createPortal } from 'react-dom';
import { ThemeConfig } from '../../../contexts/ThemeContext';
import { getAutoContrastColor, isContrastAccessible } from '../../../ism-library';

interface InlineColorPickerProps {
  label: string;
  colorKey: string;
  checkContrastBg?: string;
  currentTheme: ThemeConfig;
  onColorChange: (key: string, value: string) => void;
}

export default function InlineColorPicker({
  label,
  colorKey,
  checkContrastBg,
  currentTheme,
  onColorChange,
}: InlineColorPickerProps) {
  const color = currentTheme.colors?.[colorKey] || '#000000';
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const bgToCompare = checkContrastBg ? currentTheme.colors?.[checkContrastBg] : null;
  const hasLowContrast = bgToCompare && color ? !isContrastAccessible(color, bgToCompare) : false;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="flex items-center justify-between py-2 relative">
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-text-primary">{label}</span>
        {hasLowContrast && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-1.5 mt-0.5 text-[10px] text-warning font-bold uppercase tracking-wider"
          >
            <AlertTriangle size={12} /> Low Contrast
            <button
              onClick={() => onColorChange(colorKey, getAutoContrastColor(bgToCompare!))}
              className="ml-1 flex items-center gap-1 text-primary hover:underline hover:text-primary/80 transition-colors"
            >
              <Wand2 size={10} /> Auto-fix
            </button>
          </motion.div>
        )}
      </div>
      <button
        ref={btnRef}
        type="button"
        className="w-8 h-8 rounded-full border border-border-strong hover:scale-105 transition-all shadow-sm relative overflow-hidden shrink-0 ring-offset-2 ring-offset-bg-base focus:ring-2 focus:ring-primary outline-none"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCoords({ top: rect.bottom + 8, left: rect.right - 200 });
          setIsOpen((prev) => !prev);
        }}
        aria-label={`Pick ${label} color`}
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgfQEhD/o8F8Gk48HMgE4iNYXg1jJpgNMGgZ8DQC8OoaRg0DMxMAADkZgq27C1j/wAAAABJRU5ErkJggg==")',
          }}
        >
          <div className="w-full h-full" style={{ backgroundColor: color }} />
        </div>
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={pickerRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute z-[9999] p-0 border border-border-subtle rounded-xl overflow-hidden shadow-floating bg-bg-surface flex flex-col pointer-events-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ top: coords.top, left: coords.left }}
            >
              <HexAlphaColorPicker color={color} onChange={(c) => onColorChange(colorKey, c)} />
              <div className="p-3 border-t border-border-subtle flex items-center justify-between bg-bg-elevated">
                <span className="text-xs font-bold text-text-muted">HEX</span>
                <input
                  type="text"
                  value={color.toUpperCase()}
                  onChange={(e) => onColorChange(colorKey, e.target.value)}
                  className="bg-bg-base text-text-primary text-xs font-mono px-2 py-1 rounded w-24 text-center border border-border-strong outline-none focus:border-primary transition-colors"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
