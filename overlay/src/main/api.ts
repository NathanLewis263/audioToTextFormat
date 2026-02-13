export const API_URL = "http://127.0.0.1:3847";

// Helper to call backend
export const callBackend = async (
  endpoint: string,
  method: "POST" | "GET" = "POST",
) => {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { method });
    // Attempt to parse JSON if possible, but don't crash if empty
    try {
      const json = await res.json();
      // console.log(`[main.ts] Response from ${endpoint}:`, json);
    } catch (e) {}
  } catch (e) {
    console.error(`[api.ts] Failed to call ${endpoint}:`, e);
  }
};
