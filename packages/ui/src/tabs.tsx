'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = {
  content: ReactNode;
  id: string;
  label: string;
};

export function Tabs({ items, label }: { items: readonly TabItem[]; label: string }) {
  const groupId = useId();
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    const next = items[nextIndex];
    setActiveId(next.id);
    document.getElementById(`${groupId}-tab-${next.id}`)?.focus();
  }

  return (
    <div>
      <div
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-[var(--border-default)]"
        role="tablist"
      >
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              aria-controls={`${groupId}-panel-${item.id}`}
              aria-selected={selected}
              className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-bold ${selected ? 'border-[var(--action-primary)] text-[var(--action-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              id={`${groupId}-tab-${item.id}`}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          aria-labelledby={`${groupId}-tab-${item.id}`}
          className="py-5"
          hidden={item.id !== activeId}
          id={`${groupId}-panel-${item.id}`}
          key={item.id}
          role="tabpanel"
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
