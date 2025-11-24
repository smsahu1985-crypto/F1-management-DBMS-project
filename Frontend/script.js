/* ======== GLOBAL DATA CACHE ======== */
let allDriverStandings = [];
let allTeamStandings = [];
let allRaces = [];
let appDataLoaded = false;

/* ======== DOM SELECTORS ======== */
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const modalContainer = document.getElementById('modal-container');
const modalCloseBtn = document.getElementById('modal-close-btn');

// ======== ADMIN & API GLOBALS ========
const API_URL = "https://f1-management.up.railway.app";
const driverForm = document.getElementById('driver-form');
const driverTableBody = document.getElementById('admin-driver-table-body');
const formTitle = document.getElementById('form-title');
const formSubmitBtn = document.getElementById('form-submit-btn');
const formCancelBtn = document.getElementById('form-cancel-btn');

let isEditMode = false;
let editDriverId = null;

/* ======== MOBILE MENU ======== */
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show-menu');
    });
}

if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
}

/* ======== PAGE NAVIGATION ======== */
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);

        navLinks.forEach(nav => nav.classList.remove('active-link'));
        link.classList.add('active-link');

        pages.forEach(page => {
            if (page.id === targetId) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });

        if (targetId === 'admin') {
            loadAdminPage();
        }

        navMenu.classList.remove('show-menu');
    });
});

document.getElementById('home').classList.add('active');

/* ======== DATA LOADING & POPULATION ======== */
document.addEventListener('DOMContentLoaded', () => {
    loadAllApplicationData();

    if (driverForm) {
        driverForm.addEventListener('submit', handleFormSubmit);
    }
    if (formCancelBtn) {
        formCancelBtn.addEventListener('click', resetForm);
    }
    if (driverTableBody) {
        driverTableBody.addEventListener('click', handleTableClick);
    }
});

// Main data fetcher with better error handling
async function loadAllApplicationData() {
    if (appDataLoaded) return;

    try {
        // Test backend connection first
        const healthCheck = await fetch(`${API_URL}/api/health`);
        if (!healthCheck.ok) {
            throw new Error('Backend server is not responding');
        }

        // Fetch all data in parallel
        const [driverRes, teamRes, raceRes] = await Promise.all([
            fetch(`${API_URL}/api/driver-standings`),
            fetch(`${API_URL}/api/team-standings`),
            fetch(`${API_URL}/api/races`)
        ]);

        if (!driverRes.ok) throw new Error('Failed to fetch driver standings');
        if (!teamRes.ok) throw new Error('Failed to fetch team standings');
        if (!raceRes.ok) throw new Error('Failed to fetch races');

        allDriverStandings = await driverRes.json();
        allTeamStandings = await teamRes.json();
        allRaces = await raceRes.json();

        console.log('Data loaded successfully:', {
            drivers: allDriverStandings.length,
            teams: allTeamStandings.length,
            races: allRaces.length
        });

        loadHomepageRaces();
        loadRaces();
        loadDrivers();
        loadTeams();
        loadStandings();
        loadPodium();

        appDataLoaded = true;

    } catch (error) {
        console.error("Error loading application data:", error);
        showErrorMessage("Error loading data from server. Please check:\n1. Backend server is running (npm start in Backend folder)\n2. MySQL server is running\n3. Database 'formulaOne' exists");
    }
}

// Error message helper
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#e74c3c;color:white;padding:1rem 2rem;border-radius:8px;z-index:9999;max-width:500px;text-align:center;';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 8000);
}

// 1. Load Homepage Races
function loadHomepageRaces() {
    const container = document.getElementById('upcoming-race-grid');
    if (!container) return;
    
    const today = new Date();
const upcomingRaces = allRaces
    .filter(race => new Date(race.RaceDate) >= today)
    .slice(0, 3);
    
    if (upcomingRaces.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-color-light);">No races available</p>';
        return;
    }
    
    let html = '';
    upcomingRaces.forEach(race => {
        const raceDate = race.RaceDate ? new Date(race.RaceDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : 'TBA';
        
        html += `
            <article class="upcoming-race-card">
                <h3>${race.Name}</h3>
                <p><strong>${race.Location}</strong></p>
                <p style="color: var(--primary-color);">${raceDate}</p>
            </article>
        `;
    });
    container.innerHTML = html;
}

