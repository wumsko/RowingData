document.getElementById('searchForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('nameInput').value.trim();
    const resultsDiv = document.getElementById('results');
    const errorDiv = document.getElementById('error');
    resultsDiv.textContent = '';
    errorDiv.textContent = '';
    if (!name) {
        errorDiv.textContent = 'Please enter a name.';
        return;
    }
    try {
        // 1. Search for the person to get PersonID
        const searchUrl = `https://api.foys.io/tournament/public/api/v1/persons/search?searchString=${encodeURIComponent(name)}&pageNumber=1&pageSize=30`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) throw new Error('Failed to search for person.');
        const searchData = await searchResp.json();
        if (!searchData || !searchData.items || !searchData.items.length) {
            errorDiv.textContent = 'No person found with that name.';
            return;
        }
        if (searchData.items.length > 1) {
            // Display all matches as a list
            resultsDiv.innerHTML = `<b>Found ${searchData.items.length} persons:</b><ul>` +
                searchData.items.map(p => `<li><b><a href='https://roeievenementen.knrb.nl/person-results/${p.personId}' target='_blank' rel='noopener'>${p.fullName}</a></b> (${p.clubName || 'No club'})</li>`).join('') + '</ul>';
            return;
        }
        // Use the first result (only one person found)
        const person = searchData.items[0];
        const personId = person.personId;
        // 2. Fetch the overview/results for the person
        const overviewUrl = `https://api.foys.io/tournament/public/api/v1/persons/${personId}?id=${personId}`;
        const overviewResp = await fetch(overviewUrl);
        if (!overviewResp.ok) throw new Error('Failed to fetch person overview.');
        const overviewData = await overviewResp.json();
        // 3. Extract and display points
        const sculling = overviewData?.totalScullingPoints ?? 'N/A';
        const sweeping = overviewData?.totalSweepingPoints ?? 'N/A';
        const association = overviewData?.organisationName ?? 'N/A';
        resultsDiv.innerHTML = `<strong>${person.fullName}</strong><br>Total Sculling Points: <b>${sculling}</b><br>Total Sweeping Points: <b>${sweeping}</b><br>Association: <b>${association}</b>`;
    } catch (err) {
        errorDiv.textContent = err.message || 'An error occurred.';
    }
});

// Club/Association search functionality

