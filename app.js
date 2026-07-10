// ==========================================
// MAZ ART EXPO 2026 - MASTER VOTING ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; 
let currentYear = "";     

// 5KM RADIUS CONFIG
const CAMPUSES = [
    { name: "Shah Alam", lat: 3.0681, lon: 101.4895 },
    { name: "Petaling Jaya", lat: 3.1095, lon: 101.6265 }
];
const RADIUS_KM = 5.0; 

const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

// 1. INITIALIZE VIRTUAL IDENTITY & CACHE
function initVoter() {
    let savedId = localStorage.getItem('maz_voter_id');
    if (!savedId) {
        savedId = 'voter_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('maz_voter_id', savedId);
    }
    currentVoter = savedId;
}

async function loadArtData() {
    initVoter();
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // A. LISTEN FOR GLOBAL DEVICE WIPE (The "Cookie Clear" Logic)
        db.collection('settings').doc('status').onSnapshot(doc => {
            if (doc.exists && doc.data().lastGlobalReset) {
                const cloudReset = doc.data().lastGlobalReset.toMillis();
                const localReset = localStorage.getItem('maz_last_reset') || 0;

                if (cloudReset > localReset) {
                    console.log("🧨 GLOBAL RESET DETECTED. WIPING DEVICE LOCKS...");
                    // Keep the Voter ID but clear all "voted_" flags
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('voted_')) localStorage.removeItem(key);
                    });
                    localStorage.setItem('maz_last_reset', cloudReset);
                    if (currentVoter) window.showMenu();
                }
            }
        });
    } catch (e) { setTimeout(loadArtData, 2000); }
}

function killSearchBox() {
    const results = document.getElementById('search-results');
    if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
    const input = document.getElementById('search-input');
    if (input) input.value = '';
}

loadArtData();

// 2. START VOTING (IDENTITY + SECURITY)
window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter your email or phone number.");

    btn.innerText = "CHECKING SYSTEM..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is currently locked.");
            btn.innerText = "Enter Expo"; btn.disabled = false; return;
        }

        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING RADIUS...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    let isVerified = false;
                    CAMPUSES.forEach(c => { if(calculateDistance(c.lat, c.lon, pos.coords.latitude, pos.coords.longitude) <= RADIUS_KM) isVerified = true; });
                    if (!isVerified) { alert("Access Denied: Voting only allowed within 5km of MAZ."); btn.innerText = "Enter Expo"; btn.disabled = false; } 
                    else { proceed(id); }
                },
                () => { alert("Location access required! Allow GPS and refresh."); btn.innerText = "Enter Expo"; btn.disabled = false; },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else { proceed(id); }
    } catch (e) { alert("System Error."); btn.disabled = false; }
};

function proceed(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTING AS: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

// 3. MENU SYSTEM
window.showMenu = function() {
    killSearchBox();
    hideAllSteps();
    document.getElementById('step-menu').classList.remove('hidden');

    ['kindergarten', 'primary', 'secondary'].forEach(cat => {
        // Since buttons are generated in showSubMenu, we just reset current selections
    });
};

window.showSubMenu = function(cat) {
    currentCategory = cat; 
    killSearchBox();
    hideAllSteps();
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
    currentYear = year.toUpperCase().trim(); 
    killSearchBox();
    hideAllSteps();
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = "SEARCH " + currentYear;
    setupSearch();
};

// 4. HYBRID SEARCH ENGINE
function setupSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase().trim(); results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }

        const matches = allArtworks.filter(a => {
            return a.year === currentYear && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val) || (a.title && a.title.toLowerCase().includes(val)));
        }).slice(0, 6);

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

// 5. CONFIRMATION
window.confirmVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = false; btn.innerText = "Submit Official Vote";

    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { 
        alert("You already voted for " + currentYear); 
        localStorage.setItem(`voted_${currentYear}`, "true"); 
        window.showSubMenu(currentCategory); return; 
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

// 6. SUBMIT
window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); if (btn.disabled) return;
    btn.disabled = true; btn.innerText = "RECORDING...";
    
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentYear}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        
        localStorage.setItem(`voted_${currentYear}`, "true");
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#e63946', '#1d3557', '#ffb703'] });
        window.showSubMenu(currentCategory); 
    } catch (e) { alert("Error! Check connection."); btn.disabled = false; btn.innerText = "Submit Official Vote"; }
};

function hideAllSteps() { document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden')); }
window.backToSubMenu = () => { killSearchBox(); window.showSubMenu(currentCategory); };
window.cancelToSearch = () => { killSearchBox(); hideAllSteps(); document.getElementById('step-search').classList.remove('hidden'); };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
