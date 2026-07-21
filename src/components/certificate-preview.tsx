"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

export function CertificatePreview({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", close); };
  }, [open]);
  return <>
    <section className="certificate-public-preview" aria-label="Certificate image">
      <p className="auros-kicker">Certificate preview</p>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open certificate image preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
        <span><Maximize2 /> Click to enlarge</span>
      </button>
    </section>
    {open && <div className="certificate-lightbox" role="dialog" aria-modal="true" aria-label={`${alt} enlarged preview`} onClick={() => setOpen(false)}>
      <button className="certificate-lightbox-close" type="button" onClick={() => setOpen(false)} aria-label="Close preview"><X /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>}
  </>;
}
