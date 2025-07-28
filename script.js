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
        resultsDiv.innerHTML = `<strong>${person.fullName}</strong><br>Total Sculling Points: <b>${sculling}</b><br>Total Sweeping Points: <b>${sweeping}</b>`;
    } catch (err) {
        errorDiv.textContent = err.message || 'An error occurred.';
    }
}); 