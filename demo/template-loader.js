import { db } from '../erp/js/firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function loadDynamicTemplate() {
    const urlParams = new URLSearchParams(window.location.search);
    const demoId = urlParams.get('id');

    if (!demoId) {
        document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; text-align:center; padding:20px;"><h2>Demo Link Missing</h2><p>Please provide a valid Demo ID in the URL (?id=...).</p></div>';
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
        applyDemoData(data);

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

function applyDemoData(data) {
    // 1. Update Title and Metadata
    if (data.clinicName) {
        document.title = `${data.clinicName} | Premium Aesthetics Demo`;
        document.querySelectorAll('.demo-clinic-name').forEach(el => el.textContent = data.clinicName);
    }

    // 2. Inject CSS Variables
    const root = document.documentElement;
    if (data.primaryColor) root.style.setProperty('--color-primary', data.primaryColor);
    if (data.secondaryColor) root.style.setProperty('--color-secondary', data.secondaryColor);

    // Auto-generate darker hex for hover states
    if (data.primaryColor) {
        root.style.setProperty('--color-primary-dark', shadeColor(data.primaryColor, -20));
    }

    if (data.bgColor) {
        root.style.setProperty('--color-bg', data.bgColor);
    }

    if (data.btnRadius !== undefined) root.style.setProperty('--radius-btn', `${data.btnRadius}px`);
    if (data.cardRadius !== undefined) root.style.setProperty('--radius-card', `${data.cardRadius}px`);
    if (data.imgRadius !== undefined) root.style.setProperty('--radius-img', `${data.imgRadius}px`);

    // 3. Apply Theme Structure (Full Hero vs 50/50 Split)
    const heroSplitEl = document.querySelector('.hero-split');
    if (heroSplitEl) {
        if (data.theme === 'full') {
            heroSplitEl.classList.add('theme-full');
        } else {
            heroSplitEl.classList.remove('theme-full');
        }
    }

    // 4. Update Images/Logos
    if (data.logoUrl) {
        document.querySelectorAll('.demo-logo').forEach(img => {
            img.src = data.logoUrl;
            img.style.display = 'block';
        });
    }
    if (data.heroImage) {
        document.querySelectorAll('.demo-hero-image').forEach(img => {
            img.src = data.heroImage;
            img.style.display = 'block';
        });
    }
    if (data.aboutImage) {
        document.querySelectorAll('.demo-about-image').forEach(img => {
            img.src = data.aboutImage;
            img.style.display = 'block';
        });
    }

    // 5. Update Contact Info & Copy
    if (data.email) {
        document.querySelectorAll('.demo-email').forEach(el => {
            if (el.tagName.toLowerCase() === 'a') el.href = `mailto:${data.email}`;
            el.textContent = data.email;
        });
    }
    if (data.phone) {
        document.querySelectorAll('.demo-phone').forEach(el => el.textContent = data.phone);
        document.querySelectorAll('.demo-phone-href').forEach(el => {
            const cleanPhone = data.phone.replace(/[^0-9+]/g, '');
            el.href = `tel:${cleanPhone}`;
        });
    }
    if (data.address) {
        document.querySelectorAll('.demo-address').forEach(el => el.textContent = data.address);
        document.querySelectorAll('.demo-itinerary-btn').forEach(el => el.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.address)}`);
    }
    if (data.heroHeadline) document.querySelectorAll('.demo-hero-headline').forEach(el => el.textContent = data.heroHeadline);
    if (data.heroSubhead) document.querySelectorAll('.demo-hero-subhead').forEach(el => el.textContent = data.heroSubhead);
    if (data.heroCta) document.querySelectorAll('.demo-hero-cta').forEach(el => el.textContent = data.heroCta);

    // 6. Update About Section Text
    if (data.aboutText) {
        document.querySelectorAll('#demo-about-text').forEach(el => {
            el.innerHTML = data.aboutText.split('\n')
                .filter(p => p.trim() !== '')
                .map(p => `<p>${p}</p>`)
                .join('');
        });
    }


    // 5b. Update Map
    const mapContainer = document.querySelector('.demo-embed-map-container');
    if (mapContainer) {
        if (data.embedMap) {
            mapContainer.innerHTML = data.embedMap;
        } else if (data.address) {
            // Auto generate map from address if embed not provided
            mapContainer.innerHTML = `<iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=100%25&amp;height=100%25&amp;hl=en&amp;q=${encodeURIComponent(data.address)}&amp;t=&amp;z=14&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"></iframe>`;
        }
    }

    // 6. Inject Dynamic Services
    if (data.services && data.services.length > 0) {
        const servicesGrid = document.querySelector('.services-grid');
        const serviceSelect = document.querySelector('.demo-service-select');

        if (servicesGrid) {
            servicesGrid.innerHTML = data.services.map((service, index) => {
                // Fallback images if not provided
                const imgNum = (index % 3) + 1;
                const imgSrc = service.image || `assets/images/service_${imgNum}.png`;
                return `
                <article class="service-card">
                    <div class="card-image">
                        <img src="${imgSrc}" alt="${service.title}">
                    </div>
                    <div class="card-content">
                        <h3>${service.title}</h3>
                        <p>Premium aesthetic solution tailored for your exact needs.</p>
                        <a href="service-detail.html?id=${data.id || new URLSearchParams(window.location.search).get('id')}&serviceIndex=${index}" class="text-link">Learn More</a>
                    </div>
                </article>
                `;
            }).join('');
        }

        if (serviceSelect) {
            serviceSelect.innerHTML = `<option value="">Select a service...</option>` +
                data.services.map(s => `<option value="${s.title}">${s.title}</option>`).join('');
        }
    }

    // 7. Inject Dynamic Gallery
    if (data.gallery && data.gallery.length > 0) {
        const gallerySection = document.getElementById('gallery');
        const galleryTitle = document.getElementById('demo-template-gallery-title');
        const galleryGrid = document.getElementById('demo-template-gallery');

        if (gallerySection) gallerySection.style.display = 'block';
        if (galleryTitle && data.clinicName) galleryTitle.textContent = `The ${data.clinicName} Experience`;

        if (galleryGrid) {
            galleryGrid.innerHTML = data.gallery.map((imgUrl, index) => {
                const largeClass = (index === 0) ? ' large' : '';
                return `
                        <div class="gallery-item${largeClass}" onclick="openGalleryModal('${imgUrl}')" style="cursor: pointer;">
                            <img src="${imgUrl}" alt="${data.clinicName} Gallery Image ${index + 1}" style="transition: transform 0.3s ease;">
                        </div>
                        `;
            }).join('');
        }
    }

    // 8. Inject Dynamic Reviews
    if (data.reviews && data.reviews.length > 0) {
        const reviewsSection = document.getElementById('reviews');
        const reviewsSlider = document.getElementById('demo-template-reviews');

        if (reviewsSection && reviewsSlider) {
            reviewsSection.style.display = 'block';
            reviewsSlider.innerHTML = data.reviews.map(r => `
                <div class="review-card text-center">
                    <div class="stars">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
                    <blockquote>"${r.quote}"</blockquote>
                    <cite>- ${r.author}${r.role ? ', ' + r.role : ''}</cite>
                </div>
            `).join('');
        }
    }

    // 9. Set up Booking Form listener
    setupBookingForm(data.id || new URLSearchParams(window.location.search).get('id'), data);
}

