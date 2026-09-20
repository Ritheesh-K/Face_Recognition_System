import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  Trash2, 
  Eye, 
  Calendar, 
  Tag, 
  Plus, 
  Image as ImageIcon,
  CheckCircle2, 
  ShieldCheck,
  AlertCircle,
  X,
  Upload,
  Edit3,
  Loader2,
  Check
} from 'lucide-react';
import { listPersons, getPerson, deletePerson, deleteEmbedding, addPersonImage, updatePerson } from '../services/api';

export default function PersonsPage({ onDatabaseChange, onSelectPerson }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Edit Person State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', code: '', department: '', notes: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);

  const handleOpenEdit = (person) => {
    setPersonToEdit(person);
    setEditFormData({
      name: person.name || '',
      code: person.code || '',
      department: person.department || '',
      notes: person.notes || ''
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!personToEdit) return;
    if (!editFormData.name.trim()) {
      setEditError("Full name is required.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const updated = await updatePerson(personToEdit.id, {
        name: editFormData.name.trim(),
        code: editFormData.code.trim() || null,
        department: editFormData.department.trim() || null,
        notes: editFormData.notes.trim() || null
      });

      setEditSuccess("Profile details updated successfully!");

      // Update local lists
      setPersons(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      if (selectedPerson?.id === updated.id) {
        setSelectedPerson(prev => ({ ...prev, ...updated }));
      }

      if (onDatabaseChange) onDatabaseChange();

      setTimeout(() => {
        setEditModalOpen(false);
        setEditSuccess(null);
      }, 700);
    } catch (err) {
      console.error("Failed to update person:", err);
      const detail = err.response?.data?.detail;
      setEditError(detail || "Failed to update profile details. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchPersons = async () => {
    setLoading(true);
    try {
      const data = await listPersons(searchQuery);
      setPersons(data);
    } catch (err) {
      console.error("Failed to load persons:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersons();
  }, [searchQuery]);

  const handleDeletePerson = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name} and all enrolled face models?`)) {
      return;
    }
    try {
      await deletePerson(id);
      if (selectedPerson?.id === id) setInspectModalOpen(false);
      fetchPersons();
      if (onDatabaseChange) onDatabaseChange();
    } catch (err) {
      alert("Failed to delete person.");
    }
  };

  const handleOpenInspect = async (id) => {
    try {
      const person = await getPerson(id);
      setSelectedPerson(person);
      setInspectModalOpen(true);
    } catch (err) {
      alert("Failed to load person details.");
    }
  };

  const handleDeleteEmbedding = async (embId) => {
    if (!window.confirm("Delete this enrolled face image?")) return;
    try {
      await deleteEmbedding(embId);
      if (selectedPerson) {
        const updated = await getPerson(selectedPerson.id);
        setSelectedPerson(updated);
      }
      fetchPersons();
      if (onDatabaseChange) onDatabaseChange();
    } catch (err) {
      alert("Failed to delete face image.");
    }
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPerson) return;

    setUploadingImage(true);
    const fd = new FormData();
    fd.append('file', file);

    try {
      await addPersonImage(selectedPerson.id, fd);
      const updated = await getPerson(selectedPerson.id);
      setSelectedPerson(updated);
      fetchPersons();
      if (onDatabaseChange) onDatabaseChange();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to add enrollment image. Ensure face is clearly visible.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Persons Database
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registered identities with individual ArcFace embeddings and representative biometric templates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Grid of Persons */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">Loading enrolled identities...</div>
      ) : persons.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Enrolled Persons Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {searchQuery ? `No persons matching "${searchQuery}".` : "The database is empty. Enroll new identities to start recognizing faces."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {persons.map((person) => (
            <div
              key={person.id}
              className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all group"
            >
              <div>
                <div className="flex items-start gap-4 mb-4">
                  {/* Avatar thumbnail */}
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                    {person.avatar_path ? (
                      <img
                        src={`/media/${person.avatar_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-8 h-8 text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white truncate">{person.name}</h3>
                      {person.code && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono text-[10px] font-bold">
                          {person.code}
                        </span>
                      )}
                    </div>

                    {person.department && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                        <Tag className="w-3 h-3 text-cyan-500" />
                        <span>{person.department}</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-cyan-400" />
                        {person.image_count} {person.image_count === 1 ? 'image' : 'images'}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(person.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {person.notes && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
                    {person.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenInspect(person.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(person)}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors px-2.5 py-1 rounded-lg hover:bg-amber-950/40 border border-amber-500/20 hover:border-amber-500/40"
                    title="Edit name, roll number, department, or notes"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeletePerson(person.id, person.name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Delete Person"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: View Details */}
      {inspectModalOpen && selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700 p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Person Header */}
            <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-800 pr-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedPerson.avatar_path ? (
                    <img
                      src={`/media/${selectedPerson.avatar_path}`}
                      alt={selectedPerson.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-8 h-8 text-slate-500" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-white">{selectedPerson.name}</h2>
                    {selectedPerson.code && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-xs font-bold">
                        {selectedPerson.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedPerson.department || 'No department specified'} • Enrolled on {new Date(selectedPerson.created_at).toLocaleDateString()}
                  </p>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[11px] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Representative Template: L2-Normalized 512D ArcFace Vector</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenEdit(selectedPerson)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Info</span>
              </button>
            </div>

            {/* Enrolled Photos Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Enrolled Face Samples ({selectedPerson.embeddings?.length || 0})
                </h4>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{uploadingImage ? 'Processing...' : 'Add Sample Photo'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAddPhoto}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedPerson.embeddings?.map((emb, idx) => (
                  <div
                    key={emb.id}
                    className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-square"
                  >
                    <img
                      src={`/media/${emb.thumbnail_path}`}
                      alt={`Face sample ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="text-[10px] font-mono text-cyan-300">
                        {emb.detection_confidence ? `Det: ${Number(emb.detection_confidence).toFixed(2)}` : 'Sample'}
                      </div>
                      <button
                        onClick={() => handleDeleteEmbedding(emb.id)}
                        className="self-end p-1.5 rounded-lg bg-rose-900/80 text-rose-200 hover:bg-rose-800 transition-colors"
                        title="Delete photo sample"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Person Information */}
      {editModalOpen && personToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div 
            className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/50 border border-amber-800/60 flex items-center justify-center shrink-0">
                <Edit3 className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Edit Person Identity</h3>
                <p className="text-xs text-slate-400">
                  Update full name, roll number / ID, department, or remarks for <span className="text-amber-300 font-semibold">{personToEdit.name}</span>.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Success Banner */}
            {editSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Roll No / Person ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Roll No / Person ID / Code
                </label>
                <input
                  type="text"
                  value={editFormData.code}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. 21CS042 or EMP-1042"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                />
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Unique student roll number, employee code, or badge number
                </p>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Department / Role (Optional)
                </label>
                <input
                  type="text"
                  value={editFormData.department}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g. Computer Science / AI Lab"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional details, shift timings, remarks, etc."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editSubmitting || !editFormData.name.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
