import {translate} from '@docusaurus/Translate';
import React, { useCallback, useEffect } from 'react';
import styles from './styles.module.css';

const STORAGE_KEY = 'docs.sidebarWidth';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

const clamp = (w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

function applyWidth(width) {
  document.documentElement.style.setProperty('--doc-sidebar-width', `${width}px`);
}

function saveWidth(width) {
  try {
    if (width === DEFAULT_WIDTH) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Storage blocked: the width just won't survive a reload.
  }
}

// Drag handle on the right edge of the docs sidebar. Changes the
// --doc-sidebar-width variable Docusaurus already sizes the sidebar with.
// Double-click restores the default width.
export default function SidebarResizer() {
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (stored) applyWidth(clamp(stored));
    } catch {
      // Storage blocked: keep the default width.
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    document.documentElement.classList.add('sidebar-resizing');

    let width = DEFAULT_WIDTH;
    const onMove = (ev) => {
      width = clamp(ev.clientX);
      applyWidth(width);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.documentElement.classList.remove('sidebar-resizing');
      saveWidth(width);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, []);

  const onDoubleClick = useCallback(() => {
    applyWidth(DEFAULT_WIDTH);
    saveWidth(DEFAULT_WIDTH);
  }, []);

  const onKeyDown = useCallback((e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const current =
      parseInt(getComputedStyle(document.documentElement).getPropertyValue('--doc-sidebar-width'), 10) ||
      DEFAULT_WIDTH;
    const next = clamp(current + (e.key === 'ArrowRight' ? 16 : -16));
    applyWidth(next);
    saveWidth(next);
  }, []);

  return (
    <div className={styles.rail}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={translate({id: "site.sidebarResizer.01", message: "Resize sidebar"})}
        title={translate({id: "site.sidebarResizer.02", message: "Drag to resize, double-click to reset"})}
        tabIndex={0}
        className={styles.handle}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