// 2. Load Races
function loadRaces() {
    const container = document.getElementById('race-list-container');
    if (!container) return;
    
    if (allRaces.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-color-light);">No races available</p>';
        return;
    }
    
    let html = '';
    allRaces.forEach(race => {
        const raceDate = race.RaceDate ? new Date(race.RaceDate).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        }) : 'TBA';

        const winnerText = race.WinningTeam 
            ? `Winner: ${race.WinningTeam}`
            : 'Winner: TBD';
        
        html += `
            <article class="race-card">
                <div class="race-card-icon-placeholder">
                    ${race.Location}
                </div>
                <div class="race-card-content">
                    <div>
                        <h3 class="race-card-title">${race.Name}</h3>
                        <p class="race-card-date">${raceDate}</p>
                        <p class="race-card-winner">${winnerText}</p>
                    </div>
                    <span class="details-btn" data-modal-type="race" data-id="${race.Race_ID}">
                        View Details
                    </span>
                </div>
            </article>
        `;
    });
    container.innerHTML = html;
}

// 3. Load Drivers
function loadDrivers() {
    const container = document.getElementById('driver-grid-container');
    if (!container) return;
    
    if (allDriverStandings.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-color-light);">No drivers available</p>';
        return;
    }
    
    let html = '';
    allDriverStandings.forEach(driver => {
        html += `
            <article class="driver-card" data-modal-type="driver" data-id="${driver.Driver_ID}">
                <div class="driver-card-number">${driver.Number}</div>
                <p class="driver-card-team">${driver.TeamName || 'No Team'}</p>
                <h3 class="driver-card-name">${driver.FirstName} ${driver.LastName}</h3>
                <p class="driver-card-points">${driver.Points || 0} PTS</p>
            </article>
        `;
    });
    container.innerHTML = html;
}

