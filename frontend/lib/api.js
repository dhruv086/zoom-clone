import axios from 'axios';

const defaultApiBase = process.env.NODE_ENV === 'production'
  ? 'https://zoom-backend.onrender.com/api'
  : 'http://localhost:8000/api';

const defaultWsBase = process.env.NODE_ENV === 'production'
  ? 'wss://zoom-backend.onrender.com'
  : 'ws://localhost:8000';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || defaultApiBase;
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_BACKEND_WS_URL || defaultWsBase;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { API_BASE_URL, WS_BASE_URL };
export default api;
