# CampusHub - College Event & Club Management Platform

CampusHub is a modern university web application built to streamline college events, hackathons, student societies, and admission pass ticketing with verifiable QR codes.

## Features

- **Live Event Discovery & Search**: Filter upcoming hackathons, sports tournaments, cultural nights, and workshops by category, date, or popularity.
- **Student Societies & Clubs**: Explore verified student bodies (Code Nexus, Tarang Cultural, RoboCrafters, Aperture Shutterbugs, Titan Sports), join societies, or register new ones.
- **Event Registrations & Dynamic QR Passes**: Instant event registration with dynamic QR code generation for venue entry check-ins.
- **Digital Wallet**: View, download, print, or cancel booked event tickets.
- **Campus Memories**: Photo wall showcasing highlights of campus fests with likes and photo submission modals.
- **Role-Based Auth & One-Click Demo**: Test instantly as Student, Club Lead, or Faculty Admin.
- **Admin Portal**: Publish new campus events, monitor seat capacities, manage attendees, and export rosters to CSV.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Manrope typography, Lucide Icons
- **State & Caching**: TanStack Query (React Query), LocalStorage persistence
- **Routing**: React Router DOM (v6)
- **Utilities**: `qrcode`, `canvas-confetti`

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Samridh-Sethi29/DBMS_project.git
cd DBMS_project
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for production
```bash
npm run build
```
