package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

type Patient struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Visit struct {
	ID        int `json:"id"`
	PatientID int `json:"patient_id"`
}

type NoteRequest struct {
	Content string `json:"content"`
}

// CORS Middleware
func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// AI/NLP Parser
func parseNoteText(text string) (drugs []map[string]string, tests []map[string]string, summary string, observations []string) {

	lower := strings.ToLower(text)

	addDrug := func(name, dosage, price string) {
		drugs = append(drugs, map[string]string{
			"name":   name,
			"dosage": dosage,
			"price":  price,
		})
	}

	addTest := func(name, price string) {
		tests = append(tests, map[string]string{
			"test_name": name,
			"price":     price,
		})
	}

	// ---------------- DRUGS ----------------

	// Fever
	if strings.Contains(lower, "fever") {
		addDrug("Paracetamol", "500mg", "50")
		addTest("Blood Test", "100")
	}

	// Cough
	if strings.Contains(lower, "cough") {
		addDrug("Cough Syrup", "10ml", "60")
	}

	// Sore throat
	if strings.Contains(lower, "sore throat") {
		addDrug("Lozenges", "2 pieces", "30")
		addTest("Throat Swab", "120")
	}

	// Muscle pain / back pain
	if strings.Contains(lower, "muscle pain") ||
		strings.Contains(lower, "back pain") ||
		strings.Contains(lower, "body pain") {

		addDrug("Ibuprofen", "400mg", "80")
		addDrug("Muscle Relaxant", "5mg", "100")
		addTest("X-Ray", "200")

		observations = append(observations, "Musculoskeletal pain detected")
	}

	// Headache
	if strings.Contains(lower, "headache") {
		addDrug("Paracetamol", "500mg", "50")
	}

	// Infection / inflammation
	if strings.Contains(lower, "infection") {
		addTest("CBC", "150")
		addTest("CRP", "200")
	}
	//here can add more

	// ---------------- TESTS ----------------

	if strings.Contains(lower, "blood test") ||
		strings.Contains(lower, "routine blood test") ||
		strings.Contains(lower, "recommended blood test") {

		addTest("Routine Blood Test", "100")
	}
	if strings.Contains(lower, " blood pressure") {
		addTest("Blood Pressure Check + Cholesterol Test", "200")
	}

	if strings.Contains(lower, "x-ray") || strings.Contains(lower, "xray") {
		addTest("X-Ray", "200")
	}

	if strings.Contains(lower, "mri") {
		addTest("MRI Scan", "500")
	}

	if strings.Contains(lower, "ultrasound") {
		addTest("Ultrasound Scan", "300")
	}

	// ---------------- OBSERVATIONS ----------------

	if strings.Contains(lower, "fever") {
		observations = append(observations, "Patient has fever")
	}

	if strings.Contains(lower, "cough") {
		observations = append(observations, "Patient reports cough")
	}

	if strings.Contains(lower, "pain") {
		observations = append(observations, "Patient experiencing pain")
	}

	if strings.Contains(lower, "back pain") {
		observations = append(observations, "Lower back pain reported")
	}

	if strings.Contains(lower, "muscle") {
		observations = append(observations, "Muscle-related discomfort")
	}

	// ---------------- SUMMARY ----------------

	if len(text) > 300 {
		summary = text[:300] + "..."
	} else {
		summary = text
	}

	return
}

// ---------------- Handlers ----------------

// GET /patients or POST /patients
func PatientsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == "GET" {
		rows, _ := db.Query("SELECT id, name FROM patients ORDER BY id")
		defer rows.Close()
		var patients []Patient
		for rows.Next() {
			var p Patient
			rows.Scan(&p.ID, &p.Name)
			patients = append(patients, p)
		}
		json.NewEncoder(w).Encode(patients)
		return
	}

	// POST: create patient
	var p Patient
	json.NewDecoder(r.Body).Decode(&p)
	if strings.TrimSpace(p.Name) == "" {
		http.Error(w, "Invalid patient name", http.StatusBadRequest)
		return
	}
	db.QueryRow("INSERT INTO patients (name) VALUES ($1) RETURNING id", p.Name).Scan(&p.ID)
	json.NewEncoder(w).Encode(p)
}

