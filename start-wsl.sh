#!/bin/bash
PROJECT_ROOT="/home/adel/projects/meet-2"

cd $PROJECT_ROOT/backend && nohup npm run dev > $PROJECT_ROOT/backend.log 2>&1 &
cd $PROJECT_ROOT/student-client && nohup npm run dev > $PROJECT_ROOT/student.log 2>&1 &
cd $PROJECT_ROOT/wall-client && nohup npm run dev > $PROJECT_ROOT/wall.log 2>&1 &
echo "All processes started in background from $PROJECT_ROOT"
