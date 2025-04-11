import OpenAI from 'openai';

export const openai = new OpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: `${process.env['OPENROUTER_API_KEY']}`,
	// defaultHeaders: {
	// 	'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
	// 	'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
	// },
});
