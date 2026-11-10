const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware for parsing og CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serverer statiske filer fra frontend-mappen
app.use(express.static(path.join(__dirname, '../frontend')));

// Send brukeren rett til index.html når man går til http://localhost:3000/
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ----------------------------------------------------
// DATABASETILKOBLING OG TABELLER
// ----------------------------------------------------
// Oppretter og kobler til ryddeapp.db i backend-mappen
const db = new sqlite3.Database(path.join(__dirname, 'ryddeapp.db'), (err) => {
    if (err) {
        console.error('Feil ved tilkobling til database:', err.message);
    } else {
        console.log('Tilkoblet ryddeapp.db');
    }
});

// Opprett tabeller automatisk hvis de ikke finnes
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS oppgaver (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tittel TEXT NOT NULL,
        poeng INTEGER NOT NULL,
        beskrivelse TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS brukere (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brukernavn TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS utforte_oppgaver (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bruker_id INTEGER,
        oppgave_id INTEGER,
        FOREIGN KEY(bruker_id) REFERENCES brukere(id),
        FOREIGN KEY(oppgave_id) REFERENCES oppgaver(id)
    )`);
});

// ----------------------------------------------------
// API-ENDEPUNKTER
// ----------------------------------------------------

// 1. Innlogging (Legger til bruker hvis den ikke finnes)
app.post('/api/login', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Brukernavn er påkrevd' });
    }

    const sql = `INSERT OR IGNORE INTO brukere (brukernavn) VALUES (?)`;
    db.run(sql, [username], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, brukernavn: username });
    });
});

// 2. Legge til ny oppgave (fra lagOppgaver.html)
app.post('/api/oppgaver', (req, res) => {
    const { tittel, poeng, beskrivelse } = req.body;
    const sql = `INSERT INTO oppgaver (tittel, poeng, beskrivelse) VALUES (?, ?, ?)`;
    
    db.run(sql, [tittel, poeng, beskrivelse], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Oppgave lagret!' });
    });
});

// 3. Poeng-oversikt (fra oversikt.html)
app.get('/api/oversikt', (req, res) => {
    const sql = `
        SELECT b.brukernavn, COALESCE(SUM(o.poeng), 0) AS totale_poeng
        FROM brukere b
        LEFT JOIN utforte_oppgaver uo ON b.id = uo.bruker_id
        LEFT JOIN oppgaver o ON uo.oppgave_id = o.id
        GROUP BY b.id
        ORDER BY totale_poeng DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server kjører på http://localhost:${PORT}`);
});