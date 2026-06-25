let currentVoter = "";
let currentArt = null;
let allArtworks = []; 

// Load database into memory for instant searching
async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("System Ready: " + allArtworks.length + " artists loaded.");
    } catch (e) {
        console.error("Firebase load failed. Check your rules!");
    }
}
loadArtData();

function showBoothInput() {
    const id = document.getElementById('voter-id').value.trim();
    if (id.length < 5) return alert("Please enter a valid email or phone");
    currentVoter = id;
    document.getElementById('step-id').classList.add('hidden');
    document.getElementById('step-booth').classList.remove('hidden');
    setupSearch();
}

function setupSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    input.addEventListener('input', () => {
        const val = input.value.toLowerCase();
        results.innerHTML = '';
        
        if (val.length < 2) {
            results.classList.add('hidden');
            return;
        }

        // Search by Artist Name or Artwork Title
        const matches = allArtworks.filter(a => 
            a.artist.toLowerCase().includes(val) || 
            a.title.toLowerCase().includes(val)
        ).slice(0, 6); 

        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `
                    <div style="color: var(--red); font-size: 0.7rem; font-weight:900;">${m.category.toUpperCase()}</div>
                    <div style="font-weight: 900; font-size: 1.1rem;">${m.artist}</div>
                    <div style="font-size: 0.8rem; opacity: 0.7;">"${m.title}"</div>
                `;
                div.onclick = () => selectStudent(m);
                results.appendChild(div);
            });
        } else {
            results.classList.add('hidden');
        }
    });
}

function selectStudent(student) {
    currentArt = student;
    document.getElementById('search-results').classList.add('hidden');
    confirmVote();
}

async function confirmVote() {
    // Check if voter already voted for this category (e.g. kindergarten)
    const voteCheck = await db.collection('voters')
        .doc(`${currentVoter}_${currentArt.category}`).get();
            
    if (voteCheck.exists) {
        alert(`You have already cast your vote for the ${currentArt.category} category!`);
        location.reload();
        return;
    }

    // Prepare Preview
    document.getElementById('artwork-preview').innerHTML = `
        <img src="${currentArt.imageUrl || 'https://via.placeholder.com/400x300?text=Artwork'}" alt="Art">
        <h3>${currentArt.title}</h3>
        <p>${currentArt.artist}</p>
        <div style="background:var(--yellow); color:var(--black); padding:10px; font-weight:900; font-size:0.8rem; border-top: 4px solid black;">
            CATEGORY: ${currentArt.category.toUpperCase()}
        </div>
    `;
    document.getElementById('step-booth').classList.add('hidden');
    document.getElementById('step-confirm').classList.remove('hidden');
}

async function submitVote() {
    const btn = document.getElementById('vote-btn');
    btn.disabled = true;
    btn.innerText = "INKING VOTE...";

    const batch = db.batch();
    
    // Increment specific artwork
    const artRef = db.collection('artworks').doc(currentArt.id);
    batch.update(artRef, { voteCount: firebase.firestore.FieldValue.increment(1) });

    // Block this person from voting in this category again
    const voterRef = db.collection('voters').doc(`${currentVoter}_${currentArt.category}`);
    batch.set(voterRef, { timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    try {
        await batch.commit();
        document.getElementById('voting-card').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
    } catch (err) {
        alert("Connection error! Please check your internet and try again.");
        btn.disabled = false;
        btn.innerText = "Confirm Vote";
    }
}