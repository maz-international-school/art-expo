// ==========================================
// MAZ ART EXPO 2026 - IRONCLAD ENGINE v5.0
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; 
let currentYear = "";     
let isSystemOpen = true; // Global flag

const CAMPUSES = [{ lat: 3.0681, lon: 101.4895 }, { lat: 3.1095, lon: 101.6265 }];
const RADIUS_KM = 5.0; 

const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

// 1. DATA PRE-LOAD & REAL-TIME LOCK LISTENER
async function loadArtData() {
    initVoter();
    
    // A. THE REAL-TIME KILL-SWITCH (This is the fix!)
    db.collection('settings').doc('status').onSnapshot(doc => {
        if (doc.exists) {
            isSystemOpen = doc.data().isOpen;
            if (!isSystemOpen) {
                // If admin locks it, force the UI to close immediately
                document.getElementById('voting-card').innerHTML = `
                    <div style="text-align:center; padding:40px 20px;">
                        <h2 style="color:var(--red); font-size: 2rem;">VOTING CLOSED</h2>
                        <div style="width:40px; height:6px; background:var(--black); margin: 20px auto;"></div>
                        <p style="font-weight:700;">The competition period has ended. Thank you for your participation!</p>
                    </div>`;
                // Hide header info
                document.getElementById('voter-display').classList.add('hidden');
            }
        }
    });

    // B. Load Students
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data,
                year: (data.year || "").toString().toUpperCase().trim(),
                artist: (data.artist || "").toString().trim(),
                title: (data.title || "").toString().trim()
            };
        });
        console.log("Database Synced: " + allArtworks.length + " artists.");
    } catch (e) { setTimeout(loadArtData, 2000); }
}

function initVoter() {
    let savedId = localStorage.getItem('maz_voter_id');
    if (!savedId) {
        savedId = 'voter_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('maz_voter_id', savedId);
    }
    currentVoter = savedId;
}

function killSearchBox() {
    const results = document.getElementById('search-results');
    if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
    const input = document.getElementById('search-input');
    if (input) input.value = '';
}

loadArtData();

// 2. START VOTING
window.startVoting = async function() {
    const btn = document.querySelector('#step-id button');
    
    // Check local flag first
    if (!isSystemOpen) {
        alert("VOTING CLOSED: The competition has ended.");
        return;
    }

    btn.innerText = "CHECKING SYSTEM..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED.");
            btn.innerText = "Enter Expo"; btn.disabled = false; return;
        }

        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING RADIUS...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    let verified = false;
                    CAMPUSES.forEach(c => { if(calculateDistance(c.lat, c.lon, pos.coords.latitude, pos.coords.longitude) <= RADIUS_KM) verified = true; });
                    if (!verified) { alert("Access Denied: Please vote on-site (within 5km)."); btn.innerText = "Enter Expo"; btn.disabled = false; } 
                    else { proceed(); }
                },
                () => { alert("Location required! Allow GPS and refresh."); btn.innerText = "Enter Expo"; btn.disabled = false; },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else { proceed(); }
    } catch (e) { alert("Connection Error."); btn.disabled = false; }

    function proceed() {
        document.getElementById('step-id').classList.add('hidden');
        window.showMenu();
    }
};

window.showMenu = function() {
    killSearchBox();
    hideAllSteps();
    document.getElementById('step-menu').classList.remove('hidden');
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
    document.getElementById('search-title').innerText = "VOTING FOR " + currentYear;
    setupSearch();
};

function setupSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase().trim();
        results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }

        const matches = allArtworks.filter(a => {
            return a.year === currentYear && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val) || a.title.toLowerCase().includes(val));
        }).slice(0, 6);

        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
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
    btn.disabled = false; btn.innerText = "Submit Official Vote";

    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { 
        alert("Already voted for " + currentYear); 
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
