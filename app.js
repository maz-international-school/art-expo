<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vote | Art Expo 2026</title>
    <link rel="stylesheet" href="styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body>
    <img src="image1.png" class="school-logo" alt="MAZ Logo">

    <div class="container">
        <header>
            <h1>ART EXPO 2026</h1>
            <div id="step-indicator" class="hidden" style="font-weight: 900; color: var(--red); margin-bottom: 10px;">
                QUESTION <span id="current-q-num">1</span> OF 3
            </div>
        </header>

        <div class="card" id="voting-card">
            <div id="step-id">
                <h2>Who is voting?</h2>
                <input type="text" id="voter-id" placeholder="Email or Phone Number">
                <button type="button" onclick="startVoting()">Start Voting</button>
            </div>

            <div id="step-search" class="hidden">
                <h2 id="question-title">Category</h2>
                <div style="position: relative;">
                    <input type="text" id="search-input" placeholder="Search artist..." autocomplete="off">
                    <div id="search-results" class="search-suggestions hidden"></div>
                </div>
                <button onclick="nextStep()" style="background:none; color: var(--blue); border:none; margin-top:20px; font-size: 0.8rem; text-decoration: underline; cursor:pointer; width:100%;">Skip Category</button>
            </div>

            <div id="step-confirm" class="hidden">
                <div id="artwork-preview"></div>
                <button id="vote-btn" onclick="submitVote()">Cast Vote</button>
                <button onclick="backToSearch()" style="background:none; color: var(--blue); border:none; margin-top:15px; font-size: 0.7rem; text-decoration: underline; width:100%;">Change Selection</button>
            </div>
        </div>

        <div id="success-message" class="card hidden">
            <h2 style="color: var(--red)">THANK YOU!</h2>
            <p>All your votes have been recorded.</p>
            <button onclick="location.reload()">Finish</button>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="firebase-config.js"></script>
    <!-- REMOVED async/defer/type="module" to ensure global scope -->
    <script src="app.js"></script>
</body>
</html>