// 4. Load Teams
function loadTeams() {
    const container = document.getElementById('team-gallery-container');
    if (!container) return;

    if (allTeamStandings.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-color-light);">No teams available</p>';
        return;
    }

    let html = '';
    allTeamStandings.forEach(team => {
        html += `
            <div class="team-card">
                <h3 class="team-card-name">${team.Name}</h3>
                <p class="team-card-spec">Engine: ${team.Engine || 'N/A'}</p>
                <p class="team-card-spec">Points: <strong>${team.TotalPoints || 0}</strong></p>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 5. Load Standings
function loadStandings() {
    const driverBody = document.getElementById('driver-standings-body');
    const teamBody = document.getElementById('team-standings-body');

    if (driverBody) {
        if (allDriverStandings.length === 0) {
            driverBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No driver data available</td></tr>';
        } else {
            let driverHtml = '';
            allDriverStandings.forEach((driver, index) => {
                driverHtml += `
                    <tr class="${index === 0 ? 'top-row' : ''}">
                        <td>${index + 1}</td>
                        <td>${driver.FirstName} ${driver.LastName}</td>
                        <td>${driver.Nationality}</td>
                        <td>${driver.TeamName || 'No Team'}</td>
                        <td><strong>${driver.Points || 0}</strong></td>
                    </tr>
                `;
            });
            driverBody.innerHTML = driverHtml;
        }
    }

    if (teamBody) {
        if (allTeamStandings.length === 0) {
            teamBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No team data available</td></tr>';
        } else {
            let teamHtml = '';
            allTeamStandings.forEach((team, index) => {
                teamHtml += `
                    <tr class="${index === 0 ? 'top-row' : ''}">
                        <td>${index + 1}</td>
                        <td>${team.Name}</td>
                        <td><strong>${team.TotalPoints || 0}</strong></td>
                    </tr>
                `;
            });
            teamBody.innerHTML = teamHtml;
        }
    }
}

// 6. Load Podium
function loadPodium() {
    const container = document.getElementById('podium-grid-container');
    if (!container) return;

    const podiumDrivers = {
        pos1: allDriverStandings.length > 0 ? allDriverStandings[0] : null,
        pos2: allDriverStandings.length > 1 ? allDriverStandings[1] : null,
        pos3: allDriverStandings.length > 2 ? allDriverStandings[2] : null
    };

    const createPodiumCard = (driver, pos) => {
        if (!driver) {
             return `<div class="podium-card pos-${pos}"><h3 class="podium-name">N/A</h3></div>`;
        }
        let rankText = (pos === 1) ? "1<span>st</span>" : (pos === 2) ? "2<span>nd</span>" : "3<span>rd</span>";
        return `
            <div class="podium-card pos-${pos}">
                <h2 class="pos-rank">${rankText}</h2>
                <div class="podium-number">${driver.Number}</div>
                <h3 class="podium-name">${driver.FirstName} ${driver.LastName}</h3>
                <p class="podium-team">${driver.TeamName || 'No Team'}</p>
                <p class="podium-points">${driver.Points || 0} PTS</p>
            </div>
        `;
    };

    let html = '';
    html += createPodiumCard(podiumDrivers.pos2, 2);
    html += createPodiumCard(podiumDrivers.pos1, 1);
    html += createPodiumCard(podiumDrivers.pos3, 3);
    
    container.innerHTML = html;
}

/* ======== MODAL & INTERACTIVITY ======== */
const modalBody = document.getElementById('modal-body');

document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn) {
        const tabId = tabBtn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        tabBtn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(panel => {
            if (panel.id === `tab-${tabId}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    const modalBtn = e.target.closest('[data-modal-type]');
    if (modalBtn) {
        const type = modalBtn.dataset.modalType;
        const id = modalBtn.dataset.id;
        
        if (type === 'race') {
    const race = allRaces.find(r => r.Race_ID.toString() === id);
    if (!race) return;
    
    const raceDate = race.RaceDate ? new Date(race.RaceDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : 'TBA';

    const winnerText = race.WinningTeam || 'TBD';
    
    modalBody.innerHTML = `
        <h2 class="modal-title">${race.Name}</h2>
        <div class="modal-stat">
            <span>Location</span>
            <strong>${race.Location}</strong>
        </div>
        <div class="modal-stat">
            <span>Date</span>
            <strong>${raceDate}</strong>
        </div>
        <div class="modal-stat">
            <span>Winning Team</span>
            <strong>${winnerText}</strong>
        </div>
        ${race.Details ? `<p style="margin-top:1rem;">${race.Details}</p>` : ''}
    `;
}

        
        if (type === 'driver') {
            const driver = allDriverStandings.find(d => d.Driver_ID.toString() === id);
            if (!driver) return;
            
            const dob = driver.DOB ? new Date(driver.DOB).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }) : 'N/A';
            
            modalBody.innerHTML = `
                <h2 class="modal-title">${driver.FirstName} ${driver.LastName} #${driver.Number}</h2>
                <div class="modal-stat">
                    <span>Team</span>
                    <strong>${driver.TeamName || 'No Team'}</strong>
                </div>
                <div class="modal-stat">
                    <span>Nationality</span>
                    <strong>${driver.Nationality}</strong>
                </div>
                <div class="modal-stat">
                    <span>Date of Birth</span>
                    <strong>${dob}</strong>
                </div>
                <div class="modal-stat">
                    <span>Current Season Points</span>
                    <strong>${driver.Points || 0}</strong>
                </div>
                <div class="modal-stat">
                    <span>World Championships</span>
                    <strong>${driver.Championships || 0}</strong>
                </div>
            `;
        }
        
        modalContainer.classList.add('active');
    }
});

modalCloseBtn.addEventListener('click', () => {
    modalContainer.classList.remove('active');
});

modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
        modalContainer.classList.remove('active');
    }
});

/* ======== ADMIN CRUD FUNCTIONS ======== */

