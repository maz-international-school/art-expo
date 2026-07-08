// ==========================================
// MAZ ART EXPO 2026 - MASTER VOTING ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; // e.g., 'secondary'
let currentYear = "";     // e.g., 'Y7'

// 5KM RADIUS AROUND BOTH CAMPUSES
const CAMPUSES = [
    { name: "Shah Alam", lat: 3.0681, lon: 101.4895 },
    { name: "Petaling Jaya", lat: 3.1095, lon: 101.6265 }
];
const RADIUS_KM = 5.0; 

// MAPPING YEARS TO MAIN CATEGORIES
const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

// 1. DATA PRE-LOAD
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Aura System Online: " + allArtworks.length + " artists synced.");
    } catch (e) {
        console.log("Database connection struggle. Retrying in 2s...");
        setTimeout(loadArtData, 2000);
    }
}
loadArtData();

// 2. START VOTING (IDENTITY + SECURITY CHECK)
window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter a valid email or phone number.");

    btn.innerText = "AUTHENTICATING...";
    btn.disabled = true;

    try {
        // Fetch Cloud Settings (Kill-switch & Geofence Toggle)
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        // A. Check Kill-Switch
        if (settings.isOpen === false) {
            alert("EXPO NOTICE: Voting is currently closed.");
            resetBtn(btn);
            return;
        }

        // B. Check Geofence
        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING RADIUS...";
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                    enableHighAccuracy: true, 
                    timeout: 8000 
                });
            }).catch(err => {
                alert("LOCATION REQUIRED: Access to your GPS is needed to verify you are on-site.");
                return null;
            });

            if (!position) { resetBtn(btn); return; }

            const uLat = position.coords.latitude;
            const uLon = position.coords.longitude;
            
            let isVerified = false;
            let minDistance = 999;

            CAMPUSES.forEach(campus => {
                const dist = calculateDistance(campus.lat, campus.lon, uLat, uLon);
                if (dist < minDistance) minDistance = dist;
                if (dist <= RADIUS_KM) isVerified = true;
            });

            if (!isVerified) {
                alert(`ACCESS DENIED: You are ${minDistance.toFixed(1)}km away. Voting is restricted to MAZ Shah Alam and PJ campuses.`);
                resetBtn(btn);
                return;
            }
        }

        // SUCCESS: Sign In
        currentVoter = id;
        document.getElementById('voter-display').innerText = "VOTING AS: " + id;
        document.getElementById('voter-display').classList.remove('hidden');
        document.getElementById('step-id').classList.add('hidden');
        window.showMenu();

    } catch (e) {
        console.error(e);
        alert("Connection error. Ensure you have internet and try again.");
        resetBtn(btn);
    }
};

function resetBtn(btn) { btn.innerText = "Enter Expo"; btn.disabled = false; }

// 3. MENU SYSTEM
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
        
        btn.innerText = year + (hasVoted ? " (VOTED)" : "");
        btn.className = hasVoted ? "voted-btn" : "";
        btn.style.marginBottom = "10px";
        
        if (!hasVoted) {
            btn.onclick = () => window.pickYear(year);
        } else {
            btn.style.opacity = "0.4";
        }
        
        container.appendChild(btn);
    });
};

window.pickYear = function(year) {
    currentYear = year;
    hideAllSteps();
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = year + " SEARCH";
    document.getElementById('search-input').value = "";
    setupSearch(year);
};

// 4. TRIPLE-HYBRID SEARCH (Highlighting Enabled)
function setupSearch(yearId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase(); 
        results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }

        // Filter by Year AND (ID OR Name OR Title)
        const matches = allArtworks.filter(a => 
            a.year === yearId && 
            (a.id.toLowerCase().includes(val) || 
             a.artist.toLowerCase().includes(val) || 
             (a.title && a.title.toLowerCase().includes(val)))
        ).slice(0, 6);

        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                
                const regex = new RegExp(`(${val})`, 'gi');
                const hName = m.artist.replace(regex, `<span class="highlight-red">$1</span>`);
                const hCode = m.id.replace(regex, `<span class="highlight-code">$1</span>`);

                div.innerHTML = `${hCode} <strong>${hName}</strong><br><small style="margin-left:40px; opacity:0.6;">"${m.title || 'Untitled'}"</small>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

// 5. FORMAL PREVIEW SCREEN
window.confirmVote = async function() {
    // DB Check
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { 
        alert("You have already cast your official vote for " + currentYear); 
        localStorage.setItem(`voted_${currentYear}`, "true"); 
        window.showSubMenu(currentCategory); return; 
    }
    
    hideAllSteps();
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center; background:white;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem; letter-spacing:2px; text-transform:uppercase;">Entry Verification</p>
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase; line-height:1.1;">${currentArt.title || 'Untitled'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin:0 auto 15px auto;"></div>
            <p style="font-weight:700; font-size:1.2rem; margin:0; line-height:1.2;">Artist: ${currentArt.artist}</p>
            <p style="font-size:0.8rem; margin-top:10px; opacity:0.6;">BOOTH: ${currentArt.id} | LEVEL: ${currentYear}</p>
        </div>
        <div style="background:var(--yellow); font-weight:900; text-align:center; padding:15px; border-top:6px solid black; margin:0; font-size:0.9rem;">
            CONFIRM SELECTION
        </div>`;
    document.getElementById('step-confirm').classList.remove('hidden');
};

// 6. FINAL VOTE SUBMISSION
window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true; btn.innerText = "INKING VOTE...";

    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentYear}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });

        await batch.commit();
        localStorage.setItem(`voted_${currentYear}`, "true");
        
        // CONFETTI FLEX
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#e63946', '#1d3557', '#ffb703'] });

        document.getElementById('success-year').innerText = currentYear;
        hideAllSteps();
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) {
        alert("Network Timeout. Check signal and try again.");
        btn.disabled = false; btn.innerText = "Submit Official Vote";
    }
};

// 7. UTILS
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