function setupBookingForm(demoId, demoData) {
    const form = document.getElementById('demo-lead-form');
    if (!form) return;

    // Set footer ERP link
    const erpLink = document.getElementById('footer-erp-link');
    if (erpLink) {
        erpLink.href = `/demo/erp.html?id=${demoId}`;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('demo-booking-submit-btn');
        const originalText = submitBtn.innerText;
        submitBtn.innerHTML = '<span class="material-icons rotating">sync</span> Processing...';
        submitBtn.disabled = true;

        try {
            const formData = {
                firstName: document.getElementById('demo-lead-first-name').value,
                lastName: document.getElementById('demo-lead-last-name').value,
                email: document.getElementById('demo-lead-email').value,
                phone: document.getElementById('demo-lead-phone').value,
                service: document.getElementById('demo-lead-service').value,
                message: document.getElementById('demo-lead-message').value,
                status: 'NEW',
                createdAt: serverTimestamp()
            };

            // Save to Firestore
            await addDoc(collection(db, 'demos', demoId, 'mockup_appointments'), formData);

            // Trigger Mockup Email
            await sendMockupEmail(formData, demoData);

            // Show Success UI
            document.getElementById('booking-step-1').style.display = 'none';
            document.getElementById('booking-success-state').style.display = 'block';

            // Set ERP View link
            document.getElementById('view-in-erp-btn').href = `/demo/erp.html?id=${demoId}`;

        } catch (error) {
            console.error("Error submitting booking:", error);
            alert("There was an error processing your request. Please try again.");
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function sendMockupEmail(bookingData, demoData) {
    try {
        const response = await fetch('/api/emails/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: bookingData.email,
                subject: `Booking Confirmation - ${demoData.clinicName}`,
                html: generateMockupEmailHtml(bookingData, demoData)
            })
        });

        if (!response.ok) {
            console.error("Failed to send mockup email.");
        }
    } catch (e) {
        console.error("Mockup email sending error:", e);
    }
}

function generateMockupEmailHtml(bookingData, demoData) {
    const primaryColor = demoData.primaryColor || '#B5A18C';

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background-color: ${primaryColor}; padding: 30px 20px; text-align: center;">
                ${demoData.logoUrl ? `<img src="${demoData.logoUrl}" alt="${demoData.clinicName} Logo" style="max-height: 60px; max-width: 200px; filter: brightness(0) invert(1);">` : `<h1 style="color: #ffffff; margin: 0;">${demoData.clinicName}</h1>`}
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
                <h2 style="color: #333333; margin-top: 0;">Booking Confirmed!</h2>
                <p style="color: #666666; font-size: 16px; line-height: 1.6;">Hello ${bookingData.firstName},</p>
                <p style="color: #666666; font-size: 16px; line-height: 1.6;">Your booking request for <strong>${bookingData.service}</strong> at ${demoData.clinicName} has been received successfully.</p>
                
                <div style="background-color: #f5f5f5; border-left: 4px solid ${primaryColor}; padding: 15px; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; color: #444444;"><strong>Details:</strong></p>
                    <ul style="margin: 0; padding-left: 20px; color: #666666;">
                        <li><strong>Name:</strong> ${bookingData.firstName} ${bookingData.lastName}</li>
                        <li><strong>Service:</strong> ${bookingData.service}</li>
                        <li><strong>Phone:</strong> ${bookingData.phone}</li>
                    </ul>
                </div>
                
                <p style="color: #666666; font-size: 16px; line-height: 1.6;">Our team will review your request and contact you shortly to confirm the exact date and time.</p>
                
                <div style="text-align: center; margin-top: 40px;">
                    <a href="https://${window.location.host}/demo?id=${new URLSearchParams(window.location.search).get('id')}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Return to Website</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #eeeeee; padding: 20px; text-align: center; font-size: 12px; color: #888888;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${demoData.clinicName}. All rights reserved.</p>
                ${demoData.address ? `<p style="margin: 5px 0 0 0;">${demoData.address}</p>` : ''}
            </div>
        </div>
    </div>`;
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
