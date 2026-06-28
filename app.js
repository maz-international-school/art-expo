// ==========================================
// ART EXPO 2026 - CORE VOTING ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentStep = 1; 

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
        console.log("Aura System: " + allArtworks.length + " artists ready.");
    } catch (e) {
        console.error("Database Error:", e);
    }
}
loadArtData();

// 2. START VOTING (Button Step 0)
window.startVoting = async function() {
    // A. Check Remote Kill-Switch (Miss Amalina's Time Limit)
    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        if (statusDoc.exists && statusDoc.data().isOpen === false) {
            alert("Voting is currently CLOSED. Please visit the admin desk if you think this is an error.");
            return;
        }
    } catch (e) { console.log("Bypassing status check..."); }

    // B. Get Identity
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();

    if (id.length < 5) {
        alert("Please enter a valid email or phone number to continue.");
        return;
    }
    
    currentVoter = id;
    document.getElementById('step-id').classList.add('hidden');
    document.getElementById('step-indicator').classList.remove('hidden');
    
    // Proceed to first category
    showStep();
};

// 3. SHOW STEP (Handles the 3-Question Flow)
function showStep() {
    // If finished all 3 categories
    if (currentStep > 3) {
        finishExpo();
        return;
    }

    const cat = categories[currentStep];

    // SECURITY: Device Lock Check
    // If this specific phone has a "voted" token for this category, skip it.
    if (localStorage.getItem(`voted_${cat.id}`)) {
        console.log(`Device lock detected for ${cat.id}. Skipping...`);
        currentStep++;
        showStep();
        return;
    }

    // Update UI
    document.getElementById('current-q-num').innerText = currentStep;
    document.getElementById('question-title').innerText = cat.label;
    
    document.getElementById('search-input').value = "";
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('step-confirm').classList.add('hidden');
    
    setupSearch(cat.id);
}

// 4. SMART SEARCH LOGIC
function setupSearch(categoryId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true); // Clears old listeners
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase();
        results.innerHTML = '';
        
        if (val.length < 2) {
            results.classList.add('hidden');
            return;
        }

        // Filter by category AND name/title
        const matches = allArtworks.filter(a => 
            a.category === categoryId && 
            (a.artist.toLowerCase().includes(val) || a.title.toLowerCase().includes(val))
        ).slice(0, 6); 

        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `
                    <div style="font-weight: 900; font-size: 1.1rem;">${m.artist}</div>
                    <div style="font-size: 0.8rem; opacity: 0.7;">"${m.title || 'Untitled'}"</div>
                `;
                div.onclick = () => { 
                    currentArt = m; 
                    window.confirmVote(); 
                };
                results.appendChild(div);
            });
        } else {
            results.classList.add('hidden');
        }
    });
}

// 5. CONFIRMATION SCREEN
window.confirmVote = async function() {
    // DATABASE CHECK: Has this email/phone voted in this category?
    try {
        const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
        if (voteCheck.exists) { 
            alert("This ID has already cast a vote for " + currentArt.category.toUpperCase()); 
            localStorage.setItem(`voted_${currentArt.category}`, "true"); // Update device lock
            window.nextStep(); 
            return; 
        }
    } catch(e) { console.log("Running network check..."); }

    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" style="width:100%; border-bottom:4px solid black;">
        <div style="padding:15px;">
            <h3 style="margin:0; font-size:1.4rem;">${currentArt.title || 'Untitled'}</h3>
            <p style="margin:5px 0; font-weight:700;">Artist: ${currentArt.artist}</p>
        </div>
        <div style="background:var(--yellow); font-weight:900; text-align:center; padding:10px; border-top:4px solid black; font-size:0.8rem;">
            VOTING FOR: ${categories[currentStep].label.toUpperCase()}
        </div>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
};

// 6. FINAL SUBMISSION (The Moment of Truth)
window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    const catId = currentArt.category;
    
    btn.disabled = true;
    btn.innerText = "RECORDING...";

    const batch = db.batch();
    
    // Increment specific artwork vote
    const artRef = db.collection('artworks').doc(currentArt.id);
    batch.update(artRef, { voteCount: firebase.firestore.FieldValue.increment(1) });

    // Mark email/phone as "used" in this category
    const voterRef = db.collection('voters').doc(`${currentVoter}_${catId}`);
    batch.set(voterRef, { 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        device: navigator.userAgent // Log device type for security
    });

    try {
        await batch.commit();
        
        // DEVICE LOCK: Save to browser memory
        localStorage.setItem(`voted_${catId}`, "true");

        window.nextStep();
    } catch (err) {
        alert("Submission failed. Check your internet connection.");
        btn.disabled = false;
        btn.innerText = "Cast Vote";
    }
};

// 7. UTILITIES
window.nextStep = function() { 
    currentStep++; 
    showStep(); 
};

window.backToSearch = function() { 
    document.getElementById('step-confirm').classList.add('hidden'); 
    document.getElementById('step-search').classList.remove('hidden'); 
};

function finishExpo() {
    document.getElementById('voting-card').classList.add('hidden');
    document.getElementById('step-indicator').classList.add('hidden');
    document.getElementById('success-message').classList.remove('hidden');
}
