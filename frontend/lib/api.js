import axios from 'axios';

// Create an Axios instance with a configurable baseURL.
// During development, we default to the local Django server port 8000.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
