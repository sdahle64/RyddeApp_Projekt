// 1. Lagre hvilken bruker som er logget inn
function innlogging(event) {
    event.preventDefault(); // Hindrer at siden laster på nytt
    
    const brukernavn = document.getElementById('username').value;
    
    // Send brukernavnet til backend (server.js)
    fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: brukernavn })
    })
    .then(res => res.json())
    .then(data => {
        // Lagre brukernavnet lokalt i nettleseren slik at profilSide.html vet hvem du er
        localStorage.setItem('innloggetBruker', brukernavn);
        
        // Gå til profil/oversiktssiden
        window.location.href = 'profilSide.html';
    })
    .catch(err => console.error('Feil ved innlogging:', err));
}

// 2. Hente og vise poeng-oversikten (brukes f.eks. på oversikt.html)
function lasterInnOversikt() {
    fetch('http://localhost:3000/api/oversikt')
        .then(res => res.json())
        .then(data => {
            console.log('Poeng-oversikt fra databasen:', data);
            // Her kan du bruke 'data' til å oppdatere HTML-en din med tabeller/lister
        })
        .catch(err => console.error('Feil ved henting av oversikt:', err));
}