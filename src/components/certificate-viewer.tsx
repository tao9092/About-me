"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Maximize2, X } from "lucide-react";

// A certificate in its frame on its own page: it tilts a little toward the
// pointer with a glare sliding across it, and opens full size when chosen.
export function CertificateViewer({ src, alt }: { src: string; alt: string }) {
  const frame = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      removeEventListener("keydown", close);
    };
  }, [open]);

  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    event.currentTarget.style.setProperty("--rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
  };
  const rest = () => {
    frame.current?.style.setProperty("--rx", "0deg");
    frame.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <>
      <button type="button" ref={frame} className="cert-frame" onPointerMove={tilt} onPointerLeave={rest} onClick={() => setOpen(true)} aria-label={`Open ${alt} full size`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <span className="cert-zoom">
          <Maximize2 /> Enlarge
        </span>
      </button>
      {open && (
        <div className="certificate-lightbox" role="dialog" aria-modal="true" aria-label={`${alt}, full size`} onClick={() => setOpen(false)}>
          <button className="certificate-lightbox-close" type="button" onClick={() => setOpen(false)} aria-label="Close">
            <X />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
