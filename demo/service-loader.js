import { db } from '../erp/js/firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function loadDynamicTemplate() {
    const urlParams = new URLSearchParams(window.location.search);
    const demoId = urlParams.get('id');
    const serviceIndex = urlParams.get('serviceIndex');

    if (!demoId || serviceIndex === null) {
        document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; text-align:center; padding:20px;"><h2>Demo Link Missing</h2><p>Please provide a valid Demo ID and Service Index in the URL.</p></div>';
        return;
    }

    try {
        const docRef = doc(db, 'demos', demoId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; text-align:center; padding:20px;"><h2>Demo Not Found</h2><p>This demo link has expired or never existed.</p></div>';
            return;
        }

        const data = docSnap.data();
        applyServiceData(data, parseInt(serviceIndex));

        // Remove the loading overlay once done
        const loader = document.getElementById('demo-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }

    } catch (error) {
        console.error("Error fetching demo data:", error);
        alert("Failed to load demo data.");
    }
}

function applyServiceData(data, index) {
    // 1. Update Global Metadata & CSS
    if (data.clinicName) {
        document.querySelectorAll('.demo-clinic-name').forEach(el => el.textContent = data.clinicName);
    }

    const root = document.documentElement;
    if (data.primaryColor) {
        root.style.setProperty('--color-primary', data.primaryColor);
        root.style.setProperty('--color-primary-dark', shadeColor(data.primaryColor, -20));
    }
    if (data.secondaryColor) root.style.setProperty('--color-secondary', data.secondaryColor);
    if (data.bgColor) root.style.setProperty('--color-bg', data.bgColor);
    if (data.btnRadius !== undefined) root.style.setProperty('--radius-btn', `${data.btnRadius}px`);
    if (data.cardRadius !== undefined) root.style.setProperty('--radius-card', `${data.cardRadius}px`);
    if (data.imgRadius !== undefined) root.style.setProperty('--radius-img', `${data.imgRadius}px`);

    if (data.logoUrl) {
        document.querySelectorAll('.demo-logo').forEach(img => {
            img.src = data.logoUrl;
            img.style.display = 'block';
        });
    }

    // Contact info
    if (data.phone) {
        document.querySelectorAll('.demo-phone').forEach(el => el.textContent = data.phone);
        document.querySelectorAll('.demo-phone-href').forEach(el => el.href = `tel:${data.phone.replace(/[^0-9+]/g, '')}`);
    }
    if (data.email) {
        document.querySelectorAll('.demo-email').forEach(el => {
            if (el.tagName.toLowerCase() === 'a') el.href = `mailto:${data.email}`;
            el.textContent = data.email;
        });
    }

    // 2. Validate and Inject Selected Service
    const service = data.services ? data.services[index] : null;

    if (!service) {
        document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; text-align:center; padding:20px;"><h2>Service Not Found</h2><p>This service does not exist in the current configuration.</p></div>';
        return;
    }

    document.title = `${service.title} | ${data.clinicName || 'Premium Clinic'}`;

    const titleEl = document.getElementById('service-detail-title');
    const imgEl = document.getElementById('service-detail-image');
    const descEl = document.getElementById('service-detail-description');

    if (titleEl) titleEl.textContent = service.title;
    if (imgEl) imgEl.src = service.image;

    if (descEl && service.description) {
        descEl.innerHTML = service.description.split('\n')
            .filter(p => p.trim() !== '')
            .map(p => `<p style="margin-bottom: 1rem;">${p}</p>`)
            .join('');
    } else if (descEl) {
        descEl.innerHTML = '<p>No description provided for this service.</p>';
    }

    // 3. Update "Back to Home" Link
    const backBtn = document.getElementById('back-home-btn');
    if (backBtn) backBtn.href = `index.html?id=${data.id || new URLSearchParams(window.location.search).get('id')}`;
}

// Utility: Darken Hex Color
function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    R = Math.round(R);
    G = Math.round(G);
    B = Math.round(B);

    let RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
    let GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
    let BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

// Start sequence
document.addEventListener('DOMContentLoaded', loadDynamicTemplate);
