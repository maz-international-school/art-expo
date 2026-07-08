let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; // e.g., 'secondary'
let currentYear = "";     // e.g., 'Y7'

const CAMPUSES = [{ lat: 3.0681, lon: 101.4895 }, { lat: 3.1095, lon: 101.6265 }];
const RADIUS_KM = 5.0; 

const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { setTimeout(loadArtData, 2000); }
}
loadArtData();

window.startVoting = async function() {
    const id = document.getElementById('voter-id').value.trim().toLowerCase();
    if (id.length < 5) return alert("Enter email or phone!");
    const btn = document.querySelector('#step-id button');
    btn.innerText = "CHECKING..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };
        if (!settings.isOpen) { alert("VOTING CLOSED."); resetBtn(btn); return; }

        if (settings.isGeofenceEnabled) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    let verified = false;
                    CAMPUSES.forEach(c => { if(calculateDistance(c.lat, c.lon, pos.coords.latitude, pos.coords.longitude) <= RADIUS_KM) verified = true; });
                    if (!verified) { alert("On-site only!"); resetBtn(btn); } 
                    else { finishSignIn(id); }
                },
                () => { alert("Location access required!"); resetBtn(btn); },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else { finishSignIn(id); }
    } catch (e) { alert("Error."); resetBtn(btn); }
};

function resetBtn(btn) { btn.innerText = "Vote Now"; btn.disabled = false; }

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTING AS: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

window.showMenu = function() {
    hideAllSteps();
    document.getElementById('step-menu').classList.remove('hidden');
};

window.showSubMenu = function(cat) {
    currentCategory = cat;
    hideAllSteps();
    document.getElementById('step-submenu').classList.remove('hidden');
    document.getElementById('submenu-title').innerText = cat.toUpperCase();
    
    const container = document.getElementById('year-buttons-container');
    container.innerHTML = "";
    
    YEAR_MAP[cat].forEach(year => {
        const btn = document.createElement('button');
        const hasVoted = localStorage.getItem(`voted_${year}`);
        btn.innerText = year + (hasVoted ? " (DONE)" : "");
        btn.style.background = hasVoted ? "#ccc" : "var(--black)";
        if (hasVoted) btn.style.pointerEvents = "none";
        
        btn.onclick = () => window.pickYear(year);
        container.appendChild(btn);
    });
};

window.pickYear = function(year) {
    currentYear = year;
    hideAllSteps();
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = "SEARCH " + year;
    document.getElementById('search-input').value = "";
    setupSearch(year);
};

function setupSearch(yearId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase(); results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }
        // FILTER BY YEAR Group
        const matches = allArtworks.filter(a => a.year === yearId && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val))).slice(0, 6);
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                div.innerHTML = `[${m.id}] <strong>${m.artist}</strong>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

window.confirmVote = async function() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { alert("Already voted for " + currentYear); localStorage.setItem(`voted_${currentYear}`, "true"); window.showSubMenu(currentCategory); return; }
    
    hideAllSteps();
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem;">CONFIRM FOR ${currentYear}</p>
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase;">${currentArt.title || 'UNTITLED'}</h3>
            <p style="font-weight:700;">Artist: ${currentArt.artist}</p>
        </div>`;
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); btn.disabled = true;
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentYear}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        localStorage.setItem(`voted_${currentYear}`, "true");
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        document.getElementById('success-year').innerText = currentYear;
        hideAllSteps();
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) { alert("Error!"); btn.disabled = false; }
};

function hideAllSteps() {
    document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden'));
}

window.backToSubMenu = () => window.showSubMenu(currentCategory);
window.cancelToSearch = () => { hideAllSteps(); document.getElementById('step-search').classList.remove('hidden'); };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
