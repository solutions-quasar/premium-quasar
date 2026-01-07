export async function initAccount() {
    console.log('Initializing Account Module...');

    // Load User Data (Mock or LocalStorage)
    let user = JSON.parse(localStorage.getItem('quasar_user')) || {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@quasar.com',
        role: 'Super Admin'
    };

    const container = document.getElementById('view-account');
    container.innerHTML = `
        <div class="text-h text-gold mb-4">My Account</div>
        
        <div style="display:grid; grid-template-columns: 250px 1fr; gap:2rem;">
            <!-- Profile Card -->
            <div class="card text-center" style="height:fit-content;">
                <div style="width:100px; height:100px; background:var(--bg-dark); border-radius:50%; margin:0 auto 1rem auto; display:flex; align-items:center; justify-content:center; border:2px solid var(--gold); font-size:2rem; color:var(--gold);">
                    ${user.firstName[0]}${user.lastName[0]}
                </div>
                <div class="text-h" style="font-size:1.1rem;">${user.firstName} ${user.lastName}</div>
                <div class="text-muted text-sm mb-3">${user.role}</div>
                <button class="btn btn-sm btn-block" style="border-color:var(--gold); color:var(--gold);">Change Avatar</button>
            </div>

            <!-- Settings Form -->
            <div class="card">
                <div class="text-h text-sm uppercase text-muted mb-4">Personal Information</div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <div class="form-group">
                        <label class="form-label">First Name</label>
                        <input type="text" id="acc-firstname" class="form-input" value="${user.firstName}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Last Name</label>
                        <input type="text" id="acc-lastname" class="form-input" value="${user.lastName}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" id="acc-email" class="form-input" value="${user.email}">
                </div>

                <div class="divider" style="margin:2rem 0; border-top:1px solid var(--border);"></div>

                <div class="text-h text-sm uppercase text-muted mb-4">Security</div>

                <div class="form-group">
                    <label class="form-label">New Password</label>
                    <input type="password" id="acc-password" class="form-input" placeholder="Leave blank to keep current">
                </div>

                <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input type="password" id="acc-confirm-pass" class="form-input" placeholder="Confirm new password">
                </div>

                <div style="margin-top:2rem; display:flex; gap:10px; justify-content:flex-end;">
                    <button class="btn" onclick="location.hash='#dashboard'">Cancel</button>
                    <button class="btn btn-primary" onclick="saveAccountSettings()">Save Changes</button>
                </div>
            </div>
        </div>
    `;
}

window.saveAccountSettings = () => {
    const fname = document.getElementById('acc-firstname').value;
    const lname = document.getElementById('acc-lastname').value;
    const email = document.getElementById('acc-email').value;
    const pass = document.getElementById('acc-password').value;
    const confirmPass = document.getElementById('acc-confirm-pass').value;

    if (pass && pass !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }

    const updatedUser = {
        firstName: fname,
        lastName: lname,
        email: email,
        role: 'Super Admin' // Keep role static for now
    };

    localStorage.setItem('quasar_user', JSON.stringify(updatedUser));

    // Update sidebar immediately if possible, or just reload to reflect
    alert("Profile Updated Successfully!");
    location.reload();
};
