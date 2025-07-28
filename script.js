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
        // Use the first result
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
            // Progress feedback
            clubResultsDiv.textContent = `Loading and filtering persons by club... (${Math.min(pageNumber * pageSize, totalCount)} / ${totalCount})`;
            // Stop if last page
            if (data.items.length < pageSize) break;
            pageNumber++;
        }
        if (filteredPersons.length === 0) {
            clubResultsDiv.textContent = 'No persons found for this club.';
            return;
        }
        // Display results
        clubResultsDiv.innerHTML = `<b>Found ${filteredPersons.length} persons in this club:</b><ul>` +
            filteredPersons.map(p => `<li>${p.fullName} (${p.clubName})</li>`).join('') + '</ul>';
    } catch (err) {
        clubResultsDiv.textContent = err.message || 'An error occurred.';
    }
}); 