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

    // Fjernet NOT NULL på passord slik at enkel innlogging med bare brukernavn fungerer uten feil
    db.run(`CREATE TABLE IF NOT EXISTS brukere (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brukernavn TEXT UNIQUE NOT NULL,
        passord TEXT
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

// 1. Innlogging (Sjekker passord hvis brukeren finnes, eller oppretter ny bruker)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Brukernavn og passord er påkrevd' });
    }

    db.get(`SELECT id, brukernavn, passord FROM brukere WHERE brukernavn = ?`, [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Hvis brukeren allerede finnes: sjekk at passordet stemmer
        if (row) {
            if (row.passord === password) {
                return res.json({ success: true, id: row.id, brukernavn: row.brukernavn });
            } else {
                return res.status(401).json({ error: 'Feil passord!' });
            }
        }

        // Hvis brukeren ikke finnes fra før: opprett ny bruker i databasen
        db.run(`INSERT INTO brukere (brukernavn, passord) VALUES (?, ?)`, [username, password], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID, brukernavn: username });
        });
    });
});

// 2. Legge til ny oppgave (fra lagOppgaver.html)
app.post('/api/oppgaver', (req, res) => {
    const { tittel, poeng, beskrivelse } = req.body;
    console.log('Mottatt oppgave:', tittel, poeng, beskrivelse);
    const sql = `INSERT INTO oppgaver (tittel, poeng, beskrivelse) VALUES (?, ?, ?)`;
    
    db.run(sql, [tittel, poeng, beskrivelse], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Oppgave lagret!' });
    });
});

// 3. Hente alle oppgaver (for visning og registrering av utførte oppgaver)
app.get('/api/oppgaver', (req, res) => {
    const sql = `SELECT * FROM oppgaver`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 4. Registrere utførte oppgaver (uten norsk ø i URL-en)
app.post('/api/utforte-oppgaver', (req, res) => {
    const { bruker_id, oppgave_id } = req.body;
    const sql = `INSERT INTO utforte_oppgaver (bruker_id, oppgave_id) VALUES (?, ?)`;

    db.run(sql, [bruker_id, oppgave_id], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Utført oppgave registrert!' });
    });
});

// 5. Poeng-oversikt (fra oversikt.html)
app.get('/api/oversikt', (req, res) => {
    const sql = `
        SELECT b.brukernavn, COALESCE(SUM(o.poeng), 0) AS totale_poeng
        FROM brukere b
        LEFT JOIN utforte_oppgaver uo ON b.id = uo.bruker_id
        LEFT JOIN oppgaver o ON uo.oppgave_id = o.id
        GROUP BY b.id, b.brukernavn
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