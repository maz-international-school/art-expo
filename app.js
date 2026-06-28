// ==========================================
// MAZ ART EXPO 2026 - CORE VOTING ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = "";

// MAZ Shah Alam Center Coordinates
const SCHOOL_LAT = 3.0685; 
const SCHOOL_LON = 101.4900;
const RADIUS_KM = 2.0; 

// 1. INITIALIZE: Load artists from Cloud once for instant search
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Aura System: " + allArtworks.length + " artists ready.");
    } catch (e) {
        console.error("Database Error:", e);
    }
}
loadArtData();

// 2. START VOTING (Checks Kill-switch, Geofence, and ID)
window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Please enter a valid email or phone number.");

    btn.innerText = "CHECKING SYSTEM...";
    btn.disabled = true;

    try {
        // Fetch Settings (Kill-switch & Geofence Toggle)
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED: The competition is not currently open.");
            btn.innerText = "Sign In to Vote"; btn.disabled = false;
            return;
        }

        // GPS Check (If enabled in Admin)
        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING LOCATION...";
            if (!navigator.geolocation) {
                alert("GPS Error: Your browser doesn't support location services.");
                btn.disabled = false; return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const dist = calculateDistance(SCHOOL_LAT, SCHOOL_LON, position.coords.latitude, position.coords.longitude);
                    if (dist > RADIUS_KM) {
                        alert(`ACCESS DENIED: You are ${dist.toFixed(1)}km away. Voting is only allowed on-site at MAZ Shah Alam.`);
                        btn.innerText = "Sign In to Vote"; btn.disabled = false;
                    } else {
                        finishSignIn(id);
                    }
                },
                (error) => {
                    alert("LOCATION REQUIRED: You must 'Allow' location access to verify you are at the Expo.");
                    btn.innerText = "Sign In to Vote"; btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            finishSignIn(id);
        }
    } catch (e) {
        alert("Connection Error. Try again.");
        btn.innerText = "Sign In to Vote"; btn.disabled = false;
    }
};

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTER ID: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

// 3. MENU LOGIC (Pick a Category)
window.showMenu = function() {
    // Hide all other steps
    document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden'));
    document.getElementById('step-menu').classList.remove('hidden');

    // Update buttons based on whether this phone has already voted
    const cats = ['kindergarten', 'primary', 'secondary'];
    cats.forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (localStorage.getItem(`voted_${cat}`)) {
            btn.innerText = cat.toUpperCase() + " (VOTED)";
            btn.style.opacity = "0.4";
            btn.style.background = "var(--blue)";
            btn.style.pointerEvents = "none";
        } else {
            btn.innerText = cat.toUpperCase();
            btn.style.opacity = "1";
            btn.style.background = "var(--black)";
            btn.style.pointerEvents = "auto";
        }
    });
};

window.pickCategory = function(cat) {
    currentCategory = cat;
    document.getElementById('step-menu').classList.add('hidden');
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = cat.toUpperCase();
    document.getElementById('search-input').value = "";
    setupSearch(cat);
};

// 4. SMART SEARCH
function setupSearch(catId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase();
        results.innerHTML = '';
        if (val.length < 2) { results.classList.add('hidden'); return; }

        const matches = allArtworks.filter(a => 
            a.category === catId && a.artist.toLowerCase().includes(val)
        ).slice(0, 6);

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

// 5. CONFIRMATION
window.confirmVote = async function() {
    // Cloud Double-Check
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) {
        alert("You have already voted for " + currentArt.category.toUpperCase());
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        window.showMenu();
        return;
    }

    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" style="width:100%; border-bottom:5px solid black;">
        <div style="padding:15px; text-align:left;">
            <h3 style="margin:0;">${currentArt.title || 'Untitled'}</h3>
            <p>Artist: ${currentArt.artist}</p>
        </div>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

// 6. SUBMIT VOTE
window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true; btn.innerText = "RECORDING...";
    const catId = currentArt.category;

    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${catId}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });

        await batch.commit();
        localStorage.setItem(`voted_${catId}`, "true"); // Device Lock
        
        document.getElementById('step-confirm').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) {
        alert("Error! Check internet.");
        btn.disabled = false; btn.innerText = "Confirm Vote";
    }
};

// 7. UTILS
window.cancelToSearch = function() {
    document.getElementById('step-confirm').classList.add('hidden');
    document.getElementById('step-search').classList.remove('hidden');
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