document.getElementById('clubForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const clubName = document.getElementById('clubInput').value.trim().toLowerCase();
    const clubResultsDiv = document.getElementById('clubResults');
    clubResultsDiv.textContent = '';
    if (!clubName) {
        clubResultsDiv.textContent = 'Please enter a club/association name.';
        return;
    }
    clubResultsDiv.textContent = 'Loading and filtering persons by club...';
    let pageNumber = 1;
    const pageSize = 10000; // Increase page size for efficiency
    let totalCount = null;
    let filteredPersons = [];
    let totalFetched = 0;
    let personPoints = [];
    let allPointsFetched = false;
    // Dynamically add/remove the filter checkbox
    function showHideZeroCheckbox(show) {
        let existing = document.getElementById('hideZeroWinsContainer');
        if (show) {
            if (!existing) {
                const label = document.createElement('label');
                label.id = 'hideZeroWinsContainer';
                label.style = 'display:block;margin-bottom:8px;';
                label.innerHTML = `<input type="checkbox" id="hideZeroWins" checked> Hide persons with 0 wins`;
                document.getElementById('clubForm').insertAdjacentElement('afterend', label);
            }
        } else {
            if (existing) existing.remove();
        }
    }
    // Show the checkbox when a club search starts
    showHideZeroCheckbox(true);
    try {
        while (true) {
            const url = `https://api.foys.io/tournament/public/api/v1/persons/search?searchString=+&pageNumber=${pageNumber}&pageSize=${pageSize}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Failed to fetch persons.');
            const data = await resp.json();
            if (totalCount === null) totalCount = data.totalCount;
            if (!data.items || !data.items.length) break;
            // Filter for club name (case-insensitive, partial match)
            const matches = data.items.filter(p => (p.clubName || '').toLowerCase().includes(clubName));
            filteredPersons = filteredPersons.concat(matches);
            totalFetched += data.items.length;
            // Progress feedback
            clubResultsDiv.innerHTML = `<b>Found ${filteredPersons.length} persons in this club so far:</b><ul id='clubPersonsList'>` +
                filteredPersons.map((p, i) => `<li id='person-${i}'><b>${p.fullName}</b> (${p.clubName})<br>Sculling: <span class='sculling'>...</span> | Sweeping: <span class='sweeping'>...</span></li>`).join('') + '</ul>' +
                `<div style='margin-top:10px;'>Loading and filtering persons by club... (${Math.min(totalFetched, totalCount)} / ${totalCount})</div>`;
            // Stop if last page or all persons fetched
            if (data.items.length < pageSize || totalFetched >= totalCount) break;
            pageNumber++;
        }
        if (filteredPersons.length === 0) {
            clubResultsDiv.textContent = 'No persons found for this club.';
            return;
        }
        // Display results with placeholders for points
        clubResultsDiv.innerHTML = `<b>Found ${filteredPersons.length} persons in this club so far:</b><ul id='clubPersonsList'>` +
            filteredPersons.map((p, i) => `<li id='person-${i}'><b>${p.fullName}</b><b>(${p.clubName})</b><b>Sculling: <span class='sculling'>...</span> | Sweeping: <span class='sweeping'>...</span></b></li>`).join('') + '</ul>' +
            `<div style='margin-top:10px;'>Loading and filtering persons by club... (${Math.min(totalFetched, totalCount)} / ${totalCount})</div>`;
        // Helper to render the list based on the filter
        function renderClubList() {
            const hideZero = document.getElementById('hideZeroWins')?.checked;
            const sortOption = document.getElementById('clubSort')?.value || 'points-desc';
            // Prepare sortable array of [person, points, index]
            let sortable = filteredPersons.map((p, i) => {
                const points = personPoints[i];
                let sculling = points ? points.sculling : 0;
                let sweeping = points ? points.sweeping : 0;
                // If not loaded, treat as 0 for sorting
                if (sculling === '...' || sculling === 'N/A' || sculling === 'Err') sculling = 0;
                if (sweeping === '...' || sweeping === 'N/A' || sweeping === 'Err') sweeping = 0;
                return { p, points, sculling: Number(sculling), sweeping: Number(sweeping), i };
            });
            // Filter for hideZero
            if (hideZero) {
                sortable = sortable.filter(obj => (obj.sculling + obj.sweeping) > 0);
            }
            // Sort
            if (sortOption === 'points-desc') {
                sortable.sort((a, b) => (b.sculling + b.sweeping) - (a.sculling + a.sweeping));
            } else if (sortOption === 'points-asc') {
                sortable.sort((a, b) => (a.sculling + a.sweeping) - (b.sculling + b.sweeping));
            } else if (sortOption === 'alpha') {
                sortable.sort((a, b) => a.p.fullName.localeCompare(b.p.fullName));
            }
            let visibleCount = sortable.length;
            let html = `<b>Results: ${visibleCount} / ${filteredPersons.length}</b><br>`;
            html += `<b>Found ${filteredPersons.length} persons in this club so far:</b><ul id='clubPersonsList'>`;
            for (const obj of sortable) {
                const { p, points, sculling, sweeping, i } = obj;
                let scullingDisp = points ? points.sculling : '...';
                let sweepingDisp = points ? points.sweeping : '...';
                html += `<li id='person-${i}' style='display:flex;align-items:center;gap:1.2rem;'><b><a href='https://roeievenementen.knrb.nl/person-results/${p.personId}' target='_blank' rel='noopener'>${p.fullName}</a></b> <span style='color:#888;font-size:0.98em;'>(${p.clubName})</span> <span style='margin-left:auto;'>Sculling: <span class='sculling'>${scullingDisp}</span> | Sweeping: <span class='sweeping'>${sweepingDisp}</span></span></li>`;
            }
            html += '</ul>' + `<div style='margin-top:10px;'>Loading and filtering persons by club... (${Math.min(totalFetched, totalCount)} / ${totalCount})</div>`;
            clubResultsDiv.innerHTML = html;
        }
        // Initial render
        renderClubList();
        // Listen for filter toggle and sort change
        document.getElementById('hideZeroWins').onchange = renderClubList;
        document.getElementById('clubSort').onchange = renderClubList;
        // Fetch and display points for each person (no delay)
        const fetchPointsForPerson = async (person, idx) => {
            try {
                const overviewUrl = `https://api.foys.io/tournament/public/api/v1/persons/${person.personId}?id=${person.personId}`;
                const resp = await fetch(overviewUrl);
                if (!resp.ok) throw new Error('Failed to fetch overview');
                const data = await resp.json();
                const sculling = data?.totalScullingPoints ?? 'N/A';
                const sweeping = data?.totalSweepingPoints ?? 'N/A';
                personPoints[idx] = { sculling, sweeping };
                renderClubList();
            } catch (err) {
                personPoints[idx] = { sculling: 'Err', sweeping: 'Err' };
                renderClubList();
            }
        };
        await Promise.all(filteredPersons.map((p, i) => fetchPointsForPerson(p, i)));
        allPointsFetched = true;
        // Final render to ensure all points and filter are correct
        renderClubList();
        // When club search is done or reset, remove the checkbox
        // (You may want to call showHideZeroCheckbox(false) when clearing results or starting a new search)
    } catch (err) {
        clubResultsDiv.textContent = err.message || 'An error occurred.';
    }
});

