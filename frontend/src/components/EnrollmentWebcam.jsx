import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, 
  CameraOff, 
  X, 
  Check, 
  CheckCircle2, 
  Sparkles, 
  RotateCcw, 
  ArrowRight,
  Info,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

const POSE_GUIDES = [
  {
    step: 1,
    title: "Pose 1: Frontal Look",
    instruction: "Look straight into the camera with a neutral expression.",
    icon: "👤",
    direction: "straight"
  },
  {
    step: 2,
    title: "Pose 2: Slight Left Angle",
    instruction: "Turn your head slightly (~15°) to your left.",
    icon: "👈",
    direction: "left"
  },
  {
    step: 3,
    title: "Pose 3: Slight Right Angle",
    instruction: "Turn your head slightly (~15°) to your right.",
    icon: "👉",
    direction: "right"
  },
  {
    step: 4,
    title: "Pose 4: Natural Expression / Smile",
    instruction: "Natural expression or slight smile to capture muscle variations.",
    icon: "😊",
    direction: "smile"
  },
  {
    step: 5,
    title: "Pose 5: Slight Tilt / Head Angle",
    instruction: "Slight upward or downward angle for 3D template robustness.",
    icon: "📐",
    direction: "tilt"
  }
];

export default function EnrollmentWebcam({ 
  isOpen, 
  onClose, 
  onPhotoCaptured, 
  existingCount = 0 
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [streamActive, setStreamActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [recentSnaps, setRecentSnaps] = useState([]);
  const [flash, setFlash] = useState(false);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode: 'user' 
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Unable to access camera. Please check camera permissions in your browser.");
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      // Set pose based on existing count
      const initialStep = Math.min(existingCount, POSE_GUIDES.length - 1);
      setCurrentStepIdx(initialStep);
    } else {
      stopCamera();
      setRecentSnaps([]);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Trigger visual shutter flash
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const poseName = POSE_GUIDES[currentStepIdx]?.direction || `angle_${currentStepIdx + 1}`;
      const filename = `enroll_webcam_${poseName}_${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      setRecentSnaps(prev => [...prev, dataUrl]);

      if (onPhotoCaptured) {
        onPhotoCaptured(file, dataUrl);
      }

      // Automatically advance to the next recommended angle
      if (currentStepIdx < POSE_GUIDES.length - 1) {
        setCurrentStepIdx(prev => prev + 1);
      }
    }, 'image/jpeg', 0.95);
  };

  if (!isOpen) return null;

  const totalCaptured = existingCount;
  const currentGuide = POSE_GUIDES[currentStepIdx] || POSE_GUIDES[0];
  const hasMinPhotos = totalCaptured >= 3;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl shadow-cyan-950/40 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 shadow-md shadow-cyan-950">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Multi-Angle Webcam Enrollment</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Live
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Snap at least 3 distinct face angles for robust ArcFace biometric template creation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guided Pose Indicator Bar */}
        <div className="p-3 sm:px-5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          {POSE_GUIDES.map((guide, idx) => {
            const isDone = idx < totalCaptured;
            const isCurrent = idx === currentStepIdx;
            return (
              <button
                key={guide.step}
                onClick={() => setCurrentStepIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isCurrent
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : isDone
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                <span className="text-sm">{guide.icon}</span>
                <span>{guide.title.split(':')[1] || guide.title}</span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Camera Area */}
        <div className="relative w-full aspect-video max-h-[380px] bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-8 text-center max-w-sm">
              <CameraOff className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <p className="text-xs text-rose-300 mb-4">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Retry Access
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Shutter Flash Animation */}
              {flash && (
                <div className="absolute inset-0 bg-white/70 animate-ping pointer-events-none z-30" />
              )}

              {/* Biometric Oval Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-52 h-68 border-2 border-cyan-400/50 rounded-[42px] border-dashed animate-pulse flex items-center justify-center">
                  <div className="w-48 h-64 border border-cyan-400/20 rounded-[38px]" />
                </div>
              </div>

              {/* Current Angle Instruction Overlay */}
              <div className="absolute top-3 left-3 right-3 pointer-events-none flex justify-center">
                <div className="px-4 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-center shadow-xl flex items-center gap-2">
                  <span className="text-lg">{currentGuide.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-cyan-300">
                      {currentGuide.title}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {currentGuide.instruction}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live indicator */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Feed</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar: Action & Snaps Reel */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="text-xs">
              <span className="text-slate-400">Captured: </span>
              <span className={`font-mono font-bold ${hasMinPhotos ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalCaptured} photo(s)
              </span>
              <span className="text-slate-500 font-mono text-[11px]"> (min 3 required)</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!streamActive}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Snap Photo ({currentGuide.icon})</span>
            </button>

            {hasMinPhotos ? (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Done ({totalCaptured})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
