require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
// Railway automatically sets PORT environment variable
const port = process.env.PORT || 8080; 

// FIXED: More permissive CORS for Vercel
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow any Vercel domain or localhost
    const allowedOrigins = [
  /\.vercel\.app$/,
  /^https:\/\/f1management\.vercel\.app$/,
  /^https:\/\/f1-management\.vercel\.app$/,
  /^https:\/\/f1-management\.up\.railway\.app$/,
  /^http:\/\/localhost/,
  /^http:\/\/127\.0\.0\.1/
];
    
    if (allowedOrigins.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Still allow for now during debugging
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ 
    status: "Server is alive!",
    timestamp: new Date().toISOString(),
    port: port
  });
});

// FIXED: Database Connection using environment variables
const dbConfig = {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE || process.env.MYSQLNAME,
  port: process.env.MYSQLPORT || 3306,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log('🔧 Database config:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port
});

// Use createPool instead of createConnection for better reliability
const db = mysql.createPool(dbConfig);

// Test the connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error connecting to database:", err.message);
    return;
  }
  console.log("✅ Successfully connected to MySQL database!");
  connection.release();
});

// Health check endpoint - IMPROVED
app.get("/api/health", (req, res) => {
  db.query("SELECT 1 as result", (err, results) => {
    if (err) {
      console.error("Health check failed:", err.message);
      return res.status(500).json({ 
        status: "ERROR", 
        message: "Database connection failed",
        error: err.message 
      });
    }
    res.json({ 
      status: "OK", 
      message: "Backend and database are running",
      timestamp: new Date().toISOString(),
      database: dbConfig.database,
      port: port
    });
  });
});

// === API FOR VISUAL COMPONENTS ===

app.get('/api/race-winners', (req, res) => {
  const sql = `
    SELECT 
      r.Race_ID,
      r.Name AS race_name,
      r.Location,
      r.RaceDate,
      t.Team_ID,
      t.Name AS winning_team
    FROM Race r
    LEFT JOIN Team t 
      ON r.Winning_Team_ID = t.Team_ID
    ORDER BY r.RaceDate;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching race winners:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(results);
  });
});


// GET Driver Standings
app.get("/api/driver-standings", (req, res) => {
    const sql = `
        SELECT 
            d.Driver_ID, 
            d.FirstName, 
            d.LastName, 
            d.Nationality,
            d.DOB,
            d.Championships,
            d.CurrentPoints AS Points,
            d.DriverNumber AS Number,
            t.Name AS TeamName
        FROM Driver d
        LEFT JOIN Contract c ON d.Driver_ID = c.Driver_ID 
            AND (c.End_Date IS NULL OR c.End_Date >= CURDATE())
        LEFT JOIN Team t ON c.Team_ID = t.Team_ID
        ORDER BY d.CurrentPoints DESC, d.Championships DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching driver standings:", err.message);
            return res.status(500).json({ 
              error: "Database error fetching driver standings",
              details: err.message 
            });
        }
        console.log(`✅ Fetched ${results.length} driver standings`);
        res.json(results);
    });
});

// GET Team Standings
app.get("/api/team-standings", (req, res) => {
    const sql = `
        SELECT 
            t.Team_ID,
            t.Name,
            (SELECT Engine FROM Cars WHERE Cars.Team_ID = t.Team_ID LIMIT 1) AS Engine,
            COALESCE(SUM(d.CurrentPoints), 0) AS TotalPoints
        FROM Team t
        LEFT JOIN Contract con ON t.Team_ID = con.Team_ID 
            AND (con.End_Date IS NULL OR con.End_Date >= CURDATE())
        LEFT JOIN Driver d ON con.Driver_ID = d.Driver_ID
        GROUP BY t.Team_ID, t.Name
        ORDER BY TotalPoints DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching team standings:", err.message);
            return res.status(500).json({ 
              error: "Database error fetching team standings",
              details: err.message 
            });
        }
        console.log(`✅ Fetched ${results.length} team standings`);
        res.json(results);
    });
});

// GET Races
// GET Races (with winning team)
app.get("/api/races", (req, res) => {
    const sql = `
        SELECT 
            r.Race_ID, 
            r.Name, 
            r.Location, 
            r.RaceDate,
            r.Details,
            t.Name AS WinningTeam
        FROM Race r
        LEFT JOIN Team t 
          ON r.Winning_Team_ID = t.Team_ID
        ORDER BY r.RaceDate ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching races:", err.message);
            return res.status(500).json({ 
              error: "Database error fetching races",
              details: err.message 
            });
        }
        console.log(`✅ Fetched ${results.length} races (with winners)`);
        res.json(results);
    });
});

