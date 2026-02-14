import axios from "axios";

export const API_URL = "http://127.0.0.1:3847";

// Helper to call backend
export const callBackend = async (
  endpoint: string,
  method: "POST" | "GET" = "POST",
  data?: any,
) => {
  try {
    const res = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
    });
    return res.data;
  } catch (e) {
    console.error(`[api.ts] Failed to call ${endpoint}:`, e);
    return null;
  }
};
