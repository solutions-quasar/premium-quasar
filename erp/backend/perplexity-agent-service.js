/**
 * Solutions Quasar Inc. - Perplexity Agent API Service
 * 
 * Provides web-grounded AI agent capabilities powered by Perplexity Agent API
 * Endpoint: POST https://api.perplexity.ai/v1/agent
 * 
 * Uses official @perplexity-ai/perplexity_ai SDK with direct Axios fallback.
 * Strictly resolves API key from PERPLEXITY_API_KEY environment variable.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const axios = require('axios');

class PerplexityAgentService {
    constructor() {
        this.client = null;
        this.sdkLoadPromise = null;
    }

    /**
     * Check if PERPLEXITY_API_KEY is configured
     */
    isConfigured() {
        return Boolean(process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY.trim() !== '');
    }

    /**
     * Lazy-load the official @perplexity-ai/perplexity_ai SDK
     */
    async _getClient() {
        if (!this.isConfigured()) {
            throw new Error('PERPLEXITY_API_KEY environment variable is not set. Please set it in your environment or .env file.');
        }

        if (this.client) return this.client;

        if (!this.sdkLoadPromise) {
            this.sdkLoadPromise = (async () => {
                try {
                    const sdkEntry = path.join(__dirname, 'node_modules/@perplexity-ai/perplexity_ai/dist/index.js');
                    const sdkUrl = pathToFileURL(sdkEntry).href;
                    const { default: Perplexity } = await import(sdkUrl);
                    this.client = new Perplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
                    return this.client;
                } catch (err) {
                    console.warn('[PerplexityAgentService] SDK import note (using direct HTTPS agent endpoint):', err.message);
                    return null;
                }
            })();
        }

        return this.sdkLoadPromise;
    }

    /**
     * Core Agent Run method using Perplexity Agent API (POST /v1/agent)
     * 
     * @param {Object} options
     * @param {string|Array} options.input - Prompt or messages array
     * @param {string} [options.preset="low"] - Presets: 'fast' | 'low' | 'medium' | 'high' | 'xhigh'
     * @param {string} [options.model] - Optional model (e.g. 'openai/gpt-5.6-sol')
     * @param {Array} [options.tools] - Tools (e.g. [{ type: "web_search" }])
     * @param {string} [options.instructions] - System prompt / instructions
     * @param {Object} [options.response_format] - Structured output schema (json_schema)
     * @param {string} [options.previous_response_id] - For multi-turn conversations
     */
    async runAgent(options = {}) {
        if (!this.isConfigured()) {
            throw new Error('PERPLEXITY_API_KEY is required but not configured.');
        }

        const input = options.input;
        if (!input) {
            throw new Error('Missing required parameter: input');
        }

        const preset = options.preset || 'low';
        const requestPayload = {
            input,
            preset
        };

        if (options.model) requestPayload.model = options.model;
        if (options.tools) requestPayload.tools = options.tools;
        if (options.instructions) requestPayload.instructions = options.instructions;
        if (options.response_format) requestPayload.response_format = options.response_format;
        if (options.previous_response_id) requestPayload.previous_response_id = options.previous_response_id;

        // Try using official SDK first
        try {
            const client = await this._getClient();
            if (client && client.responses && typeof client.responses.create === 'function') {
                const sdkResp = await client.responses.create(requestPayload);
                return this._formatResponse(sdkResp);
            }
        } catch (sdkErr) {
            console.warn('[PerplexityAgentService] SDK call error, falling back to direct HTTPS:', sdkErr.message);
            // Handle rate-limits
            if (sdkErr.status === 429) {
                const retryAfter = sdkErr.headers?.['retry-after'];
                throw new Error(`Perplexity API rate limit exceeded (429). Retry-After: ${retryAfter || 'wait a few moments'}`);
            }
        }

        // Direct HTTP call fallback (POST https://api.perplexity.ai/v1/agent)
        try {
            const resp = await axios.post('https://api.perplexity.ai/v1/agent', requestPayload, {
                headers: {
                    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return this._formatResponse(resp.data);
        } catch (httpErr) {
            if (httpErr.response) {
                const status = httpErr.response.status;
                const data = httpErr.response.data;
                if (status === 401) {
                    throw new Error('Perplexity API authentication failed (401). Please verify your PERPLEXITY_API_KEY.');
                }
                if (status === 429) {
                    const retryAfter = httpErr.response.headers?.['retry-after'];
                    throw new Error(`Perplexity API rate limited (429). Retry-After: ${retryAfter || '60s'}`);
                }
                throw new Error(`Perplexity Agent API error (${status}): ${JSON.stringify(data)}`);
            }
            throw httpErr;
        }
    }

    /**
     * Standardize response fields
     */
    _formatResponse(resp) {
        // output_text convenience accessor
        let outputText = resp.output_text || '';
        const searchResults = [];
        const citations = [];

        if (Array.isArray(resp.output)) {
            for (const item of resp.output) {
                // If output_text not set on root, collect from content
                if (!outputText && item.content) {
                    for (const c of item.content) {
                        if (c.text) outputText += c.text;
                        if (Array.isArray(c.annotations)) {
                            for (const ann of c.annotations) {
                                if (ann.url) citations.push(ann.url);
                            }
                        }
                    }
                }
                // Search results with metadata
                if (Array.isArray(item.results)) {
                    for (const res of item.results) {
                        searchResults.push({
                            title: res.title || '',
                            url: res.url || '',
                            snippet: res.snippet || '',
                            date: res.date || null
                        });
                    }
                }
            }
        }

        return {
            id: resp.id || null,
            model: resp.model || null,
            output_text: outputText,
            search_results: searchResults,
            citations: Array.from(new Set(citations)),
            usage: resp.usage || null,
            raw: resp
        };
    }

    /**
     * Specialized Decision Maker Search for B2B Leads
     * 
     * Uses Perplexity web grounding to find the Owner / Founder / CEO / Director
     */
    async findDecisionMaker({ businessName, city = '', provinceState = '', websiteUrl = '' }) {
        if (!businessName || typeof businessName !== 'string' || businessName.trim() === '') {
            return {
                success: false,
                reason: 'NO_BUSINESS_NAME',
                decision_maker: null
            };
        }

        const prompt = `Recherche web approfondie en temps réel pour identifier le dirigeant ou propriétaire (Decision Maker) de cette entreprise :
Entreprise : ${businessName.trim()}
Ville : ${city || 'Inconnue'}
Province/État : ${provinceState || 'Inconnue'}
Site Web Officiel : ${websiteUrl || 'Inconnu'}

Objectif :
1. Trouve le nom et prénom du dirigeant principal (Propriétaire, Fondateur, Président, CEO, Directeur Général, Médecin-Chef / Associé principal).
2. Trouve son titre exact.
3. Trouve son profil LinkedIn (si disponible publiquement).
4. Trouve son email professionnel direct (ou email officiel).
5. Trouve son numéro direct (si disponible).
6. Fournis un résumé en 1 phrase indiquant la source où l'information a été confirmée (ex: Registraire des entreprises, page équipe, article de presse, LinkedIn).

Réponds OBLIGATOIREMENT sous forme d'un objet JSON strict valide respectant ce schéma exact (aucun texte autour) :
{
  "found": true | false,
  "dm_name": "Prénom Nom" ou null,
  "dm_title": "Titre professionnel" ou null,
  "dm_email": "email" ou null,
  "dm_phone": "phone" ou null,
  "dm_linkedin": "https://linkedin.com/in/..." ou null,
  "confidence": "high" | "medium" | "low",
  "source_summary": "Explication de la source..."
}`;

        try {
            console.log(`[PerplexityAgentService] Finding Decision Maker for "${businessName}" in "${city}"...`);
            const agentResp = await this.runAgent({
                preset: 'low',
                input: prompt,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "decision_maker_discovery",
                        schema: {
                            type: "object",
                            properties: {
                                found: { type: "boolean" },
                                dm_name: { type: ["string", "null"] },
                                dm_title: { type: ["string", "null"] },
                                dm_email: { type: ["string", "null"] },
                                dm_phone: { type: ["string", "null"] },
                                dm_linkedin: { type: ["string", "null"] },
                                confidence: { type: "string", enum: ["high", "medium", "low"] },
                                source_summary: { type: "string" }
                            },
                            required: ["found", "dm_name", "confidence"]
                        }
                    }
                }
            });

            let parsed = null;
            try {
                parsed = JSON.parse(agentResp.output_text);
            } catch (jsonErr) {
                // Fallback regex extraction if model returned wrapped markdown
                const match = agentResp.output_text.match(/\{[\s\S]*\}/);
                if (match) {
                    parsed = JSON.parse(match[0]);
                }
            }

            if (!parsed) {
                return {
                    success: false,
                    reason: 'INVALID_JSON_RESPONSE',
                    raw_text: agentResp.output_text
                };
            }

            // Normalise fields
            const isFound = Boolean(parsed.found && parsed.dm_name && !/inconnu|unknown|aucun/i.test(parsed.dm_name));

            return {
                success: true,
                found: isFound,
                dm_name: isFound ? parsed.dm_name.trim() : null,
                dm_title: isFound ? (parsed.dm_title || 'Dirigeant') : null,
                dm_email: parsed.dm_email || null,
                dm_phone: parsed.dm_phone || null,
                dm_linkedin: parsed.dm_linkedin || null,
                confidence: parsed.confidence || 'medium',
                source_summary: parsed.source_summary || '',
                sources: agentResp.search_results.slice(0, 5),
                model_used: agentResp.model,
                response_id: agentResp.id
            };
        } catch (err) {
            console.error('[PerplexityAgentService] Error finding Decision Maker:', err.message);
            return {
                success: false,
                reason: err.message,
                decision_maker: null
            };
        }
    }
}

module.exports = new PerplexityAgentService();
