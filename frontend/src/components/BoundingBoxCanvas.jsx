import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';

export default function BoundingBoxCanvas({
  imageUrl,
  results = [],
  onSelectFace,
  selectedFaceIndex = 0
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [scale, setScale] = useState({ scaleX: 1, scaleY: 1, naturalWidth: 0, naturalHeight: 0 });

  const updateScale = useCallback(() => {
    if (imgRef.current) {
      const { naturalWidth, naturalHeight, clientWidth, clientHeight } = imgRef.current;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setScale({
          scaleX: clientWidth / naturalWidth,
          scaleY: clientHeight / naturalHeight,
          naturalWidth,
          naturalHeight
        });
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateScale);
    let resizeObserver;
    if (imgRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => updateScale());
      resizeObserver.observe(imgRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateScale);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateScale]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center min-h-[380px] max-h-[600px] p-2">
      <div ref={containerRef} className="relative inline-block max-w-full max-h-[580px]">
        {/* Query Image */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Recognition Query"
          onLoad={updateScale}
          className="max-h-[580px] w-auto object-contain rounded-xl block shadow-inner"
        />

        {/* Bounding Box Overlays */}
        {results.map((res, idx) => {
          const isSelected = selectedFaceIndex === idx;
          const isKnown = res.status === 'KNOWN' || res.status === 'MATCH';
          const isError = res.status === 'ERROR' || res.status === 'NO_FACE';
          const { x1, y1, x2, y2 } = res.bbox;

          // Responsive coordinate mapping without distortion
          const boxLeft = x1 * scale.scaleX;
          const boxTop = y1 * scale.scaleY;
          const boxWidth = Math.max(20, (x2 - x1) * scale.scaleX);
          const boxHeight = Math.max(20, (y2 - y1) * scale.scaleY);

          // Color themes
          let borderColor = 'border-amber-400';
          let bgColor = 'bg-amber-500/15';
          let glowColor = 'shadow-amber-500/30';
          let badgeBg = 'bg-amber-600';

          if (isKnown) {
            borderColor = 'border-emerald-400';
            bgColor = 'bg-emerald-500/15';
            glowColor = 'shadow-emerald-500/30';
            badgeBg = 'bg-emerald-600';
          } else if (isError) {
            borderColor = 'border-rose-400';
            bgColor = 'bg-rose-500/15';
            glowColor = 'shadow-rose-500/30';
            badgeBg = 'bg-rose-600';
          }

          const simVal = Number(res.similarity_score ?? res.similarity ?? 0).toFixed(2);

          return (
            <div
              key={idx}
              onClick={() => onSelectFace && onSelectFace(idx)}
              style={{
                left: `${boxLeft}px`,
                top: `${boxTop}px`,
                width: `${boxWidth}px`,
                height: `${boxHeight}px`,
              }}
              className={`absolute cursor-pointer border-2 ${borderColor} ${bgColor} rounded-lg transition-all duration-150 ${
                isSelected ? `ring-4 ring-cyan-400 shadow-xl ${glowColor} z-30` : 'hover:scale-[1.01] z-20'
              }`}
            >
              {/* Corner brackets */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl shadow" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr shadow" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl shadow" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-white rounded-br shadow" />

              {/* Tag Badge near Bounding Box */}
              <div
                className={`absolute -top-11 left-0 flex flex-col px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-none ${badgeBg}`}
              >
                <div className="flex items-center gap-1.5 leading-tight">
                  {isKnown ? (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-white" />
                  ) : isError ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-white" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-white" />
                  )}
                  <span className="font-extrabold tracking-wide">
                    Face {idx + 1}: {res.name || (isKnown ? 'Identified' : 'UNKNOWN')}
                  </span>
                </div>
                <div className="text-[10px] font-mono opacity-90 pl-5">
                  {(res.person_code || res.code) ? `ID: ${res.person_code || res.code} • ` : ''}Similarity: {simVal}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
