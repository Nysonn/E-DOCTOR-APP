import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import axios from "axios";
import Twilio from "twilio";
import { WebSocketServer } from 'ws';
import http from 'http';
import pdf from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

const PORT = 3000;
// const IP  = '192.168.137.1';
const app = express();

// PostgreSQL Database connection
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();

// Cookie-based session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Middleware for authenticated routes
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/sign-in");
  }
}

// Middleware setup
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Landing page route
app.get("/landing-page", (req, res) => {
  res.render("landing");
});

// Sign-in page route
app.get("/sign-in", (req, res) => {
  res.render("sign-in");
});

// Sign-in process
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const query = `SELECT id, full_name, role, password_hash FROM users WHERE email = $1`;
    const values = [email];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(401).send("Invalid email or password.");
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).send("Invalid email or password.");
    }

    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
    };

    if (user.role.toLowerCase() === "patient") {
      res.redirect("/patient-dashboard");
    } else if (user.role.toLowerCase() === "doctor") {
      res.redirect("/medic-dashboard");
    } else {
      res.status(403).send("Unauthorized role.");
    }
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(500).send("An error occurred while signing in.");
  }
});

// Patient dashboard route
app.get("/patient-dashboard", requireAuth, (req, res) => {
  res.render("patient-dashboard", { user: req.session.user });
});

// Render doctor's dashboard
app.get("/medic-dashboard", requireAuth, (req, res) => {
  const roomName = req.session.roomName || null;
  res.render("medic-dashboard", { 
    roomName,
    user: req.session.user  // Add the user object from the session
  });
});

// Create patient account route
app.get("/create-account-patient", (req, res) => {
  res.render("create-patient-account");
});

// Patient signup process
app.post("/signup-patient", async (req, res) => {
  const { full_name, residence, age, role, email, phone, password } = req.body;

  try {
    if (role.toLowerCase() !== "patient") {
      return res.status(400).send("Role must be 'Patient'.");
    }

    const emailCheckQuery = `SELECT id FROM users WHERE email = $1`;
    const emailCheckResult = await db.query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(409).send("Email already registered.");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO users (full_name, residence, age, role, email, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const values = [full_name, residence, age, role, email, phone, hashedPassword];
    const result = await db.query(insertQuery, values);

    req.session.user = {
      id: result.rows[0].id,
      full_name,
      role,
    };

    res.redirect("/signin");
  } catch (error) {
    console.error("Error during patient signup:", error);
    res.status(500).send("An error occurred while creating the account.");
  }
});

// Create doctor account route
app.get("/create-account-doctor", (req, res) => {
  res.render("create-doctor-account");
});

// Doctor signup process
app.post("/signup-doctor", async (req, res) => {
  const { full_name, specialisation, role, email, phone, password } = req.body;

  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const query = `
      INSERT INTO users (full_name, specialisation, role, email, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;
    const values = [full_name, specialisation, role, email, phone, password_hash];
    const result = await db.query(query, values);

    console.log(`Doctor account created with ID: ${result.rows[0].id}`);
    res.redirect("/sign-in");
  } catch (error) {
    console.error("Error during doctor signup:", error);
    res.status(500).send("An error occurred while signing up.");
  }
});

// Video call setup
app.get("/make-a-call-patient", requireAuth, (req, res) => {
  res.render("make-a-call-patient", {
    user: req.session.user
  });
});

// Video call setup - create a unique room name and send it to the frontend
app.post("/start-call", (req, res) => {
  try {
    const roomName = `ConsultationRoom-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    req.session.roomName = roomName; // Save the room name in the session
    res.json({ success: true, roomName });
  } catch (error) {
    console.error("Error generating room name:", error);
    res.status(500).json({ success: false, message: "Failed to generate room name." });
  }
});

// Incoming Call page route (GET)
app.get("/incoming-call", (req, res) => {
  // Render the incoming call page (incoming-call.ejs)
  res.render("medic-dashboard");
});

