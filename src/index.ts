/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	BUCKET: R2Bucket;
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

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { height = 600, width = 1200, html } = (await request.json()) as ImageRequest;

		if (!html) {
			return new Response('Missing html', { status: 400 });
		}

		const element = toReactNode(html);

		const NotoSerifRegular = await env.BUCKET.get('NotoSerif-Regular.ttf').then((res) => res?.arrayBuffer());
		const NotoSerifBold = await env.BUCKET.get('NotoSerif-Bold.ttf').then((res) => res?.arrayBuffer());

		// const NotoSerifRegular = await fetch('https://typewriter.baltia.de/NotoSerif/NotoSerif-Regular.ttf').then((res) => res.arrayBuffer());
		// const NotoSerifBold = await fetch('https://typewriter.baltia.de/NotoSerif/NotoSerif-Bold.ttf').then((res) => res.arrayBuffer());

		if (!NotoSerifRegular || !NotoSerifBold) {
			return new Response('Missing font', { status: 500 });
		}

		try {
			const image = new ImageResponse(element, {
				width,
				height,
				fonts: [
					{
						name: 'Noto Sans',
						data: Buffer.from(NotoSerifRegular),
						style: 'normal',
						weight: 400,
					},
					{
						name: 'Noto Sans',
						data: Buffer.from(NotoSerifBold),
						style: 'normal',
						weight: 700,
					},
				],
				// debug: true,
			});

			return image;
		} catch (error) {
			console.log('🚀 ~ fetch ~ error:', error);
			return new Response(error?.message ?? 'fuck', { status: 500 });
		}
	},
};
