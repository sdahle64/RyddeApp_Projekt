const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server statiske filer (HTML, CSS) fra mappen din
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../')));

// Koble til SQLite-database
const db = new sqlite3.Database('./ryddeapp.db', (err) => {
    if (err) console.error(err.message);
    console.log('Tilkoblet ryddeapp.db');
});

// Opprett tabeller om de ikke finnes
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

// 1. ENDEPUNKT FOR INNLOGGING (Ny!)
app.post('/api/login', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send('Brukernavn påkrevd');
    }

    // Sett inn brukeren hvis den ikke finnes fra før
    const sql = `INSERT OR IGNORE INTO brukere (brukernavn) VALUES (?)`;
    db.run(sql, [username], function(err) {
        if (err) return res.status(500).send(err.message);

        // Send brukeren videre til profil/oversiktssiden etter innlogging
        res.redirect('/frontend/profilSide.html');
    });
});

// 2. Endepunkt for å legge til ny oppgave
app.post('/api/oppgaver', (req, res) => {
    const { tittel, poeng, beskrivelse } = req.body;
    const sql = `INSERT INTO oppgaver (tittel, poeng, beskrivelse) VALUES (?, ?, ?)`;
    
    db.run(sql, [tittel, poeng, beskrivelse], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Oppgave lagret!' });
    });
});

// 3. Endepunkt for poeng-oversikt
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
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// Start server
app.listen(3000, () => {
    console.log('Server kjører på http://localhost:3000');
});