// Tab navigation logic
document.getElementById('homeTab').onclick = () => showPage('homePage');
document.getElementById('clubTab').onclick = () => showPage('clubPage');
document.getElementById('personTab').onclick = () => showPage('personPage');
// Start on homepage
showPage('homePage');

// --- Competition Analyzer Tab Setup ---
document.getElementById('competitionTab').onclick = () => showPage('competitionPage');

const raceListDiv = document.getElementById('raceList');
const fieldListDiv = document.getElementById('fieldList');
const crewListDiv = document.getElementById('crewList');
const competitionErrorDiv = document.getElementById('competitionError');
const paginationDiv = document.getElementById('pagination');

// API base URL
const API_BASE_URL = 'https://carstenhanekamp-fastapibackend.hf.space';

// State management
let currentRaces = [];
let currentFields = [];
let currentRaceUrl = '';
let currentRaceName = '';
let currentFieldName = '';
let currentPage = 1;
const racesPerPage = 24;

// Load available races when competition tab is opened
async function loadAvailableRaces() {
    try {
        raceListDiv.innerHTML = 'Loading available races...';
        paginationDiv.innerHTML = '';
        competitionErrorDiv.textContent = '';
        
        const response = await fetch(`${API_BASE_URL}/races`);
        if (!response.ok) throw new Error('Failed to fetch races');
        
        currentRaces = await response.json();
        currentPage = 1;
        
        if (currentRaces.length === 0) {
            raceListDiv.innerHTML = '<p>No races available at the moment.</p>';
            return;
        }
        
        displayRacesPage();
        
    } catch (error) {
        competitionErrorDiv.textContent = `Error loading races: ${error.message}`;
        raceListDiv.innerHTML = '';
    }
}

// Display races for current page
function displayRacesPage() {
    const startIndex = (currentPage - 1) * racesPerPage;
    const endIndex = startIndex + racesPerPage;
    const pageRaces = currentRaces.slice(startIndex, endIndex);
    
    // Display races in 3-column grid
    raceListDiv.innerHTML = '<h3>Available Races:</h3><div class="race-grid">' +
        pageRaces.map(race => `
            <div class="race-item" onclick="selectRace('${race.url}', '${race.name}')">
                <div class="race-name">${race.name}</div>
                <div class="race-date">${race.date}</div>
            </div>
        `).join('') + '</div>';
    
    // Display pagination
    displayPagination();
}

// Display pagination controls
function displayPagination() {
    const totalPages = Math.ceil(currentRaces.length / racesPerPage);
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span class="pagination-info">...</span>';
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationHTML += '<span class="pagination-info">...</span>';
        paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
    
    // Page info
    paginationHTML += `<span class="pagination-info">Page ${currentPage} of ${totalPages} (${currentRaces.length} total races)</span>`;
    
    paginationDiv.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    if (page < 1 || page > Math.ceil(currentRaces.length / racesPerPage)) return;
    currentPage = page;
    displayRacesPage();
}

// Select a race and go to fields page
async function selectRace(raceUrl, raceName) {
    try {
        currentRaceUrl = raceUrl;
        currentRaceName = raceName;
        
        // Go to fields page
        showPage('raceFieldsPage');
        
        // Update page title
        document.getElementById('raceFieldsTitle').textContent = `Fields for ${raceName}`;
        
        // Load fields
        await loadRaceFields();
        
    } catch (error) {
        document.getElementById('competitionError2').textContent = `Error: ${error.message}`;
    }
}

