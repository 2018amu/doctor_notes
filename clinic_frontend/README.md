 Clinic Management System(using doctor notes )

A simple clinic management system with a Go (Golang) backend and a React frontend.
The system allows managing patients, visits, notes, and generating reports with AI-parsed medical data.

<!-- Features -->

Patient management

Create and manage visits

Add clinical notes (text/voice input)

AI-like parsing of notes into:

Drugs

Tests

Observations

Summary

Billing

View structured dashboard

Generate and download PDF reports

Tech Stack

Frontend: React, Axios, Tailwind CSS

Backend: Go (Golang), REST APIs

PDF Generation: jsPDF

 How to Run the Project
1. Backend (Go Server)

Navigate to backend directory:

PS C:\Users\User\Desktop\clinic-backend> go run main.go

The backend will start on:

http://localhost:8080
2. Frontend (React App)

Navigate to frontend directory:

cd C:\Users\User\Desktop\clinic-backend\clinic_frontend
npm install
npm start

The frontend will run on:

http://localhost:3000
🔗 API Endpoints (Backend)

GET /patients – Get all patients

POST /patients/{id}/visits – Create a visit

GET /patients/{id}/visits – Get visits of a patient

POST /visits/{id}/notes – Save and analyze notes