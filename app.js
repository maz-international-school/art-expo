// ==========================================
// MAZ ART EXPO 2026 - CORE ENGINE (FIXED)
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 

// TARGET: MAZ Shah Alam
const TARGET_LAT = 3.0681; 
const TARGET_LON = 101.4895;
const RADIUS_KM = 5.0; 

// 1. DATA PRE-LOAD
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Database Sync: " + allArtworks.length + " entries ready.");
    } catch (e) {
        console.log("Retrying connection...");
        setTimeout(loadArtData, 2000);
    }
}
loadArtData();

// 2. START VOTING (THE UNBREAKABLE VERSION)
window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter your email or phone number.");

    // Visual Feedback
    btn.innerText = "CHECKING..."; 
    btn.disabled = true;

    try {
        // A. Check Admin Controls
        const statusDoc = await db.collection('settings').doc('status').get();
        
        // If settings don't exist yet, we assume open and no GPS for safety
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: false };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is currently locked.");
            resetVoteButton(btn);
            return;
        }

        // B. Geolocation Verification
        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING GPS...";
            
            if (!navigator.geolocation) {
                alert("GPS Error: Your browser doesn't support location services.");
                resetVoteButton(btn);
                return;
            }

            // Using a Promise to wrap the Geolocation callback for cleaner async/await
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                    enableHighAccuracy: true, 
                    timeout: 8000 
                });
            }).catch(err => {
                let msg = "Location access denied. Please 'Allow' location to cast your vote.";
                if(err.code === 3) msg = "GPS Timeout. Please check your signal.";
                alert(msg);
                return null;
            });

            if (!position) {
                resetVoteButton(btn);
                return;
            }

            const dist = calculateDistance(TARGET_LAT, TARGET_LON, position.coords.latitude, position.coords.longitude);
            console.log(`User is ${dist.toFixed(2)} km away.`);

            if (dist > RADIUS_KM) {
                alert(`ACCESS DENIED: You are ${dist.toFixed(1)}km away. Voting only allowed within 5km of MAZ.`);
                resetVoteButton(btn);
                return;
            }
        }

        // SUCCESS PATH
        finishSignIn(id);

    } catch (e) {
        console.error(e);
        alert("System Error: Ensure you have internet and try again.");
        resetVoteButton(btn);
    }
};

function resetVoteButton(btn) {
    btn.innerText = "Vote Now";
    btn.disabled = false;
}

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTER: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

// 3. MENU & SEARCH (Hybrid System)
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
        
        // HYBRID SEARCH: Match Code OR Name
        const matches = allArtworks.filter(a => a.category === catId && (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val))).slice(0, 6);
        
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                div.innerHTML = `<span style="background:var(--red); color:white; padding:2px 6px; font-size:0.6rem; margin-right:8px;">${m.id}</span> <strong>${m.artist}</strong><br><small style="margin-left:45px;">Year: ${m.year || 'N/A'}</small>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

// 4. PREVIEW & SUBMISSION
window.confirmVote = async function() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) { 
        alert("Already voted for this category!"); 
        localStorage.setItem(`voted_${currentArt.category}`, "true"); 
        window.showMenu(); return; 
    }
    
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem; letter-spacing:2px;">BOOTH: ${currentArt.id}</p>
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase;">${currentArt.title || 'UNTITLED'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin:0 auto 15px auto;"></div>
            <p style="font-weight:700; font-size:1.2rem; margin:0;">Artist: ${currentArt.artist}</p>
        </div>
        <p style="background:var(--yellow); font-weight:900; text-align:center; padding:15px; border-top:6px solid black; margin:0;">${currentArt.category.toUpperCase()}</p>`;
    
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); btn.disabled = true; btn.innerText = "INKING...";
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        // CONFETTI CELEBRATION
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
