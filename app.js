// ==========================================
// ADMIN CONTROL SCRIPT - YEAR-GROUP ENABLED
// ==========================================

let fullLocalData = []; // Local cache of the database for instant searching

// 1. SYSTEM SETTINGS (Kill-Switch & GPS Toggle)
async function toggleSet(key, value) {
    try {
        await db.collection('settings').doc('status').set({ [key]: value }, { merge: true });
        console.log(`Setting ${key} updated to ${value}`);
    } catch (e) { alert("Error updating settings: " + e.message); }
}

// Watch System Status in real-time
db.collection('settings').doc('status').onSnapshot(doc => {
    if (doc.exists) {
        const data = doc.data();
        const statusLabel = document.getElementById('status-label');
        const geoLabel = document.getElementById('geo-label');

        if (statusLabel) {
            statusLabel.innerText = data.isOpen ? 'OPEN' : 'LOCKED';
            statusLabel.style.color = data.isOpen ? '#27ae60' : 'var(--red)';
        }
        if (geoLabel) {
            geoLabel.innerText = data.isGeofenceEnabled ? 'ACTIVE' : 'OFF';
            geoLabel.style.color = data.isGeofenceEnabled ? 'var(--red)' : 'var(--blue)';
        }
    }
});

// 2. MANUAL DATA MANAGEMENT (Save / Update)
async function saveArt() {
    const code = document.getElementById('a-code').value.toUpperCase().trim();
    const artist = document.getElementById('a-artist').value.trim();
    const title = document.getElementById('a-title').value.trim();
    const year = document.getElementById('a-year').value.toUpperCase().trim(); // Year Group
    const cat = document.getElementById('a-cat').value;

    if (!code || !artist || !year) return alert("Code, Name, and Year Group are required!");

    try {
        await db.collection('artworks').doc(code).set({
            artist: artist,
            title: title || "Untitled",
            year: year,
            category: cat
        }, { merge: true });

        alert("Database Updated: " + code);
        resetForm();
    } catch (e) { alert("Error saving: " + e.message); }
}

function resetForm() {
    document.getElementById('a-code').value = "";
    document.getElementById('a-code').disabled = false;
    document.getElementById('a-artist').value = "";
    document.getElementById('a-title').value = "";
    document.getElementById('a-year').value = "";
    document.getElementById('form-title').innerText = "Add/Edit Artist";
    document.getElementById('cancel-btn').classList.add('hidden');
}

// 3. EDIT & DELETE LOGIC (ID-Based Lookup for Stability)
function prepareEdit(id) {
    const student = fullLocalData.find(d => d.id === id);
    if (!student) return alert("Error finding student data locally.");

    // Populate the form
    document.getElementById('a-code').value = student.id;
    document.getElementById('a-code').disabled = true; // Lock ID during edit
    document.getElementById('a-artist').value = student.artist;
    document.getElementById('a-title').value = student.title || "";
    document.getElementById('a-year').value = student.year || "";
    document.getElementById('a-cat').value = student.category;

    document.getElementById('form-title').innerText = "Editing: " + student.id;
    document.getElementById('cancel-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteArt(id) {
    if (confirm(`PERMANENTLY DELETE ${id}? Votes will be lost.`)) {
        try {
            await db.collection('artworks').doc(id).delete();
        } catch (e) { alert("Delete failed: " + e.message); }
    }
}

// 4. SMART BULK UPLOAD (Handles Header Case Sensitivity)
async function bulkUpload() {
    const file = document.getElementById('csv-file').files[0];
    const status = document.getElementById('upload-status');
    
    if (!file) return alert("Please select a CSV file first!");

    status.innerText = "PROCESSING...";
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            let count = 0;
            const data = results.data;

            for (let item of data) {
                // Header Normalization (Checks Code, code, CODE etc)
                const code = (item.Code || item.code || item.CODE || "").trim().toUpperCase();
                const name = (item.Name || item.name || item.NAME || "").trim();
                const title = (item.Title || item.title || item.TITLE || "").trim();
                const category = (item.Category || item.category || item.CATEGORY || "primary").toLowerCase().trim();
                const year = (item.Year || item.year || item.YEAR || "Y1").toUpperCase().trim();

                if (code) {
                    await db.collection('artworks').doc(code).set({
                        artist: name || "Unknown Artist",
                        title: title || "",
                        category: category,
                        year: year,
                        voteCount: 0 // Initialize at zero for new uploads
                    }, { merge: true });
                    count++;
                    status.innerText = `SYNCING: ${count} / ${data.length}`;
                }
            }
            status.innerText = `✅ DONE: ${count} RECORDS LOADED.`;
            alert("Success! 13 Prize Groups are now synchronized.");
        }
    });
}

// 5. EXPORT FINAL RESULTS
function exportCSV() {
    if (fullLocalData.length === 0) return alert("No data to export!");

    let csv = "Code,Name,Title,Category,Year,Votes\n";
    fullLocalData.forEach(d => {
        csv += `${d.id},"${d.artist}","${d.title || ''}",${d.category},${d.year},${d.voteCount || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'art_expo_13_winners_results.csv');
    a.click();
}

// 6. DATABASE SEARCH & LIST RENDER
function renderList(filter = "") {
    const out = document.getElementById('admin-results');
    out.innerHTML = "";

    const filtered = fullLocalData.filter(d => 
        d.id.toLowerCase().includes(filter) || 
        d.artist.toLowerCase().includes(filter) ||
        (d.year && d.year.toLowerCase().includes(filter))
    );

    filtered.forEach(d => {
        const row = document.createElement('div');
        row.className = "result-row";
        row.innerHTML = `
            <div style="flex:1;">
                <b style="color:var(--red)">${d.id}</b> ${d.artist}
                <br><small>${d.year || 'No Year'} | ${d.category.toUpperCase()} | "${d.title || 'Untitled'}"</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:var(--blue); color:white; padding:2px 8px;">${d.voteCount || 0}</span>
                <button onclick="prepareEdit('${d.id}')" 
                        style="background:var(--yellow); color:black; font-size:0.6rem; padding:5px; width:auto; border:2px solid black; cursor:pointer;">EDIT</button>
                <button onclick="deleteArt('${d.id}')" 
                        style="background:var(--red); color:white; font-size:0.6rem; padding:5px; width:auto; border:2px solid black; cursor:pointer;">DEL</button>
            </div>
        `;
        out.appendChild(row);
    });
}

// 7. REAL-TIME LISTENER
document.getElementById('db-search').oninput = (e) => renderList(e.target.value.toLowerCase());

db.collection('artworks').onSnapshot(snap => {
    let total = 0;
    fullLocalData = snap.docs.map(doc => {
        const d = doc.data();
        total += (d.voteCount || 0);
        return { id: doc.id, ...d };
    });

    const totalVotesDisplay = document.getElementById('total-votes');
    if (totalVotesDisplay) totalVotesDisplay.innerText = "TOTAL VOTES: " + total;
    
    renderList(document.getElementById('db-search').value.toLowerCase());
});
