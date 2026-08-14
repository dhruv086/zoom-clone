# Zoom Clone — LiveKit-powered Meeting App

A full-stack Zoom-inspired meeting application built with Django REST Framework on the backend and Next.js on the frontend. The project combines a polished UI, meeting lifecycle flows, real-time media connectivity using LiveKit, and host moderation tools.

## Overview

This app includes:
- **Dashboard-based meeting creation and scheduling**: Start instant meetings or join/schedule future sessions with customized titles, descriptions, dates, and durations.
- **Auto-normalizing ID validation**: Join meetings using invite links, raw numbers, or spaced codes. The system automatically cleans inputs and formats them to the standard `XXX-XXX-XXXX` format.
- **Physical device selections**: Enumerate real system microphones and camera inputs dynamically on both the dashboard and live meeting settings.
- **Host moderation controls**: Lock meetings, enable waiting rooms, mute all participant microphones, customize user permissions (chat, share screen, renaming), and eject/kick users.
- **Real-time communications**: Real-time video/audio streams, synchronized text chat, and interactive emoji reactions powered by LiveKit client APIs and data channel packets.
- **Render deployment blueprint**: Easy cloud deployment setup using `render.yaml`.

---

## Stack

- **Backend**: Django 4+ & Django REST Framework (DRF)
- **Frontend**: Next.js 14 & React (with Tailwind CSS styling)
- **Real-time Media & Signaling**: LiveKit Web SDK
- **Database**: SQLite for local development (supports SQLite/PostgreSQL migrations)
- **Deployment**: Render Blueprint YAML included

---

## Project Structure

- `backend/` — Django REST API, models, tests, and meeting views
- `frontend/` — Next.js application, React components, and meeting room layouts
- `docker-compose.yml` — Docker configuration for local LiveKit server
- `livekit.yaml` — LiveKit server configuration
- `render.yaml` — Blueprint config for cloud deployment
- `README.md` — Setup and usage guide

---

## Features

### 1. Active Hardware Device Integration
- Fetches real physical video and audio inputs from the user's browser using `navigator.mediaDevices.enumerateDevices()`.
- Dynamically switches camera and microphone tracks in real-time inside the meeting room using LiveKit's `switchActiveDevice` API.
- Persists selected device preferences across sessions in browser storage.

### 2. Host Controls & Meeting Security
- **Lock Meeting**: When locked by a host, new incoming participants are blocked from joining the session (enforced by backend validation).
- **Waiting Room & Restrictions**: Hosts can toggle waiting rooms or toggle user permissions (renaming, chat access, and screen sharing).
- **Mute All**: The host can instantly disable everyone else's microphones with a single action.
- **Participant Ejection**: Kick users out of the room instantly. Kicked participants are redirected to the landing page and greeted with a custom notification modal.

### 3. Smart Screen Sharing
- Normalizes and validates meeting IDs against the API *prior* to prompting screen capture permission for a better user experience.
- Screen sharing streams are safely cached in memory to handle sequential connection lifecycle updates seamlessly.

### 4. Interactive Collaboration
- Real-time text chat box inside the meeting room.
- Real-time floating emoji reaction animations.

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm
- Docker (for local LiveKit server testing)

### 1. Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the `backend/` directory:
   ```env
   DEBUG=True
   SECRET_KEY=your-secret-key
   ALLOWED_HOSTS=localhost,127.0.0.1
   CORS_ALLOW_ALL_ORIGINS=True
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   LIVEKIT_WS_URL=wss://your-livekit-host
   ```

5. Run Django database migrations:
   ```bash
   python manage.py migrate
   ```

6. Start the development server:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

The API will be running at `http://localhost:8000/api/`.

### 2. LiveKit Server Setup
To run a local LiveKit instance:
```bash
docker compose up -d
```
This starts a LiveKit server container matching the configurations in `livekit.yaml`.

### 3. Frontend Setup

1. In a separate terminal tab, navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install packages:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

The application will be running at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)
```env
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOW_ALL_ORIGINS=True
CORS_ALLOWED_ORIGINS=http://localhost:3000
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_WS_URL=wss://your-livekit-host
```

### Frontend (`frontend/.env.local` optional)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Running Automated Tests

Run backend unit tests (covering security permissions, meeting creation, and ejecting views) by running:
```bash
cd backend
python manage.py test
```

---

## Deployment to Render

A cloud deployment configuration is pre-configured in `render.yaml`. It sets up:
1. A Django web service (WSGI/ASGI).
2. A PostgreSQL database.
3. A Next.js frontend web service.

To deploy, upload the project to GitHub, link it on Render, specify your LiveKit credentials in the environment fields, and deploy! Use a hosted provider like LiveKit Cloud for production deployments.
