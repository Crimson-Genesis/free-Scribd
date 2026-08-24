import React, { useRef } from 'react';
import { Moon, Sun } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleTheme: (buttonRef?: React.RefObject<HTMLButtonElement | null>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleTheme,
}) => {
  const desktopBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileBtnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      {/* Mobile Top Header Bar */}
      <header className={`lg:hidden w-full h-11 px-4 flex items-center justify-between border-b backdrop-blur-md shrink-0 z-30 ${
        darkMode ? 'bg-black/40 border-neutral-800/40 text-neutral-100' : 'bg-white/40 border-neutral-200/60 text-neutral-900'
      }`}>
        <div className="flex items-center gap-2">
          <svg width="11" height="14" viewBox="0 0 9 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={darkMode ? 'text-neutral-100' : 'text-neutral-900'}>
            <path d="M8.99774 0.146548C9.01762 0.0422957 8.90256 -0.0363551 8.8088 0.0173858L0.251555 4.92037C0.0956501 5.00998 0 5.17304 0 5.34926V6.00003V6.65069C0 6.8269 0.0956501 6.99008 0.251555 7.07958L8.8088 11.9827C8.90256 12.0363 9.01762 11.9577 8.99774 11.8534V0.146548Z" fill="currentColor" transform="translate(9 12) rotate(-180)"/>
          </svg>
          <span className="font-bold text-xs tracking-tight">Free-Scribd</span>
        </div>

        <button
          ref={mobileBtnRef}
          onClick={() => onToggleTheme(mobileBtnRef)}
          className="p-1.5 border-none bg-transparent hover:opacity-75 transition-opacity"
          title="Toggle Dark / Light Theme"
        >
          {darkMode ? <Sun className="h-4 w-4 text-neutral-200" /> : <Moon className="h-4 w-4 text-neutral-800" />}
        </button>
      </header>

      {/* Floating Desktop Elements (Floating directly over background animation with NO BORDER) */}
      <div className="hidden lg:block pointer-events-none">
        {/* Top-Left Floating Brand Logo */}
        <div className="absolute top-4 left-5 z-40 pointer-events-auto flex items-center gap-2.5">
          <svg width="12" height="15" viewBox="0 0 9 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={darkMode ? 'text-neutral-100' : 'text-neutral-900'}>
            <path d="M8.99774 0.146548C9.01762 0.0422957 8.90256 -0.0363551 8.8088 0.0173858L0.251555 4.92037C0.0956501 5.00998 0 5.17304 0 5.34926V6.00003V6.65069C0 6.8269 0.0956501 6.99008 0.251555 7.07958L8.8088 11.9827C8.90256 12.0363 9.01762 11.9577 8.99774 11.8534V0.146548Z" fill="currentColor" transform="translate(9 12) rotate(-180)"/>
          </svg>
          <span className={`font-bold text-sm tracking-tight ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            Free-Scribd <span className={`text-xs font-normal ml-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>PDF Studio</span>
          </span>
        </div>

        {/* Top-Right Floating Theme Icon Button (NO BORDER) */}
        <button
          ref={desktopBtnRef}
          onClick={() => onToggleTheme(desktopBtnRef)}
          className="absolute top-4 right-5 z-40 pointer-events-auto p-2 border-none bg-transparent hover:scale-110 transition-transform cursor-pointer"
          title="Toggle Dark / Light Theme"
        >
          {darkMode ? (
            <Sun className="h-5 w-5 text-neutral-200 hover:text-white transition-colors" />
          ) : (
            <Moon className="h-5 w-5 text-neutral-800 hover:text-black transition-colors" />
          )}
        </button>
      </div>
    </>
  );
};
