// src/services/api.js
const BASE = "/api/election";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  searchConstituencies: (search = "") =>
    get(`/constituencies${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getConstituency:      (id) => get(`/constituencies/${id}`),
  getConstituencyChart: (id) => get(`/constituencies/${id}/chart`),
  getParties:           ()   => get(`/parties`),
  getSeatsChart:        ()   => get(`/chart/seats`),
  getVotesChart:        ()   => get(`/chart/votes`),
  getStats:             ()   => get(`/stats`),
  getGender:            ()   => get(`/gender`),   // ← NEW
};
