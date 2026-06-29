// ==========================================
// MAZ ART EXPO 2026 - DUAL CAMPUS (5KM)
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 

// AUTHORIZED LOCATIONS (Exact for MAZ SA and MAZ PJ)
const CAMPUSES = [
    { name: "Shah Alam", lat: 3.0681, lon: 101.4895 },
    { name: "Petaling Jaya", lat: 3.1095, lon: 101.6265 }
];
const RADIUS_KM = 5.0; // 5KM radius as requested

// 1. DATA PRE-LOAD
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("System Ready: " + allArtworks.length + " artists loaded.");
    } catch (e) { setTimeout(loadArtData, 2000); }
}
loadArtData();

// 2. START VOTING
window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter your email or phone number.");

    btn.innerText = "CHECKING SYSTEM...";
    btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is currently locked.");
            btn.innerText = "Vote Now"; btn.disabled = false; return;
        }

        if (settings.isGeofenceEnabled) {
            btn.innerText = "FINDING GPS...";
            if (!navigator.geolocation) {
                alert("GPS Error: Your browser doesn't support location services.");
                btn.disabled = false; return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const uLat = pos.coords.latitude;
                    const uLon = pos.coords.longitude;
                    
                    let isVerified = false;
                    let nearestDist = 999;

                    CAMPUSES.forEach(campus => {
                        const dist = calculateDistance(campus.lat, campus.lon, uLat, uLon);
                        if (dist < nearestDist) nearestDist = dist;
                        if (dist <= RADIUS_KM) isVerified = true;
                    });

                    if (!isVerified) {
                        alert(`ACCESS DENIED: You are ${nearestDist.toFixed(1)}km away from the school. Voting is only permitted within 5km of MAZ PJ or Shah Alam.`);
                        btn.innerText = "Vote Now"; btn.disabled = false;
                    } else {
                        finishSignIn(id);
                    }
                },
                (err) => {
                    alert("LOCATION REQUIRED: Please click 'Allow' to verify you are at the Expo.");
                    btn.innerText = "Vote Now"; btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            finishSignIn(id);
        }
    } catch (e) {
        alert("System Error. Please try again.");
        btn.innerText = "Vote Now"; btn.disabled = false;
    }
};

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTER: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

// 3. MENU SYSTEM
window.showMenu = function() {
    document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden'));
    document.getElementById('step-menu').classList.remove('hidden');
    ['kindergarten', 'primary', 'secondary'].forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (localStorage.getItem(`voted_${cat}`)) {
            btn.innerText = cat.toUpperCase() + " (VOTED)";
            btn.style.opacity = "0.5"; btn.style.pointerEvents = "none";
        } else {
            btn.innerText = cat.toUpperCase();
            btn.style.opacity = "1"; btn.style.pointerEvents = "auto";
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
        if (val.length < 2) { results.classList.add('hidden'); return; }
        const matches = allArtworks.filter(a => a.category === catId && a.artist.toLowerCase().includes(val)).slice(0, 6);
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                div.innerHTML = `<strong>${m.artist}</strong><br><small>${m.title || 'Untitled'}</small>`;
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
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase; line-height:1;">${currentArt.title || 'UNTITLED'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin: 0 auto 20px auto;"></div>
            <p style="font-weight:700; font-size:1.2rem; margin:0;">Artist: ${currentArt.artist}</p>
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
        document.getElementById('step-confirm').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) { alert("Error: Check connection."); btn.disabled = false; btn.innerText = "Confirm Vote"; }
};

window.cancelToSearch = function() { document.getElementById('step-confirm').classList.add('hidden'); document.getElementById('step-search').classList.remove('hidden'); };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
