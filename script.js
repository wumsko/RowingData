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
            filteredPersons.map((p, i) => `<li id='person-${i}'><b>${p.fullName}</b> (${p.clubName})<br>Sculling: <span class='sculling'>...</span> | Sweeping: <span class='sweeping'>...</span></li>`).join('') + '</ul>' +
            `<div style='margin-top:10px;'>Loading and filtering persons by club... (${Math.min(totalFetched, totalCount)} / ${totalCount})</div>`;
        // Helper to render the list based on the filter
        function renderClubList() {
            const hideZero = document.getElementById('hideZeroWins')?.checked;
            let visibleCount = 0;
            let html = '';
            // Count visible persons
            filteredPersons.forEach((p, i) => {
                const points = personPoints[i];
                let sculling = points ? points.sculling : '...';
                let sweeping = points ? points.sweeping : '...';
                if (hideZero && points && sculling == 0 && sweeping == 0) return;
                visibleCount++;
            });
            html += `<b>Results: ${visibleCount} / ${filteredPersons.length}</b><br>`;
            html += `<b>Found ${filteredPersons.length} persons in this club so far:</b><ul id='clubPersonsList'>`;
            filteredPersons.forEach((p, i) => {
                const points = personPoints[i];
                let sculling = points ? points.sculling : '...';
                let sweeping = points ? points.sweeping : '...';
                if (hideZero && points && sculling == 0 && sweeping == 0) return;
                html += `<li id='person-${i}'><b><a href='https://roeievenementen.knrb.nl/person-results/${p.personId}' target='_blank' rel='noopener'>${p.fullName}</a></b> (${p.clubName})<br>Sculling: <span class='sculling'>${sculling}</span> | Sweeping: <span class='sweeping'>${sweeping}</span></li>`;
            });
            html += '</ul>' + `<div style='margin-top:10px;'>Loading and filtering persons by club... (${Math.min(totalFetched, totalCount)} / ${totalCount})</div>`;
            clubResultsDiv.innerHTML = html;
        }
        // Initial render
        renderClubList();
        // Listen for filter toggle
        document.getElementById('hideZeroWins').onchange = renderClubList;
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