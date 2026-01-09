export class LeadFilterService {
    /**
     * Extracts unique values for search filters from a list of leads
     * @param {Array} leads 
     * @returns {Object} { industries: [], provinces: [], painPoints: [] }
     */
    static getFilterOptions(leads) {
        const industries = new Set();
        const provinces = new Set();

        // Define standard pain points mapping
        const painPointsMap = {
            'NO_WEBSITE': 'No Website',
            'BAD_DESIGN': 'Bad Design/UX',
            'BAD_SEO': 'Weak SEO/Visibility',
            'SLOW_SPEED': 'Slow Load Speed',
            'MISSING_SSL': 'Not Secure (No SSL)',
            'OTHER': 'Other Issues'
        };

        leads.forEach(lead => {
            // Industry
            if (lead.category) industries.add(lead.category);

            // Province (Parse from 'City, PV')
            if (lead.city && lead.city.includes(',')) {
                const parts = lead.city.split(',');
                const prov = parts[parts.length - 1].trim();
                if (prov.length === 2) provinces.add(prov.toUpperCase());
            } else if (lead.state) {
                // Fallback for some data models
                provinces.add(lead.state);
            }
        });

        // Always return sorted lists
        return {
            industries: Array.from(industries).sort(),
            provinces: Array.from(provinces).sort(),
            painPoints: Object.entries(painPointsMap).map(([key, label]) => ({ key, label }))
        };
    }

    /**
     * Filter leads based on criteria
     * @param {Array} leads 
     * @param {Object} criteria { industry, province, painPoint }
     * @returns {Array} filtered leads
     */
    static filterLeads(leads, criteria) {
        return leads.filter(lead => {
            // 1. Industry (Exact Match)
            if (criteria.industry && criteria.industry !== 'ALL') {
                if (lead.category !== criteria.industry) return false;
            }

            // 2. Province (Suffix Match)
            if (criteria.province && criteria.province !== 'ALL') {
                const leadProv = this.extractProvince(lead);
                if (leadProv !== criteria.province) return false;
            }

            // 3. Pain Point (Array Contains)
            if (criteria.painPoint && criteria.painPoint !== 'ALL') {
                const pain = lead.pain_signals || [];
                if (!pain.includes(criteria.painPoint)) return false;
            }

            return true;
        });
    }

    static extractProvince(lead) {
        if (lead.city && lead.city.includes(',')) {
            const parts = lead.city.split(',');
            return parts[parts.length - 1].trim().toUpperCase();
        }
        return 'UNKNOWN';
    }
}
