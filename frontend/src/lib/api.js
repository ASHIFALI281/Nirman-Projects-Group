import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config;
    if (error.response?.status === 401 && cfg && !cfg._retry && cfg.url?.startsWith("/admin")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        return api(cfg);
      } catch (e) {
        window.dispatchEvent(new Event("admin-session-expired"));
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export const assetUrl = (u) => (u && u.startsWith("/api/") ? `${process.env.REACT_APP_BACKEND_URL}${u}` : u);

export const fmtDate = (d, withTime = false) => {
  if (!d) return "";
  const v = typeof d === "string" && d.includes("T") && !/(Z|[+-]\d\d:\d\d)$/.test(d) ? `${d}Z` : d;
  const opts = { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) };
  return new Date(v).toLocaleString("en-IN", opts);
};

const LABELS = { name: "Name", phone: "Mobile number", email: "Email", message: "Message", position: "Position", service: "Service", location: "Project location", company_name: "Company name", budget: "Budget" };

export const formatApiError = (err) => {
  const detail = err?.response?.data?.detail;
  if (!err?.response) return "Could not reach the server. Please check your connection and try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && typeof e.msg === "string" ? `${e.loc?.length ? `${LABELS[e.loc[e.loc.length - 1]] || e.loc[e.loc.length - 1]}: ` : ""}${e.msg.replace(/^Value error, /, "")}` : "")).filter(Boolean).join(". ");
  return "Something went wrong. Please try again.";
};
