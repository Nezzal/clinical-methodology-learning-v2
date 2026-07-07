"use client";

import { useEffect } from "react";

export default function MobileOverlay() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth > 768) return;

    const aside = document.querySelector('aside[class*="Sidebar-module"]');
    const panel = document.querySelector('div[class*="sidebarPanel"]');

    let overlayEl: HTMLDivElement | null = null;

    function createOverlay() {
      if (overlayEl) return;
      overlayEl = document.createElement("div");
      overlayEl.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        z-index: 199; opacity: 0; visibility: hidden;
        transition: all 0.3s ease;
      `;
      overlayEl.addEventListener("click", closeAll);
      document.body.appendChild(overlayEl);
    }

    function showOverlay() {
      if (!overlayEl) createOverlay();
      if (!overlayEl) return;
      overlayEl.style.opacity = "1";
      overlayEl.style.visibility = "visible";
      document.body.style.overflow = "hidden";
    }

    function hideOverlay() {
      if (!overlayEl) return;
      overlayEl.style.opacity = "0";
      overlayEl.style.visibility = "hidden";
      document.body.style.overflow = "";
    }

    function closeAll() {
      if (aside) {
        const style = aside.getAttribute("style") || "";
        if (style.includes("280")) {
          const toggleBtn = document.querySelector(
            'button[title="Toggle navigation"]'
          ) as HTMLButtonElement | null;
          if (toggleBtn) toggleBtn.click();
        }
      }
      if (panel && !panel.className.includes("collapsed")) {
        const collapseBtn = panel.querySelector(
          'button[class*="collapseDiscussionBtn"]'
        ) as HTMLButtonElement | null;
        if (collapseBtn) collapseBtn.click();
      }
    }

    if (aside) {
      const observer = new MutationObserver(() => {
        const style = aside.getAttribute("style") || "";
        if (style.includes("280")) {
          showOverlay();
        } else {
          if (panel && !panel.className.includes("collapsed")) return;
          hideOverlay();
        }
      });
      observer.observe(aside, { attributes: true, attributeFilter: ["style"] });
    }

    if (panel) {
      const panelObserver = new MutationObserver(() => {
        if (!panel.className.includes("collapsed")) {
          showOverlay();
        } else {
          if (aside && (aside.getAttribute("style") || "").includes("280")) return;
          hideOverlay();
        }
      });
      panelObserver.observe(panel, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      if (overlayEl) overlayEl.remove();
    };
  }, []);

  return null;
}