// === ADMIN PANEL API ===

// GET all drivers
app.get("/api/drivers", (req, res) => {
    const sql = `
        SELECT 
            d.Driver_ID,
            d.FirstName,
            d.LastName,
            d.Nationality,
            d.DOB,
            d.Championships,
            d.CurrentPoints,
            t.Name AS TeamName
        FROM Driver d
        LEFT JOIN Contract c ON d.Driver_ID = c.Driver_ID 
            AND (c.End_Date IS NULL OR c.End_Date >= CURDATE())
        LEFT JOIN Team t ON c.Team_ID = t.Team_ID
        ORDER BY d.Driver_ID
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching drivers:", err.message);
            return res.status(500).json({ 
              error: "Database error",
              details: err.message 
            });
        }
        console.log(`✅ Fetched ${results.length} drivers`);
        res.json(results);
    });
});

// ADD a new driver
app.post("/api/drivers", (req, res) => {
    const { FirstName, LastName, Nationality, DOB, Championships, CurrentPoints } = req.body;

    if (!FirstName || !LastName || !Nationality || !DOB) {
        return res.status(400).json({ error: "First name, last name, nationality, and DOB are required" });
    }

    const sql = `
        INSERT INTO Driver 
        (FirstName, LastName, Nationality, DOB, Championships, CurrentPoints) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        FirstName,
        LastName,
        Nationality,
        DOB,
        Championships || 0,
        CurrentPoints || 0
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error adding driver:", err.message);
            return res.status(500).json({ 
              error: "Database error",
              details: err.message 
            });
        }
        console.log(`✅ Added new driver: ${FirstName} ${LastName}`);
        res.status(201).json({ 
            Driver_ID: result.insertId, 
            FirstName, 
            LastName, 
            Nationality, 
            DOB, 
            Championships: Championships || 0,
            CurrentPoints: CurrentPoints || 0
        });
    });
});

// DELETE a driver
app.delete("/api/drivers/:id", (req, res) => {
    const { id } = req.params; 
    const sql = "DELETE FROM Driver WHERE Driver_ID = ?"; 

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Error deleting driver:", err.message);
            return res.status(500).json({ 
              error: "Database error",
              details: err.message 
            });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Driver not found" });
        }
        console.log(`✅ Deleted driver ID: ${id}`);
        res.status(200).json({ message: "Driver deleted successfully" });
    });
});

// UPDATE a driver
app.put("/api/drivers/:id", (req, res) => {
    const { id } = req.params;
    const { FirstName, LastName, Nationality, DOB, Championships, CurrentPoints } = req.body;

    if (!FirstName || !LastName || !Nationality || !DOB) {
        return res.status(400).json({ error: "All required fields must be provided" });
    }

    const sql = `
        UPDATE Driver 
        SET FirstName = ?, LastName = ?, Nationality = ?, DOB = ?, 
            Championships = ?, CurrentPoints = ? 
        WHERE Driver_ID = ?
    `;
    
    const values = [
        FirstName,
        LastName,
        Nationality,
        DOB,
        Championships || 0,
        CurrentPoints || 0,
        id
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error updating driver:", err.message);
            return res.status(500).json({ 
              error: "Database error",
              details: err.message 
            });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Driver not found" });
        }
        console.log(`✅ Updated driver ID: ${id}`);
        res.status(200).json({ 
            Driver_ID: id, 
            FirstName, 
            LastName, 
            Nationality, 
            DOB, 
            Championships: Championships || 0,
            CurrentPoints: CurrentPoints || 0
        });
    });
});



// Catch-all 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: "Not Found", 
        message: `Route ${req.method} ${req.url} not found`,
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'GET /api/driver-standings',
            'GET /api/team-standings', 
            'GET /api/races',
            'GET /api/drivers',
            'POST /api/drivers',
            'PUT /api/drivers/:id',
            'DELETE /api/drivers/:id'
        ]
    });
});

// Start the Server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend server running on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check available at /api/health`);
    console.log(`🗄️  Database: ${dbConfig.database}@${dbConfig.host}`);
});
