import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "./App.css";
import VoiceInput from "./VoiceInput";

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState("");
  const [noteText, setNoteText] = useState("");
  const [status, setStatus] = useState("");

  const [parsedData, setParsedData] = useState({
    notes: [],
    drugs: [],
    tests: [],
    observations: [],
    billing: 0,
    summary: "",
  });

  // Load patients
  useEffect(() => {
    axios
      .get("http://localhost:8080/patients")
      .then((res) => setPatients(res.data || []))
      .catch(() => setPatients([]));
  }, []);

  // Load visits
  useEffect(() => {
    if (!selectedPatient) {
      setVisits([]);
      setSelectedVisit("");
      return;
    }

    axios
      .get(`http://localhost:8080/patients/${selectedPatient}/visits`)
      .then((res) => setVisits(res.data || []))
      .catch(() => setVisits([]));
  }, [selectedPatient]);

  // Create visit
  const createVisit = async () => {
    if (!selectedPatient) return setStatus(" Select patient first");

    try {
      const res = await axios.post(
        `http://localhost:8080/patients/${selectedPatient}/visits`,
        {}
      );

      setVisits((prev) => [...prev, res.data]);
      setSelectedVisit(res.data.id);

      setParsedData({
        notes: [],
        drugs: [],
        tests: [],
        observations: [],
        billing: 0,
        summary: "",
      });

      setStatus(` Visit #${res.data.id} created`);
    } catch {
      setStatus(" Failed to create visit");
    }
  };

  // Save note
  const saveNote = async () => {
    if (!selectedVisit) return setStatus(" Select a visit first");
    if (!noteText.trim()) return setStatus(" Enter a note");

    try {
      const res = await axios.post(
        `http://localhost:8080/visits/${selectedVisit}/notes`,
        { content: noteText }
      );

      const data = res.data;

      console.log("API RESPONSE:", data);

      setParsedData({
        notes: Array.isArray(data.notes) ? data.notes : [],
        drugs: Array.isArray(data.drugs) ? data.drugs : [],
        tests: Array.isArray(data.tests) ? data.tests : [],
        observations: Array.isArray(data.observations) ? data.observations : [],
        billing: data.billing || 0,
        summary: data.summary || "",
      });

      setNoteText("");
      setStatus(" Note saved");
    } catch {
      setStatus(" Failed to save note");
    }
  };

  // PDF download
  const downloadPDF = () => {
    const doc = new jsPDF();
  
    let y = 15;
  
    // Header
    doc.setFontSize(18);
    doc.text("Clinic Visit Report", 14, y);
    y += 10;
  
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, y);
    y += 10;
  
    // Divider
    doc.line(14, y, 200, y);
    y += 10;
  
    // Summary
    doc.setFontSize(12);
    doc.text("Summary:", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(parsedData.summary || "-", 14, y);
    y += 10;
  
    // Drugs
    doc.setFontSize(12);
    doc.text("Drugs:", 14, y);
    y += 6;
  
    parsedData.drugs.forEach((d, i) => {
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${d.name} (${d.dosage}) - $${d.price}`, 16, y);
      y += 6;
    });
  
    y += 4;
  
    // Tests
    doc.setFontSize(12);
    doc.text("Tests:", 14, y);
    y += 6;
  
    parsedData.tests.forEach((t, i) => {
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${t.test_name} - $${t.price}`, 16, y);
      y += 6;
    });
  
    y += 4;
  
    // Observations
    doc.setFontSize(12);
    doc.text("Observations:", 14, y);
    y += 6;
  
    parsedData.observations.forEach((o, i) => {
      doc.setFontSize(10);
      doc.text(`- ${o}`, 16, y);
      y += 6;
    });
  
    y += 10;
  
    // Billing Box
    doc.setFontSize(12);
    doc.text("Billing Summary", 14, y);
    y += 6;
  
    doc.rect(14, y, 180, 20); // box
  
    doc.setFontSize(11);
    doc.text(`Total Amount: $${parsedData.billing}`, 20, y + 12);
  
    doc.save("visit_report.pdf");
  };

  const uniqueNotes = [...new Set(parsedData.notes || [])];

  return (
    <div className="app-container">
      <h1 className="title">🏥 Clinic Management System</h1>

      {/* Controls */}
      <div className="top-panel">
        <select
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
        >
          <option value="">Select Patient</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button onClick={createVisit}>+ New Visit</button>

        <select
          value={selectedVisit}
          onChange={(e) => setSelectedVisit(e.target.value)}
        >
          <option value="">Select Visit</option>
          {visits.map((v) => (
            <option key={v.id} value={v.id}>
              Visit #{v.id}
            </option>
          ))}
        </select>
      </div>

      <VoiceInput onResult={(text) => setNoteText(text)} />

      {/* Note Input */}
      <div className="note-box">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter symptoms, diagnosis, treatment..."
        />
        
        <button onClick={saveNote}>Save Note</button>
      </div>

      {parsedData.notes.length > 0 && (
        <button className="download-btn" onClick={downloadPDF}>
          📄 Download Report
        </button>
      )}

      {status && <p className="status">{status}</p>}

      {/* Dashboard */}
      <div className="dashboard">
        {/* Summary */}
        <div className="card">
          <h2>📋 Summary</h2>
          <p>{parsedData.summary || "No summary available"}</p>
        </div>

        {/* Drugs */}
        <div className="card">
          <h2>💊 Drugs</h2>
          {Array.isArray(parsedData.drugs) && parsedData.drugs.length > 0 ? (
            parsedData.drugs.map((d, i) => (
              <p key={i}>
                {d.name} ({d.dosage}) - ${d.price}
              </p>
            ))
          ) : (
            <p>No drugs</p>
          )}
        </div>

        {/* Tests */}
        <div className="card">
          <h2>🧪 Tests</h2>
          {Array.isArray(parsedData.tests) && parsedData.tests.length > 0 ? (
            parsedData.tests.map((t, i) => (
              <p key={i}>
                {t.test_name} - ${t.price}
              </p>
            ))
          ) : (
            <p>No tests</p>
          )}
        </div>

        {/* Observations */}
        <div className="card">
          <h2>🩺 Observations</h2>
          {Array.isArray(parsedData.observations) &&
          parsedData.observations.length > 0 ? (
            parsedData.observations.map((o, i) => <p key={i}>• {o}</p>)
          ) : (
            <p>No observations available</p>
          )}
        </div>

        {/* Notes Timeline */}
        <div className="card wide">
          <h2>📝 Notes Timeline</h2>
          {uniqueNotes.length > 0 ? (
            uniqueNotes.map((n, i) => (
              <div key={i} className="timeline-item">
                {n}
              </div>
            ))
          ) : (
            <p>No notes</p>
          )}
        </div>

        {/* Billing */}
        <div className="card billing">
          <h2>💰 Total Bill</h2>
          <p>${parsedData.billing || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
