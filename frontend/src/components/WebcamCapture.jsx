import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, RefreshCw, Sparkles } from 'lucide-react';

export default function WebcamCapture({ onCapture, isProcessing = false }) {
  const videoRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Camera access denied or device not found. Please allow camera permissions or upload an image instead.");
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamActive(false);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob && onCapture) {
        onCapture(blob, canvas.toDataURL('image/jpeg'));
      }
    }, 'image/jpeg', 0.95);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center">
      {errorMsg ? (
        <div className="p-8 text-center max-w-md">
          <CameraOff className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-sm text-rose-300 mb-4">{errorMsg}</p>
          <button
            onClick={startCamera}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
          >
            Retry Camera
          </button>
        </div>
      ) : (
        <>
          <div className="relative w-full aspect-video max-h-[460px] bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Guide overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-72 border-2 border-cyan-400/40 rounded-3xl border-dashed animate-pulse" />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="w-full p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs text-slate-400 font-medium">Live Camera Feed</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={captureFrame}
                disabled={!streamActive || isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Identifying...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-slate-950" />
                    <span>Capture & Identify</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={streamActive ? stopCamera : startCamera}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title={streamActive ? "Stop Camera" : "Start Camera"}
              >
                {streamActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
