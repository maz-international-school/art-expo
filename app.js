// ==========================================
// MAZ ART EXPO 2026 - FINAL STABLE ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; 
let currentYear = "";     

// SHAH ALAM ONLY - STATED COORDINATES
const TARGET_LAT = 3.0681; 
const TARGET_LON = 101.4895;
const RADIUS_KM = 5.0; 

const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

// --- CORE UTILITIES ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDeviceDNA() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const txt = 'MAZ_ART_EXPO_2026';
    ctx.textBaseline = "top"; ctx.font = "14px 'Arial'"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60"; ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069"; ctx.fillText(txt, 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"; ctx.fillText(txt, 4, 17);
    const result = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < result.length; i++) { hash = (hash << 5) - hash + result.charCodeAt(i); hash |= 0; }
    return "dna_" + Math.abs(hash);
}

function killSearchBox() {
    const results = document.getElementById('search-results');
    if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
    const input = document.getElementById('search-input');
    if (input) input.value = '';
}

function hideAllSteps() { document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden')); }

// --- DATA LOAD ---
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Database Synced: " + allArtworks.length + " artists ready.");
    } catch (e) { setTimeout(loadArtData, 2000); }
}
loadArtData();

// --- GLOBAL FUNCTIONS ---

window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter your email or phone number.");

    btn.innerText = "AUTHENTICATING..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED.");
            btn.innerText = "Vote Now"; btn.disabled = false; return;
        }

        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING RADIUS...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const dist = calculateDistance(TARGET_LAT, TARGET_LON, pos.coords.latitude, pos.coords.longitude);
                    if (dist > RADIUS_KM) {
                        alert(`ACCESS DENIED: You are ${dist.toFixed(1)}km away. Voting only allowed at Shah Alam.`);
                        btn.innerText = "Vote Now"; btn.disabled = false;
                    } else { proceedSignIn(id); }
                },
                (err) => { alert("Location access required!"); btn.innerText = "Vote Now"; btn.disabled = false; },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else { proceedSignIn(id); }
    } catch (e) { alert("Error connecting."); btn.innerText = "Vote Now"; btn.disabled = false; }
};

function proceedSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTING AS: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

window.showMenu = function() {
    killSearchBox(); hideAllSteps();
    document.getElementById('step-menu').classList.remove('hidden');
};

window.showSubMenu = function(cat) {
    currentCategory = cat; killSearchBox(); hideAllSteps();
    document.getElementById('step-submenu').classList.remove('hidden');
    document.getElementById('submenu-title').innerText = cat.toUpperCase();
    const container = document.getElementById('year-buttons-container');
    container.innerHTML = "";
    YEAR_MAP[cat].forEach(year => {
        const btn = document.createElement('button');
        const hasVoted = localStorage.getItem(`voted_${year}`);
        btn.innerText = year + (hasVoted ? " (DONE)" : "");
        btn.className = hasVoted ? "voted-btn" : "";
        if (!hasVoted) btn.onclick = () => window.pickYear(year);
        container.appendChild(btn);
    });
};

window.pickYear = function(year) {
    currentYear = year.toUpperCase().trim(); killSearchBox(); hideAllSteps();
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = "VOTING FOR " + currentYear;
    setupSearch(year);
};

function setupSearch(yearId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase().trim(); results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }
        const matches = allArtworks.filter(a => a.year === yearId && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val) || (a.title && a.title.toLowerCase().includes(val)))).slice(0, 6);
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                const regex = new RegExp(`(${val})`, 'gi');
                const hName = m.artist.replace(regex, `<span class="highlight-red">$1</span>`);
                const hCode = m.id.replace(regex, `<span class="highlight-code">$1</span>`);
                div.innerHTML = `${hCode} <strong>${hName}</strong><br><small style="margin-left:40px; opacity:0.6;">"${m.title || 'Untitled'}"</small>`;
                div.onclick = () => { currentArt = m; killSearchBox(); window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

window.confirmVote = async function() {
    const btn = document.getElementById('vote-btn');
    if (btn) { btn.disabled = false; btn.innerText = "Submit Official Vote"; }

    const statusDoc = await db.collection('settings').doc('status').get();
    const settings = statusDoc.exists ? statusDoc.data() : { isDNALockEnabled: false };

    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { alert("Already voted!"); localStorage.setItem(`voted_${currentYear}`, "true"); window.showSubMenu(currentCategory); return; }

    if (settings.isDNALockEnabled) {
        const dna = getDeviceDNA();
        const dnaCheck = await db.collection('voters').where('dna', '==', dna).where('year', '==', currentYear).get();
        if (!dnaCheck.empty) { alert("HARDWARE LOCK: One vote per device."); localStorage.setItem(`voted_${currentYear}`, "true"); window.showSubMenu(currentCategory); return; }
    }
    
    hideAllSteps();
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center; background:white;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem; text-transform:uppercase;">Entry Verification</p>
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase; line-height:1.1;">${currentArt.title || 'UNTITLED'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin:0 auto 25px auto;"></div>
            <p style="font-weight:700; font-size:1.2rem; margin:0;">Artist: ${currentArt.artist}</p>
        </div>
        <p style="background:var(--yellow); font-weight:900; text-align:center; padding:15px; border-top:6px solid black; margin:0; font-size:0.9rem; color:black;">BOOTH: ${currentArt.id}</p>`;
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); if (btn.disabled) return;
    btn.disabled = true; btn.innerText = "RECORDING...";
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentYear}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp(), dna: getDeviceDNA(), year: currentYear, id: currentVoter });
        await batch.commit();
        localStorage.setItem(`voted_${currentYear}`, "true");
        document.getElementById('success-artist').innerText = currentArt.artist;
        document.getElementById('success-year').innerText = currentYear;
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#e63946', '#1d3557', '#ffb703'] });
        hideAllSteps(); document.getElementById('success-message').classList.remove('hidden');
    } catch (e) { alert("Error! Check connection."); btn.disabled = false; btn.innerText = "Submit Official Vote"; }
};

window.cancelToSearch = function() { killSearchBox(); hideAllSteps(); document.getElementById('step-search').classList.remove('hidden'); };
window.backToSubMenu = function() { killSearchBox(); window.showSubMenu(currentCategory); };
