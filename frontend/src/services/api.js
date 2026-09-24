import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    import.meta.env?.VITE_API_URL ||
    "https://theage-backend.southindia.cloudapp.azure.com" 
});

// Attach token from sessionStorage to all outgoing requests
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Session handling on error responses:
//  - 401 (not authenticated / token expired/invalid): the session is dead, so
//    clear it and send the user to /login.
//  - 403 (authenticated but not allowed on this page/action): the token is
//    still valid — do NOT log the user out. Let the calling page surface an
//    "access denied" message instead of bouncing to /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;