async function loadAdminPage() {
    if (!driverTableBody) return;
    
    try {
        const response = await fetch(`${API_URL}/api/drivers`);
        if (!response.ok) throw new Error('Failed to fetch drivers');
        const drivers = await response.json();
        
        driverTableBody.innerHTML = '';
        
        if (drivers.length === 0) {
            driverTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No drivers in database</td></tr>';
            return;
        }
        
        drivers.forEach(driver => {
            const dob = new Date(driver.DOB).toISOString().split('T')[0];
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver.Driver_ID}</td>
                <td>${driver.FirstName}</td>
                <td>${driver.LastName}</td>
                <td>${driver.Nationality}</td>
                <td>${dob}</td>
                <td>${driver.Championships || 0}</td>
                <td>
                    <button class="btn-action btn-edit" data-id="${driver.Driver_ID}">Edit</button>
                    <button class="btn-action btn-delete" data-id="${driver.Driver_ID}">Delete</button>
                </td>
            `;
            row.dataset.driver = JSON.stringify(driver);
            driverTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading admin page:", error);
        driverTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#e74c3c;">Error: ${error.message}</td></tr>`;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(driverForm);
    const driverData = Object.fromEntries(formData.entries());
    
    // Disable submit button
    formSubmitBtn.disabled = true;
    formSubmitBtn.textContent = isEditMode ? 'Updating...' : 'Adding...';
    
    try {
        let response;
        if (isEditMode) {
            response = await fetch(`${API_URL}/api/drivers/${editDriverId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(driverData)
            });
        } else {
            response = await fetch(`${API_URL}/api/drivers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(driverData)
            });
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'API request failed');
        }
        
        showSuccessMessage(isEditMode ? 'Driver updated successfully!' : 'Driver added successfully!');
        resetForm();
        loadAdminPage();
        
        // Refresh main data
        appDataLoaded = false;
        loadAllApplicationData();
        
    } catch (error) {
        console.error("Error saving driver:", error);
        alert(`Error: ${error.message}`);
    } finally {
        formSubmitBtn.disabled = false;
        formSubmitBtn.textContent = isEditMode ? 'Update Driver' : 'Add Driver';
    }
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:white;padding:1rem 2rem;border-radius:8px;z-index:9999;';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

function handleTableClick(e) {
    const target = e.target;
    
    if (target.classList.contains('btn-delete')) {
        const id = target.dataset.id;
        if (confirm(`Are you sure you want to delete driver ID ${id}?`)) {
            deleteDriver(id);
        }
    }
    
    if (target.classList.contains('btn-edit')) {
        const row = target.closest('tr');
        const driver = JSON.parse(row.dataset.driver);
        
        driverForm.elements.FirstName.value = driver.FirstName;
        driverForm.elements.LastName.value = driver.LastName;
        driverForm.elements.Nationality.value = driver.Nationality;
        driverForm.elements.DOB.value = new Date(driver.DOB).toISOString().split('T')[0];
        driverForm.elements.Championships.value = driver.Championships || 0;
        
        isEditMode = true;
        editDriverId = driver.Driver_ID;
        formTitle.textContent = `Edit Driver (ID: ${driver.Driver_ID})`;
        formSubmitBtn.textContent = "Update Driver";
        formCancelBtn.style.display = 'inline-block';
        
        driverForm.scrollIntoView({ behavior: 'smooth' });
    }
}

async function deleteDriver(id) {
    try {
        const response = await fetch(`${API_URL}/api/drivers/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'API request failed');
        }
        
        showSuccessMessage('Driver deleted successfully!');
        loadAdminPage();
        
        // Refresh main data
        appDataLoaded = false;
        loadAllApplicationData();
        
    } catch (error) {
        console.error("Error deleting driver:", error);
        alert(`Error: ${error.message}`);
    }
}

function resetForm() {
    driverForm.reset();
    isEditMode = false;
    editDriverId = null;
    formTitle.textContent = "Add New Driver";
    formSubmitBtn.textContent = "Add Driver";
    formCancelBtn.style.display = 'none';
}
