'use client';

import { useEffect, useState } from 'react';

import { LegalModalLink } from './legal-modal-link';

const consentKey = 'roventra-cookie-consent-v1';
const consentCookie = 'roventra_cookie_consent';

type Consent = { analytics: boolean; marketing: boolean; necessary: true };
const essentialOnly: Consent = { analytics: false, marketing: false, necessary: true };
const acceptAll: Consent = { analytics: true, marketing: true, necessary: true };

function saveConsent(consent: Consent) {
  window.localStorage.setItem(consentKey, JSON.stringify(consent));
  document.cookie = `${consentCookie}=${encodeURIComponent(JSON.stringify(consent))}; path=/; max-age=31536000; samesite=lax; secure`;
  window.dispatchEvent(new CustomEvent('roventra:cookie-consent', { detail: consent }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (window.self !== window.top) return;
    const revealTimer = window.setTimeout(
      () => setVisible(!window.localStorage.getItem(consentKey)),
      0,
    );
    const openSettings = () => {
      const saved = window.localStorage.getItem(consentKey);
      if (saved) {
        try {
          const consent = JSON.parse(saved) as Consent;
          setAnalytics(Boolean(consent.analytics));
          setMarketing(Boolean(consent.marketing));
        } catch {
          // Invalid preferences are replaced when the visitor saves again.
        }
      }
      setSettingsOpen(true);
      setVisible(true);
    };
    window.addEventListener('roventra:open-cookie-settings', openSettings);
    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener('roventra:open-cookie-settings', openSettings);
    };
  }, []);

  if (!visible) return null;
  const choose = (consent: Consent) => {
    saveConsent(consent);
    setVisible(false);
    setSettingsOpen(false);
  };

  return (
    <div
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5"
      role="region"
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#cbdcf4] bg-white p-5 shadow-[0_24px_70px_rgba(11,31,58,.22)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-base font-bold text-[#0b1f3a]">Your privacy choices</p>
            <p className="mt-2 text-sm leading-6 text-[#52627a]">
              We use necessary cookies to keep Roventra secure and working. With your permission, we
              may also use analytics and marketing cookies to improve the experience. Optional
              cookies stay off until you choose.
            </p>
            <div className="mt-2 flex gap-4 text-xs font-semibold text-[#1d4ed8]">
              <LegalModalLink href="/cookies">
                Cookie Policy
              </LegalModalLink>
              <LegalModalLink href="/privacy">
                Privacy Policy
              </LegalModalLink>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
            <button
              className="min-h-11 rounded-xl border border-[#b8cce5] px-4 text-sm font-bold text-[#17365f]"
              onClick={() => setSettingsOpen((open) => !open)}
              type="button"
            >
              Manage choices
            </button>
            <button
              className="min-h-11 rounded-xl border border-[#b8cce5] px-4 text-sm font-bold text-[#17365f]"
              onClick={() => choose(essentialOnly)}
              type="button"
            >
              Necessary only
            </button>
            <button
              className="min-h-11 rounded-xl bg-[#2563eb] px-5 text-sm font-bold text-white hover:bg-[#1d4ed8]"
              onClick={() => choose(acceptAll)}
              type="button"
            >
              Accept all
            </button>
          </div>
        </div>
        {settingsOpen ? (
          <div className="mt-5 border-t border-[#e2eaf5] pt-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Preference
                checked
                description="Authentication, security, and saved privacy choices."
                disabled
                label="Necessary"
              />
              <Preference
                checked={analytics}
                description="Helps us understand usage and improve Roventra."
                label="Analytics"
                onChange={setAnalytics}
              />
              <Preference
                checked={marketing}
                description="Supports campaign measurement and relevant promotion."
                label="Marketing"
                onChange={setMarketing}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="min-h-11 rounded-xl bg-[#0b1f3a] px-5 text-sm font-bold text-white"
                onClick={() => choose({ analytics, marketing, necessary: true })}
                type="button"
              >
                Save choices
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Preference({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl bg-[#f5f9ff] p-4">
      <input
        checked={checked}
        className="mt-1 size-4 accent-[#2563eb]"
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-bold text-[#0b1f3a]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#52627a]">{description}</span>
      </span>
    </label>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      className="text-left"
      onClick={() => window.dispatchEvent(new Event('roventra:open-cookie-settings'))}
      type="button"
    >
      Cookie settings
    </button>
  );
}
