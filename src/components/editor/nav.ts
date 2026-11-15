"use client";

/**
 * PDFDock — the navigation bridge. The page rail and the top bar need
 * to ask the workspace (which owns the scrolling element) to jump to a
 * page. A tiny mutable bus keeps them decoupled without lifting state.
 */

export const navBus: { goToPage: (_index: number) => void } = {
  goToPage: () => undefined,
};
