# Classroom Wall Display (Kiosk Mode)

A dedicated wall display client for the Hybrid Classroom system. Shows all connected students in a responsive grid layout.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The app will run on `http://localhost:5173`

## Features

- **Grid Layout**: Automatically adjusts grid based on number of participants
- **Kiosk Mode**: No local video or control buttons visible
- **User Tags**: Shows participant names and microphone status
- **Responsive Design**: Adapts to different screen sizes
- **Audio Playback**: Receives and plays audio from all participants

## Backend Integration

Requires backend API at `http://localhost:5000/api/rooms/join` with:

```json
{
  "roomName": "classroom-wall",
  "identity": "ClassroomWall",
  "isTeacher": false,
  "isWallDisplay": true
}
```
