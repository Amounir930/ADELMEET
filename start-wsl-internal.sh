#!/bin/bash
PROJECT_ROOT="/home/adel/projects/meet-2"

echo "Starting Backend..."
(cd $PROJECT_ROOT/backend && npm run dev > $PROJECT_ROOT/backend.log 2>&1) &

echo "Starting Student Client..."
(cd $PROJECT_ROOT/student-client && npm run dev > $PROJECT_ROOT/student.log 2>&1) &

echo "Starting Wall Client..."
(cd $PROJECT_ROOT/wall-client && npm run dev > $PROJECT_ROOT/wall.log 2>&1) &

disown -a
echo "All processes started."
