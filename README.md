# Zoom Clone — LiveKit-powered Meeting App

A full-stack Zoom-inspired meeting application built with Django REST Framework on the backend and Next.js on the frontend. The project is designed as a recruiter-facing demo that combines polished UI, meeting lifecycle flows, and real-time media connectivity using LiveKit.

## Overview

This app includes:

- dashboard-based meeting creation and discovery
- meeting join and validation flows
- participant tracking and mute/video controls
- chat and host controls
- real-time meeting rooms with LiveKit token generation
- Render deployment blueprint for easy cloud deployment

This is a polished demonstration app rather than a full production communications platform, but it is structured to look and behave like a realistic modern conference app.

---

## Stack

- Backend: Django + DRF
- Frontend: Next.js 14 + React
- Styling: Tailwind CSS
- Real-time media: LiveKit
- Database: SQLite for local development
- Deployment: Render blueprint included

---

## Project structure

- backend/ — Django API and meeting logic
- frontend/ — Next.js app and meeting UI
- docker-compose.yml — local LiveKit server
- livekit.yaml — LiveKit server configuration
- render.yaml — deployment setup for Render
- README.md — setup and usage guide

---

## Features

- create and list meeting sessions
- meeting validation by human-friendly ID
- join meeting flow with display name and media toggles
- host controls like mute all and room actions
- dynamic participant state tracking
- in-meeting chat messages
- meeting end/leave flow
- LiveKit room token generation for real-time meetings
- polished Zoom-like UI and experience

---

## Local development setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Docker (for local LiveKit server)

### 1. Backend setup

1. Open a terminal and go to the backend folder:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Create a backend env file:

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

5. Run migrations:

   ```bash
   python manage.py migrate
   ```

6. Start the Django server:

   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

The API will be available at:

```text
http://localhost:8000/api/
```

### 2. LiveKit setup

For local testing, you can run the included LiveKit server config:

```bash
docker compose up -d
```

This uses the configuration in [livekit.yaml](livekit.yaml) and exposes the usual LiveKit ports.

### 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```

---

## Environment variables

The backend expects these values in [backend/.env](backend/.env):

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

The frontend can use:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## LiveKit architecture

The meeting room uses LiveKit for media connectivity. The flow is:

1. User enters the meeting room.
2. Frontend requests a JWT token from the backend.
3. Django backend generates a token using the configured LiveKit API key and secret.
4. Frontend connects to the LiveKit room using that JWT.
5. Real-time audio and video streams are established through the LiveKit server.

This is the real-time infrastructure behind the actual meeting experience.

---

## Deployment

A Render deployment blueprint is included in [render.yaml](render.yaml). It configures:

- backend web service
- frontend web service
- Python runtime for Django
- Node runtime for Next.js
- env variables for LiveKit and API URLs

Before deployment, replace the placeholder LiveKit values with your real credentials and update the frontend/backend URLs for the deployed hosts.

### Render deployment

The included blueprint deploys the frontend, the Django ASGI service, and a
Render Postgres database. After syncing it in Render, add these backend
environment variables in the Render dashboard:

```env
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_WS_URL=wss://your-livekit-project.livekit.cloud
```

Use a hosted LiveKit project (such as LiveKit Cloud) for production media.
Render web services do not expose the UDP transport that a self-hosted LiveKit
server needs. The names and URLs in `render.yaml` must match your Render service
URLs if you rename either web service.

---

## Notes

- SQLite is used for local development and quick demonstration setup.
- The app is designed to feel like a polished Zoom clone for assignment and portfolio use.
- It is not a full enterprise-grade conferencing stack, but it is a strong end-to-end example of meeting product thinking and real-time media integration.

---

## Verification status

The project has been validated for:

- Django startup with env loading
- LiveKit JWT generation using configured credentials
- frontend production build compatibility

The backend environment must still be pointed to a valid LiveKit host and credentials for full live meeting validation in a real browser session.
