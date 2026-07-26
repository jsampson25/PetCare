'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  isWebsitePreviewSection,
  WEBSITE_EDITOR_SECTION_EVENT_TYPE,
  type WebsitePreviewSection,
} from './website-live-preview';

const sections: Array<{
  id: WebsitePreviewSection;
  label: string;
  description: string;
}> = [
  { id: 'hero', label: 'Hero', description: 'Headline, introduction, and brand colors' },
  { id: 'services', label: 'Services', description: 'Visibility, order, and service guidance' },
  { id: 'about', label: 'About', description: 'Business story and care philosophy' },
  { id: 'contact', label: 'Contact', description: 'FAQ, policies, email, and phone' },
];

type WebsiteSectionInspectorProps = Record<WebsitePreviewSection, ReactNode>;

export function WebsiteSectionInspector(props: WebsiteSectionInspectorProps) {
  const [selectedSection, setSelectedSection] = useState<WebsitePreviewSection>('hero');
  const panelRefs = useRef<Partial<Record<WebsitePreviewSection, HTMLElement | null>>>({});
  const shouldFocusSelectionRef = useRef(false);

  function selectSection(
    section: WebsitePreviewSection,
    notifyCanvas: boolean,
    focusPanel: boolean,
  ) {
    shouldFocusSelectionRef.current = focusPanel;
    setSelectedSection(section);
    if (notifyCanvas) {
      window.dispatchEvent(
        new CustomEvent(WEBSITE_EDITOR_SECTION_EVENT_TYPE, {
          detail: { section, source: 'inspector' },
        }),
      );
    }
  }

  useEffect(() => {
    function receiveSectionSelection(event: Event) {
      const detail = (event as CustomEvent<{ section?: unknown; source?: unknown }>).detail;
      if (detail?.source !== 'canvas' || !isWebsitePreviewSection(detail.section)) return;
      selectSection(detail.section, false, true);
    }

    window.addEventListener(WEBSITE_EDITOR_SECTION_EVENT_TYPE, receiveSectionSelection);
    return () =>
      window.removeEventListener(WEBSITE_EDITOR_SECTION_EVENT_TYPE, receiveSectionSelection);
  }, []);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('[data-website-draft-form]');
    if (!form) return;
    let revealedInvalidField = false;

    function revealInvalidPanel(event: Event) {
      if (revealedInvalidField || !(event.target instanceof Element)) return;
      const panel = event.target.closest<HTMLElement>('[data-editor-section]');
      const section = panel?.dataset.editorSection;
      if (!panel?.hidden || !isWebsitePreviewSection(section)) return;
      revealedInvalidField = true;
      panel.hidden = false;
      selectSection(section, true, true);
      window.setTimeout(() => {
        revealedInvalidField = false;
      }, 0);
    }

    form.addEventListener('invalid', revealInvalidPanel, true);
    return () => form.removeEventListener('invalid', revealInvalidPanel, true);
  }, []);

  useEffect(() => {
    if (!shouldFocusSelectionRef.current) return;
    shouldFocusSelectionRef.current = false;
    const animationFrame = window.requestAnimationFrame(() => {
      const panel = panelRefs.current[selectedSection];
      panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      panel
        ?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, button')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedSection]);

  const selectedDetails = sections.find((section) => section.id === selectedSection) ?? sections[0];

  return (
    <section className="sm:col-span-2" aria-labelledby="website-section-inspector-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Section inspector
          </p>
          <h3
            className="mt-1 text-lg font-black text-[#0b1f3a]"
            id="website-section-inspector-title"
          >
            Edit {selectedDetails.label}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedDetails.description}</p>
        </div>
        <p className="text-xs font-bold text-[var(--text-secondary)]">
          Select here or click the preview
        </p>
      </div>

      <div
        aria-label="Website sections"
        className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-4"
        role="group"
      >
        {sections.map((section) => (
          <button
            aria-controls={`website-editor-panel-${section.id}`}
            aria-pressed={selectedSection === section.id}
            className={`min-h-11 rounded-xl px-3 text-sm font-black transition ${
              selectedSection === section.id
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
            }`}
            id={`website-editor-tab-${section.id}`}
            key={section.id}
            onClick={() => selectSection(section.id, true, false)}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section
          aria-labelledby={`website-editor-tab-${section.id}`}
          className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 ring-4 ring-blue-50"
          data-editor-section={section.id}
          hidden={selectedSection !== section.id}
          id={`website-editor-panel-${section.id}`}
          key={section.id}
          ref={(element) => {
            panelRefs.current[section.id] = element;
          }}
          tabIndex={-1}
        >
          {props[section.id]}
        </section>
      ))}
    </section>
  );
}
