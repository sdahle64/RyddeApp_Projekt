// ==========================================
// 1. INNLOGGING (index.html)
// ==========================================
function innlogging(event) {
    event.preventDefault();
    const brukernavn = document.getElementById('username').value;
    const passord = document.getElementById('password').value;

    fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: brukernavn, password: passord })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('innloggetBruker', data.brukernavn);
            localStorage.setItem('brukerId', data.id);
            window.location.href = 'profilSide.html';
        } else {
            alert(data.error || 'Feil brukernavn eller passord!');
        }
    })
    .catch(err => console.error('Feil ved innlogging:', err));
}

// ==========================================
// 2. OPPRETT NY OPPGAVE (lagOppgaver.html)
// ==========================================
const oppgaveForm = document.getElementById('oppgaveForm');
if (oppgaveForm) {
    oppgaveForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const data = {
            tittel: document.getElementById('oppgave').value,
            poeng: Number(document.getElementById('poeng').value),
            beskrivelse: document.getElementById('beskrivelse').value
        };

        const response = await fetch('http://localhost:3000/api/oppgaver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Oppgaven er lagret i databasen!');
            this.reset();
        }
    });
}

// ==========================================
// 3. REGISTRER GJORT OPPGAVE (gjortOppgave.html)
// ==========================================
const gjortForm = document.getElementById('gjortForm');
let alleOppgaver = [];

async function lastOppgaverTilDropdown() {
    const dropdown = document.getElementById('oppgaveVelger');
    if (!dropdown) return;

    try {
        const response = await fetch('http://localhost:3000/api/oppgaver');
        alleOppgaver = await response.json();

        dropdown.innerHTML = '';

        if (alleOppgaver.length === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.text = 'Ingen oppgaver tilgjengelig';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            dropdown.appendChild(defaultOption);
            document.getElementById('oppgaveBeskrivelse').innerText = '';
            return;
        }

        const startOption = document.createElement('option');
        startOption.text = '-- Velg en oppgave --';
        startOption.value = '';
        dropdown.appendChild(startOption);

        alleOppgaver.forEach(oppgave => {
            const option = document.createElement('option');
            option.value = oppgave.id;
            option.text = `${oppgave.tittel} (${oppgave.poeng} p)`;
            dropdown.appendChild(option);
        });
    } catch (err) {
        console.error('Feil ved henting av oppgaver:', err);
    }
}

function visBeskrivelse() {
    const dropdown = document.getElementById('oppgaveVelger');
    const beskrivelseFelt = document.getElementById('oppgaveBeskrivelse');
    if (!dropdown || !beskrivelseFelt) return;

    const valgtId = Number(dropdown.value);
    if (!valgtId) {
        beskrivelseFelt.innerText = '';
        return;
    }

    const valgtOppgave = alleOppgaver.find(o => o.id === valgtId);
    beskrivelseFelt.innerText = (valgtOppgave && valgtOppgave.beskrivelse)
        ? `Beskrivelse: "${valgtOppgave.beskrivelse}"`
        : '';
}

if (gjortForm) {
    lastOppgaverTilDropdown();

    gjortForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const dropdown = document.getElementById('oppgaveVelger');
        const oppgaveId = Number(dropdown.value);
        const brukerId = localStorage.getItem('brukerId');

        if (!oppgaveId) {
            alert("Vennligst velg en oppgave først!");
            return;
        }

        if (!brukerId) {
            alert("Du må logge inn først!");
            window.location.href = 'index.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/utforte-oppgaver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bruker_id: Number(brukerId),
                    oppgave_id: oppgaveId
                })
            });

            if (response.ok) {
                const utfortOppgave = alleOppgaver.find(o => o.id === oppgaveId);
                alert(`Fantastisk! Du fullførte "${utfortOppgave.tittel}" og fikk ${utfortOppgave.poeng} poeng! ⭐`);
                document.getElementById('oppgaveBeskrivelse').innerText = '';
                dropdown.value = '';
            } else {
                alert("Noe gikk galt ved lagring av poeng.");
            }
        } catch (err) {
            console.error('Feil ved registrering:', err);
        }
    });
}

// ==========================================
// 4. POENG-OVERSIKT (oversikt.html)
// ==========================================
async function lastOversikt() {
    const tbody = document.querySelector('.tabell-container table tbody');
    if (!tbody) return;

    const response = await fetch('http://localhost:3000/api/oversikt');
    const brukere = await response.json();

    tbody.innerHTML = '';

    brukere.forEach(bruker => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${bruker.brukernavn}</td>
            <td>${bruker.totale_poeng} p</td>
        `;
        tbody.appendChild(tr);
    });
}

lastOversikt();