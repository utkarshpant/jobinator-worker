import openai, { OpenAI } from 'openai';

interface EnvVars {
	OPENAI_API_KEY: string;
	JOBINATOR: KVNamespace;
}

interface Env extends EnvVars {}

export default {
	async fetch(request, env: Env, ctx): Promise<Response> {
		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
		});
		const resume = await env.JOBINATOR.get('resume');
		console.log({
			role: 'user',
			content: `Resume:\n\n${resume}`
		});
		const modelResponse = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: "You're a knowledgeable recruiter in the tech industry in the US. The user is a software engineer looking for a job and would like a resume review. The resume is provided in stringified JSON - please analyse it and rate it from 1 to 10, and provide feedback for improvement. Since the input is stringified JSON, offer a qualitative analysis of the resume's content and structure only."
				},
				{
					role: 'user',
					content: `Resume:\n\n${resume}`
				}
			]
		})

		return new Response(modelResponse.choices[0].message.content);
	},
} satisfies ExportedHandler<Env>;
