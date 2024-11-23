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
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// GET ROUTE LANDING PAGE
app.get("/landing-page", (req, res) => {
  res.render("landing");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
