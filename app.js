// ==========================================
// ART EXPO 2026 - CORE VOTING ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentStep = 1; 

// MAZ Shah Alam Coordinates
const SCHOOL_LAT = 3.0685; 
const SCHOOL_LON = 101.4900;
const RADIUS_KM = 2.0; 

const categories = {
    1: { id: "kindergarten", label: "Kindergarten" },
    2: { id: "primary", label: "Primary School" },
    3: { id: "secondary", label: "Secondary School" }
};

// 1. INITIALIZE: Load artists from Cloud
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("System Ready: " + allArtworks.length + " artists loaded.");
    } catch (e) {
        console.error("Database Error:", e);
    }
}
loadArtData();

// 2. START VOTING (With Remote Geofence Toggle)
window.startVoting = async function() {
    const btn = document.querySelector('#step-id button');
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();

    if (id.length < 5) {
        alert("Please enter a valid email or phone number.");
        return;
    }

    btn.innerText = "CHECKING SYSTEM...";
    btn.disabled = true;

    try {
        // Fetch Remote Settings from Admin Panel
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        // Check if Voting is Locked (Kill-Switch)
        if (settings.isOpen === false) {
            alert("VOTING CLOSED: The competition has ended or is not yet open.");
            btn.innerText = "Start Voting";
            btn.disabled = false;
            return;
        }

        // Check if Geofencing is Enabled
        if (settings.isGeofenceEnabled) {
            btn.innerText = "VERIFYING LOCATION...";
            
            if (!navigator.geolocation) {
                alert("GPS Error: Your browser doesn't support location services.");
                btn.disabled = false;
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const uLat = position.coords.latitude;
                    const uLon = position.coords.longitude;
                    const dist = calculateDistance(SCHOOL_LAT, SCHOOL_LON, uLat, uLon);

                    if (dist > RADIUS_KM) {
                        alert(`ACCESS DENIED: You are ${dist.toFixed(1)}km away. Voting is only allowed on-site at MAZ Shah Alam.`);
                        btn.innerText = "Start Voting";
                        btn.disabled = false;
                        return;
                    }

                    // On-site Success
                    proceedToVoting(id);
                },
                (error) => {
                    alert("LOCATION REQUIRED: You must 'Allow' location access to verify you are at the Expo.");
                    btn.innerText = "Start Voting";
                    btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            // GEOFENCING DISABLED: Skip to voting
            proceedToVoting(id);
        }

    } catch (e) {
        console.error(e);
        alert("Connection error. Please try again.");
        btn.disabled = false;
        btn.innerText = "Start Voting";
    }
};

function proceedToVoting(voterId) {
    currentVoter = voterId;
    document.getElementById('step-id').classList.add('hidden');
    document.getElementById('step-indicator').classList.remove('hidden');
    showStep();
}

// 3. STEPPER LOGIC
function showStep() {
    if (currentStep > 3) {
        finishExpo();
        return;
    }

    const cat = categories[currentStep];

    // DEVICE LOCK CHECK (Same phone can't vote twice)
    if (localStorage.getItem(`voted_${cat.id}`)) {
        currentStep++;
        showStep();
        return;
    }

    document.getElementById('current-q-num').innerText = currentStep;
    document.getElementById('question-title').innerText = cat.label;
    document.getElementById('search-input').value = "";
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('step-confirm').classList.add('hidden');
    
    setupSearch(cat.id);
}

// 4. SMART SEARCH
function setupSearch(categoryId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase();
        results.innerHTML = '';
        if (val.length < 2) { results.classList.add('hidden'); return; }

        const matches = allArtworks.filter(a => 
            a.category === categoryId && 
            a.artist.toLowerCase().includes(val)
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
    // DB Check for double voting
    try {
        const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
        if (voteCheck.exists) { 
            alert("This ID has already voted for " + currentArt.category.toUpperCase()); 
            localStorage.setItem(`voted_${currentArt.category}`, "true");
            window.nextStep(); 
            return; 
        }
    } catch(e) { console.log("Verifying ID..."); }

    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" style="width:100%;">
        <div style="padding:15px; text-align:left;">
            <h3 style="margin:0;">${currentArt.title || 'Untitled'}</h3>
            <p>Artist: ${currentArt.artist}</p>
        </div>
        <p style="background:var(--yellow); font-weight:900; text-align:center; padding:10px; border-top:4px solid black; margin:0;">
            CATEGORY: ${categories[currentStep].label.toUpperCase()}
        </p>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

// 6. SUBMIT
window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true;
    btn.innerText = "RECORDING...";

    const batch = db.batch();
    batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
    batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    try {
        await batch.commit();
        localStorage.setItem(`voted_${currentArt.category}`, "true");
        window.nextStep();
    } catch (err) {
        alert("Error! Check connection.");
        btn.disabled = false;
        btn.innerText = "Cast Vote";
    }
};

// 7. UTILS
window.nextStep = function() { currentStep++; showStep(); };
window.backToSearch = function() { 
    document.getElementById('step-confirm').classList.add('hidden'); 
    document.getElementById('step-search').classList.remove('hidden'); 
};

function finishExpo() {
    document.getElementById('voting-card').classList.add('hidden');
    document.getElementById('step-indicator').classList.add('hidden');
    document.getElementById('success-message').classList.remove('hidden');
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}
