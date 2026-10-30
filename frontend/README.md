# CampusHub frontend

The React/Vite frontend reads clubs, events, and event memories from the Express API. Authentication uses the API's JWT endpoints; the frontend does not contain demo users or fallback club/event data.

## Requirements

- Node.js and npm
- The backend API and MySQL database running locally

## Getting started

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

By default, Vite starts at `http://localhost:5173` and the API client uses `http://localhost:3000`. Set `VITE_API_URL` in `.env` to the backend base URL when it runs elsewhere. Configure the backend's `CORS_ORIGIN` to allow the frontend origin.

## Build

```powershell
npm run build
```

## API-connected pages

- Home and event listings: active club, upcoming event, and memory endpoints.
- Club listing and detail: paginated/filterable clubs, club profile, core members, and upcoming events.
- Event detail and memories: public event detail and event photo/recap endpoints.
- Login, registration, and session restoration: `/auth/login`, `/auth/register`, and `/auth/me`.
- My registrations: authenticated `/auth/me/registrations`; cancellation uses the event registration endpoint.
- Admin overview: guarded for administrator accounts; currently read-only because the API does not expose the former dashboard's editing and roster workflows.

API errors are shown in the UI with retry controls for data queries. Missing or unavailable image URLs display neutral placeholders.
