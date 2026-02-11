import { useState, useRef} from "react";

interface Position {
  top: number;
  right: number;
}

export const useDraggable = (
  initialPosition: Position = { top: 24, right: 24 },
) => {
  const [position, setPosition] = useState(initialPosition);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent drag if clicking on a button or interactive element
    if ((e.target as HTMLElement).closest(".no-drag")) return;

    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX,
      y: e.clientY,
    };

    if (window.overlay?.setIgnoreMouseEvents) {
      window.overlay.setIgnoreMouseEvents(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - dragOffset.current.x;
    const dy = e.clientY - dragOffset.current.y;

    setPosition((prev) => ({
      right: prev.right - dx,
      top: prev.top + dy,
    }));

    dragOffset.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseEnter = () => {
    if (window.overlay?.setIgnoreMouseEvents) {
      window.overlay.setIgnoreMouseEvents(false);
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging.current && window.overlay?.setIgnoreMouseEvents) {
      window.overlay.setIgnoreMouseEvents(true);
    }
  };

  return {
    position,
    handleMouseDown,
    handleMouseEnter,
    handleMouseLeave,
  };
};
