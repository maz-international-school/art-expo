// ==========================================
// ADMIN CONTROL SCRIPT - LA FINALE (SECURE)
// ==========================================

let fullLocalData = []; // Local cache of the database

// 1. SETTINGS CONTROL (Kill-Switch & GPS Toggle)
async function toggleSet(key, value) {
    try {
        await db.collection('settings').doc('status').set({ [key]: value }, { merge: true });
        // Alert is optional, console log is cleaner for rapid toggling
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
            geoLabel.innerText = data.isGeofenceEnabled ? '2KM ACTIVE' : 'OFF (GLOBAL)';
            geoLabel.style.color = data.isGeofenceEnabled ? 'var(--red)' : 'var(--blue)';
        }
    }
});

// 2. MANUAL DATA MANAGEMENT (Add / Edit)
async function saveArt() {
    const code = document.getElementById('a-code').value.toUpperCase().trim();
    const artist = document.getElementById('a-artist').value.trim();
    const cat = document.getElementById('a-cat').value;
    
    // Title is optional, default to "Untitled"
    const titleInput = document.getElementById('a-title');
    const title = titleInput ? titleInput.value.trim() : "";

    if (!code || !artist) return alert("Code and Artist Name are required!");

    try {
        await db.collection('artworks').doc(code).set({
            artist: artist,
            title: title || "Untitled",
            category: cat
        }, { merge: true });

        alert("Saved successfully!");
        resetForm();
    } catch (e) { alert("Error saving: " + e.message); }
}

function resetForm() {
    document.getElementById('a-code').value = "";
    document.getElementById('a-code').disabled = false;
    document.getElementById('a-artist').value = "";
    if(document.getElementById('a-title')) document.getElementById('a-title').value = "";
    document.getElementById('form-title').innerText = "Add/Edit Artist";
}

// 3. EDIT & DELETE LOGIC (Sanitized for Apostrophes)
function prepareEdit(code, title, artist, cat) {
    document.getElementById('a-code').value = code;
    document.getElementById('a-code').disabled = true; // Lock ID during edit
    document.getElementById('a-artist').value = artist;
    if(document.getElementById('a-title')) document.getElementById('a-title').value = title;
    document.getElementById('a-cat').value = cat;

    document.getElementById('form-title').innerText = "Editing: " + code;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteArt(code) {
    if (confirm(`PERMANENTLY DELETE ${code}? This cannot be undone.`)) {
        try {
            await db.collection('artworks').doc(code).delete();
        } catch (e) { alert("Delete failed: " + e.message); }
    }
}

// 4. BULK UPLOAD (CSV)
async function bulkUpload() {
    const file = document.getElementById('csv-file').files[0];
    const status = document.getElementById('upload-status');
    
    if (!file) return alert("Please select a CSV file first!");

    status.innerText = "Parsing CSV...";
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            let count = 0;
            const data = results.data;

            for (let item of data) {
                if (item.Code) {
                    await db.collection('artworks').doc(item.Code.trim().toUpperCase()).set({
                        artist: item.Name || "Unknown Artist",
                        title: item.Title || "Untitled",
                        category: (item.Category || "primary").toLowerCase()
                    }, { merge: true });
                    count++;
                    status.innerText = `Syncing: ${count} / ${data.length}`;
                }
            }
            status.innerText = `✅ Success! ${count} records synced.`;
        }
    });
}

// 5. EXPORT RESULTS
function exportCSV() {
    if (fullLocalData.length === 0) return alert("No data to export!");

    let csv = "Code,Name,Title,Category,Votes\n";
    fullLocalData.forEach(d => {
        // Wrap names/titles in quotes to handle commas in the data
        csv += `${d.id},"${d.artist}","${d.title || ''}",${d.category},${d.voteCount || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'art_expo_final_results.csv');
    a.click();
}

// 6. SEARCH & RENDER (The "Moh'd" Fix)
function renderList(filter = "") {
    const out = document.getElementById('admin-results');
    out.innerHTML = "";

    const filtered = fullLocalData.filter(d => 
        d.id.toLowerCase().includes(filter) || 
        d.artist.toLowerCase().includes(filter)
    );

    filtered.forEach(d => {
        const row = document.createElement('div');
        row.className = "result-row";

        // --- THE CRITICAL FIX FOR APOSTROPHES ---
        // We replace ' with \' so the onclick string doesn't break
        const safeTitle = (d.title || '').replace(/'/g, "\\'");
        const safeArtist = (d.artist || '').replace(/'/g, "\\'");

        row.innerHTML = `
            <div style="flex:1;">
                <b style="color:var(--red)">${d.id}</b> ${d.artist}
                <br><small>${d.category.toUpperCase()} | "${d.title || 'Untitled'}"</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:var(--blue); color:white; padding:2px 8px;">${d.voteCount || 0}</span>
                <button onclick="prepareEdit('${d.id}', '${safeTitle}', '${safeArtist}', '${d.category}')" 
                        style="background:var(--yellow); color:black; font-size:0.6rem; padding:5px; width:auto; border:2px solid black;">EDIT</button>
                <button onclick="deleteArt('${d.id}')" 
                        style="background:var(--red); color:white; font-size:0.6rem; padding:5px; width:auto; border:2px solid black;">DEL</button>
            </div>
        `;
        out.appendChild(row);
    });
}

// 7. REAL-TIME DATABASE LISTENER
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
