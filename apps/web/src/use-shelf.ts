import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent, PointerEvent } from "react";

export function useShelf(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; active: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const shelf = ref.current;
    if (!shelf) return;
    const update = () => {
      const end = Math.max(0, shelf.scrollWidth - shelf.clientWidth);
      const previous = shelf.scrollLeft > 2;
      const next = shelf.scrollLeft < end - 2;
      setEdges((old) => old.previous === previous && old.next === next ? old : { previous, next });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(shelf);
    shelf.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      shelf.removeEventListener("scroll", update);
    };
  }, [itemCount]);

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.active) suppressClickUntil.current = performance.now() + 350;
    drag.current = null;
    event.currentTarget.style.scrollSnapType = "";
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(current.id)) event.currentTarget.releasePointerCapture(current.id);
  };

  return {
    ref,
    edges,
    dragging,
    scroll: (direction: number) => {
      const shelf = ref.current;
      shelf?.scrollBy({ left: direction * shelf.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    },
    handlers: {
      onDragStart: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        suppressClickUntil.current = 0;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, active: false };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        if (!current.active) {
          if (Math.abs(dx) <= 6 || Math.abs(dx) <= Math.abs(event.clientY - current.y)) return;
          current.active = true;
          event.currentTarget.style.scrollSnapType = "none";
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        event.preventDefault();
        event.currentTarget.scrollLeft = current.left - dx;
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onPointerLeave: () => { if (drag.current && !drag.current.active) drag.current = null; },
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail > 0 && performance.now() < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClickUntil.current = 0;
        }
      },
    },
  };
}