app.post("/accept-call", (req, res) => {
  if (req.session.roomName) {
    res.json({ success: true, roomName: req.session.roomName });
  } else {
    res.status(400).json({ success: false, message: "No active room available." });
  }
});

app.post("/decline-call", (req, res) => {
  try {
    req.session.roomName = null; // Clear room from the session
    res.json({ success: true, message: "Call declined successfully." });
  } catch (error) {
    console.error("Error during call decline:", error);
    res.status(500).json({ success: false, message: "Failed to decline call." });
  }
});

// Add this route to fetch available doctors
app.get('/available-doctors', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT id, full_name, specialisation 
      FROM users 
      WHERE role = 'Doctor'
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Add this right after your imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Update your /save-report route
app.post('/save-report', async (req, res) => {
  const { patientName, symptoms, diagnosis, prescribedMedication, additionalNotes, userId } = req.body;

  try {
    // Generate PDF
    const doc = new pdf();
    const fileName = `report_${Date.now()}.pdf`;
    const reportsDir = path.join(__dirname, 'reports');
    const filePath = path.join(reportsDir, fileName);

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Create write stream
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(18).text('Patient Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Patient Name: ${patientName}`);
    doc.moveDown(0.5);
    doc.text(`Symptoms: ${symptoms}`);
    doc.moveDown(0.5);
    doc.text(`Diagnosis: ${diagnosis}`);
    doc.moveDown(0.5);
    doc.text(`Prescribed Medication: ${prescribedMedication}`);
    doc.moveDown(0.5);
    doc.text(`Additional Notes: ${additionalNotes}`);
    doc.moveDown(0.5);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);

    // Handle PDF completion
    writeStream.on('finish', async () => {
      try {
        // Save file path in the database
        const query = `INSERT INTO patient_reports (user_id, file_path) VALUES ($1, $2) RETURNING id`;
        const values = [userId, filePath];
        await db.query(query, values);
        res.status(200).json({ success: true, message: 'Report saved successfully.' });
      } catch (dbError) {
        console.error('Database error:', dbError);
        res.status(500).json({ success: false, message: 'Failed to save report to database.' });
      }
    });

    // Handle PDF errors
    writeStream.on('error', (writeError) => {
      console.error('Error writing PDF:', writeError);
      res.status(500).json({ success: false, message: 'Failed to generate PDF report.' });
    });

    // End the PDF document
    doc.end();

  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ success: false, message: 'Failed to save the report.' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Store active calls and connections
const activeConnections = new Map();
const activeCalls = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log('Received WebSocket message:', data);
    
    switch (data.type) {
      case 'register':
        console.log('Registering user:', data.userId);
        activeConnections.set(data.userId, ws);
        break;
        
      case 'start-call':
        console.log('Starting call:', data);
        const roomName = `ConsultationRoom-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
        activeCalls.set(data.patientId, {
          roomName,
          doctorId: data.doctorId,
          fullName: data.fullName
        });
        
        const doctorWs = activeConnections.get(data.doctorId);
        if (doctorWs) {
          console.log('Notifying doctor of incoming call');
          doctorWs.send(JSON.stringify({
            type: 'incoming-call',
            roomName,
            patientId: data.patientId,
            fullName: data.fullName
          }));
        } else {
          console.log('Doctor not connected:', data.doctorId);
        }
        break;
        
      case 'accept-call':
        const callDetails = activeCalls.get(data.patientId);
        if (callDetails) {
          const patientWs = activeConnections.get(data.patientId);
          if (patientWs) {
            patientWs.send(JSON.stringify({
              type: 'call-accepted',
              roomName: callDetails.roomName
            }));
          }
        }
        break;
    }
  });
});

// Update the listen call to use the HTTP server
server.listen(PORT,() => {
  console.log(`Server running on http://localhost:${PORT}`);
});
