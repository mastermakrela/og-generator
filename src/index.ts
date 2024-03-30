export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	FONTS: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

type ImageRequest = {
	height: number;
	width: number;
	html: string;
};

import { Buffer } from 'node:buffer';
import { html as toReactNode } from 'satori-html';
import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

const fonts = [
	{
		name: 'Noto Serif',
		files: [
			{ name: 'Noto Serif', data: 'Noto_Serif/static/NotoSerif-Regular.ttf', style: 'normal', weight: 400 },
			{ name: 'Noto Serif', data: 'Noto_Serif/static/NotoSerif-Bold.ttf', style: 'normal', weight: 700 },
		],
	},
	{
		name: 'Comfortaa',
		files: [{ name: 'Comfortaa', data: 'Comfortaa/static/Comfortaa-Regular.ttf', style: 'normal', weight: 400 }],
	},
];

async function prepare_fonts(env: Env, html: string) {
	const _fonts = fonts
		.filter((font) => html.includes(font.name))
		.flatMap((font) => font.files)
		.map(async (file) => {
			const data = await env.FONTS.get(file.data).then((res) => res?.arrayBuffer());

			if (!data) {
				console.warn(`Font file ${file.data} not found`);
				return null;
			}

			return {
				...file,
				data: Buffer.from(data),
			};
		});

	const ret = await Promise.all(_fonts).then((fonts) => fonts.filter((font) => font !== null));

	if (ret.length === 0) return undefined;

	return ret;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const { height = 600, width = 1200, html } = (await request.json()) as ImageRequest;
		console.log('🚀 ~ fetch ~ html:', html);

		if (!html) {
			return new Response('Missing html', { status: 400 });
		}

		const element = toReactNode(html);

		try {
			const image = new ImageResponse(element, {
				width,
				height,
				fonts: await prepare_fonts(env, html),
			});

			return image;
		} catch (error) {
			console.log('🚀 ~ fetch ~ error:', error);
			return new Response(`${error}`, { status: 500 });
		}
	},
};
