import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pg from "pg"; 
import bcrypt from "bcrypt";
import session from 'express-session';

dotenv.config();

const PORT = 3000;
const app = express();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Connect to the PostgreSQL database
db.connect();

//COOKIE SESSION
app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000 // 1 day 
  }
}));

// Set EJS as the view engine
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// GET ROUTE LANDING PAGE
app.get("/landing-page", (req, res) => {
  res.render("landing");
});

// GET ROUTE SIGN IN PAGE
app.get("/sign-in", (req, res) => {
  res.render("sign-in");
});

// POST ROUTE FOR SIGN IN
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Query the database for the user with the provided email
    const query = `SELECT id, full_name, role, password_hash FROM users WHERE email = $1`;
    const values = [email];
    const result = await db.query(query, values);

    // Check if a user exists with the given email
    if (result.rows.length === 0) {
      return res.status(401).send("Invalid email or password.");
    }

    const user = result.rows[0];

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid email or password.");
    }

    // Save user data to the session
    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
    };

    // Redirect based on the user's role
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

// GET ROUTE FOR PATIENT DASHBOARD
app.get("/patient-dashboard", (req, res) => {
  res.render("patient-dashboard", { user: req.session.user });
});

// GET ROUTE FOR DOCTOR DASHBOARD
app.get("/medic-dashboard", (req, res) => {
  res.render("medic-dashboard", { user: req.session.user });
});

// GET ROUTE CREATE PATIENT ACCOUNT PAGE
app.get("/create-account-patient", (req, res) => {
  res.render("create-patient-account");
});

// POST ROUTE FOR CREATE PATIENT ACCOUNT
app.post("/signup-patient", async (req, res) => {
  const { full_name, residence, age, role, email, phone, password } = req.body;

  try {
    // Validate the role to ensure it's either "Patient" or another acceptable value
    if (role.toLowerCase() !== "patient") {
      return res.status(400).send("Role must be 'Patient'.");
    }

    // Check if the email already exists in the database
    const emailCheckQuery = `SELECT id FROM users WHERE email = $1`;
    const emailCheckResult = await db.query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(409).send("Email already registered.");
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the new patient into the database
    const insertQuery = `
      INSERT INTO users (full_name, residence, age, role, email, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const values = [full_name, residence, age, role, email, phone, hashedPassword];
    const result = await db.query(insertQuery, values);

    // Retrieve the new user's ID from the result
    const newUserId = result.rows[0].id;

    // Store the user data in the session
    req.session.user = {
      id: newUserId,
      full_name,
      role,
    };

    // Redirect to the patient dashboard
    res.redirect("/sigin");
  } catch (error) {
    console.error("Error during patient signup:", error);
    res.status(500).send("An error occurred while creating the account.");
  }
});

// GET ROUTE CREATE DOCTOR ACCOUNT PAGE
app.get("/create-account-doctor", (req, res) => {
  res.render("create-doctor-account");
});

// POST ROUTE FOR CREATE DOCTOR ACCOUNT
app.post("/signup-doctor", async (req, res) => {
  const { full_name, specialisation, role, email, phone, password } = req.body;

  try {
    // Hash the password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert into the database
    const query = `
      INSERT INTO users (full_name, specialisation, role, email, phone, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;
    const values = [full_name, specialisation, role, email, phone, password_hash];

    const result = await db.query(query, values);
    console.log(`Doctor account created with ID: ${result.rows[0].id}`);

    // Redirect to the sign-in page after successful registration
    res.redirect("/sign-in");
  } catch (error) {
    console.error("Error during doctor signup:", error);
    res.status(500).send("An error occurred while signing up.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
