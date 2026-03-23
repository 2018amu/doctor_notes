import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  
    const patientName =
      patients.find((p) => String(p.id) === String(selectedPatient))?.name || "Patient";
  
    const doctorName = "Dr. N.Jeevan"; //change dynamically if needed
  
    // ---------------- LOGO ----------------
    // Use base64 image OR public path
    const logo = "./logo.png"; // place logo in public folder
  
    try {
      doc.addImage(logo, "PNG", 14, 10, 25, 25);
    } catch {
      console.log("Logo not found, skipping...");
    }
  
    // ---------------- HEADER ----------------
    doc.setFontSize(16);
    doc.text("CITY CLINIC", 45, 18);
  
    doc.setFontSize(11);
    doc.text("Patient Visit Report", 45, 24);
  
    doc.setFontSize(9);
    doc.text(`Date: ${new Date().toLocaleString()}`, 150, 18);
  
    doc.line(14, 35, 200, 35);
  
    // ---------------- PATIENT INFO ----------------
    let y = 42;
  
    doc.setFontSize(11);
    doc.text(`Patient: ${patientName}`, 14, y);
    doc.text(`Visit ID: ${selectedVisit}`, 120, y);
  
    y += 8;
  
    // ---------------- SUMMARY ----------------
    doc.setFontSize(12);
    doc.text("Clinical Summary", 14, y);
    y += 6;
  
    doc.setFontSize(10);
  
    const splitSummary = doc.splitTextToSize(
      parsedData.summary || "-",
      180
    );
    doc.text(splitSummary, 14, y);
  
    y += splitSummary.length * 6 + 4;
  
    // ---------------- DRUGS TABLE ----------------
    autoTable(doc, {
      startY: y,
      head: [["Drug", "Dosage", "Price ($)"]],
      body:
        parsedData.drugs.length > 0
          ? parsedData.drugs.map((d) => [d.name, d.dosage, d.price])
          : [["No drugs prescribed", "", ""]],
    });
  
    y = doc.lastAutoTable.finalY + 6;
  
    // ---------------- TESTS TABLE ----------------
    autoTable(doc, {
      startY: y,
      head: [["Test", "Price ($)"]],
      body:
        parsedData.tests.length > 0
          ? parsedData.tests.map((t) => [t.test_name, t.price])
          : [["No tests ordered", ""]],
    });
  
    y = doc.lastAutoTable.finalY + 6;
  
    // ---------------- OBSERVATIONS ----------------
    doc.setFontSize(12);
    doc.text("Observations", 14, y);
    y += 6;
  
    doc.setFontSize(10);
  
    const observationsText =
      parsedData.observations.length > 0
        ? parsedData.observations.map((o) => `• ${o}`).join("\n")
        : "No observations";
  
    const splitObs = doc.splitTextToSize(observationsText, 180);
    doc.text(splitObs, 14, y);
  
    y += splitObs.length * 6 + 10;
  
    // ---------------- BILLING ----------------
    autoTable(doc, {
      startY: y,
      head: [["Billing Summary", "Amount ($)"]],
      body: [["Total", parsedData.billing]],
      theme: "grid",
    });
  
    y = doc.lastAutoTable.finalY + 15;
  
    // ---------------- SIGNATURE ----------------
    doc.setFontSize(10);
    doc.text(`Doctor: ${doctorName}`, 14, y);
  
    y += 10;
    doc.line(14, y, 80, y);
    doc.text("Signature", 14, y + 5);
  
    // ---------------- MULTI-PAGE SUPPORT ----------------
    // autoTable already handles page breaks automatically
  
    // ---------------- SAVE ----------------
    doc.save(`Visit_${selectedVisit}_Report.pdf`);
  };

  const uniqueNotes = [...new Set(parsedData.notes || [])];

  return (
    <div className="app-container">
    <header className="header">
      <h1 className="title">Clinic Management System</h1>
    </header>
  
    {/* Controls */}
    <div className="top-panel card">
      <div className="form-group">
        <label>Patient</label>
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
      </div>
  
      <button className="btn primary" onClick={createVisit}>
        + New Visit
      </button>
  
      <div className="form-group">
        <label>Visit</label>
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
    </div>
  
    {/* Voice Input */}
    <div className="card">
      <VoiceInput onResult={(text) => setNoteText(text)} />
    </div>
  
    {/* Note Input */}
    <div className="note-box card">
      <label>Clinical Notes</label>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Enter symptoms, diagnosis, treatment plan..."
      />
      <button className="btn primary" onClick={saveNote}>
        Save Note
      </button>
    </div>
  
    {parsedData.notes.length > 0 && (
      <button className="btn secondary download-btn" onClick={downloadPDF}>
        Download Report
      </button>
    )}
  
    {status && <p className="status">{status}</p>}
  
    {/* Dashboard */}
    <div className="dashboard">
      <div className="card">
        <h2>Summary</h2>
        <p>{parsedData.summary || "No summary available"}</p>
      </div>
  
      <div className="card">
        <h2>Drugs</h2>
        {Array.isArray(parsedData.drugs) && parsedData.drugs.length > 0 ? (
          parsedData.drugs.map((d, i) => (
            <p key={i}>
              {d.name} ({d.dosage}) - ${d.price}
            </p>
          ))
        ) : (
          <p>No drugs prescribed</p>
        )}
      </div>
  
      <div className="card">
        <h2>Tests</h2>
        {Array.isArray(parsedData.tests) && parsedData.tests.length > 0 ? (
          parsedData.tests.map((t, i) => (
            <p key={i}>
              {t.test_name} - ${t.price}
            </p>
          ))
        ) : (
          <p>No tests ordered</p>
        )}
      </div>
  
      <div className="card">
        <h2>Observations</h2>
        {Array.isArray(parsedData.observations) &&
        parsedData.observations.length > 0 ? (
          parsedData.observations.map((o, i) => <p key={i}>• {o}</p>)
        ) : (
          <p>No observations recorded</p>
        )}
      </div>
  
      <div className="card wide">
        <h2>Notes Timeline</h2>
        {uniqueNotes.length > 0 ? (
          uniqueNotes.map((n, i) => (
            <div key={i} className="timeline-item">
              {n}
            </div>
          ))
        ) : (
          <p>No notes available</p>
        )}
      </div>
  
      <div className="card billing">
        <h2>Total Bill</h2>
        <p>${parsedData.billing || 0}</p>
      </div>
    </div>
  </div>
  );
}

export default App;
