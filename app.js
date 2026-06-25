// app.js
let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentStep = 1; 

const categories = {
    1: { id: "kindergarten", label: "Kindergarten" },
    2: { id: "primary", label: "Primary School" },
    3: { id: "secondary", label: "Secondary School" }
};

// Pre-load data
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("System Ready: " + allArtworks.length + " artists loaded.");
    } catch (e) {
        console.error("Database failed to load:", e);
    }
}
loadArtData();

// GLOBAL FUNCTION - This must be visible to index.html
async function startVoting() {
    console.log("Button clicked, checking status...");
    
    // Check if system is locked in Firebase
    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        if (statusDoc.exists && statusDoc.data().isOpen === false) {
            alert("Voting is currently locked by the administrator.");
            return;
        }
    } catch (e) {
        console.log("Status check skipped (settings/status might not exist yet)");
    }

    const id = document.getElementById('voter-id').value.trim();
    if (id.length < 5) return alert("Enter email or phone!");
    
    currentVoter = id;
    document.getElementById('step-id').classList.add('hidden');
    document.getElementById('step-indicator').classList.remove('hidden');
    showStep();
}

function showStep() {
    if (currentStep > 3) {
        document.getElementById('voting-card').classList.add('hidden');
        document.getElementById('step-indicator').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
        return;
    }
    const cat = categories[currentStep];
    document.getElementById('current-q-num').innerText = currentStep;
    document.getElementById('question-title').innerText = cat.label;
    document.getElementById('search-input').value = "";
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('step-confirm').classList.add('hidden');
    setupSearch(cat.id);
}

function setupSearch(categoryId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase();
        results.innerHTML = '';
        if (val.length < 2) { results.classList.add('hidden'); return; }
        const matches = allArtworks.filter(a => a.category === categoryId && a.artist.toLowerCase().includes(val)).slice(0, 6); 
        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<strong>${m.artist}</strong><br><small>${m.title || 'No Title'}</small>`;
                div.onclick = () => { currentArt = m; confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

async function confirmVote() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) { 
        alert("You already voted for " + currentArt.category + "!"); 
        nextStep(); 
        return; 
    }
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}">
        <h3>${currentArt.title || 'Untitled'}</h3><p>${currentArt.artist}</p>
        <p style="background:var(--yellow); font-size:0.7rem;">CATEGORY: ${currentArt.category.toUpperCase()}</p>`;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
}

async function submitVote() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true;
    const batch = db.batch();
    batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
    batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    nextStep();
}

function nextStep() { currentStep++; showStep(); }
function backToSearch() { document.getElementById('step-confirm').classList.add('hidden'); document.getElementById('step-search').classList.remove('hidden'); }
