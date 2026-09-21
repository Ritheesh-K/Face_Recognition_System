import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Scan, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Sliders, 
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Users,
  ChevronRight,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import WebcamCapture from '../components/WebcamCapture';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';
import ThresholdSlider from '../components/ThresholdSlider';
import { recognizeFace } from '../services/api';

export default function RecognitionPage({ systemSettings, onRecognitionComplete, onNavigate, enrolledCount = 0 }) {
  const [mode, setMode] = useState('upload'); // 'upload' or 'webcam'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [threshold, setThreshold] = useState(systemSettings?.matching_threshold || 0.50);
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedFaceIdx, setSelectedFaceIdx] = useState(0);

  const fileInputRef = useRef(null);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultData(null);
    setErrorMsg(null);
    setSelectedFaceIdx(0);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImage(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processSelectedImage(file);
    }
  };

  const processSelectedImage = (file) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setResultData(null);
    setErrorMsg(null);
    runRecognition(file, url);
  };

  const handleWebcamCapture = (blob, dataUrl) => {
    setSelectedFile(blob);
    setPreviewUrl(dataUrl);
    setResultData(null);
    setErrorMsg(null);
    runRecognition(blob, dataUrl);
  };

  const runRecognition = async (fileOrBlob, preview) => {
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', fileOrBlob, 'query.jpg');
    formData.append('threshold', threshold.toString());

    try {
      const data = await recognizeFace(formData);
      setResultData(data);
      // Auto-select the first recognized (KNOWN/MATCH) face if available, otherwise default to face 0
      const matchedIdx = data.results?.findIndex(r => r.status === 'MATCH' || r.status === 'KNOWN');
      setSelectedFaceIdx(matchedIdx >= 0 ? matchedIdx : 0);
      if (onRecognitionComplete) {
        onRecognitionComplete();
      }
    } catch (err) {
      console.error("Recognition error:", err);
      const detail = err.response?.data?.detail;
      setErrorMsg(detail || "Recognition failed. Please verify the image and try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedFace = resultData?.results?.[selectedFaceIdx];
  const totalFaces = resultData?.results?.length || 0;
  const isMatch = selectedFace && (selectedFace.status === 'MATCH' || selectedFace.status === 'KNOWN');
  const isUnknown = selectedFace && selectedFace.status === 'UNKNOWN';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Scan className="w-7 h-7 text-cyan-400" />
            Face Recognition & Identification
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Detect all faces, align landmarks, extract ArcFace 512D embeddings, and perform 1:N open-set matching.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start sm:self-auto">
          <button
            id="tab-mode-upload"
            onClick={() => handleModeChange('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'upload'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Image</span>
          </button>
          <button
            id="tab-mode-webcam"
            onClick={() => handleModeChange('webcam')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'webcam'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Live Webcam</span>
          </button>
        </div>
      </div>

      {/* Empty Database Alert State */}
      {enrolledCount === 0 && (
        <div className="p-5 rounded-3xl bg-amber-950/40 border border-amber-800/60 shadow-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                Recognition Database is Empty
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                No enrolled person templates were found in the database. Please enroll at least one person before running face identification.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('enroll')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 hover:scale-105"
            >
              Enroll Person
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Input Area + Threshold & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Source / Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {mode === 'webcam' ? (
            previewUrl ? (
              <div className="space-y-4">
                <BoundingBoxCanvas
                  imageUrl={previewUrl}
                  results={resultData?.results || []}
                  onSelectFace={(idx) => setSelectedFaceIdx(idx)}
                  selectedFaceIndex={selectedFaceIdx}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    id="btn-retake-webcam"
                    onClick={() => {
                      setPreviewUrl(null);
                      setResultData(null);
                      setErrorMsg(null);
                      setSelectedFile(null);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-xl text-xs font-bold border border-cyan-500/30 transition-colors flex items-center gap-2 shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retake / Live Camera</span>
                  </button>

                  {selectedFile && (
                    <button
                      id="btn-rescan-webcam"
                      onClick={() => runRecognition(selectedFile, previewUrl)}
                      disabled={loading}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-cyan-500/20"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>{loading ? 'Scanning...' : 'Re-run Scan (Current τ)'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <WebcamCapture onCapture={handleWebcamCapture} isProcessing={loading} />
            )
          ) : (
            <div>
              {previewUrl ? (
                <div className="space-y-4">
                  <BoundingBoxCanvas
                    imageUrl={previewUrl}
                    results={resultData?.results || []}
                    onSelectFace={(idx) => setSelectedFaceIdx(idx)}
                    selectedFaceIndex={selectedFaceIdx}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      id="btn-diff-img"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
                    >
                      Choose Different Image
                    </button>

                    {selectedFile && (
                      <button
                        id="btn-rescan"
                        onClick={() => runRecognition(selectedFile, previewUrl)}
                        disabled={loading}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>{loading ? 'Scanning...' : 'Re-run Scan (Current τ)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  id="dropzone-recognize"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-cyan-500/60 rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 bg-slate-900/30 hover:bg-slate-900/50 flex flex-col items-center justify-center min-h-[380px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 flex items-center justify-center mb-4 shadow-xl shadow-cyan-950/50">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Drag & Drop face image here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Supports single or multiple faces. Every face is detected, aligned, bounded, and identified.
                  </p>
                  <span className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
                    Browse Local File
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Threshold Tuning Slider */}
          <ThresholdSlider
            threshold={threshold}
            onChange={(val) => setThreshold(val)}
          />

          {/* Visual Distinction Legend */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Status Categories:</span>
            <div className="flex items-center gap-4 font-mono font-bold text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500" />
                KNOWN (Match ≥ τ)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-sm shadow-amber-500" />
                UNKNOWN (Score &lt; τ)
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500" />
                ERROR
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Identification Details & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Recognition Error: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {resultData ? (
            <div className="space-y-5">
              {/* Scan Summary Banner */}
              {resultData.total_faces_detected === 0 ? (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/60 via-slate-900/90 to-slate-900 border border-rose-800/80 shadow-xl shadow-rose-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Pipeline Warning
                    </span>
                    <span className="text-xs font-mono text-rose-400/90 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Processing Time: {resultData.latency_ms} ms
                    </span>
                  </div>

                  <div className="text-lg font-black text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{resultData.message}</span>
                  </div>

                  <div className="text-xs text-rose-300/80 font-mono">
                    Detected Faces: <span className="text-rose-400 font-black">0</span> • Threshold Applied: <span className="text-slate-300 font-bold">{resultData.threshold_applied?.toFixed(2) ?? '0.50'}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-900/50 text-xs text-rose-200/90 leading-relaxed">
                    No face detected. Please ensure the subject is facing the camera with good lighting and no obstructions.
                  </div>
                </div>
              ) : (
                <div className="glass-panel p-5 rounded-3xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Pipeline Execution
                    </span>
                    <span className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Processing Time: {resultData.latency_ms} ms
                    </span>
                  </div>

                  <div className="text-lg font-bold text-white mb-1">
                    {resultData.message}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Detected Faces: <span className="text-cyan-300 font-bold">{resultData.total_faces_detected}</span> • Threshold Applied: <span className="text-cyan-300 font-bold">{resultData.threshold_applied?.toFixed(2) ?? '0.50'}</span>
                  </div>
                </div>
              )}

              {/* Multi-Face Navigation Pills (if more than 1 face) */}
              {totalFaces > 1 && (
                <div className="glass-panel p-3.5 rounded-3xl border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Detected Faces ({totalFaces})</span>
                    <span className="text-[11px] text-slate-500">Select to inspect</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {resultData.results.map((res, idx) => {
                      const resMatch = res.status === 'MATCH' || res.status === 'KNOWN';
                      const isSelected = selectedFaceIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedFaceIdx(idx)}
                          className={`p-2.5 rounded-xl border text-left transition-all text-xs ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-500/30'
                              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-850'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-200">Face {idx + 1}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              resMatch ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {resMatch ? 'KNOWN' : 'UNKNOWN'}
                            </span>
                          </div>
                          <div className="font-medium text-slate-300 truncate">
                            {res.name || 'UNKNOWN'}
                          </div>
                          {(res.person_code || res.code) && (
                            <div className="text-[10px] font-mono text-cyan-400/90 truncate font-semibold">
                              ID: {res.person_code || res.code}
                            </div>
                          )}
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Similarity: {res.similarity_score.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exact Recognition Result Card requested by Prompt */}
              {selectedFace ? (
                <div className={`p-6 rounded-3xl border shadow-xl transition-all space-y-5 ${
                  isMatch 
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/30 border-emerald-800/80 shadow-emerald-950/20' 
                    : 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-amber-950/30 border-amber-800/80 shadow-amber-950/20'
                }`}>
                  {/* Status Banner */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl border ${
                        isMatch
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800 shadow-lg shadow-emerald-950'
                          : 'bg-amber-950/80 text-amber-400 border-amber-800 shadow-lg shadow-amber-950'
                      }`}>
                        {isMatch ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                      </div>

                      <div>
                        <div className={`text-xs font-extrabold uppercase tracking-wider ${
                          isMatch ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {isMatch ? 'KNOWN PERSON' : 'UNKNOWN PERSON'}
                        </div>
                        <h3 className="text-2xl font-black text-white mt-0.5">
                          {isMatch ? selectedFace.name : 'Unknown Identity'}
                        </h3>
                        {isMatch && (selectedFace.person_code || selectedFace.code) && (
                          <div className="text-xs font-mono text-cyan-300 font-bold mt-0.5">
                            ID: {selectedFace.person_code || selectedFace.code}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-500 block">FACE</span>
                      <span className="text-sm font-bold text-slate-300">Face #{selectedFaceIdx + 1} of {totalFaces}</span>
                    </div>
                  </div>

                  {/* Similarity and Threshold Display - No % Confidence! */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3 font-mono">
                    {isMatch ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Name:</span>
                          <span className="font-extrabold text-white text-base font-sans">{selectedFace.name}</span>
                        </div>
                        {(selectedFace.person_code || selectedFace.code) && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Person ID / Code:</span>
                            <span className="font-mono font-bold text-cyan-300 text-sm">{selectedFace.person_code || selectedFace.code}</span>
                          </div>
                        )}
                        {selectedFace.department && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Department:</span>
                            <span className="font-semibold text-slate-200 text-sm">{selectedFace.department}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Similarity:</span>
                          <span className="font-extrabold text-emerald-400 text-base">{selectedFace.similarity_score.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Threshold:</span>
                          <span className="font-semibold text-slate-300">{selectedFace.threshold_used.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Best Similarity:</span>
                          <span className="font-extrabold text-amber-400 text-base">{selectedFace.similarity_score.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Threshold:</span>
                          <span className="font-semibold text-slate-300">{selectedFace.threshold_used.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="pt-1 space-y-1">
                      <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ left: `${Math.min(100, Math.max(0, selectedFace.threshold_used * 100))}%` }}
                          className="absolute top-0 bottom-0 w-1 bg-white z-10"
                          title={`Threshold: ${selectedFace.threshold_used.toFixed(2)}`}
                        />
                        <div
                          style={{ width: `${Math.max(0, Math.min(100, selectedFace.similarity_score * 100))}%` }}
                          className={`h-full transition-all duration-500 rounded-full ${
                            isMatch
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Required Scientific Explanation Notice */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Similarity is the cosine similarity between the query face embedding and the enrolled template.
                    </p>
                  </div>

                  {/* Candidate Ranking List */}
                  {selectedFace.candidate_ranking && selectedFace.candidate_ranking.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-800/80">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Gallery Candidate Scores
                      </div>
                      <div className="space-y-1.5">
                        {selectedFace.candidate_ranking.map((cand, cIdx) => (
                          <div
                            key={cand.person_id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-500 text-[11px] w-4">
                                #{cIdx + 1}
                              </span>
                              <span className="font-semibold text-slate-200">{cand.name}</span>
                            </div>
                            <span className="font-mono text-cyan-400 font-semibold">
                              Similarity: {Number(cand.similarity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mb-3">
                <Scan className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-300 mb-1">Awaiting Query Image</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Upload a face photograph or capture a live webcam frame to run biometric identification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
