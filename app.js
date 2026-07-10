// ==========================================
// ADMIN CONTROL - LA FINALE v5.0 (STABLE)
// ==========================================


}

let fullLocalData = []; // Local cache to save 'Read' quota

// 2. SETTINGS CONTROL (Kill-Switch & GPS)
async function toggleSet(key, value) {
    try {
        await db.collection('settings').doc('status').set({ [key]: value }, { merge: true });
    } catch (e) { alert("Settings error: " + e.message); }
}

// Watch System Status
db.collection('settings').doc('status').onSnapshot(doc => {
    if (doc.exists) {
        const d = doc.data();
        const sLabel = document.getElementById('status-label');
        const gLabel = document.getElementById('geo-label');
        if(sLabel) { 
            sLabel.innerText = d.isOpen ? 'OPEN' : 'LOCKED'; 
            sLabel.style.color = d.isOpen ? '#27ae60' : 'var(--red)'; 
        }
        if(gLabel) { 
            gLabel.innerText = d.isGeofenceEnabled ? 'ACTIVE (5KM)' : 'OFF'; 
            gLabel.style.color = d.isGeofenceEnabled ? 'var(--red)' : 'var(--blue)'; 
        }
    }
});

// Watch Voter Count (Real-time unique devices)
db.collection('voters').onSnapshot(snap => {
    const vCount = document.getElementById('active-voters');
    if(vCount) vCount.innerText = snap.size;
});

// 3. MANUAL DATA SAVE (Add / Edit)
async function saveArt() {
    if (entry !== ADMIN_PASSKEY) return;
    
    const code = document.getElementById('a-code').value.toUpperCase().trim();
    const artist = document.getElementById('a-artist').value.trim();
    const title = document.getElementById('a-title').value.trim();
    const year = document.getElementById('a-year').value.toUpperCase().trim();
    const cat = document.getElementById('a-cat').value;

    if (!code || !artist || !year) return alert("Code, Name, and Year Group are required!");

    try {
        await db.collection('artworks').doc(code).set({
            artist: artist,
            title: title || "Untitled",
            year: year,
            category: cat,
            voteCount: firebase.firestore.FieldValue.increment(0) 
        }, { merge: true });
        alert("Success: " + code + " updated.");
        resetForm();
    } catch (e) { alert("Save failed: " + e.message); }
}

// 4. THE SEARCH & LIST RENDER
function renderList(filter = "") {
    const out = document.getElementById('admin-results');
    if (!out) return;
    out.innerHTML = "";

    const query = filter.toLowerCase();

    const filtered = fullLocalData.filter(d => {
        return (d.artist || "").toLowerCase().includes(query) || 
               (d.id || "").toLowerCase().includes(query) || 
               (d.year || "").toLowerCase().includes(query);
    });

    filtered.forEach(d => {
        const row = document.createElement('div');
        row.className = "result-row";
        row.innerHTML = `
            <div style="flex:1;">
                <b style="color:var(--red)">${d.id}</b> ${d.artist}
                <br><small>${d.year || 'NO YEAR'} | ${d.category.toUpperCase()} | "${d.title || 'Untitled'}"</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:var(--blue); color:white; padding:2px 8px; font-weight:900;">${d.voteCount || 0}</span>
                <button onclick="prepareEdit('${d.id}')" style="width:auto; padding:5px 10px; font-size:0.6rem; background:var(--yellow); color:black; border:2px solid black; cursor:pointer;">EDIT</button>
                <button onclick="deleteArt('${d.id}')" style="width:auto; padding:5px 10px; font-size:0.6rem; background:var(--red); color:white; border:2px solid black; cursor:pointer;">DEL</button>
            </div>
        `;
        out.appendChild(row);
    });
}

// 5. DATABASE LISTENER (The Heart of Admin)
db.collection('artworks').onSnapshot(snap => {
    let total = 0;
    fullLocalData = snap.docs.map(doc => {
        const data = doc.data();
        total += (data.voteCount || 0);
        return { id: doc.id, ...data };
    });

    const totDisp = document.getElementById('total-votes');
    if (totDisp) totDisp.innerText = "TOTAL VOTES: " + total;
    
    // Auto-update list with current search filter
    const searchInput = document.getElementById('db-search');
    renderList(searchInput ? searchInput.value : "");
});

// 6. BULK CSV UPLOADER
async function bulkUpload() {
    const file = document.getElementById('csv-file').files[0];
    const status = document.getElementById('upload-status');
    if (!file) return alert("Select a CSV file!");

    status.innerText = "UPLOADING...";
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            let count = 0;
            for (let item of results.data) {
                // Normalize headers (removes spaces and case issues)
                const clean = {};
                Object.keys(item).forEach(k => clean[k.trim().toLowerCase()] = item[k]);

                if (clean.code) {
                    await db.collection('artworks').doc(clean.code.trim().toUpperCase()).set({
                        artist: (clean.name || "Unknown").trim(),
                        title: (clean.title || "").trim(),
                        category: (clean.category || "primary").toLowerCase().trim(),
                        year: (clean.year || "Y1").toUpperCase().trim(),
                        voteCount: 0
                    }, { merge: true });
                    count++;
                    status.innerText = `PROCESSED: ${count}`;
                }
            }
            alert("SUCCESS: " + count + " students synced.");
            status.innerText = "";
        }
    });
}

// 7. MAINTENANCE TOOLS
async function nuclearWipe() {
    if(prompt("⚠️ TYPE 'DELETE' TO WIPE EVERY STUDENT FROM THE DATABASE") === "DELETE") {
        const snap = await db.collection('artworks').get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Database has been Nuked. Refreshing...");
        location.reload();
    }
}

async function resetExpoForLaunch() {
    if(confirm("Wipe all vote counts and voter history for launch?")) {
        const batch = db.batch();
        fullLocalData.forEach(s => batch.update(db.collection('artworks').doc(s.id), { voteCount: 0 }));
        const voters = await db.collection('voters').get();
        voters.forEach(v => batch.delete(v.ref));
        await batch.commit();
        alert("System Reset. Votes are now 0.");
    }
}

// 8. UTILS
function prepareEdit(id) {
    const s = fullLocalData.find(x => x.id === id);
    if(!s) return;
    document.getElementById('a-code').value = s.id;
    document.getElementById('a-code').disabled = true;
    document.getElementById('a-artist').value = s.artist || "";
    document.getElementById('a-title').value = s.title || "";
    document.getElementById('a-year').value = s.year || "";
    document.getElementById('a-cat').value = s.category || "primary";
    document.getElementById('cancel-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('a-code').value = "";
    document.getElementById('a-code').disabled = false;
    document.getElementById('a-artist').value = "";
    document.getElementById('a-title').value = "";
    document.getElementById('a-year').value = "";
    document.getElementById('cancel-btn').classList.add('hidden');
}

async function deleteArt(id) {
    if(confirm("Permanently delete " + id + "?")) {
        await db.collection('artworks').doc(id).delete();
    }
}

function exportCSV() {
    let csv = "Code,Name,Title,Category,Year,Votes\n";
    fullLocalData.forEach(d => {
        csv += `${d.id},"${d.artist}","${d.title}",${d.category},${d.year},${d.voteCount||0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'maz_expo_results.csv';
    a.click();
}

// Attach Search Event
document.getElementById('db-search').addEventListener('input', (e) => renderList(e.target.value));
