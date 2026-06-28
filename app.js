// ==========================================
// MAZ ART EXPO 2026 - CORE ENGINE (GEO-FIXED)
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 

// EXACT COORDINATES: MAZ Shah Alam (Jalan Kristal)
const SCHOOL_LAT = 3.0681; 
const SCHOOL_LON = 101.4895;
const RADIUS_KM = 2.0; 

async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        setTimeout(loadArtData, 2000);
    }
}
loadArtData();

window.startVoting = async function() {
    const id = document.getElementById('voter-id').value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter your email or phone number.");

    btn.innerText = "CHECKING SYSTEM...";
    btn.disabled = true;

    try {
        // 1. First, check if Geofencing is even turned on in Admin
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is currently locked.");
            btn.innerText = "Vote Now"; btn.disabled = false;
            return;
        }

        // 2. Only run Geolocation if Admin has it enabled
        if (settings.isGeofenceEnabled) {
            btn.innerText = "FINDING GPS...";
            
            if (!navigator.geolocation) {
                alert("GPS Error: Your browser doesn't support location.");
                btn.disabled = false; return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const uLat = pos.coords.latitude;
                    const uLon = pos.coords.longitude;
                    const dist = calculateDistance(SCHOOL_LAT, SCHOOL_LON, uLat, uLon);

                    console.log(`User Distance: ${dist.toFixed(2)} km`);

                    if (dist > RADIUS_KM) {
                        alert(`ACCESS DENIED: You are too far from the school (${dist.toFixed(1)}km). Voting is only for on-site visitors.`);
                        btn.innerText = "Vote Now"; btn.disabled = false;
                    } else {
                        finishSignIn(id);
                    }
                },
                (err) => {
                    // Specific error messages for better UX
                    let msg = "Location access denied. Please allow location to vote.";
                    if(err.code === 3) msg = "GPS Timeout. Try moving closer to a window.";
                    alert(msg);
                    btn.innerText = "Vote Now"; btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            // Geofencing is OFF - skip location entirely
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

// ==========================================
// FORMULAS & MENU LOGIC
// ==========================================

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.showMenu = function() {
    document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden'));
    document.getElementById('step-menu').classList.remove('hidden');
    ['kindergarten', 'primary', 'secondary'].forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (localStorage.getItem(`voted_${cat}`)) {
            btn.innerText = cat.toUpperCase() + " (VOTED)";
            btn.style.opacity = "0.5";
            btn.style.pointerEvents = "none";
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
        const val = newInput.value.toLowerCase();
        results.innerHTML = '';
        if (val.length < 2) { results.classList.add('hidden'); return; }
        const matches = allArtworks.filter(a => a.category === catId && a.artist.toLowerCase().includes(val)).slice(0, 6);
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<strong>${m.artist}</strong><br><small>${m.title || 'Untitled'}</small>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

window.confirmVote = async function() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) {
        alert("Already voted for " + currentArt.category.toUpperCase());
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        window.showMenu();
        return;
    }
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" style="width:100%; border-bottom:4px solid black;">
        <div style="padding:15px; text-align:left;">
            <h3 style="margin:0;">${currentArt.title || 'Untitled'}</h3>
            <p>Artist: ${currentArt.artist}</p>
        </div>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true; btn.innerText = "INKING...";
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        document.getElementById('step-confirm').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) {
        alert("Error: Check connection.");
        btn.disabled = false; btn.innerText = "Confirm Vote";
    }
};

window.cancelToSearch = function() {
    document.getElementById('step-confirm').classList.add('hidden');
    document.getElementById('step-search').classList.remove('hidden');
};
