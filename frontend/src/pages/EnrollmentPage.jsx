import React, { useState, useRef, useEffect } from 'react';
import { 
  UserPlus, 
  Upload, 
  X, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Copy,
  Users, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
  Loader2,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UserX
} from 'lucide-react';
import { quickEnroll, verifyEnrollmentPhotos } from '../services/api';

export default function EnrollmentPage({ onEnrollmentChange, onNavigate }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(null); // 'detecting' | 'embedding' | 'saving'
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [enrolledPersonData, setEnrolledPersonData] = useState(null);

  // Cross-photo identity verification state
  const [verifyingPhotos, setVerifyingPhotos] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activePreviewIndex === null) return;
      if (e.key === 'Escape') {
        setActivePreviewIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setActivePreviewIndex(prev => (prev > 0 ? prev - 1 : selectedFiles.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActivePreviewIndex(prev => (prev < selectedFiles.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePreviewIndex, selectedFiles.length]);

  const handleRemoveActivePhoto = () => {
    if (activePreviewIndex === null) return;
    const indexToRemove = activePreviewIndex;
    removeFile(indexToRemove);
    if (selectedFiles.length <= 1) {
      setActivePreviewIndex(null);
    } else if (indexToRemove >= selectedFiles.length - 1) {
      setActivePreviewIndex(selectedFiles.length - 2);
    }
  };

  const runPhotoVerification = async (filesToVerify) => {
    if (filesToVerify.length < 3) {
      setVerificationResult(null);
      return;
    }

    setVerifyingPhotos(true);
    setVerificationResult(null);

    const formData = new FormData();
    filesToVerify.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const res = await verifyEnrollmentPhotos(formData);
      setVerificationResult(res);
      if (!res.valid) {
        setErrorMsg(res.message);
      } else {
        setErrorMsg(null);
      }
    } catch (err) {
      console.error("Photo verification check failed:", err);
      const backendDetail = err.response?.data?.detail;
      setVerificationResult({
        valid: false,
        message: backendDetail || "Failed to verify photos. Please check image quality.",
        mismatched_indices: [],
        photo_details: []
      });
      setErrorMsg(backendDetail || "Photo verification failed. Ensure each photo contains a clear single face.");
    } finally {
      setVerifyingPhotos(false);
    }
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validate image types
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length < files.length) {
      setErrorMsg("Some files were skipped because they are not valid images.");
    }

    const updated = [...selectedFiles, ...validFiles];
    setErrorMsg(null);

    setSelectedFiles(updated);
    setPreviews(updated.map(f => URL.createObjectURL(f)));

    if (updated.length >= 3) {
      runPhotoVerification(updated);
    } else {
      setVerificationResult(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    const updated = [...selectedFiles, ...files];
    setErrorMsg(null);

    setSelectedFiles(updated);
    setPreviews(updated.map(f => URL.createObjectURL(f)));

    if (updated.length >= 3) {
      runPhotoVerification(updated);
    } else {
      setVerificationResult(null);
    }
  };

  const removeFile = (idx) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updatedFiles);
    setPreviews(updatedFiles.map(f => URL.createObjectURL(f)));

    if (updatedFiles.length >= 3) {
      runPhotoVerification(updatedFiles);
    } else {
      setVerificationResult(null);
      setErrorMsg(null);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setEnrolledPersonData(null);

    if (!name.trim()) {
      setErrorMsg("Please enter the person's full name.");
      return;
    }
    if (!code.trim()) {
      setErrorMsg("Please enter a unique Person ID / Code.");
      return;
    }
    if (selectedFiles.length < 3) {
      setErrorMsg(`Enrollment requires at least 3 images for template generation. Currently selected: ${selectedFiles.length}.`);
      return;
    }

    // Strict client-side check if a mismatch was already flagged
    if (verificationResult && !verificationResult.valid) {
      setErrorMsg(verificationResult.message || "Please resolve photo mismatches before enrolling. All photos must belong to the same person.");
      return;
    }

    setSubmitting(true);
    setProgressStep("Detecting faces and verifying cross-photo identity consistency...");

    const payload = new FormData();
    payload.append('name', name.trim());
    payload.append('code', code.trim());
    if (department.trim()) payload.append('department', department.trim());
    if (notes.trim()) payload.append('notes', notes.trim());

    selectedFiles.forEach((file) => {
      payload.append('images', file);
    });

    try {
      setTimeout(() => setProgressStep("Extracting 512D ArcFace embeddings and normalizing..."), 600);
      setTimeout(() => setProgressStep("Generating representative template mean vector..."), 1200);

      const res = await quickEnroll(payload);
      setSuccessMsg(res.message || `Identity '${name}' enrolled successfully with ${res.embeddings_created || selectedFiles.length} face embeddings.`);
      setEnrolledPersonData(res);
      setName('');
      setCode('');
      setDepartment('');
      setNotes('');
      setSelectedFiles([]);
      setPreviews([]);
      setVerificationResult(null);
      if (onEnrollmentChange) onEnrollmentChange();
    } catch (err) {
      console.error("Enrollment error:", err);
      const backendDetail = err.response?.data?.detail;
      setErrorMsg(backendDetail || "Enrollment failed. Ensure each image contains exactly one clear face and all photos belong to the same person.");
    } finally {
      setSubmitting(false);
      setProgressStep(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <UserPlus className="w-7 h-7 text-cyan-400" />
            Enroll Person Identity
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Register new individuals with 3 or more face photographs. SCRFD enforces exactly 1 face per image and computes a normalized ArcFace template.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono font-semibold">
            Single-Face Constraint Active
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 shadow-xl shadow-emerald-950/30 text-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-300">Enrollment Successful!</h4>
              <p className="text-xs text-slate-300 mt-1">{successMsg}</p>
              {enrolledPersonData && (
                <div className="mt-2 text-xs font-mono text-emerald-400/90">
                  ID: {enrolledPersonData.code} • Enrolled Photos: {enrolledPersonData.embeddings_created || 'Multiple'}
                </div>
              )}
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('persons')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 shrink-0"
            >
              View in Database
            </button>
          )}
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 shadow-xl shadow-rose-950/30 text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-rose-300">Enrollment Validation Failed: </span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Enrollment Form Container */}
      <form onSubmit={handleEnrollSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Fields (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Identity Information
            </h3>

            {/* Name Input */}
            <div>
              <label htmlFor="input-enroll-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="input-enroll-name"
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Person ID Input */}
            <div>
              <label htmlFor="input-enroll-code" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Person ID / Code <span className="text-rose-400">*</span>
              </label>
              <input
                id="input-enroll-code"
                type="text"
                required
                placeholder="e.g. EMP-1042 or rahul_s"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">Unique alphanumeric identifier</p>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="input-enroll-dept" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department / Role (Optional)
              </label>
              <input
                id="input-enroll-dept"
                type="text"
                placeholder="e.g. Computer Vision Lab"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="input-enroll-notes" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Notes (Optional)
              </label>
              <textarea
                id="input-enroll-notes"
                rows={2}
                placeholder="Additional details, camera conditions, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Guidelines Notice */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <Info className="w-4 h-4 text-cyan-400" />
              Enrollment Guidelines
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
              <li>Upload <strong className="text-cyan-300">at least 3 images</strong> per person (more photos improve recognition accuracy).</li>
              <li>Each image <strong className="text-rose-300">must contain exactly ONE face</strong>. Images with 0 or multiple faces will be rejected.</li>
              <li>Vary angles slightly (frontal, slight left/right, smile) for robust template creation.</li>
              <li>A normalized representative template vector is automatically derived using: <span className="font-mono text-cyan-400">template = L2(mean(embeddings))</span>.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Multi-Image Upload & Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  Face Images (at least 3 required)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selected: <span className={`font-mono font-bold ${selectedFiles.length >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>{selectedFiles.length} photo(s) (min 3)</span>
                </p>
              </div>

              <button
                type="button"
                id="btn-browse-images"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add Photos</span>
              </button>
            </div>

            {/* Dropzone Area */}
            <div
              id="dropzone-enroll"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                selectedFiles.length === 0
                  ? 'border-slate-800 hover:border-cyan-500/60 bg-slate-900/40 hover:bg-slate-900/60 min-h-[160px] flex flex-col items-center justify-center'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/20 py-4'
              }`}
            >
              <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-200">
                Drag & Drop 3 or more face photographs here, or click to browse
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supported formats: JPG, PNG, WEBP
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFilesSelected}
              className="hidden"
            />

            {/* Consistency Verification Status Banner */}
            {verifyingPhotos && (
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>Verifying photo consistency: Checking that all {selectedFiles.length} photos are distinct and belong to the same person...</span>
              </div>
            )}

            {/* Already Enrolled Identity Warning Banner */}
            {verificationResult?.already_enrolled_collision?.has_collision && !verifyingPhotos && (
              <div className="p-4 rounded-2xl bg-purple-950/60 border-2 border-purple-500/90 shadow-xl shadow-purple-950/60 text-purple-200 text-xs space-y-2.5 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <UserX className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                      <span>
                        {verificationResult.already_enrolled_collision.collision_type === "DUPLICATE_ENROLLED_PHOTO"
                          ? "Photo Already Enrolled for Another Identity!"
                          : "Person Already Enrolled in Database!"}
                      </span>
                    </h4>
                    <p className="text-purple-200 mt-1 leading-relaxed">
                      {verificationResult.already_enrolled_collision.message}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-900/80 border border-purple-600 text-purple-200 font-semibold">
                        Registered Name: <strong className="text-purple-100">{verificationResult.already_enrolled_collision.matched_person_name}</strong>
                      </span>
                      {verificationResult.already_enrolled_collision.matched_person_code && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-900/80 border border-purple-600 text-purple-200 font-semibold">
                          ID: <strong className="text-purple-100">{verificationResult.already_enrolled_collision.matched_person_code}</strong>
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-purple-900/80 border border-purple-600 text-purple-200 font-semibold">
                        Biometric Match: <strong className="text-purple-100">{Math.round(verificationResult.already_enrolled_collision.similarity * 100)}%</strong>
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-300/90 mt-2 font-medium">
                      ⛔ The system strictly prevents registering the same individual multiple times under different names or reusing photos from existing identities.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate Photo Warning Banner */}
            {verificationResult?.duplicate_indices?.length > 0 && !verificationResult?.already_enrolled_collision?.has_collision && !verifyingPhotos && (
              <div className="p-4 rounded-2xl bg-amber-950/50 border-2 border-amber-600/80 shadow-xl shadow-amber-950/50 text-amber-200 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <Copy className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm">Duplicate Photo Detected!</h4>
                    <p className="text-amber-200 mt-1 leading-relaxed">
                      {verificationResult.message}
                    </p>
                    <p className="text-[11px] text-amber-300/90 mt-1.5 font-medium">
                      ⚠️ Multi-photo enrollment requires distinct face photographs from different angles or lighting conditions. Click the <strong>✕</strong> on the highlighted duplicate photo to remove it and upload a different photo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Identity Mismatch Warning Banner */}
            {verificationResult?.mismatched_indices?.length > 0 && !verificationResult?.already_enrolled_collision?.has_collision && !verifyingPhotos && (
              <div className="p-4 rounded-2xl bg-rose-950/50 border-2 border-rose-600/80 shadow-xl shadow-rose-950/50 text-rose-200 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-300 text-sm">Different Person Photo Detected!</h4>
                    <p className="text-rose-200 mt-1 leading-relaxed">
                      {verificationResult.message}
                    </p>
                    <p className="text-[11px] text-rose-300/90 mt-1.5 font-medium">
                      ⚠️ Enrollment is blocked until all photos match. Click the red <strong>✕</strong> on the highlighted photo to remove it and upload a matching photo of the same person.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Photo Quality / Validation Error Banner */}
            {(verificationResult?.invalid_indices?.length > 0 || (verificationResult && !verificationResult.valid && !verificationResult.mismatched_indices?.length && !verificationResult.duplicate_indices?.length && !verificationResult.already_enrolled_collision?.has_collision)) && !verifyingPhotos && (
              <div className="p-4 rounded-2xl bg-rose-950/50 border-2 border-rose-600/80 shadow-xl shadow-rose-950/50 text-rose-200 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-300 text-sm">Photo Quality Issue Detected</h4>
                    <p className="text-rose-200 mt-1 leading-relaxed">
                      {verificationResult.message}
                    </p>
                    <p className="text-[11px] text-rose-300/90 mt-1.5 font-medium">
                      ⚠️ Click the red <strong>✕</strong> on the highlighted photo to remove it and upload a clearer, well-lit face photo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {verificationResult && verificationResult.valid && !verifyingPhotos && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">All {selectedFiles.length} photos verified! Distinct shots of the same person confirmed and free of collisions.</span>
              </div>
            )}

            {/* Previews Grid */}
            {previews.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Selected Image Previews</span>
                  <span>{previews.length} photos ready</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {previews.map((url, idx) => {
                    const isAlreadyEnrolled = verificationResult?.already_enrolled_collision?.has_collision;
                    const isDuplicate = verificationResult?.duplicate_indices?.includes(idx);
                    const isMismatched = verificationResult?.mismatched_indices?.includes(idx);
                    const isInvalid = verificationResult?.invalid_indices?.includes(idx) || (verificationResult?.photo_details?.[idx]?.status === 'ERROR');
                    const isVerifiedValid = verificationResult?.valid;

                    return (
                      <div 
                        key={idx}
                        onClick={() => setActivePreviewIndex(idx)}
                        title="Click to view full photo on screen"
                        className={`group relative rounded-2xl overflow-hidden aspect-square shadow-md transition-all duration-300 cursor-pointer ${
                          isAlreadyEnrolled
                            ? 'border-2 border-purple-500 shadow-purple-950/80 ring-2 ring-purple-500/50 bg-purple-950/20'
                            : isDuplicate
                            ? 'border-2 border-amber-500 shadow-amber-950/80 ring-2 ring-amber-500/50 bg-amber-950/20'
                            : isMismatched 
                            ? 'border-2 border-rose-500 shadow-rose-950/80 ring-2 ring-rose-500/50 bg-rose-950/20' 
                            : isInvalid
                            ? 'border-2 border-rose-500 shadow-rose-950/80 ring-2 ring-rose-500/50 bg-rose-950/20'
                            : isVerifiedValid 
                            ? 'border-2 border-emerald-500/80 shadow-emerald-950/40' 
                            : 'border border-slate-800 bg-slate-950 hover:border-cyan-500/60'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-[10px] font-mono font-bold text-cyan-300 border border-slate-800">
                          #{idx + 1}
                        </div>

                        {/* Hover Overlay with Zoom indicator */}
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                          <div className="p-2 px-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-cyan-300 shadow-lg flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm">
                            <ZoomIn className="w-4 h-4" />
                            <span>View Full</span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        {isAlreadyEnrolled && (
                          <div className="absolute bottom-2 left-2 right-2 px-1.5 py-1 rounded-lg bg-purple-950/95 border border-purple-500 text-purple-200 text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg z-10">
                            <UserX className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">Already: {verificationResult.already_enrolled_collision.matched_person_name}</span>
                          </div>
                        )}
                        {isDuplicate && !isAlreadyEnrolled && (
                          <div className="absolute bottom-2 left-2 right-2 px-1.5 py-1 rounded-lg bg-amber-950/95 border border-amber-600 text-amber-200 text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg z-10">
                            <Copy className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">Duplicate Photo</span>
                          </div>
                        )}
                        {isMismatched && !isDuplicate && !isAlreadyEnrolled && (
                          <div className="absolute bottom-2 left-2 right-2 px-1.5 py-1 rounded-lg bg-rose-900/95 border border-rose-600 text-rose-100 text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg z-10">
                            <AlertTriangle className="w-3 h-3 text-rose-300 shrink-0" />
                            <span className="truncate">Different Person</span>
                          </div>
                        )}
                        {isInvalid && !isMismatched && !isDuplicate && !isAlreadyEnrolled && (
                          <div className="absolute bottom-2 left-2 right-2 px-1.5 py-1 rounded-lg bg-rose-900/95 border border-rose-600 text-rose-100 text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-lg z-10">
                            <AlertCircle className="w-3 h-3 text-rose-300 shrink-0" />
                            <span className="truncate">Quality Issue</span>
                          </div>
                        )}
                        {isVerifiedValid && !isMismatched && !isDuplicate && !isAlreadyEnrolled && !isInvalid && (
                          <div className="absolute bottom-2 left-2 right-2 px-1.5 py-0.5 rounded-lg bg-emerald-900/90 border border-emerald-600 text-emerald-100 text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-md z-10">
                            <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                            <span>Matched</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className={`absolute top-2 right-2 p-1.5 rounded-full border transition-all z-20 ${
                            isAlreadyEnrolled
                              ? 'bg-purple-600 text-white border-purple-400 hover:bg-purple-500 ring-2 ring-purple-400/60'
                              : isDuplicate
                              ? 'bg-amber-600 text-white border-amber-400 hover:bg-amber-500 ring-2 ring-amber-400/60'
                              : isMismatched 
                              ? 'bg-rose-600 text-white border-rose-400 hover:bg-rose-500 ring-2 ring-rose-400/60'
                              : 'bg-rose-950/80 text-rose-300 hover:bg-rose-600 hover:text-white border-rose-800/80'
                          }`}
                          title={isAlreadyEnrolled ? "Remove photo matching enrolled person" : isDuplicate ? "Remove duplicate photo" : (isMismatched ? "Remove mismatched photo" : "Remove photo")}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress indicator during submission */}
            {submitting && (
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/50 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Processing Biometric Enrollment...</span>
                </div>
                {progressStep && (
                  <p className="text-[11px] text-slate-400 font-mono pl-6">
                    {progressStep}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="btn-submit-enroll"
                disabled={
                  submitting || 
                  selectedFiles.length < 3 || 
                  verifyingPhotos || 
                  (verificationResult && !verificationResult.valid)
                }
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
                  verificationResult?.already_enrolled_collision?.has_collision
                    ? 'bg-purple-950/90 text-purple-300 border border-purple-600/80 cursor-not-allowed'
                    : verificationResult && !verificationResult.valid
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enrolling Face Identity...</span>
                  </>
                ) : verifyingPhotos ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Photo Consistency...</span>
                  </>
                ) : verificationResult?.already_enrolled_collision?.has_collision ? (
                  <>
                    <UserX className="w-4 h-4 text-purple-400" />
                    <span>Already Enrolled as "{verificationResult.already_enrolled_collision.matched_person_name}" ({verificationResult.already_enrolled_collision.matched_person_code || 'Registered'})</span>
                  </>
                ) : verificationResult?.duplicate_indices?.length > 0 ? (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Resolve Duplicate Photos to Enroll</span>
                  </>
                ) : verificationResult?.mismatched_indices?.length > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Resolve Photo Mismatches to Enroll</span>
                  </>
                ) : verificationResult && !verificationResult.valid ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Replace Invalid Photo to Enroll</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Enroll Person Identity ({selectedFiles.length} Photos)</span>
                  </>
                )}
              </button>
              {selectedFiles.length < 3 && (
                <p className="text-[11px] text-amber-400/80 text-center mt-2 font-mono">
                  Select at least {3 - selectedFiles.length} more photo(s) to enable enrollment
                </p>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Enlarged Photo Inspection Modal / Lightbox */}
      {activePreviewIndex !== null && previews[activePreviewIndex] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setActivePreviewIndex(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono text-xs font-bold">
                  Photo #{activePreviewIndex + 1} of {selectedFiles.length}
                </span>
                <span className="text-sm font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                  {selectedFiles[activePreviewIndex]?.name}
                </span>

                {/* Status Badges */}
                {verificationResult?.already_enrolled_collision?.has_collision ? (
                  <span className="px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500 text-purple-200 text-xs font-bold flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5 text-purple-400" /> Already Enrolled: {verificationResult.already_enrolled_collision.matched_person_name} ({Math.round(verificationResult.already_enrolled_collision.similarity * 100)}%)
                  </span>
                ) : verificationResult?.duplicate_indices?.includes(activePreviewIndex) ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-950 border border-amber-600 text-amber-300 text-xs font-bold flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5 text-amber-400" /> Duplicate Photo
                  </span>
                ) : verificationResult?.mismatched_indices?.includes(activePreviewIndex) ? (
                  <span className="px-2 py-0.5 rounded-md bg-rose-950 border border-rose-600 text-rose-300 text-xs font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Different Person
                  </span>
                ) : (verificationResult?.invalid_indices?.includes(activePreviewIndex) || verificationResult?.photo_details?.[activePreviewIndex]?.status === 'ERROR') ? (
                  <span className="px-2 py-0.5 rounded-md bg-rose-950 border border-rose-600 text-rose-300 text-xs font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Quality Issue
                  </span>
                ) : verificationResult?.valid ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-600 text-emerald-300 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Matched Identity
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                id="btn-close-lightbox"
                onClick={() => setActivePreviewIndex(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0 ml-2"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Large Image Display with Prev/Next Navigation */}
            <div className="relative flex-1 flex items-center justify-center p-4 bg-slate-950/70 min-h-[320px] max-h-[calc(90vh-140px)] overflow-hidden">
              {/* Navigation Left */}
              {selectedFiles.length > 1 && (
                <button
                  type="button"
                  id="btn-lightbox-prev"
                  onClick={() => setActivePreviewIndex(prev => (prev > 0 ? prev - 1 : selectedFiles.length - 1))}
                  className="absolute left-3 sm:left-5 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 border border-slate-700 shadow-2xl backdrop-blur transition-all"
                  title="Previous photo (←)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Navigation Right */}
              {selectedFiles.length > 1 && (
                <button
                  type="button"
                  id="btn-lightbox-next"
                  onClick={() => setActivePreviewIndex(prev => (prev < selectedFiles.length - 1 ? prev + 1 : 0))}
                  className="absolute right-3 sm:right-5 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 border border-slate-700 shadow-2xl backdrop-blur transition-all"
                  title="Next photo (→)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Large Image */}
              <img
                src={previews[activePreviewIndex]}
                alt={selectedFiles[activePreviewIndex]?.name || `Photo ${activePreviewIndex + 1}`}
                className="max-h-[62vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800/80 transition-all"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 text-xs text-slate-400">
              <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                {selectedFiles[activePreviewIndex]?.size && (
                  <span>Size: {Math.round(selectedFiles[activePreviewIndex].size / 1024)} KB</span>
                )}
                {selectedFiles[activePreviewIndex]?.type && (
                  <span>Format: {selectedFiles[activePreviewIndex].type.replace('image/', '').toUpperCase()}</span>
                )}
                <span className="hidden md:inline text-slate-500 font-mono">
                  Tip: Use ← / → arrow keys to browse, Esc to close
                </span>
              </div>

              <button
                type="button"
                id="btn-lightbox-remove"
                onClick={handleRemoveActivePhoto}
                className="px-3.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-rose-100 font-semibold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Remove Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
