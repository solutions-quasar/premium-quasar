export class LeadFilterService {
    static CANADA_REGIONS = {
        'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick', 'NL': 'Newfoundland',
        'NS': 'Nova Scotia', 'ON': 'Ontario', 'PE': 'Prince Edward Island', 'QC': 'Quebec', 'SK': 'Saskatchewan',
        'NT': 'Northwest Territories', 'NU': 'Nunavut', 'YT': 'Yukon'
    };

    static USA_REGIONS = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado',
        'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
        'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
        'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
        'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
    };

    /**
     * Extracts unique values for search filters from a list of leads
     * @param {Array} leads 
     * @returns {Object} { industries: [], regions: { canada: [], usa: [] }, painPoints: [] }
     */
    static getFilterOptions(leads) {
        const industries = new Set();
        const detectedRegions = new Set();

        const painPointsMap = {
            'NO_WEBSITE': 'No Website',
            'BAD_DESIGN': 'Bad Design/UX',
            'BAD_SEO': 'Weak SEO/Visibility',
            'SLOW_SPEED': 'Slow Load Speed',
            'MISSING_SSL': 'Not Secure (No SSL)',
            'OTHER': 'Other Issues'
        };

        leads.forEach(lead => {
            if (lead.category) industries.add(lead.category);
            const region = this.extractRegion(lead);
            if (region && region !== 'UNKNOWN') {
                detectedRegions.add(region);
            }
        });

        // We provide full lists, but we'll flag if it has leads for potential UI styling
        const canada = Object.entries(this.CANADA_REGIONS).map(([code, name]) => ({
            key: code,
            label: code,
            hasLeads: detectedRegions.has(code)
        })).sort((a, b) => a.key.localeCompare(b.key));

        const usa = Object.entries(this.USA_REGIONS).map(([code, name]) => ({
            key: code,
            label: code,
            hasLeads: detectedRegions.has(code)
        })).sort((a, b) => a.key.localeCompare(b.key));

        return {
            industries: Array.from(industries).sort(),
            regions: { canada, usa },
            painPoints: Object.entries(painPointsMap).map(([key, label]) => ({ key, label }))
        };
    }

    /**
     * Filter leads based on criteria
     * @param {Array} leads 
     * @param {Object} criteria { industry, region, painPoint }
     * @returns {Array} filtered leads
     */
    static filterLeads(leads, criteria) {
        return leads.filter(lead => {
            if (criteria.industry && criteria.industry !== 'ALL') {
                if (lead.category !== criteria.industry) return false;
            }
            if (criteria.region && criteria.region !== 'ALL') {
                const leadRegion = this.extractRegion(lead);
                if (leadRegion !== criteria.region) return false;
            }
            if (criteria.painPoint && criteria.painPoint !== 'ALL') {
                const pain = lead.pain_signals || [];
                if (!pain.includes(criteria.painPoint)) return false;
            }
            return true;
        });
    }

    static extractRegion(lead) {
        let raw = '';
        if (lead.state) raw = lead.state;
        else if (lead.city && lead.city.includes(',')) {
            const parts = lead.city.split(',');
            raw = parts[parts.length - 1].trim();
        } else if (lead.city) {
            const parts = lead.city.split(' ');
            if (parts.length > 1) {
                raw = parts[parts.length - 1].trim();
            }
        }

        if (!raw) return 'UNKNOWN';
        const clean = raw.toUpperCase().replace(/\./g, '');

        // Reverse lookup
        for (const [code, name] of Object.entries(this.CANADA_REGIONS)) {
            if (clean === code || clean === name.toUpperCase()) return code;
        }
        for (const [code, name] of Object.entries(this.USA_REGIONS)) {
            if (clean === code || clean === name.toUpperCase()) return code;
        }

        return clean.length === 2 ? clean : 'UNKNOWN';
    }
}
