import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const getHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const getSettings = async () => {
  const res = await api.get('/settings');
  return res.data;
};

export const updateSettings = async (settings) => {
  const res = await api.put('/settings', settings);
  return res.data;
};

export const listPersons = async (query = '') => {
  const res = await api.get('/persons', { params: query ? { query } : {} });
  return res.data;
};

export const getPerson = async (id) => {
  const res = await api.get(`/persons/${id}`);
  return res.data;
};

export const createPerson = async (personData) => {
  const res = await api.post('/persons', personData);
  return res.data;
};

export const updatePerson = async (id, personData) => {
  const res = await api.put(`/persons/${id}`, personData);
  return res.data;
};

export const deletePerson = async (id) => {
  const res = await api.delete(`/persons/${id}`);
  return res.data;
};

export const quickEnroll = async (formData) => {
  const res = await api.post('/enroll', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const verifyEnrollmentPhotos = async (formData) => {
  const res = await api.post('/enroll/verify-photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const addPersonImage = async (personId, formData) => {
  const res = await api.post(`/persons/${personId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteEmbedding = async (embeddingId) => {
  const res = await api.delete(`/embeddings/${embeddingId}`);
  return res.data;
};

export const recognizeFace = async (formData) => {
  const res = await api.post('/recognize', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getLogs = async (params = {}) => {
  const res = await api.get('/logs', { params });
  return res.data;
};

export const getLogStats = async () => {
  const res = await api.get('/logs/stats');
  return res.data;
};

export const clearLogs = async () => {
  const res = await api.delete('/logs');
  return res.data;
};

export const deleteSingleLog = async (logId) => {
  const res = await api.delete(`/logs/${logId}`);
  return res.data;
};

export const runEvaluation = async () => {
  const res = await api.post('/evaluate/run');
  return res.data;
};

export const getEvaluationSummary = async () => {
  const res = await api.get('/evaluate/summary');
  return res.data;
};

export default api;