// Load fields for selected race
async function loadRaceFields() {
    try {
        fieldListDiv.innerHTML = 'Loading fields...';
        document.getElementById('competitionError2').textContent = '';
        
        const response = await fetch(`${API_BASE_URL}/fields?race_url=${encodeURIComponent(currentRaceUrl)}`);
        if (!response.ok) throw new Error('Failed to fetch fields');
        
        currentFields = await response.json();
        
        if (currentFields.length === 0) {
            fieldListDiv.innerHTML = '<p>No fields available for this race.</p>';
            return;
        }
        
        // Display fields as clickable items
        fieldListDiv.innerHTML = '<div class="field-list">' +
            currentFields.map(field => `
                <div class="field-item" onclick="selectField('${field.url}', '${field.name}')">
                    <div class="field-code">${field.code}</div>
                    <div class="field-name">${field.name}</div>
                    <div class="field-entries">${field.entries} entries</div>
                </div>
            `).join('') + '</div>';
            
    } catch (error) {
        document.getElementById('competitionError2').textContent = `Error loading fields: ${error.message}`;
        fieldListDiv.innerHTML = '';
    }
}

// Select a field and go to crews page
async function selectField(fieldUrl, fieldName) {
    try {
        currentFieldName = fieldName;
        
        // Go to crews page
        showPage('fieldCrewsPage');
        
        // Update page title
        document.getElementById('fieldCrewsTitle').textContent = `Crews for ${fieldName}`;
        
        // Load crews
        await loadFieldCrews(fieldUrl);
        
    } catch (error) {
        document.getElementById('competitionError2').textContent = `Error: ${error.message}`;
    }
}

// Load crews for selected field
async function loadFieldCrews(fieldUrl) {
    try {
        crewListDiv.innerHTML = 'Loading crews and fetching competitor points...';
        document.getElementById('competitionError3').textContent = '';
        
        // Convert results URL to entries URL
        const entriesUrl = fieldUrl.replace('/results/', '/entries/');
        
        const response = await fetch(`${API_BASE_URL}/entries?race_url=${encodeURIComponent(entriesUrl)}`);
        if (!response.ok) throw new Error('Failed to fetch entries');
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            crewListDiv.innerHTML = '<p>No crews available for this field.</p>';
            return;
        }
        
        // Display crews with loading state for points
        crewListDiv.innerHTML = `
            <div class="crew-table-container">
                <table class="crew-table">
                    <thead>
                        <tr>
                            <th>Crew Name</th>
                            <th>Member Names</th>
                            <th>Sculling Points</th>
                            <th>Sweeping Points</th>
                            <th>Total Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.results.map(crew => `
                            <tr class="crew-row" data-crew-name="${crew.name}">
                                <td class="crew-name">${crew.name}</td>
                                <td class="crew-members">
                                    ${crew.crew_members.map(member => `
                                        <div class="member-item" data-name="${member}">
                                            <span class="member-name">${member}</span>
                                            <span class="member-points">
                                                <span class="sculling-points">Loading...</span> | 
                                                <span class="sweeping-points">Loading...</span>
                                            </span>
                                        </div>
                                    `).join('')}
                                </td>
                                <td class="crew-sculling-total">-</td>
                                <td class="crew-sweeping-total">-</td>
                                <td class="crew-total-points">-</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Start fetching points asynchronously for each crew member
        fetchAllCrewMemberPointsAsync(data.results);
        
    } catch (error) {
        document.getElementById('competitionError3').textContent = `Error loading crews: ${error.message}`;
        crewListDiv.innerHTML = '';
    }
}

// Fetch points for all crew members asynchronously
async function fetchAllCrewMemberPointsAsync(crews) {
    // Process each crew individually for better async performance
    for (const crew of crews) {
        await processCrewPointsAsync(crew);
    }
}

