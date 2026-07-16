'use client';

import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeableSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function isRTL(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dir === 'rtl';
}

export const SwipeableSidebar = forwardRef<HTMLDivElement, SwipeableSidebarProps>(
  ({ isOpen, onClose, children }, ref) => {
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const MIN_SWIPE = 50;
    const VELOCITY_THRESHOLD = 0.3;
    const SIDEBAR_WIDTH = 288;

    const onTouchStart = useCallback((e: TouchEvent) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      setIsDragging(true);
    }, []);

    const onTouchMove = useCallback((e: TouchEvent) => {
      if (!touchStartRef.current || e.touches.length > 1) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStartRef.current.x;
      const rtl = isRTL();

      if (isOpen) {
        const clamped = rtl
          ? Math.min(0, Math.max(-SIDEBAR_WIDTH, dx))
          : Math.max(0, Math.min(SIDEBAR_WIDTH, dx));
        setDragOffset(clamped);
      } else {
        const clamped = rtl
          ? Math.max(0, Math.min(SIDEBAR_WIDTH, -dx))
          : Math.min(0, Math.max(-SIDEBAR_WIDTH, dx));
        setDragOffset(clamped);
      }
    }, [isOpen]);

    const onTouchEnd = useCallback(() => {
      if (!touchStartRef.current) return;
      const elapsed = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(dragOffset) / elapsed;
      const rtl = isRTL();

      const shouldClose =
        (isOpen && velocity > VELOCITY_THRESHOLD) ||
        (isOpen && (
          (rtl && dragOffset < -MIN_SWIPE) ||
          (!rtl && dragOffset > MIN_SWIPE)
        )) ||
        (!isOpen && velocity > VELOCITY_THRESHOLD) ||
        (!isOpen && (
          (rtl && dragOffset > MIN_SWIPE) ||
          (!rtl && dragOffset < -MIN_SWIPE)
        ));

      if (shouldClose) {
        onClose();
      }

      setDragOffset(0);
      setIsDragging(false);
      touchStartRef.current = null;
    }, [dragOffset, isOpen, onClose]);

    useEffect(() => {
      const element = sidebarRef.current || (ref && 'current' in ref ? ref.current : null);
      if (!element) return;

      element.addEventListener('touchstart', onTouchStart, { passive: true });
      element.addEventListener('touchmove', onTouchMove, { passive: true });
      element.addEventListener('touchend', onTouchEnd);

      return () => {
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
      };
    }, [onTouchStart, onTouchMove, onTouchEnd, ref]);

    useEffect(() => {
      if (!isOpen) setDragOffset(0);
    }, [isOpen]);

    const isRtl = isRTL();
    const transformX = isOpen
      ? dragOffset
      : isRtl
        ? dragOffset
        : dragOffset;

    return (
      <div
        ref={(node) => {
          sidebarRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="fixed inset-0 z-50 lg:hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="absolute inset-0 bg-black/32 backdrop-blur-sm transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
          onClick={onClose}
          aria-hidden="true"
        />

        <div
          className={`absolute top-0 h-full w-72 border-border bg-background shadow-lg transition-transform duration-300 ease-in-out ${
            isRtl ? 'end-0 border-s' : 'start-0 border-e'
          }`}
          style={{
            pointerEvents: 'auto',
            transform: `translateX(${isOpen ? transformX : isRtl ? '100%' : '-100%'})`,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {children}

          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center ${
              isRtl ? '-start-3' : '-end-3'
            }`}
            aria-hidden="true"
          >
            <div className="flex h-6 w-3 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-sm">
              {isRtl ? (
                <ChevronLeft className="h-3 w-3 text-foreground-muted/50" />
              ) : (
                <ChevronRight className="h-3 w-3 text-foreground-muted/50" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SwipeableSidebar.displayName = 'SwipeableSidebar';
