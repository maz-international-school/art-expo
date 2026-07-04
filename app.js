let currentVoter = "";
let currentArt = null;
let allArtworks = []; 

const CAMPUSES = [
    { name: "Shah Alam", lat: 3.0681, lon: 101.4895 },
    { name: "PJ", lat: 3.1095, lon: 101.6265 }
];
const RADIUS_KM = 5.0; 

async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Database Sync Complete. Aura Active.");
    } catch (e) { setTimeout(loadArtData, 2000); }
}
loadArtData();

window.startVoting = async function() {
    const id = document.getElementById('voter-id').value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');
    if (id.length < 5) return alert("Please enter your email or phone number.");
    btn.innerText = "CHECKING SYSTEM..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is currently locked.");
            btn.innerText = "Vote Now"; btn.disabled = false; return;
        }

        if (settings.isGeofenceEnabled) {
            btn.innerText = "FINDING GPS...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const uLat = pos.coords.latitude; const uLon = pos.coords.longitude;
                    let isVerified = false;
                    CAMPUSES.forEach(c => { if(calculateDistance(c.lat, c.lon, uLat, uLon) <= RADIUS_KM) isVerified = true; });
                    if (!isVerified) {
                        alert("Access Denied: You must be within 5km of MAZ PJ or Shah Alam.");
                        btn.innerText = "Vote Now"; btn.disabled = false;
                    } else { finishSignIn(id); }
                },
                (err) => { alert("Location access required! Please click 'Allow'."); btn.innerText = "Vote Now"; btn.disabled = false; },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else { finishSignIn(id); }
    } catch (e) { alert("Error connecting to system."); btn.innerText = "Vote Now"; btn.disabled = false; }
};

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTING AS: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

window.showMenu = function() {
    document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden'));
    document.getElementById('step-menu').classList.remove('hidden');
    ['kindergarten', 'primary', 'secondary'].forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (localStorage.getItem(`voted_${cat}`)) {
            btn.innerText = cat.toUpperCase() + " (VOTED)";
            btn.classList.add('voted-btn');
        } else {
            btn.innerText = cat.toUpperCase();
            btn.classList.remove('voted-btn');
        }
    });
};

window.pickCategory = function(cat) {
    document.getElementById('step-menu').classList.add('hidden');
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = cat.toUpperCase();
    document.getElementById('search-input').value = "";
    setupSearch(cat);
};

function setupSearch(catId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase(); results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }
        const matches = allArtworks.filter(a => a.category === catId && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val))).slice(0, 6);
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                // SEARCH HIGHLIGHTING (Beautification)
                const regex = new RegExp(`(${val})`, 'gi');
                const highlightedName = m.artist.replace(regex, `<span class="highlight-red">$1</span>`);
                const highlightedCode = m.id.replace(regex, `<span class="highlight-code">$1</span>`);
                div.innerHTML = `${highlightedCode} <strong>${highlightedName}</strong><br><small style="margin-left:40px; opacity:0.6;">${m.title || 'Untitled'}</small>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

window.confirmVote = async function() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) { alert("Already voted!"); localStorage.setItem(`voted_${currentArt.category}`, "true"); window.showMenu(); return; }
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem; letter-spacing:2px; text-transform:uppercase;">Confirm Selection</p>
            <h3 style="margin:20px 0; font-size:2.2rem; font-family:'Archivo Black'; text-transform:uppercase; line-height:1.1;">${currentArt.title || 'UNTITLED'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin:0 auto 15px auto;"></div>
            <p style="font-weight:700; font-size:1.3rem; margin:0;">Artist: ${currentArt.artist}</p>
        </div>
        <p style="background:var(--yellow); font-weight:900; text-align:center; padding:15px; border-top:6px solid black; margin:0;">${currentArt.category.toUpperCase()}</p>`;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); btn.disabled = true; btn.innerText = "RECORDING...";
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        // CELEBRATION (Beautification)
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#e63946', '#1d3557', '#ffb703'] });
        document.getElementById('step-confirm').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) { alert("Error! Check connection."); btn.disabled = false; btn.innerText = "Confirm Selection"; }
};

window.cancelToSearch = function() { document.getElementById('step-confirm').classList.add('hidden'); document.getElementById('step-search').classList.remove('hidden'); };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
