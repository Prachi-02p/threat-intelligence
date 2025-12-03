import axios from "axios";

const API_BASE = "http://localhost:8000";

export async function scanDomain(domain) {
  const res = await axios.get(`${API_BASE}/scan/domain?domain=${domain}`);
  return res.data;
}
