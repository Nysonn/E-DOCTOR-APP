// Import necessary packages
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import axios from "axios";
import Twilio from "twilio";

// Load environment variables
dotenv.config();

const PORT = 3000;
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

// Middleware setup
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Twilio credentials
const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env;

// Twilio client initialization
const twilioClient = new Twilio(TWILIO_API_KEY, TWILIO_API_SECRET, {
  accountSid: TWILIO_ACCOUNT_SID,
});

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
app.get("/patient-dashboard", (req, res) => {
  res.render("patient-dashboard", { user: req.session.user });
});

// Doctor dashboard route
app.get("/medic-dashboard", (req, res) => {
  res.render("medic-dashboard", { user: req.session.user });
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
app.get("/make-a-call-patient", (req, res) => {
  res.render("make-a-call-patient");
});

app.post("/start-call", async (req, res) => {
  const { service } = req.body;

  try {
    const room = await twilioClient.video.rooms.create({
      uniqueName: service,
      type: "peer-to-peer",
    });

    res.json({ success: true, roomSid: room.sid });
  } catch (error) {
    console.error("Error creating video call room:", error);
    res.status(500).json({ success: false, message: "Error creating video room" });
  }
});

app.get("/get-token", (req, res) => {
  const { roomSid } = req.query;

  try {
    const token = new Twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET
    );
    token.identity = `user-${Math.random()}`;
    const videoGrant = new Twilio.jwt.AccessToken.VideoGrant({ room: roomSid });
    token.addGrant(videoGrant);

    res.json({ success: true, token: token.toJwt() });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ success: false, message: "Error generating token" });
  }
});

// Incoming Call page route (GET)
app.get("/incoming-call", (req, res) => {
  // Render the incoming call page (incoming-call.ejs)
  res.render("medic-dashboard", {
    patientName: "John Doe", // Placeholder, can be dynamic from session or DB
    serviceType: "General Consultation", // Placeholder, can be dynamic
  });
});

// Handle accept call (POST)
app.post("/accept-call", (req, res) => {
  const { patientName, serviceType } = req.body;

  // You can process the call acceptance here (e.g., initiate video call, notify patient)
  console.log(`Call accepted for ${patientName} for ${serviceType}`);

  // Redirect to call session or any other page
  res.redirect("/call-session");
});

// Handle decline call (POST)
app.post("/decline-call", (req, res) => {
  const { patientName } = req.body;

  // You can process the call decline here (e.g., log the decline, notify patient)
  console.log(`Call declined for ${patientName}`);

  // Optionally, redirect to another page or stay on the current page
  res.redirect("/medic-dashboard");
});


// Listen on PORT
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