// GET or POST /patients/{id}/visits
func PatientVisitsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	patientID, _ := strconv.Atoi(parts[2])

	if r.Method == "GET" {
		rows, _ := db.Query("SELECT id, patient_id FROM visits WHERE patient_id=$1", patientID)
		defer rows.Close()
		var visits []Visit
		for rows.Next() {
			var v Visit
			rows.Scan(&v.ID, &v.PatientID)
			visits = append(visits, v)
		}
		json.NewEncoder(w).Encode(visits)
		return
	}

	// POST: create visit
	var v Visit
	v.PatientID = patientID
	db.QueryRow("INSERT INTO visits (patient_id) VALUES ($1) RETURNING id", patientID).Scan(&v.ID)
	json.NewEncoder(w).Encode(v)
}

// POST /visits/{id}/notes
func VisitNotesHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	visitID, _ := strconv.Atoi(parts[2])

	var req NoteRequest
	json.NewDecoder(r.Body).Decode(&req)
	if strings.TrimSpace(req.Content) == "" {
		http.Error(w, "Note content required", http.StatusBadRequest)
		return
	}

	// Save note
	_, _ = db.Exec("INSERT INTO notes (visit_id, content) VALUES ($1, $2)", visitID, req.Content)

	// AI/NLP parsing
	drugs, tests, summary, observations := parseNoteText(req.Content)

	// Insert drugs if not exists
	for _, d := range drugs {
		var exists int
		db.QueryRow("SELECT COUNT(*) FROM drugs WHERE visit_id=$1 AND name=$2", visitID, d["name"]).Scan(&exists)
		if exists == 0 {
			db.Exec("INSERT INTO drugs (visit_id, name, dosage, price) VALUES ($1,$2,$3,$4)",
				visitID, d["name"], d["dosage"], d["price"])
		}
	}

	// Insert tests if not exists
	for _, t := range tests {
		var exists int
		db.QueryRow("SELECT COUNT(*) FROM lab_tests WHERE visit_id=$1 AND test_name=$2", visitID, t["test_name"]).Scan(&exists)
		if exists == 0 {
			db.Exec("INSERT INTO lab_tests (visit_id, test_name, price) VALUES ($1,$2,$3)",
				visitID, t["test_name"], t["price"])
		}
	}

	var total float64

	// calculate from CURRENT parsed drugs
	for _, d := range drugs {
		price, _ := strconv.ParseFloat(d["price"], 64)
		total += price
	}

	// calculate from CURRENT parsed tests
	for _, t := range tests {
		price, _ := strconv.ParseFloat(t["price"], 64)
		total += price
	}

	// Upsert billing
	db.Exec(`INSERT INTO billing (visit_id, total_amount) VALUES ($1,$2)
		ON CONFLICT (visit_id) DO UPDATE SET total_amount=$2`, visitID, total)

	// Fetch all notes
	rows, _ := db.Query("SELECT content FROM notes WHERE visit_id=$1 ORDER BY id", visitID)
	defer rows.Close()
	var allNotes []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		allNotes = append(allNotes, n)
	}

	resp := map[string]interface{}{
		"notes":        allNotes,
		"drugs":        drugs,
		"tests":        tests,
		"summary":      summary,
		"billing":      total,
		"observations": observations,
	}

	json.NewEncoder(w).Encode(resp)
}

// ---------------- Main ----------------

func main() {
	psql := "host=localhost port=5433 user=postgres password=Query@2026 dbname=clinic_db sslmode=disable"

	var err error
	db, err = sql.Open("postgres", psql)
	if err != nil {
		log.Fatal(err)
	}

	db.SetMaxOpenConns(25)                 // max simultaneous connections
	db.SetMaxIdleConns(10)                 // idle connections
	db.SetConnMaxLifetime(5 * time.Minute) // recycle connections

	// Ping DB
	err = db.Ping()
	if err != nil {
		log.Fatal("Cannot connect to DB:", err)
	}

	log.Println("Connected to DB successfully")

	http.HandleFunc("/patients", PatientsHandler)
	http.HandleFunc("/patients/", PatientVisitsHandler)
	http.HandleFunc("/visits/", VisitNotesHandler)

	log.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
