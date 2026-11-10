const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Tillater at HTML-sidene dine kan koble seg på

// Koble til SQLite-databasefilen
const db = new sqlite3.Database('./database.db');

// Opprett tabeller
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brukernavn TEXT UNIQUE NOT NULL,
        passord TEXT NOT NULL,
        totale_poeng INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tittel TEXT NOT NULL,
        beskrivelse TEXT,
        poeng INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS completed_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task_tittel TEXT,
        poeng_oppnaadd INTEGER,
        dato_utfoert DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// --- API ROUTES ---

// 1. Registrer / Logg inn bruker
app.post('/api/login', (req, res) => {
    const { brukernavn, passord } = req.body;
    db.get('SELECT * FROM users WHERE brukernavn = ?', [brukernavn], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user) {
            // Finnes ikke brukeren? Opprett den automatisk
            db.run('INSERT INTO users (brukernavn, passord) VALUES (?, ?)', [brukernavn, passord], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, brukernavn, totale_poeng: 0 });
            });
        } else {
            // Sjekk passord
            if (user.passord === passord) {
                res.json(user);
            } else {
                res.status(401).json({ error: 'Feil passord' });
            }
        }
    });
});

// 2. Hent ufullførte oppgaver
app.get('/api/oppgaver', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Legg til ny oppgave
app.post('/api/oppgaver', (req, res) => {
    const { tittel, poeng, beskrivelse } = req.body;
    db.run('INSERT INTO tasks (tittel, poeng, beskrivelse) VALUES (?, ?, ?)', [tittel, poeng, beskrivelse], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// 4. Registrer utført oppgave
app.post('/api/fullfoer', (req, res) => {
    const { userId, taskId, tittel, poeng } = req.body;

    // Oppdater brukerens poeng og slett oppgaven fra oppgavelisten
    db.serialize(() => {
        db.run('UPDATE users SET totale_poeng = totale_poeng + ? WHERE id = ?', [poeng, userId]);
        db.run('INSERT INTO completed_tasks (user_id, task_tittel, poeng_oppnaadd) VALUES (?, ?, ?)', [userId, tittel, poeng]);
        db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
    });

    res.json({ status: 'Suksess' });
});

// 5. Hent poengoversikt for familien
app.get('/api/oversikt', (req, res) => {
    db.all('SELECT brukernavn, totale_poeng FROM users ORDER BY totale_poeng DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(3000, () => console.log('Server kjører på http://localhost:3000'));