// Process points for a single crew asynchronously
async function processCrewPointsAsync(crew) {
    const crewRow = document.querySelector(`[data-crew-name="${crew.name}"]`);
    if (!crewRow) return;
    
    let crewScullingTotal = 0;
    let crewSweepingTotal = 0;
    
    // Handle 1x fields where crew_members is empty
    let membersToProcess = crew.crew_members;
    if (crew.crew_members.length === 0) {
        // For 1x fields, inject the crew name as a member
        membersToProcess = [crew.name];
        
        // Also update the HTML to show the crew name as a member
        const crewMembersCell = crewRow.querySelector('.crew-members');
        if (crewMembersCell) {
            crewMembersCell.innerHTML = `
                <div class="member-item" data-name="${crew.name}">
                    <span class="member-name">${crew.name}</span>
                    <span class="member-points">
                        <span class="sculling-points">Loading...</span> | 
                        <span class="sweeping-points">Loading...</span>
                    </span>
                </div>
            `;
        }
    }
    
    // Process each member in the crew
    for (const memberName of membersToProcess) {
        try {
            const points = await fetchPersonPoints(memberName);
            
            // Update the member's points immediately
            const memberItem = crewRow.querySelector(`[data-name="${memberName}"]`);
            if (memberItem) {
                const scullingSpan = memberItem.querySelector('.sculling-points');
                const sweepingSpan = memberItem.querySelector('.sweeping-points');
                
                if (scullingSpan) scullingSpan.textContent = points.sculling;
                if (sweepingSpan) sweepingSpan.textContent = points.sweeping;
                
                // Add to crew totals if points are numbers
                if (typeof points.sculling === 'number') crewScullingTotal += points.sculling;
                if (typeof points.sweeping === 'number') crewSweepingTotal += points.sweeping;
            }
            
            // Update crew totals after each member
            updateCrewTotals(crewRow, crewScullingTotal, crewSweepingTotal);
            
        } catch (error) {
            console.error(`Error fetching points for ${memberName}:`, error);
            const memberItem = crewRow.querySelector(`[data-name="${memberName}"]`);
            if (memberItem) {
                const scullingSpan = memberItem.querySelector('.sculling-points');
                const sweepingSpan = memberItem.querySelector('.sweeping-points');
                
                if (scullingSpan) scullingSpan.textContent = 'Error';
                if (sweepingSpan) sweepingSpan.textContent = 'Error';
            }
        }
    }
}

// Update crew totals in the display
function updateCrewTotals(crewRow, scullingTotal, sweepingTotal) {
    const scullingTotalCell = crewRow.querySelector('.crew-sculling-total');
    const sweepingTotalCell = crewRow.querySelector('.crew-sweeping-total');
    const totalPointsCell = crewRow.querySelector('.crew-total-points');
    
    if (scullingTotalCell) scullingTotalCell.textContent = scullingTotal;
    if (sweepingTotalCell) sweepingTotalCell.textContent = sweepingTotal;
    if (totalPointsCell) totalPointsCell.textContent = scullingTotal + sweepingTotal;
}

// Fetch points for a specific person
async function fetchPersonPoints(personName) {
    try {
        // Search for the person to get PersonID
        const searchUrl = `https://api.foys.io/tournament/public/api/v1/persons/search?searchString=${encodeURIComponent(personName)}&pageNumber=1&pageSize=30`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) throw new Error('Failed to search for person');
        
        const searchData = await searchResp.json();
        if (!searchData || !searchData.items || !searchData.items.length) {
            return { sculling: 'N/A', sweeping: 'N/A' };
        }
        
        // Use the first result (most likely match)
        const person = searchData.items[0];
        const personId = person.personId;
        
        // Fetch the overview/results for the person
        const overviewUrl = `https://api.foys.io/tournament/public/api/v1/persons/${personId}?id=${personId}`;
        const overviewResp = await fetch(overviewUrl);
        if (!overviewResp.ok) throw new Error('Failed to fetch person overview');
        
        const overviewData = await overviewResp.json();
        
        return {
            sculling: overviewData?.totalScullingPoints ?? 0,
            sweeping: overviewData?.totalSweepingPoints ?? 0
        };
        
    } catch (error) {
        console.error(`Error fetching points for ${personName}:`, error);
        return { sculling: 'Error', sweeping: 'Error' };
    }
}



// Navigation functions
function goBackToRaces() {
    showPage('competitionPage');
}

function goBackToFields() {
    showPage('raceFieldsPage');
}

// Initialize competition analyzer when tab is shown
function initializeCompetitionAnalyzer() {
    loadAvailableRaces();
}

// Override the showPage function to initialize competition analyzer
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (pageId === 'homePage') document.getElementById('homeTab').classList.add('active');
    if (pageId === 'clubPage') document.getElementById('clubTab').classList.add('active');
    if (pageId === 'personPage') document.getElementById('personTab').classList.add('active');
    if (pageId === 'competitionPage') document.getElementById('competitionTab').classList.add('active');
    
    // Show/hide the filter checkbox only on club page
    const hideZeroContainer = document.getElementById('hideZeroWinsContainer');
    if (hideZeroContainer) hideZeroContainer.style.display = (pageId === 'clubPage') ? '' : 'none';
    
    // Initialize competition analyzer when that tab is shown
    if (pageId === 'competitionPage') {
        initializeCompetitionAnalyzer();
    }
}

