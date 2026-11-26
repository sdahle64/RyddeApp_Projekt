const erPaInnlogging = document.getElementById('loginForm');
if (!erPaInnlogging && !localStorage.getItem('brukerId')) {
    window.location.href = 'index.html';
}
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Koble til SQLite-databasen (ryddeapp.db ligger i samme mappe som server.js)
const dbPath = path.join(__dirname, 'ryddeapp.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Feil ved tilkobling til databasen:', err.message);
    } else {
        console.log('Koblet til SQLite-databasen ryddeapp.db');
        // Aktiverer støtte for Foreign Keys i SQLite
        db.run('PRAGMA foreign_keys = ON');
    }
});

// ==========================================
// 1. INNLOGGING (POST /api/login)
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Fyll inn brukernavn og passord.' });
    }

    db.get('SELECT * FROM brukere WHERE brukernavn = ?', [username], async (err, bruker) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Databasefeil.' });
        }
        if (!bruker) {
            return res.status(401).json({ success: false, error: 'Feil brukernavn eller passord.' });
        }

        try {
            // Sjekker først om passordet i databasen er hashet med bcrypt (starter med $2)
            let riktigPassord = false;
            if (bruker.passord && bruker.passord.startsWith('$2')) {
                riktigPassord = await bcrypt.compare(password, bruker.passord);
            } else {
                // Fallback hvis du har lagret passord i klartekst under testing
                riktigPassord = (password === bruker.passord);
            }

            if (riktigPassord) {
                res.json({
                    success: true,
                    id: bruker.id,
                    brukernavn: bruker.brukernavn
                });
            } else {
                res.status(401).json({ success: false, error: 'Feil brukernavn eller passord.' });
            }
        } catch (error) {
            console.error('Feil ved passordsjekk:', error);
            res.status(500).json({ success: false, error: 'Serverfeil ved innlogging.' });
        }
    });
});

// ==========================================
// 2. HENT ALLE OPPGAVER (GET /api/oppgaver)
// ==========================================
app.get('/api/oppgaver', (req, res) => {
    db.all('SELECT id, tittel, poeng, beskrivelse FROM oppgaver', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ==========================================
// 3. OPPRETT NY OPPGAVE (POST /api/oppgaver)
// ==========================================
app.post('/api/oppgaver', (req, res) => {
    const { tittel, poeng, beskrivelse } = req.body;

    if (!tittel || !poeng) {
        return res.status(400).json({ error: 'Tittel og poeng er påkrevd.' });
    }

    const sql = 'INSERT INTO oppgaver (tittel, poeng, beskrivelse) VALUES (?, ?, ?)';
    db.run(sql, [tittel, poeng, beskrivelse || ''], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            id: this.lastID,
            tittel,
            poeng,
            beskrivelse
        });
    });
});

// ==========================================
// 4. REGISTRER GJORT OPPGAVE (POST /api/utforte-oppgaver)
// ==========================================
app.post('/api/utforte-oppgaver', (req, res) => {
    const { bruker_id, oppgave_id } = req.body;

    if (!bruker_id || !oppgave_id) {
        return res.status(400).json({ error: 'Mangler bruker_id eller oppgave_id.' });
    }

    // registrert_dato settes automatisk av databasen (Default value)
    const sql = 'INSERT INTO utforte_oppgaver (bruker_id, oppgave_id) VALUES (?, ?)';
    db.run(sql, [bruker_id, oppgave_id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            success: true,
            id: this.lastID
        });
    });
});

// ==========================================
// 5. POENG-OVERSIKT SISTE 7 DAGER (GET /api/oversikt)
// ==========================================
app.get('/api/oversikt', (req, res) => {
    const sql = `
        SELECT 
            brukere.brukernavn, 
            COALESCE(SUM(oppgaver.poeng), 0) AS totale_poeng
        FROM brukere
        LEFT JOIN utforte_oppgaver 
            ON brukere.id = utforte_oppgaver.bruker_id 
            AND utforte_oppgaver.registrert_dato >= datetime('now', '-7 days', 'localtime')
        LEFT JOIN oppgaver 
            ON utforte_oppgaver.oppgave_id = oppgaver.id
        GROUP BY brukere.id, brukere.brukernavn
        ORDER BY totale_poeng DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ==========================================
// 6. MIN PROFIL & MINE OPPGAVER (profilSide.html)
// ==========================================
async function lastMineOppgaver() {
    const tabellBody = document.getElementById('mineOppgaverListe');
    if (!tabellBody) return; // Kjører bare hvis vi er på profilSide.html

    const brukerId = localStorage.getItem('brukerId');
    const brukernavn = localStorage.getItem('innloggetBruker');

    if (!brukerId) {
        window.location.href = 'index.html';
        return;
    }

    // Oppdaterer overskriften med navnet ditt
    const tittel = document.getElementById('profilTittel');
    if (tittel && brukernavn) {
        tittel.innerText = `Profilen til ${brukernavn} 🦋`;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/mine-oppgaver/${brukerId}`);
        const mineOppgaver = await response.json();

        tabellBody.innerHTML = '';
        let totalPoeng = 0;

        if (mineOppgaver.length === 0) {
            tabellBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: #777;">Du har ikke registrert noen oppgaver enda!</td>
                </tr>
            `;
            return;
        }

        mineOppgaver.forEach(oppgave => {
            totalPoeng += oppgave.poeng;

            // Kutter bort klokkeslettet hvis registrert_dato er "2026-11-26 13:24:00"
            const penDato = oppgave.registrert_dato ? oppgave.registrert_dato.split(' ')[0] : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${oppgave.tittel}</td>
                <td><strong>${oppgave.poeng} p</strong></td>
                <td>${penDato}</td>
            `;
            tabellBody.appendChild(tr);
        });

        // Oppdaterer totalsummen øverst på profilen
        const poengElement = document.getElementById('mineTotalePoeng');
        if (poengElement) {
            poengElement.innerText = `${totalPoeng} poeng`;
        }

    } catch (err) {
        console.error('Feil ved henting av mine oppgaver:', err);
    }
}

// ==========================================
// LOGG UT
// ==========================================
function loggUt() {
    localStorage.removeItem('innloggetBruker');
    localStorage.removeItem('brukerId');
    window.location.href = 'index.html';
}

lastMineOppgaver();

// Start serveren
app.listen(PORT, () => {
    console.log(`Serveren kjører på http://localhost:${PORT}`);
});