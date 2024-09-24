import { OpenAI } from 'openai';
import * as cheerio from 'cheerio';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

interface EnvVars {
	OPENAI_API_KEY: string;
	JOBINATOR: KVNamespace;
}

const getJobDescriptionFromUrl = async (url: URL) => {
	const jobPage = await fetch(url);
	const jobHtml = await jobPage.text();
	const $ = cheerio.load(jobHtml);

	switch (url.hostname) {
		case 'jobs.careers.microsoft.com':
			// Microsoft JDs are in a div with 3 div children
			// select the parent div
			return $('div.ms-DocumentCard')
				.filter(function () {
					return $(this).children('div').length === 3;
				})
				.text();
		default:
			return $('.job__description').text();
	}
};

async function markdownToHTML(markdown: string) {
	try {
		const file = await unified()
			.use(remarkParse) // Parse markdown
			.use(remarkRehype) // Convert markdown AST to HTML AST
			.use(rehypeStringify) // Convert HTML AST to HTML string
			.process(markdown); // Process the input markdown

		return file.toString(); // Return the HTML as string
	} catch (error) {
		console.error('Error processing markdown:', error);
		throw new Error('Failed to convert markdown to HTML');
	}
}

interface Env extends EnvVars {}

export default {
	async fetch(request, env: Env, ctx): Promise<Response> {
		const requestURL = new URL(request.url);

		if (requestURL.pathname === '/recommendations') {
			if (!requestURL.searchParams.has('url')) {
				return new Response('Hello World!');
			}
			const jobDescription = await getJobDescriptionFromUrl(new URL(decodeURIComponent(requestURL.searchParams.get('url') as string)));
			const openai = new OpenAI({
				apiKey: env.OPENAI_API_KEY,
			});
			const resume = await env.JOBINATOR.get('resume');
			const everything = await env.JOBINATOR.get('everything');

			const modelResponse = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content:
							"Your task is to suggest additions or substitutions *for each section* in the user's resume, picked from the longer reference document *only*, in order to align the resume with the job application. \
							For each section of the resume, please provide a bulleted list of additions, followed by substitutions, if any, and don't repeat a suggestion. Please don't change the contents of any bullet points! \
							You may also provide a brief explanation for each suggestion in parentheses in each bullet point. In a final section, suggest improvements to grammar/framing/action verbs, etc.",
					},
					{
						role: 'user',
						content: `\n\nResume:\n\n${resume}`,
					},
					{
						role: 'user',
						content: `\n\nJob Description:\n\n${jobDescription}`,
					},
					{
						role: 'user',
						content: `\n\nReference Document:\n\n${everything}`,
					},
				],
				stream: false,
			});
			const modelResponseHTML = await markdownToHTML(modelResponse.choices[0].message.content as string);

			return new Response(modelResponseHTML, {
				headers: {
					'Content-Type': 'text/html',
				},
			});
		}

		return new Response('Hello, World!', { status: 200 });
	},
} satisfies ExportedHandler<Env>;
