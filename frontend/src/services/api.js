import axios from "axios";

const API_BASE = "http://localhost:8000"; // Backend URL

export async function scanDomain(domain) {
  try {
    const res = await axios.get(`${API_BASE}/scan`, {
      params: { domain }  // Pass query parameter correctly
    });
    return res.data;
  } catch (err) {
    console.error("Error calling backend:", err);
    return { error: "Failed to connect to backend" };
  }
}
