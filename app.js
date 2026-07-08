// ==========================================
// MAZ ART EXPO 2026 - HARD FILTER ENGINE
// ==========================================

let currentVoter = "";
let currentArt = null;
let allArtworks = []; 
let currentCategory = ""; 
let currentYear = "";     

const CAMPUSES = [{ lat: 3.0681, lon: 101.4895 }, { lat: 3.1095, lon: 101.6265 }];
const RADIUS_KM = 5.0; 

const YEAR_MAP = {
    kindergarten: ['KG1', 'KG2'],
    primary: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6'],
    secondary: ['Y7', 'Y8', 'Y9', 'Y10', 'Y11']
};

async function loadArtData() {
    try {
        const snap = await db.collection('artworks').get();
        allArtworks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Aura System: Data Synced.");
    } catch (e) { setTimeout(loadArtData, 2000); }
}
loadArtData();

window.startVoting = async function() {
    const idInput = document.getElementById('voter-id');
    const id = idInput.value.trim().toLowerCase();
    const btn = document.querySelector('#step-id button');

    if (id.length < 5) return alert("Enter email or phone!");
    btn.innerText = "CHECKING..."; btn.disabled = true;

    try {
        const statusDoc = await db.collection('settings').doc('status').get();
        const settings = statusDoc.exists ? statusDoc.data() : { isOpen: true, isGeofenceEnabled: true };

        if (!settings.isOpen) {
            alert("VOTING CLOSED.");
            resetBtn(btn); return;
        }

        if (settings.isGeofenceEnabled) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    let verified = false;
                    CAMPUSES.forEach(c => { if(calculateDistance(c.lat, c.lon, pos.coords.latitude, pos.coords.longitude) <= RADIUS_KM) verified = true; });
                    if (!verified) { alert("On-site only!"); resetBtn(btn); } 
                    else { finishSignIn(id); }
                },
                () => { alert("Location access required!"); resetBtn(btn); },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else { finishSignIn(id); }
    } catch (e) { alert("Connection Error."); resetBtn(btn); }
};

function resetBtn(btn) { btn.innerText = "Vote Now"; btn.disabled = false; }

function finishSignIn(id) {
    currentVoter = id;
    document.getElementById('voter-display').innerText = "VOTING AS: " + id;
    document.getElementById('voter-display').classList.remove('hidden');
    document.getElementById('step-id').classList.add('hidden');
    window.showMenu();
}

window.showMenu = function() {
    hideAllSteps();
    document.getElementById('step-menu').classList.remove('hidden');
};

window.showSubMenu = function(cat) {
    currentCategory = cat;
    hideAllSteps();
    document.getElementById('step-submenu').classList.remove('hidden');
    document.getElementById('submenu-title').innerText = cat.toUpperCase();
    
    const container = document.getElementById('year-buttons-container');
    container.innerHTML = "";
    
    YEAR_MAP[cat].forEach(year => {
        const btn = document.createElement('button');
        const hasVoted = localStorage.getItem(`voted_${year}`);
        btn.innerText = year + (hasVoted ? " (DONE)" : "");
        btn.className = hasVoted ? "voted-btn" : "";
        btn.style.marginBottom = "10px";
        if (!hasVoted) btn.onclick = () => window.pickYear(year);
        container.appendChild(btn);
    });
};

window.pickYear = function(year) {
    currentYear = year;
    hideAllSteps();
    document.getElementById('step-search').classList.remove('hidden');
    document.getElementById('search-title').innerText = "VOTING FOR " + year;
    document.getElementById('search-input').value = "";
    setupSearch(year);
};

function setupSearch(yearId) {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener('input', () => {
        const val = newInput.value.toLowerCase(); 
        results.innerHTML = '';
        if (val.length < 1) { results.classList.add('hidden'); return; }

        // HARD FILTER: Only show students where student.year exactly matches the selected year
        const matches = allArtworks.filter(a => 
            a.year === yearId && 
            (a.id.toLowerCase().includes(val) || a.artist.toLowerCase().includes(val) || (a.title && a.title.toLowerCase().includes(val)))
        ).slice(0, 6);

        if (matches.length > 0) {
            results.classList.remove('hidden');
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'search-item';
                const regex = new RegExp(`(${val})`, 'gi');
                const hName = m.artist.replace(regex, `<span class="highlight-red">$1</span>`);
                const hCode = m.id.replace(regex, `<span class="highlight-code">$1</span>`);
                div.innerHTML = `${hCode} <strong>${hName}</strong><br><small style="margin-left:40px; opacity:0.6;">"${m.title || 'Untitled'}"</small>`;
                div.onclick = () => { currentArt = m; window.confirmVote(); };
                results.appendChild(div);
            });
        } else { results.classList.add('hidden'); }
    });
}

window.confirmVote = async function() {
    // RESET BUTTON STATE
    const voteBtn = document.getElementById('vote-btn');
    voteBtn.disabled = false;
    voteBtn.innerText = "Confirm Official Vote";

    const voteCheck = await db.collection('voters').doc(`${currentVoter}_${currentYear}`).get();
    if (voteCheck.exists) { 
        alert("Already voted for " + currentYear); 
        localStorage.setItem(`voted_${currentYear}`, "true"); 
        window.showSubMenu(currentCategory); return; 
    }
    
    hideAllSteps();
    document.getElementById('artwork-preview').innerHTML = `
        <div style="padding:40px 20px; text-align:center; background:white;">
            <p style="font-weight:900; color:var(--red); margin:0; font-size:0.7rem; text-transform:uppercase;">Entry Verification</p>
            <h3 style="margin:20px 0; font-size:2rem; font-family:'Archivo Black'; text-transform:uppercase; line-height:1.1;">${currentArt.title || 'UNTITLED'}</h3>
            <div style="width:40px; height:6px; background:var(--black); margin:0 auto 15px auto;"></div>
            <p style="font-weight:700; font-size:1.2rem; margin:0;">Artist: ${currentArt.artist}</p>
            <p style="font-size:0.8rem; margin-top:10px; opacity:0.6;">BOOTH: ${currentArt.id} | LEVEL: ${currentYear}</p>
        </div>
        <div style="background:var(--yellow); font-weight:900; text-align:center; padding:15px; border-top:6px solid black; margin:0; font-size:0.9rem;">CONFIRM SELECTION</div>`;
    document.getElementById('step-confirm').classList.remove('hidden');
};

window.submitVote = async function() {
    const btn = document.getElementById('vote-btn'); 
    btn.disabled = true; 
    btn.innerText = "RECORDING...";
    
    try {
        const batch = db.batch();
        batch.update(db.collection('artworks').doc(currentArt.id), { voteCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(db.collection('voters').doc(`${currentVoter}_${currentYear}`), { timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        
        localStorage.setItem(`voted_${currentYear}`, "true");
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#e63946', '#1d3557', '#ffb703'] });
        
        document.getElementById('success-year').innerText = currentYear;
        hideAllSteps(); 
        document.getElementById('success-message').classList.remove('hidden');
    } catch (e) { 
        alert("Error! Check connection."); 
        btn.disabled = false; 
        btn.innerText = "Confirm Official Vote";
    }
};

function hideAllSteps() { document.querySelectorAll('#voting-card > div, #success-message').forEach(div => div.classList.add('hidden')); }
window.backToSubMenu = () => window.showSubMenu(currentCategory);
window.cancelToSearch = () => { hideAllSteps(); document.getElementById('step-search').classList.remove('hidden'); };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
