// ==========================================
// ART EXPO 2026 - CORE ENGINE (GEOFENCE VER.)
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentStep = 1; 

// COORDINATES FOR MAZ SHAH ALAM (Jalan Kristal)
const SCHOOL_LAT = 3.0685; 
const SCHOOL_LON = 101.4900;
const MAX_DISTANCE_KM = 2.0; // 2 km timeline

const categories = {
    1: { id: "kindergarten", label: "Kindergarten" },
    2: { id: "primary", label: "Primary School" },
    3: { id: "secondary", label: "Secondary School" }
};

// 1. DATA PRE-LOAD
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Aura System: " + allArtworks.length + " artists ready.");
    } catch (e) { console.error("DB Load Error:", e); }
}
loadArtData();

// 2. START VOTING (GPS VERIFICATION)
window.startVoting = async function() {
    // A. Check Remote Kill-Switch
    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        if (statusDoc.exists && statusDoc.data().isOpen === false) {
            alert("VOTING CLOSED: The competition has ended.");
            return;
        }
    } catch (e) { console.log("Status check skipped"); }

    const id = document.getElementById('voter-id').value.trim().toLowerCase();
    if (id.length < 5) return alert("Please enter a valid email or phone number.");

    // B. THE GEOFENCE CHECK (THE UNBIASED SHIELD)
    if (!navigator.geolocation) {
        alert("GPS Required: Your browser doesn't support location services.");
        return;
    }

    const btn = document.querySelector('#step-id button');
    btn.innerText = "VERIFYING LOCATION...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const uLat = position.coords.latitude;
            const uLon = position.coords.longitude;
            const dist = calculateDistance(SCHOOL_LAT, SCHOOL_LON, uLat, uLon);

            if (dist > MAX_DISTANCE_KM) {
                alert(`ACCESS DENIED: You are ${dist.toFixed(2)}km away. Voting is only permitted for visitors ON-SITE at the Art Expo.`);
                btn.innerText = "Start Voting";
                btn.disabled = false;
                return;
            }

            // If location is valid, proceed
            currentVoter = id;
            document.getElementById('step-id').classList.add('hidden');
            document.getElementById('step-indicator').classList.remove('hidden');
            showStep();
        },
        (error) => {
            alert("LOCATION REQUIRED: You must click 'Allow' to verify you are at the MAZ Art Expo. If you clicked 'Deny', please refresh the page or check your browser settings.");
            btn.innerText = "Start Voting";
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// 3. STEPPER LOGIC
function showStep() {
    if (currentStep > 3) {
        finishExpo();
        return;
    }
    const cat = categories[currentStep];

    // SECURITY: Device Lock Check
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

// 4. SEARCH ENGINE
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
            (a.artist.toLowerCase().includes(val) || (a.title && a.title.toLowerCase().includes(val)))
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
    // Server-side Double-Vote Check
    try {
        const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
        if (voteCheck.exists) { 
            alert("Already voted for " + currentArt.category.toUpperCase()); 
            localStorage.setItem(`voted_${currentArt.category}`, "true");
            window.nextStep(); 
            return; 
        }
    } catch(e) { console.log("Checking DB..."); }

    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" style="width:100%;">
        <div style="padding:15px;">
            <h3>${currentArt.title || 'Untitled'}</h3>
            <p>Artist: ${currentArt.artist}</p>
        </div>
        <p style="background:var(--yellow); font-weight:900; text-align:center; padding:10px; border-top:4px solid black;">CATEGORY: ${categories[currentStep].label.toUpperCase()}</p>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

// 6. FINAL VOTE SUBMISSION
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
        alert("Connection error! Please try again.");
        btn.disabled = false;
        btn.innerText = "Cast Vote";
    }
};

// 7. UTILITIES
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

// MATHEMATICAL FORMULA FOR DISTANCE
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}
