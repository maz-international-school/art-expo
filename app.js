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

// 1. DATA PRE-LOAD
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Database Ready: " + allArtworks.length + " students.");
    } catch (e) { console.error(e); }
}
loadArtData();

// 2. START VOTING (Locked to Window for HTML)
window.startVoting = async function() {
    // Check if locked
    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        if (statusDoc.exists && statusDoc.data().isOpen === false) {
            alert("Voting is currently locked by the administrator.");
            return;
        }
    } catch (e) { console.log("Status check skipped"); }

    const id = document.getElementById('voter-id').value.trim();
    if (id.length < 5) return alert("Please enter a valid email or phone");
    
    currentVoter = id;
    document.getElementById('step-id').classList.add('hidden');
    document.getElementById('step-indicator').classList.remove('hidden');
    showStep();
};

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
                div.onclick = () => { currentArt = m; confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

async function confirmVote() {
    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentArt.category}`).get();
    if (voteCheck.exists) { 
        alert("You already voted for this category!"); 
        window.nextStep(); 
        return; 
    }

    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}">
        <h3>${currentArt.title || 'Untitled'}</h3><p>${currentArt.artist}</p>
        <p style="background:var(--yellow); font-weight:900; text-align:center;">CATEGORY: ${currentArt.category.toUpperCase()}</p>
    `;
    document.getElementById('step-search').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
}

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true;
    btn.innerText = "INKING...";

    const batch = db.batch();
    batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
    batch.set(db.collection('voters').doc(`${currentVoter}_${currentArt.category}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    try {
        await batch.commit();
        window.nextStep();
    } catch (err) {
        alert("Error! Check connection.");
        btn.disabled = false;
        btn.innerText = "Cast Vote";
    }
};

window.nextStep = function() { currentStep++; showStep(); };
window.backToSearch = function() { document.getElementById('step-confirm').classList.add('hidden'); document.getElementById('step-search').classList.remove('hidden'); };
